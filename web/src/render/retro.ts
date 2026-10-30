// Estilo de carta "retro": cada carta es una ventana de Windows 98. Barra de título con el
// nombre (degradado del color del tipo o del subtipo) y los botones _ □ ×, una fila con las
// etiquetas, la imagen dentro de un marco hundido y una barra de estado con el número, la
// rareza y la variante. Usa las mismas imágenes y datos que el estilo clásico (cards.ts).
// En blanco y negro imita los sistemas de 1 bit (el Mac original): barra de título rayada con el
// nombre en un hueco blanco, casilla de cerrar a la izquierda y de zoom a la derecha, bordes
// dobles y etiquetas con sombra negra dura. Todo son líneas, así que gasta poca tinta.
import { BW_INK, CARD_H, CARD_W, TYPE_COLORS, type RGB } from "../config";
import {
  BORDER, CX, energyOrb, energyType, image, itemIcon, trainerStyle, type Asset, type CardSpec, type PokemonSpec,
} from "./cards";
import { pixelIcon } from "./pixels";
import {
  GOLD_BADGE, PT, circle, css, fitFont, mix, num as f, pill, rarityMark, star, text, textWidth, type RenderOpts,
} from "./svg";

const FACE: RGB = [0.83, 0.82, 0.78]; // gris de las ventanas (#d4d0c8)
const WHITE: RGB = [1, 1, 1];

/** Bisel de Windows: hacia fuera (botones, ventanas) o hacia dentro (campos, marcos). */
export function bevel(x: number, y: number, w: number, h: number, raised: boolean, o: RenderOpts, s = 0.3): string {
  if (o.bw) {
    const line = (i: number, sw: number) =>
      `<rect x="${f(x + i)}" y="${f(y + i)}" width="${f(w - 2 * i)}" height="${f(h - 2 * i)}" fill="none" stroke="#000" stroke-width="${f(sw)}"/>`;
    return raised ? line(s / 2, s) : line(s / 2, s * 0.8) + line(s * 2.2, s * 0.35);
  }
  const [lt, rb, lt2, rb2] = raised ? ["#fff", "#404040", "#dfdfdf", "#808080"] : ["#808080", "#fff", "#404040", "#dfdfdf"];
  const edge = (i: number, a: string, b: string) => {
    const x0 = x + i, y0 = y + i, x1 = x + w - i, y1 = y + h - i;
    return `<path d="M${f(x0)} ${f(y1)}V${f(y0)}H${f(x1)}" fill="none" stroke="${a}" stroke-width="${f(s)}"/>`
      + `<path d="M${f(x1)} ${f(y0)}V${f(y1)}H${f(x0)}" fill="none" stroke="${b}" stroke-width="${f(s)}"/>`;
  };
  return edge(s / 2, lt, rb) + edge(s * 1.5, lt2, rb2);
}

