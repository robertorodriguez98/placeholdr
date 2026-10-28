// Imágenes de las cartas: se resuelven en segundo plano (como mucho 6 a la vez) y se
// reutilizan entre vistas previas. Cada imagen se identifica por una clave estable
// ("art:25:bw", "item:poke-ball:color"...).
import type { Asset } from "../render/cards";
import { artwork, itemArt, itemPixel } from "../data/sources";
import { bustEntry, findBust } from "./busts";
import { cropBust, loadBitmap, toBW, toCanvas, toObjectUrl, trimAndFit } from "./images";

interface Stored { asset: Asset; blob?: Blob }

const done = new Map<string, Stored>();
const running = new Map<string, Promise<Stored>>();

// cola con concurrencia limitada
const LIMIT = 6;
let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= LIMIT) await new Promise<void>((ok) => waiting.push(ok));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/** Estado actual de una imagen, sin esperar. */
export const peek = (key: string): Asset => done.get(key)?.asset ?? { type: "pending" };

const blobs = new Map<string, Blob>(); // URL de objeto -> PNG, para incrustarlo en el PDF

export function blobOf(asset: Asset): Blob | undefined {
  return "href" in asset ? blobs.get(asset.href) : undefined;
}

/** Resuelve (una sola vez) la imagen de `key`. */
export function resolve(key: string, load: () => Promise<Stored>): Promise<Stored> {
  const hit = done.get(key);
  if (hit) return Promise.resolve(hit);
  let p = running.get(key);
  if (!p) {
    p = slot(load).catch((e) => {
      console.warn(`Sin imagen para ${key}`, e);
      return { asset: { type: "vector" } } as Stored;
    }).then((s) => {
      done.set(key, s);
      running.delete(key);
      return s;
    });
    running.set(key, p);
  }
  return p;
}

async function stored(c: HTMLCanvasElement, type: "art" | "item" | "bust", bw: boolean): Promise<Stored> {
  const { url, blob } = await toObjectUrl(bw ? toBW(c) : c);
  blobs.set(url, blob);
  return { asset: { type, href: url }, blob };
}

const mode = (bw: boolean) => (bw ? "bw" : "color");

/** Artwork oficial de un Pokémon (480 px: 40 mm a ~300 ppp). */
export function artJob(dex: number, bw: boolean) {
  return {
    key: `art:${dex}:${mode(bw)}`,
    load: async () => stored(toCanvas(await loadBitmap(artwork(dex)), 480), "art", bw),
  };
}

/** Objeto de los juegos: ilustración dream-world si existe; si no, pixel art sin suavizar. */
export function itemJob(slug: string, bw: boolean) {
  return {
    key: `item:${slug}:${mode(bw)}`,
    load: async (): Promise<Stored> => {
      for (const [url, pixel] of [[itemArt(slug), false], [itemPixel(slug), true]] as const) {
        try {
          const bmp = await loadBitmap(url);
          return stored(trimAndFit(toCanvas(bmp), 360, pixel), "item", bw);
        } catch { /* se prueba la siguiente fuente */ }
      }
      console.warn(`Objeto '${slug}' sin imagen: se usa el icono vectorial`);
      return { asset: { type: "vector" } };
    },
  };
}

/** Busto del Partidario; si no hay ilustración, el icono de objeto `fallback`. */
export function bustJob(nameEn: string, name: string, slug: string, fallback: string, bw: boolean) {
  const adj = bustEntry(nameEn, name);
  return {
    key: `bust:${slug}:${mode(bw)}:${adj.dx ?? 0}:${adj.dy ?? 0}:${adj.zoom ?? 1}`,
    load: async (): Promise<Stored> => {
      try {
        const found = await findBust(nameEn, name);
        if (found) {
          const [url, pixel, origin] = found;
          const src = toCanvas(await loadBitmap(url), 1600, pixel);
          console.info(`Busto de ${name}: ${origin}`);
          return stored(cropBust(src, pixel, adj), "bust", bw);
        }
      } catch (e) {
        console.info(`Sin ilustración para ${name}`, e);
      }
      // directamente, sin pasar por la cola: este trabajo ya ocupa un hueco de ella
      return itemJob(fallback, bw).load();
    },
  };
}
