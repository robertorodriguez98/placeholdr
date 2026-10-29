// Maquetación: 3×3 cartas centradas en la hoja con líneas de corte (draw_cutlines/render del CLI).
// Dos disposiciones:
//   - juntas (por defecto): sin hueco entre cartas, así cada corte separa dos cartas a la vez
//     (8 cortes por hoja en vez de 12). Las guías son marcas de corte en el margen.
//   - separadas: 2 mm entre cartas, como el CLI, con una línea discontinua en cada hueco.
import { CARD_H, CARD_W, COLS, GAP, PAPER, ROWS, type Paper } from "../config";
import { PT, num as f, type RenderOpts } from "./svg";

export const PER_PAGE = COLS * ROWS;

export interface PageGeometry {
  pw: number; ph: number; // tamaño de la hoja (mm)
  ox: number; oy: number; // esquina superior izquierda de la cuadrícula
  gw: number; gh: number;
  gap: number;            // hueco entre cartas (0 = juntas)
}

export function geometry(paper: Paper, compact = true): PageGeometry {
  const [pw, ph] = PAPER[paper];
  const gap = compact ? 0 : GAP;
  const gw = COLS * CARD_W + (COLS - 1) * gap;
  const gh = ROWS * CARD_H + (ROWS - 1) * gap;
  return { pw, ph, gw, gh, gap, ox: (pw - gw) / 2, oy: (ph - gh) / 2 };
}

/** Posición (mm) de la carta k (0..8) dentro de la página. */
export function slot(g: PageGeometry, k: number): [number, number] {
  const col = k % COLS, row = Math.floor(k / COLS);
  return [g.ox + col * (CARD_W + g.gap), g.oy + row * (CARD_H + g.gap)];
}

export function cutlines(g: PageGeometry, o: RenderOpts): string {
  const col = o.bw ? "rgb(140,140,140)" : "rgb(115,115,204)";
  if (!g.gap) return cropMarks(g, col);
  const GAP = g.gap;
  let d = "";
  for (let i = 1; i < COLS; i++) {
    const x = g.ox + i * (CARD_W + GAP) - GAP / 2;
    d += `M${f(x)} ${f(g.oy - 3)}V${f(g.oy + g.gh + 3)}`;
  }
  for (let j = 1; j < ROWS; j++) {
    const y = g.oy + j * (CARD_H + GAP) - GAP / 2;
    d += `M${f(g.ox - 3)} ${f(y)}H${f(g.ox + g.gw + 3)}`;
  }
  return `<path d="${d}" stroke="${col}" stroke-width="${f(0.4 * PT)}" `
    + `stroke-dasharray="${f(3 * PT)} ${f(2 * PT)}" fill="none"/>`;
}

/**
 * Cartas juntas: cada corte va por la junta entre dos cartas. Se marcan sus extremos en el
 * margen (como las marcas de corte de imprenta) y una línea blanca fina en el centro de la
 * banda negra que forman los dos bordes. Con la cuchilla o la guillotina se alinea de marca
 * a marca siguiendo la línea blanca.
 */
function cropMarks(g: PageGeometry, col: string): string {
  const off = 1.5, len = 7; // separación respecto a la cuadrícula y largo de la marca (mm)
  let d = "";
  for (let i = 0; i <= COLS; i++) {
    const x = g.ox + i * CARD_W;
    d += `M${f(x)} ${f(g.oy - off - len)}V${f(g.oy - off)}`
      + `M${f(x)} ${f(g.oy + g.gh + off)}V${f(g.oy + g.gh + off + len)}`;
  }
  for (let j = 0; j <= ROWS; j++) {
    const y = g.oy + j * CARD_H;
    d += `M${f(g.ox - off - len)} ${f(y)}H${f(g.ox - off)}`
      + `M${f(g.ox + g.gw + off)} ${f(y)}H${f(g.ox + g.gw + off + len)}`;
  }
  // Entre dos cartas los bordes negros forman una banda; una línea blanca fina en su centro
  // marca el corte exacto. Va encima de las cartas (pageSvg dibuja las guías al final).
  let seam = "";
  for (let i = 1; i < COLS; i++) seam += `M${f(g.ox + i * CARD_W)} ${f(g.oy)}V${f(g.oy + g.gh)}`;
  for (let j = 1; j < ROWS; j++) seam += `M${f(g.ox)} ${f(g.oy + j * CARD_H)}H${f(g.ox + g.gw)}`;
  return `<path d="${d}" stroke="${col}" stroke-width="${f(0.5 * PT)}" fill="none"/>`
    + `<path d="${seam}" stroke="#fff" stroke-width="${f(0.6 * PT)}" fill="none"/>`;
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
