// Bustos de Partidarios (TrainerBusts del CLI): WikiDex y, si no, sprites de Showdown.
// bustos.json (raíz del repo, compartido con el CLI) fuerza la página/URL y ajusta el encuadre.
import bustMap from "../../../bustos.json";
import { fetchJson } from "../data/fetch";
import { WIKIDEX_API, showdownTrainer } from "../data/sources";
import type { BustAdjust } from "./images";

export interface BustEntry extends BustAdjust { page?: string; url?: string }

const OVER = new Map<string, BustEntry>(
  Object.entries(bustMap as Record<string, string | BustEntry>).map(([k, v]) => [
    k.toLowerCase(),
    typeof v === "string" ? (v.startsWith("http") ? { url: v } : { page: v }) : v,
  ]),
);

/** "Gladion's Final Battle" -> "gladion"; "Misty's Vitality" -> "misty"; "Gwynn" -> "gwynn". */
export const trainerSlug = (nameEn: string) =>
  nameEn.split(/['’]s\b/)[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Personaje en inglés y en español: "Combate Final de Gladio" -> "Gladio". */
export function personNames(nameEn: string, name: string): [string, string] {
  const parts = nameEn.split(/['’]s\b/);
  const en = parts[0].trim();
  const es = parts.length > 1 && name.includes(" de ") ? name.slice(name.lastIndexOf(" de ") + 4).trim() : name.trim();
  return [en, es];
}

export function bustEntry(nameEn: string, name: string): BustEntry {
  const [en, es] = personNames(nameEn, name);
  for (const k of [nameEn, name, en, es]) {
    const e = OVER.get(k.toLowerCase());
    if (e) return e;
  }
  return {};
}

interface Page { title: string; missing?: string; original?: { source: string }; thumbnail?: { source: string } }
interface Query<T> { query?: { pages?: Record<string, T> } }

const api = (params: Record<string, string>) =>
  `${WIKIDEX_API}?${new URLSearchParams({ action: "query", format: "json", origin: "*", ...params })}`;

/** URL de la imagen principal de una página de WikiDex (o null). */
async function wikidexImage(title: string): Promise<string | null> {
  const r = await fetchJson<Query<Page>>(api({
    titles: title, redirects: "1", prop: "pageimages", piprop: "original|thumbnail", pithumbsize: "1200",
  }));
  for (const pg of Object.values(r.query?.pages ?? {})) {
    if ("missing" in pg) return null;
    const src = (pg.original ?? pg.thumbnail)?.source;
    if (src) return src;
    // sin PageImages: primera imagen de la página cuyo nombre contenga el título
    const imgs = await fetchJson<Query<{ images?: { title: string }[] }>>(
      api({ titles: pg.title, prop: "images", imlimit: "100" }));
    const key = pg.title.split(" (")[0].toLowerCase();
    const file = Object.values(imgs.query?.pages ?? {}).flatMap((p) => p.images ?? [])
      .map((i) => i.title).find((t) => t.toLowerCase().includes(key) && /\.(png|webp)$/i.test(t));
    if (!file) return null;
    const info = await fetchJson<Query<{ imageinfo?: { url: string }[] }>>(
      api({ titles: file, prop: "imageinfo", iiprop: "url" }));
    return Object.values(info.query?.pages ?? {})[0]?.imageinfo?.[0]?.url ?? null;
  }
  return null;
}

/** Dónde buscar la ilustración del personaje: [url, es pixel art, origen]. */
export async function findBust(nameEn: string, name: string): Promise<[string, boolean, string] | null> {
  const entry = bustEntry(nameEn, name);
  if (entry.url) return [entry.url, false, "URL manual"];
  const [, es] = personNames(nameEn, name);
  const title = entry.page ?? es; // WikiDex redirige también los nombres ingleses
  try {
    const url = await wikidexImage(title);
    if (url) return [url, false, `WikiDex: ${title}`];
  } catch (e) {
    console.warn(`WikiDex no disponible para '${title}'`, e);
  }
  return [showdownTrainer(trainerSlug(nameEn)), true, "Showdown"];
}