export const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${extra}/>`;

/** Botones _ □ × de la barra de título, alineados a la derecha. Devuelve su anchura total. */
function titleButtons(right: number, cy: number, o: RenderOpts): { svg: string; w: number } {
  const bw = 3.5, bh = 3.1, gap = 0.35;
  let svg = "";
  for (let k = 0; k < 3; k++) {
    // el botón de cerrar va algo separado de los otros dos, como en Windows
    const x = right - (3 - k) * bw - (2 - k) * gap - (k < 2 ? gap : 0), y = cy - bh / 2;
    svg += rect(x, y, bw, bh, css(o.bw ? WHITE : FACE)) + bevel(x, y, bw, bh, true, o, 0.22);
    const mx = x + bw / 2, my = cy, line = `stroke="#000" stroke-width="${f(0.32)}" fill="none"`;
    if (k === 0) svg += `<path d="M${f(mx - 0.8)} ${f(my + 0.7)}H${f(mx + 0.8)}" ${line}/>`;
    else if (k === 1) svg += `<rect x="${f(mx - 0.8)}" y="${f(my - 0.7)}" width="1.6" height="1.4" ${line}/>`;
    else svg += `<path d="M${f(mx - 0.75)} ${f(my - 0.75)}L${f(mx + 0.75)} ${f(my + 0.75)}M${f(mx + 0.75)} ${f(my - 0.75)}L${f(mx - 0.75)} ${f(my + 0.75)}" ${line}/>`;
  }
  return { svg, w: 3 * bw + 3 * gap };
}

interface Look { col: RGB; title: string; labels: (y: number, left: number, right: number) => string; tint: RGB | null }

function look(spec: CardSpec, o: RenderOpts): Look {
  const es = o.lang === "es";
  if (spec.type === "pokemon") {
    return {
      col: o.bw ? BW_INK : spec.topLeftColor, title: spec.name, tint: null,
      labels: (cy, l, r) => pill(spec.topLeft, 6, { left: l, cy }, o, { bg: spec.topLeftColor }).svg
        + (spec.badge ? pill(spec.badge, 6, { right: r, cy }, o, { bg: GOLD_BADGE }).svg : ""),
    };
  }
  if (spec.type === "trainer") {
    const st = trainerStyle(spec.subtypes);
    const col = o.bw ? BW_INK : st.color;
    return {
      col, title: spec.name, tint: mix(col, 0.9),
      labels: (cy, l, r) => text(l, cy + 6 * 0.35 * PT, es ? "ENTRENADOR" : "TRAINER", 6, [0.15, 0.15, 0.15])
        + pill(es ? st.es : st.en, 6, { right: r, cy }, o, { bg: col }).svg
        + (spec.subtypes.includes("ACE SPEC") ? pill("ACE SPEC", 5.5, { cx: CX, cy }, o, { bg: [0.85, 0.15, 0.4] }).svg : ""),
    };
  }
  const special = spec.subtypes.includes("Special");
  const col = o.bw ? BW_INK : TYPE_COLORS[energyType(spec.nameEn)];
  const label = es ? (special ? "ENERGÍA ESPECIAL" : "ENERGÍA BÁSICA") : (special ? "SPECIAL ENERGY" : "BASIC ENERGY");
  return { col, title: spec.name, tint: mix(col, 0.9), labels: (cy, l) => pill(label, 6, { left: l, cy }, o, { bg: col }).svg };
}

/**
 * Barra de título de 1 bit: rayas horizontales, casilla de cerrar a la izquierda, de zoom a la
 * derecha y el nombre centrado en un hueco blanco.
 */
function monoTitleBar(x: number, y: number, w: number, h: number, title: string): string {
  const box = 3.6, pad = 1.4, line = `stroke="#000" stroke-width="0.25"`;
  let svg = rect(x, y, w, h, "#fff", `stroke="#000" stroke-width="0.35"`);
  for (let yy = y + 1.1; yy < y + h - 0.8; yy += 0.75) {
    svg += `<path d="M${f(x + 0.9)} ${f(yy)}H${f(x + w - 0.9)}" ${line}/>`;
  }
  const cy = y + h / 2;
  const square = (bx: number) => rect(bx - 0.6, cy - box / 2 - 0.4, box + 1.2, box + 0.8, "#fff")
    + rect(bx, cy - box / 2, box, box, "#fff", `stroke="#000" stroke-width="0.3"`);
  svg += square(x + 2.2); // cerrar
  const zx = x + w - 2.2 - box;
  svg += square(zx) + rect(zx, cy - box / 2, box * 0.55, box * 0.55, "none", line); // zoom
  const fs = fitFont(title, 9, w - 2 * (box + 4.2), 5);
  const tw = textWidth(title, fs) + 2 * pad;
  svg += rect(x + w / 2 - tw / 2, y + 0.5, tw, h - 1, "#fff");
  return svg + text(x + w / 2, cy + fs * 0.35 * PT, title, fs, [0, 0, 0], "middle");
}

/**
 * Pokémon sin imagen: el recuadro de "imagen no cargada" de los navegadores antiguos, con su
 * icono roto en la esquina y el texto alternativo (número de la Pokédex y nombre del fichero).
 */
function brokenImage(spec: PokemonSpec, cy: number, o: RenderOpts): string {
  const side = 34, x = CX - side / 2, y = cy - side / 2;
  const num = spec.dex ? String(spec.dex).padStart(4, "0") : null;
  return rect(x, y, side, side, "#fff") + bevel(x, y, side, side, false, o, 0.25)
    + pixelIcon("broken", x + 4.5, y + 4.5, 5.5, [0, 0, 0], o.bw)
    + text(CX, cy + 1.8, num ? `#${num}` : "?", num ? 12 : 18, [0.2, 0.2, 0.2], "middle")
    + (num ? text(CX, cy + 7.5, `${num}.gif`, 6, [0.5, 0.5, 0.5], "middle") : "");
}

