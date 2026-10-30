// Maquetación: 3×3 cartas centradas en la hoja, pegadas unas a otras. Sin hueco, cada corte
// separa dos cartas a la vez: 8 cortes por hoja (4 + 4) en vez de los 12 que hacían falta con
// el hueco de 2 mm del CLI, y no quedan tiras sueltas.
import { CARD_H, CARD_W, COLS, PAPER, ROWS, type Paper } from "../config";
import { PT, num as f, type RenderOpts } from "./svg";

export const PER_PAGE = COLS * ROWS;

export interface PageGeometry {
  pw: number; ph: number; // tamaño de la hoja (mm)
  ox: number; oy: number; // esquina superior izquierda de la cuadrícula
  gw: number; gh: number;
}

export function geometry(paper: Paper): PageGeometry {
  const [pw, ph] = PAPER[paper];
  const gw = COLS * CARD_W, gh = ROWS * CARD_H;
  return { pw, ph, gw, gh, ox: (pw - gw) / 2, oy: (ph - gh) / 2 };
}

/** Posición (mm) de la carta k (0..8) dentro de la página. */
export function slot(g: PageGeometry, k: number): [number, number] {
  const col = k % COLS, row = Math.floor(k / COLS);
  return [g.ox + col * CARD_W, g.oy + row * CARD_H];
}

/** Recorre las líneas de la cuadrícula: `inner` solo las juntas entre cartas, si no también el contorno. */
function gridPath(g: PageGeometry, inner: boolean): string {
  const a = inner ? 1 : 0;
  let d = "";
  for (let i = a; i <= COLS - a; i++) d += `M${f(g.ox + i * CARD_W)} ${f(g.oy)}V${f(g.oy + g.gh)}`;
  for (let j = a; j <= ROWS - a; j++) d += `M${f(g.ox)} ${f(g.oy + j * CARD_H)}H${f(g.ox + g.gw)}`;
  return d;
}

/**
 * Guías de corte, dibujadas encima de las cartas. Siempre hay marcas en el margen en la
 * prolongación de cada corte (como las de imprenta), para alinear la regla o la guillotina.
 *   - Con marco: los bordes de dos cartas forman una banda negra; una línea blanca fina en
 *     su centro marca el corte exacto, y la banda da margen de error.
 *   - Sin marco: una línea discontinua gris oscura por el borde de cada carta.
 */
export function cutlines(g: PageGeometry, o: RenderOpts): string {
  const col = o.bw ? "rgb(140,140,140)" : "rgb(115,115,204)";
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
  const marks = `<path d="${d}" stroke="${col}" stroke-width="${f(0.5 * PT)}" fill="none"/>`;
  if (o.frame) return marks + `<path d="${gridPath(g, true)}" stroke="#fff" stroke-width="${f(0.6 * PT)}" fill="none"/>`;
  // En el estilo retro, el borde de cada ventana (negro en B/N) y el de la de al lado forman una
  // banda oscura que tapaba la discontinua: debajo va una línea blanca para que se vean los huecos.
  const under = o.style === "retro"
    ? `<path d="${gridPath(g, false)}" stroke="#fff" stroke-width="${f(0.6 * PT)}" fill="none"/>` : "";
  return marks + under + `<path d="${gridPath(g, false)}" stroke="rgb(70,70,70)" stroke-width="${f(0.6 * PT)}" `
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
