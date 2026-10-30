// Descargas con caché persistente en el navegador (Cache Storage).
// Lo descargado una vez se reutiliza entre sesiones.

const CACHE = "placeholdr-v1";

// La caché es opcional: en algunas ventanas privadas, perfiles nuevos o navegadores con el
// almacenamiento bloqueado, caches.open() o put() fallan. Entonces se descarga sin guardar,
// en vez de dejar la web sin datos ("Could not load the sets").
let store: Promise<Cache | null> | null = null;
const openStore = () => (store ??= ("caches" in self ? caches.open(CACHE) : Promise.resolve(null)).catch(() => null));

async function cached(url: string, refresh = false): Promise<Response> {
  const cache = await openStore();
  if (cache && !refresh) {
    const hit = await cache.match(url).catch(() => undefined);
    if (hit) return hit;
  }
  const r = await fetch(url);
  if (!r.ok) throw new HttpError(url, r.status);
  if (cache) await cache.put(url, r.clone()).catch(() => { /* sin sitio o bloqueada: no pasa nada */ });
  return r;
}

export class HttpError extends Error {
  constructor(public url: string, public status: number) {
    super(`HTTP ${status}: ${url}`);
  }
}

export async function fetchJson<T>(url: string, refresh = false): Promise<T> {
  return (await cached(url, refresh)).json();
}

export async function fetchText(url: string, refresh = false): Promise<string> {
  return (await cached(url, refresh)).text();
}

export async function fetchBlob(url: string, refresh = false): Promise<Blob> {
  return (await cached(url, refresh)).blob();
}

/** Borra toda la caché. */
export async function clearCache(): Promise<void> {
  store = null;
  if ("caches" in self) await caches.delete(CACHE).catch(() => false);
}
