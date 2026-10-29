// Descargas con caché persistente en el navegador (Cache Storage).
// Equivale a .pokecache/ del CLI: lo descargado una vez se reutiliza entre sesiones.

const CACHE = "placeholdr-v1";

async function cached(url: string, refresh = false): Promise<Response> {
  const store = "caches" in self ? await caches.open(CACHE) : null;
  if (store && !refresh) {
    const hit = await store.match(url);
    if (hit) return hit;
  }
  const r = await fetch(url);
  if (!r.ok) throw new HttpError(url, r.status);
  if (store) await store.put(url, r.clone());
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

/** Borra toda la caché (equivale a borrar .pokecache/). */
export async function clearCache(): Promise<void> {
  if ("caches" in self) await caches.delete(CACHE);
}
