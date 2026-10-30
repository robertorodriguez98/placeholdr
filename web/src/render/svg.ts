// Primitivas de dibujo en SVG.
// Unidades: milímetros, eje Y hacia abajo y origen en la esquina superior izquierda de la
// carta (el CLI usaba puntos con el eje Y hacia arriba). Los tamaños de letra siguen en pt.
import { jsPDF } from "jspdf";
import { CARD_H, CARD_W, RARITY_ABBR, type RGB } from "../config";

export const PT = 25.4 / 72; // mm por punto
export const FONT = "helvetica, arial, sans-serif"; // svg2pdf la mapea a la Helvetica del PDF
// Texto japonés: M PLUS 1p (registrada en jsPDF con este nombre en pdf.ts y como @font-face en
// style.css para la vista previa). Solo se usa en los textos que llevan kana o kanji.
export const CJK_FAMILY = "MPLUS1p";
const CJK = /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/;
export const hasCjk = (s: string) => CJK.test(s);

export interface RenderOpts {
  bw: boolean; // optimizado para blanco y negro
  lang: string;
  frame: boolean; // marco negro; sin él, la carta llega hasta la línea de corte
  style: CardStyle; // diseño de las cartas
}

/** "classic": marco negro y pastillas; "retro": cada carta es una ventana de Windows 98. */
export type CardStyle = "classic" | "retro";

// Las anchuras se miden con las métricas de Helvetica-Bold de jsPDF, las mismas que usará
// el PDF, para que la vista previa encaje igual que lo impreso.
const metrics = new jsPDF({ unit: "pt" });
metrics.setFont("helvetica", "bold");

/**
 * Anchura en mm de un texto en Helvetica-Bold a `sizePt` puntos. Los kana y kanji de M PLUS 1p
 * miden un cuadratín; el resto se mide con Helvetica (en M PLUS 1p es parecido).
 */
export function textWidth(text: string, sizePt: number): number {
  let em = 0, latin = "";
  for (const ch of text) {
    if (CJK.test(ch)) em += 1;
    else latin += ch;
  }
  const w = latin ? metrics.getStringUnitWidth(latin) : 0;
  return ((Number.isFinite(w) ? w : latin.length * 0.6) + em) * sizePt * PT;
}

export function fitFont(text: string, maxPt: number, maxWidth: number, minPt = 5.5): number {
  let size = maxPt;
  while (size > minPt && textWidth(text, size) > maxWidth) size -= 0.25;
  return size;
}

export const css = (c: RGB) =>
  `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(",")})`;

/** Aclara un color hacia blanco (t=0 color, t=1 blanco). */
export const mix = (c: RGB, t: number): RGB => c.map((v) => v + (1 - v) * t) as RGB;

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const f = (n: number) => +n.toFixed(3); // números cortos en el SVG

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [1, 1, 1];
const isBlack = (c: RGB) => c.every((v) => v === 0);

export function text(
  x: number, y: number, str: string, sizePt: number, fill: RGB,
  anchor: "start" | "middle" | "end" = "start",
): string {
  const family = hasCjk(str) ? `${CJK_FAMILY}, ${FONT}` : FONT;
  return `<text x="${f(x)}" y="${f(y)}" font-family="${family}" font-weight="bold" `
    + `font-size="${f(sizePt * PT)}" fill="${css(fill)}" text-anchor="${anchor}">${esc(str)}</text>`;
}

export interface PillPos { cx?: number; left?: number; right?: number; cy: number }

/**
 * Pastilla redondeada con texto. En B/N, cualquier pastilla que no sea negra pasa a contorno.
 * En el estilo retro es una etiqueta recta con bisel, como un botón de Windows 98.
 */
