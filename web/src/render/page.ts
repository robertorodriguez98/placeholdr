// Una hoja completa en SVG. La vista previa y el PDF usan exactamente el mismo dibujo; la
// vista previa solo añade los bolsillos del binder (huecos libres) y el sello de las cartas
// que ya tienes.
import { CARD_H, CARD_W } from "../config";
import { BORDER, drawCard, type Asset, type CardSpec } from "./cards";
import { cutlines, pockets, slot, type PageGeometry } from "./layout";
import { FONT, PT, num as f, type RenderOpts } from "./svg";
import { t } from "../i18n";
import { currentTheme } from "../theme";
import { bevel, rect } from "./retro";

export interface PlacedCard { spec: CardSpec; asset: Asset; index: number; owned?: boolean }

export interface PageOpts { cutlines: boolean; preview: boolean }

const GREEN = "rgb(51,153,102)"; // el verde de los Estadios

/** Sello de goma "LA TENGO" sobre un velo blanco (solo vista previa, en el idioma de la interfaz). */
function ownedStamp(): string {
  const cx = CARD_W / 2, cy = CARD_H / 2 + 2;
  const label = t("stamp");
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

/**
 * Sello del tema retro: un cuadro de diálogo de Windows 98 sobre un velo blanco, con su barra de
 * título, una casilla marcada y el botón OK. Solo vista previa, en el idioma de la interfaz.
 */
function retroStamp(): string {
  const o: RenderOpts = { bw: false, lang: "en", frame: false, style: "retro" };
  const w = 46, h = 25, x = (CARD_W - w) / 2, y = CARD_H / 2 + 2 - h / 2;
  const th = 5.6, label = t("stamp");
  const text = (tx: number, ty: number, s: string, pt: number, fill: string, anchor = "start") =>
    `<text x="${f(tx)}" y="${f(ty)}" font-family="${FONT}" font-weight="bold" font-size="${f(pt * PT)}" `
    + `fill="${fill}" text-anchor="${anchor}">${s}</text>`;
  const bx = x + 5, by = y + th + 4.2, box = 6.2; // casilla
  const okW = 13, okH = 5, okX = x + w - okW - 3.5, okY = y + h - okH - 2.6; // botón OK
  return `<g class="owned-stamp" pointer-events="none">`
    + `<rect x="${f(BORDER)}" y="${f(BORDER)}" width="${f(CARD_W - 2 * BORDER)}" height="${f(CARD_H - 2 * BORDER)}" fill="#fff" fill-opacity="0.62"/>`
    + `<rect x="${f(x + 1.4)}" y="${f(y + 1.4)}" width="${w}" height="${h}" fill="#000" fill-opacity="0.35"/>` // sombra
    + rect(x, y, w, h, "rgb(212,208,200)") + bevel(x, y, w, h, true, o, 0.35)
    + rect(x + 1, y + 1, w - 2, th, "rgb(0,0,128)")
    + text(x + 2.4, y + 1 + th / 2 + 7 * PT * 0.35, "Placeholdr", 7, "#fff")
    + closeButton(x + w - 1.6, y + 1 + th / 2, o)
    + rect(bx, by, box, box, "#fff") + bevel(bx, by, box, box, false, o, 0.3)
    + `<path d="M${f(bx + 1.2)} ${f(by + 3.2)}l1.6 1.8l2.6-3.6" fill="none" stroke="${GREEN}" stroke-width="0.9" stroke-linecap="square"/>`
    + text(bx + box + 2.4, by + box / 2 + 10 * PT * 0.35, label, 10, "#000")
    + rect(okX, okY, okW, okH, "rgb(212,208,200)") + bevel(okX, okY, okW, okH, true, o, 0.3)
    + `<rect x="${f(okX + 1)}" y="${f(okY + 0.9)}" width="${f(okW - 2)}" height="${f(okH - 1.8)}" fill="none" stroke="#000" stroke-width="0.15" stroke-dasharray="0.4 0.4"/>`
    + text(okX + okW / 2, okY + okH / 2 + 7 * PT * 0.35, "OK", 7, "#000", "middle")
    + `</g>`;
}

/** Botón × de la barra de título del sello. */
function closeButton(right: number, cy: number, o: RenderOpts): string {
  const bw = 3.5, bh = 3.1, x = right - bw, y = cy - bh / 2, mx = x + bw / 2;
  return rect(x, y, bw, bh, "rgb(212,208,200)") + bevel(x, y, bw, bh, true, o, 0.22)
    + `<path d="M${f(mx - 0.75)} ${f(cy - 0.75)}L${f(mx + 0.75)} ${f(cy + 0.75)}M${f(mx + 0.75)} ${f(cy - 0.75)}L${f(mx - 0.75)} ${f(cy + 0.75)}" stroke="#000" stroke-width="0.32"/>`;
}

/** Contenido de una carta: el dibujo y, en la vista previa, el sello si ya la tienes. */
export function cardInner(c: PlacedCard, o: RenderOpts, preview: boolean): string {
  const stamp = preview && c.owned ? (currentTheme() === "retro" ? retroStamp() : ownedStamp()) : "";
  return drawCard(c.spec, c.asset, o, String(c.index)) + stamp;
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
