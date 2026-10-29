// Una hoja completa en SVG. La vista previa y el PDF usan exactamente el mismo dibujo; la
// vista previa solo añade los bolsillos del binder (huecos libres) y el sello de las cartas
// que ya tienes.
import { CARD_H, CARD_W } from "../config";
import { BORDER, drawCard, type Asset, type CardSpec } from "./cards";
import { cutlines, pockets, slot, type PageGeometry } from "./layout";
import { FONT, PT, num as f, type RenderOpts } from "./svg";

export interface PlacedCard { spec: CardSpec; asset: Asset; index: number; owned?: boolean }

export interface PageOpts { cutlines: boolean; preview: boolean }

const GREEN = "rgb(51,153,102)"; // el verde de los Estadios

/** Sello de goma "LA TENGO" sobre un velo blanco (solo vista previa). */
function ownedStamp(lang: string): string {
  const cx = CARD_W / 2, cy = CARD_H / 2 + 2;
  const label = lang === "es" ? "LA TENGO" : "GOT IT";
  return `<g class="owned-stamp" pointer-events="none">`
    + `<rect x="${f(BORDER)}" y="${f(BORDER)}" width="${f(CARD_W - 2 * BORDER)}" height="${f(CARD_H - 2 * BORDER)}" fill="#fff" fill-opacity="0.62"/>`
    + `<g transform="translate(${f(cx)} ${f(cy)}) rotate(-14)">`
    + `<rect x="-22" y="-8.5" width="44" height="17" rx="3.2" fill="#fff" fill-opacity="0.85" stroke="${GREEN}" stroke-width="1.4"/>`
    + `<rect x="-20.4" y="-6.9" width="40.8" height="13.8" rx="2.2" fill="none" stroke="${GREEN}" stroke-width="0.45"/>`
    + `<path d="M-16.5 0.2l2.6 2.8l5.2-6" fill="none" stroke="${GREEN}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<text x="3.2" y="${f(11 * PT * 0.36)}" font-family="${FONT}" font-weight="bold" font-size="${f(11 * PT)}" `
    + `fill="${GREEN}" text-anchor="middle" letter-spacing="0.3">${label}</text>`
    + `</g></g>`;
}

/** Contenido de una carta: el dibujo y, en la vista previa, el sello si ya la tienes. */
export function cardInner(c: PlacedCard, o: RenderOpts, preview: boolean): string {
  return drawCard(c.spec, c.asset, o, String(c.index)) + (preview && c.owned ? ownedStamp(o.lang) : "");
}

/** <g> de una carta en su hueco; `index` es global para que los id de clipPath no choquen. */
export function cardGroup(g: PageGeometry, k: number, c: PlacedCard, o: RenderOpts, preview: boolean): string {
  const [x, y] = slot(g, k);
  return `<g data-i="${c.index}" transform="translate(${f(x)} ${f(y)})">${cardInner(c, o, preview)}</g>`;
}

export function pageSvg(g: PageGeometry, cards: PlacedCard[], o: RenderOpts, p: PageOpts): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.pw} ${g.ph}" `
    + `width="${g.pw}mm" height="${g.ph}mm">`
    + (p.preview ? pockets(g) : "")
    + cards.map((c, k) => cardGroup(g, k, c, o, p.preview)).join("")
    + (p.cutlines ? cutlines(g, o) : "") // encima: con cartas juntas, la guía cruza los bordes
    + "</svg>";
}