export function pill(
  label: string, sizePt: number, pos: PillPos, o: RenderOpts,
  { bg = BLACK, fg = WHITE, h = 5.5, pad = 2.4 }: { bg?: RGB; fg?: RGB; h?: number; pad?: number } = {},
): { svg: string; x: number; w: number } {
  const w = textWidth(label, sizePt) + 2 * pad;
  const x = pos.left ?? (pos.right !== undefined ? pos.right - w : pos.cx! - w / 2);
  const y = pos.cy - h / 2;
  const retro = o.style === "retro";
  const r = retro ? 0 : h / 2.6;
  let svg: string;
  if (o.bw && (retro || !isBlack(bg))) {
    svg = (retro ? `<rect x="${f(x + 0.45)}" y="${f(y + 0.45)}" width="${f(w)}" height="${f(h)}" fill="#000"/>` : "")
      + `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" `
      + `fill="#fff" stroke="#000" stroke-width="${f(0.9 * PT)}"/>`;
    fg = BLACK;
  } else {
    svg = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${css(bg)}"/>`;
    if (retro) { // luz arriba a la izquierda y sombra abajo a la derecha
      const s = 0.3, x1 = x + w - s / 2, y1 = y + h - s / 2;
      svg += `<path d="M${f(x + s / 2)} ${f(y1)}V${f(y + s / 2)}H${f(x1)}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="${f(s)}"/>`
        + `<path d="M${f(x1)} ${f(y + s / 2)}V${f(y1)}H${f(x + s / 2)}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="${f(s)}"/>`;
    }
  }
  svg += text(x + w / 2, pos.cy + sizePt * 0.35 * PT, label, sizePt, fg, "middle");
  return { svg, x, w };
}

/** Marco negro grueso de la carta. */
export function cardFrame(border: number, o: RenderOpts, bg: RGB = [0.975, 0.98, 0.99], fill = true): string {
  if (!o.frame) { // sin marco: solo el fondo, a sangre hasta el borde de la carta
    return fill ? `<rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" fill="${css(o.bw ? WHITE : bg)}"/>` : "";
  }
  return `<rect x="${f(border / 2)}" y="${f(border / 2)}" width="${f(CARD_W - border)}" `
    + `height="${f(CARD_H - border)}" fill="${fill ? css(o.bw ? WHITE : bg) : "none"}" `
    + `stroke="#000" stroke-width="${f(border)}"/>`;
}

/** Nombre centrado y subrayado; `ty` es la línea base. */
export function title(cx: number, ty: number, label: string, maxW: number, size = 11): string {
  const fs = fitFont(label, size, maxW);
  const uw = Math.min(textWidth(label, fs) + 8, maxW + 4);
  return text(cx, ty, label, fs, [0.1, 0.1, 0.1], "middle")
    + `<line x1="${f(cx - uw / 2)}" y1="${f(ty + 2.2)}" x2="${f(cx + uw / 2)}" y2="${f(ty + 2.2)}" `
    + `stroke="#000" stroke-width="${f(1.4 * PT)}"/>`;
}

export function star(cx: number, cy: number, r: number, points = 5, inner = 0.45, fill = "#000"): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = Math.PI / 2 + (i * Math.PI) / points;
    pts.push(`${f(cx + rad * Math.cos(a))},${f(cy - rad * Math.sin(a))}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
}

export const circle = (cx: number, cy: number, r: number, fill: string, extra = "") =>
  `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" ${extra}/>`;

const GOLD: RGB = [0.78, 0.62, 0.15];

/** Símbolo de rareza a la derecha del número: ● ◆ ★ o abreviatura dorada. */
export function rarityMark(rarity: string | undefined, x: number, cy: number, o: RenderOpts): string {
  if (!rarity) return "";
  const s = 1.5;
  if (rarity === "Common") return circle(x + s, cy, s, "#000");
  if (rarity === "Uncommon") {
    return `<polygon points="${f(x + s)},${f(cy - s * 1.2)} ${f(x + 2 * s)},${f(cy)} `
      + `${f(x + s)},${f(cy + s * 1.2)} ${f(x)},${f(cy)}" fill="#000"/>`;
  }
  if (rarity === "Rare") return star(x + s * 1.2, cy, s * 1.4);
  const abbr = RARITY_ABBR[rarity] ?? rarity.split(/\s+/).map((w) => w[0]).join("");
  return pill(abbr, 6, { left: x, cy }, o, { bg: GOLD, h: 4.2, pad: 1.6 }).svg;
}

/** Número de colección (pastilla negra) con la rareza y, en el master set, la variante. */
export function footer(number: string, rarity: string | undefined, variant: string | undefined, o: RenderOpts): string {
  const cx = CARD_W / 2, cy = CARD_H - 10;
  const num = pill(number, 9, { cx, cy }, o);
  let svg = num.svg + rarityMark(rarity, num.x + num.w + 1.8, cy, o);
  if (variant) {
    svg += pill(variant, 6, { cx, cy: cy - 6.2 }, o, { bg: [0.55, 0.58, 0.64], h: 4.2, pad: 1.8 }).svg;
  }
  return svg;
}

export const GOLD_BADGE = GOLD;
export { f as num };