export function drawRetro(spec: CardSpec, asset: Asset, o: RenderOpts, id: string): string {
  const L = look(spec, o);
  const m = o.frame ? BORDER : 0; // con marco negro, la ventana va dentro
  const W = CARD_W - 2 * m, H = CARD_H - 2 * m;
  let svg = "";
  if (o.frame) svg += rect(0, 0, CARD_W, CARD_H, "#000");
  svg += rect(m, m, W, H, css(o.bw ? WHITE : FACE)) + bevel(m, m, W, H, true, o, 0.35);

  // barra de título
  const tx = m + 1.1, ty = m + 1.1, tw = W - 2.2, th = 7.2;
  if (o.bw) {
    svg += monoTitleBar(tx, ty, tw, th, L.title);
  } else {
    svg += `<defs><linearGradient id="tb-${id}" x1="0" y1="0" x2="1" y2="0">`
      + `<stop offset="0" stop-color="${css(L.col.map((v) => v * 0.8) as RGB)}"/>`
      + `<stop offset="1" stop-color="${css(mix(L.col, 0.45))}"/></linearGradient></defs>`
      + rect(tx, ty, tw, th, `url(#tb-${id})`);
  }
  if (!o.bw) {
    const btn = titleButtons(tx + tw - 0.8, ty + th / 2, o);
    const fs = fitFont(L.title, 9, tw - btn.w - 3.4, 5);
    svg += btn.svg + text(tx + 1.6, ty + th / 2 + fs * 0.35 * PT, L.title, fs, WHITE);
  }

  // fila de etiquetas (tipo, subtipo, ex...)
  svg += L.labels(ty + th + 3.4, tx + 0.8, tx + tw - 0.8);

  // marco hundido con la imagen
  const vx = m + 2.4, vy = ty + th + 6.6, vw = W - 4.8, vh = CARD_H - m - 10.8 - vy;
  const cy = vy + vh / 2;
  svg += rect(vx, vy, vw, vh, css(o.bw || !L.tint ? WHITE : L.tint)) + bevel(vx, vy, vw, vh, false, o, 0.35);
  if (spec.type === "pokemon") {
    const box = Math.min(vw, vh) - 8;
    if (asset.type === "art") svg += image(asset.href, CX - box / 2, cy - box / 2, box, box);
    else if (asset.type === "pending") svg += circle(CX, cy, box * 0.38, "#eceef1");
    else svg += brokenImage(spec, cy, o);
  } else if (spec.type === "trainer") {
    if (asset.type === "bust") { // retrato grande: llena el marco, apoyado abajo
      const side = Math.min(vw, vh) - 0.8;
      svg += `<clipPath id="rv-${id}"><rect x="${f(vx + 0.6)}" y="${f(vy + 0.6)}" width="${f(vw - 1.2)}" height="${f(vh - 1.2)}"/></clipPath>`
        + image(asset.href, CX - side / 2, vy + vh - side - 0.4, side, side, `clip-path="url(#rv-${id})"`)
        + bevel(vx, vy, vw, vh, false, o, 0.35);
    } else if (asset.type === "item") svg += itemIcon(asset.href, cy, 17, L.col, o);
    else if (asset.type === "vector") svg += pixelIcon(trainerStyle(spec.subtypes).icon, CX, cy, 30, L.col, o.bw);
    else svg += circle(CX, cy, 17, css(mix(L.col, 0.82)));
  } else {
    const special = spec.subtypes.includes("Special");
    if (asset.type === "item") {
      svg += energyOrb(CX, cy, 17, L.col, special, false, o) + image(asset.href, CX - 12, cy - 12, 24, 24);
    } else { // sin imagen: gema en pixel art, con destellos si es especial
      svg += pixelIcon("gem", CX, cy, 28, L.col, o.bw);
      if (special) for (const [dx, dy] of [[-15, -10], [14, -13], [13, 12]]) svg += star(CX + dx, cy + dy, 2, 4, 0.3, "#c79e26");
    }
  }

  // barra de estado: número | rareza | variante
  const sy = CARD_H - m - 8.9, sh = 6.4, scy = sy + sh / 2;
  const f1 = 27, f2 = 12, sx = m + 1.4, gap = 0.8, f3 = W - 2.8 - f1 - f2 - 2 * gap;
  svg += bevel(sx, sy, f1, sh, false, o, 0.25)
    + text(sx + f1 / 2, scy + 8.5 * 0.35 * PT, spec.number, fitFont(spec.number, 8.5, f1 - 2), [0, 0, 0], "middle");
  const x2 = sx + f1 + gap;
  const symbol = ["Common", "Uncommon", "Rare"].includes(spec.rarity ?? ""); // ● ◆ ★ al centro
  svg += bevel(x2, sy, f2, sh, false, o, 0.25) + rarityMark(spec.rarity, symbol ? x2 + f2 / 2 - 1.6 : x2 + 1.2, scy, o);
  const x3 = x2 + f2 + gap;
  svg += bevel(x3, sy, f3, sh, false, o, 0.25);
  if (spec.variant) svg += text(x3 + f3 / 2, scy + 5.5 * 0.35 * PT, spec.variant, fitFont(spec.variant, 5.5, f3 - 1.5), [0.25, 0.25, 0.25], "middle");
  return svg;
}
