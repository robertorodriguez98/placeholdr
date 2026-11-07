// Descargas con caché persistente en el navegador (Cache Storage).
// Lo descargado una vez se reutiliza entre sesiones.

const CACHE = "placeholdr-v1";
// Cuándo se guardó cada respuesta (las cabeceras propias de las fuentes, como Date, no se pueden
// leer desde otro dominio por CORS).
const SAVED_AT = "x-placeholdr-saved";

/** Un día, en ms: lo que duran los listados que cambian cuando sale un set nuevo. */
export const DAY = 24 * 60 * 60 * 1000;

export interface FetchOpts {
  /** Descargar aunque esté en la caché. */
  refresh?: boolean;
  /**
   * Edad máxima (ms) de la copia guardada. Pasado ese tiempo se vuelve a descargar, y si la red
   * falla se usa la copia vieja. Sin ella, lo guardado no caduca (imágenes, CSV, fichas).
   */
  maxAge?: number;
}

// La caché es opcional: en algunas ventanas privadas, perfiles nuevos o navegadores con el
// almacenamiento bloqueado, caches.open() o put() fallan. Entonces se descarga sin guardar,
// en vez de dejar la web sin datos ("Could not load the sets").
let store: Promise<Cache | null> | null = null;
const openStore = () => (store ??= ("caches" in self ? caches.open(CACHE) : Promise.resolve(null)).catch(() => null));

async function cached(url: string, { refresh = false, maxAge }: FetchOpts = {}): Promise<Response> {
  const cache = await openStore();
  const hit = cache && !refresh ? await cache.match(url).catch(() => undefined) : undefined;
  if (hit) {
    // las copias de antes de guardar la fecha cuentan como viejas
    const age = Date.now() - Number(hit.headers.get(SAVED_AT) ?? 0);
    if (maxAge === undefined || age <= maxAge) return hit;
  }
  let r: Response;
  try {
    r = await fetch(url);
    if (!r.ok) throw new HttpError(url, r.status);
  } catch (e) {
    if (hit) return hit; // sin red o fuente caída: mejor la copia vieja que nada
    throw e;
  }
  if (!cache) return r;
  const headers = new Headers(r.headers);
  headers.set(SAVED_AT, String(Date.now()));
  const body = await r.blob();
  await cache.put(url, new Response(body, { status: r.status, headers }))
    .catch(() => { /* sin sitio o bloqueada: no pasa nada */ });
  return new Response(body, { status: r.status, headers });
}

export class HttpError extends Error {
  constructor(public url: string, public status: number) {
    super(`HTTP ${status}: ${url}`);
  }
}

export async function fetchJson<T>(url: string, opts?: FetchOpts): Promise<T> {
  return (await cached(url, opts)).json();
}

export async function fetchText(url: string, opts?: FetchOpts): Promise<string> {
  return (await cached(url, opts)).text();
}

export async function fetchBlob(url: string, opts?: FetchOpts): Promise<Blob> {
  return (await cached(url, opts)).blob();
}

/** Borra toda la caché. */
export async function clearCache(): Promise<void> {
  store = null;
  if ("caches" in self) await caches.delete(CACHE).catch(() => false);
}
