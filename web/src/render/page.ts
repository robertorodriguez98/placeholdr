// Una hoja completa en SVG. La vista previa y el PDF usan exactamente el mismo dibujo; la
// vista previa solo añade los bolsillos del binder para ver los huecos libres.
import { drawCard, type Asset, type CardSpec } from "./cards";
import { cutlines, pockets, slot, type PageGeometry } from "./layout";
import { num as f, type RenderOpts } from "./svg";

export interface PlacedCard { spec: CardSpec; asset: Asset; index: number }

export interface PageOpts { cutlines: boolean; preview: boolean }

/** <g> de una carta en su hueco; `index` es global para que los id de clipPath no choquen. */
export function cardGroup(g: PageGeometry, k: number, c: PlacedCard, o: RenderOpts): string {
  const [x, y] = slot(g, k);
  return `<g data-i="${c.index}" transform="translate(${f(x)} ${f(y)})">`
    + drawCard(c.spec, c.asset, o, String(c.index)) + "</g>";
}

export function pageSvg(g: PageGeometry, cards: PlacedCard[], o: RenderOpts, p: PageOpts): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.pw} ${g.ph}" `
    + `width="${g.pw}mm" height="${g.ph}mm">`
    + (p.preview ? pockets(g) : "")
    + (p.cutlines ? cutlines(g, o) : "")
    + cards.map((c, k) => cardGroup(g, k, c, o)).join("")
    + "</svg>";
}
