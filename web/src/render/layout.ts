// Maquetación: 3×3 cartas centradas en la hoja con líneas de corte (draw_cutlines/render del CLI).
import { CARD_H, CARD_W, COLS, GAP, PAPER, ROWS, type Paper } from "../config";
import { PT, num as f, type RenderOpts } from "./svg";

export const PER_PAGE = COLS * ROWS;

export interface PageGeometry {
  pw: number; ph: number; // tamaño de la hoja (mm)
  ox: number; oy: number; // esquina superior izquierda de la cuadrícula
  gw: number; gh: number;
}

export function geometry(paper: Paper): PageGeometry {
  const [pw, ph] = PAPER[paper];
  const gw = COLS * CARD_W + (COLS - 1) * GAP;
  const gh = ROWS * CARD_H + (ROWS - 1) * GAP;
  return { pw, ph, gw, gh, ox: (pw - gw) / 2, oy: (ph - gh) / 2 };
}

/** Posición (mm) de la carta k (0..8) dentro de la página. */
export function slot(g: PageGeometry, k: number): [number, number] {
  const col = k % COLS, row = Math.floor(k / COLS);
  return [g.ox + col * (CARD_W + GAP), g.oy + row * (CARD_H + GAP)];
}

export function cutlines(g: PageGeometry, o: RenderOpts): string {
  let d = "";
  for (let i = 1; i < COLS; i++) {
    const x = g.ox + i * (CARD_W + GAP) - GAP / 2;
    d += `M${f(x)} ${f(g.oy - 3)}V${f(g.oy + g.gh + 3)}`;
  }
  for (let j = 1; j < ROWS; j++) {
    const y = g.oy + j * (CARD_H + GAP) - GAP / 2;
    d += `M${f(g.ox - 3)} ${f(y)}H${f(g.ox + g.gw + 3)}`;
  }
  const col = o.bw ? "rgb(140,140,140)" : "rgb(115,115,204)";
  return `<path d="${d}" stroke="${col}" stroke-width="${f(0.4 * PT)}" `
    + `stroke-dasharray="${f(3 * PT)} ${f(2 * PT)}" fill="none"/>`;
}

/** Bolsillos del binder: solo en la vista previa, para ver los huecos que quedan libres. */
export function pockets(g: PageGeometry): string {
  let svg = "";
  for (let k = 0; k < PER_PAGE; k++) {
    const [x, y] = slot(g, k);
    svg += `<rect class="pocket" x="${f(x - 0.6)}" y="${f(y - 0.6)}" width="${f(CARD_W + 1.2)}" `
      + `height="${f(CARD_H + 1.2)}" rx="2.5"/>`;
  }
  return svg;
}
