// Procesado de imágenes con <canvas>: el equivalente a lo que hacía Pillow en el CLI.
// Las imágenes se descargan como Blob (con CORS) para que el canvas no quede "contaminado"
// y se pueda leer y exportar al PDF.
import { BW_LIGHTEN, BUST_FRACTION } from "../config";
import { fetchBlob } from "../data/fetch";

export type Canvas = HTMLCanvasElement;

export async function loadBitmap(url: string): Promise<ImageBitmap> {
  return createImageBitmap(await fetchBlob(url));
}

function canvas(w: number, h: number): [Canvas, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d", { willReadFrequently: true })!];
}

/** Copia la imagen a un canvas, reduciéndola si su lado mayor supera `maxSide`. */
export function toCanvas(src: CanvasImageSource & { width: number; height: number }, maxSide = Infinity, pixel = false): Canvas {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height));
  const [c, ctx] = canvas(src.width * k, src.height * k);
  ctx.imageSmoothingEnabled = !pixel;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Caja que contiene los píxeles con alfa > umbral (Image.getbbox de Pillow). */
function alphaBox(c: Canvas, threshold = 0): [number, number, number, number] | null {
  const { data, width, height } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  let l = width, t = height, r = -1, b = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < t) t = y;
        if (y > b) b = y;
      }
    }
  }
  return r < 0 ? null : [l, t, r + 1, b + 1];
}

/** Recorta los bordes transparentes y escala para que el lado mayor mida `side` px. */
export function trimAndFit(src: Canvas, side: number, pixel: boolean): Canvas {
  const [l, t, r, b] = alphaBox(src) ?? [0, 0, src.width, src.height];
  const w = r - l, h = b - t, k = side / Math.max(w, h);
  const [c, ctx] = canvas(w * k, h * k);
  ctx.imageSmoothingEnabled = !pixel; // el pixel art se amplía sin suavizar (NEAREST)
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, l, t, w, h, 0, 0, c.width, c.height);
  return c;
}

/** Grises con contraste automático y aclarado, conservando el alfa (to_bw del CLI). */
export function toBW(c: Canvas): Canvas {
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Array<number>(256).fill(0);
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    // misma fórmula de luminancia que ImageOps.grayscale (ITU-R 601-2)
    const g = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    d[i] = g;
    if (d[i + 3] > 0) { hist[g]++; n++; } // el histograma ignora lo transparente
  }
  // autocontraste con un 1 % de recorte en cada extremo
  const cut = n * 0.01;
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && (acc += hist[lo]) <= cut) lo++;
  acc = 0;
  while (hi > 0 && (acc += hist[hi]) <= cut) hi--;
  const scale = hi > lo ? 255 / (hi - lo) : 1;
  for (let i = 0; i < d.length; i += 4) {
    let v = Math.min(255, Math.max(0, (d[i] - lo) * scale));
    v = v * (1 - BW_LIGHTEN) + 255 * BW_LIGHTEN;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface BustAdjust { dx?: number; dy?: number; zoom?: number }

/**
 * Recorte cuadrado de cabeza y hombros, centrado en la cabeza (crop_bust del CLI).
 * dx/dy desplazan el encuadre (fracción del lado) y zoom > 1 lo acerca.
 */
export function cropBust(src: Canvas, pixel: boolean, { dx = 0, dy = 0, zoom = 1 }: BustAdjust = {}): Canvas {
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  let opaque = true;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { opaque = false; break; }
  if (opaque) { // sin transparencia: quita el fondo claro uniforme
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i + 3] = g > 245 ? 0 : 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const [l, t, r, b] = alphaBox(src) ?? [0, 0, src.width, src.height];
  const h = b - t;
  const side = Math.max(8, Math.round((h * BUST_FRACTION) / zoom));
  // centro horizontal de la cabeza: media de píxeles opacos en la franja superior del 12 %
  const bandH = Math.max(1, Math.round(h * 0.12));
  let tot = 0, sum = 0;
  for (let y = t; y < t + bandH; y++) {
    for (let x = l; x < r; x++) {
      if (d[(y * src.width + x) * 4 + 3] > 128) { tot++; sum += x - l; }
    }
  }
  const headX = l + sum / (tot || 1);
  const pad = Math.round(side * 0.06);
  const x0 = Math.round(headX - side / 2 + dx * side);
  const y0 = Math.round(t - pad + dy * side);
  const target = 480;
  const [c, out] = canvas(target, target);
  out.imageSmoothingEnabled = !(pixel || side < 120);
  out.imageSmoothingQuality = "high";
  const k = target / side;
  out.drawImage(src, -x0 * k, -y0 * k, src.width * k, src.height * k);
  return c;
}

/** Canvas -> PNG -> URL de objeto para usar en <image href>. */
export async function toObjectUrl(c: Canvas): Promise<{ url: string; blob: Blob }> {
  const blob = await new Promise<Blob>((ok, ko) =>
    c.toBlob((b) => (b ? ok(b) : ko(new Error("toBlob"))), "image/png"));
  return { url: URL.createObjectURL(blob), blob };
}
