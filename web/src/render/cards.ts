// Cartas portadas de pokebinder.py (draw_pokemon, draw_trainer, draw_energy).
// Cada función devuelve el SVG de una carta en coordenadas locales (0..63 × 0..88 mm).
import { BW_INK, CARD_H, CARD_W, TRAINER_STYLE, TYPE_COLORS, type RGB } from "../config";
import {
  GOLD_BADGE, PT, cardFrame, circle, css, footer, mix, num as f, pill, star, text, title,
  type RenderOpts,
} from "./svg";

export const BORDER = 3.5 * PT; // grosor del marco (3.5 pt, como --border en el CLI)

/** Imagen ya resuelta de una carta (o lo que falta por cargar). */
export type Asset =
  | { type: "pending" }
  | { type: "vector" } // sin imagen: icono vectorial de respaldo
  | { type: "art" | "item" | "bust"; href: string };

export interface PokemonSpec {
  type: "pokemon";
  name: string;
  number: string;
  topLeft: string;
  topLeftColor: RGB;
  badge?: string;
  dex?: number; // número de la Pokédex nacional, para el modo sin imágenes
  rarity?: string;
  variant?: string;
}
export interface TrainerSpec {
  type: "trainer";
  name: string;
  number: string;
  subtypes: string[];
  rarity?: string;
  variant?: string;
}
export interface EnergySpec {
  type: "energy";
  name: string;
  nameEn: string;
  number: string;
  subtypes: string[];
  rarity?: string;
  variant?: string;
}
export type CardSpec = PokemonSpec | TrainerSpec | EnergySpec;

const CX = CARD_W / 2;
const image = (href: string, x: number, y: number, w: number, h: number, extra = "") =>
  `<image href="${href}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" `
  + `preserveAspectRatio="xMidYMid meet" ${extra}/>`;

export function drawCard(spec: CardSpec, asset: Asset, o: RenderOpts, id: string): string {
  switch (spec.type) {
    case "pokemon": return drawPokemon(spec, asset, o);
    case "trainer": return drawTrainer(spec, asset, o, id);
    case "energy": return drawEnergy(spec, asset, o);
  }
}

function drawPokemon(s: PokemonSpec, asset: Asset, o: RenderOpts): string {
  let svg = cardFrame(BORDER, o);
  svg += pill(s.topLeft, 6.5, { left: 4, cy: 8.5 }, o, { bg: s.topLeftColor }).svg;
  if (s.badge) svg += pill(s.badge, 6.5, { right: CARD_W - 4, cy: 8.5 }, o, { bg: GOLD_BADGE }).svg;
  svg += title(CX, 19, s.name, CARD_W - 12);
  const box = 40, icy = CARD_H / 2 + 4;
  if (asset.type === "art") svg += image(asset.href, CX - box / 2, icy - box / 2, box, box);
  else if (asset.type === "pending") svg += circle(CX, icy, box * 0.38, "#eceef1");
  else svg += dexBadge(s, icy, box * 0.38, o);
  return svg + footer(s.number, s.rarity, s.variant, o);
}

function trainerStyle(subtypes: string[]) {
  const sub = subtypes.find((x) => x in TRAINER_STYLE) ?? "Item";
  return TRAINER_STYLE[sub];
}

function drawTrainer(s: TrainerSpec, asset: Asset, o: RenderOpts, id: string): string {
  const st = trainerStyle(s.subtypes);
  const col = o.bw ? BW_INK : st.color;
  const clip = `clip-${id}`;
  let svg = cardFrame(BORDER, o);
  // fondo de rayas y banda superior, recortados al interior del marco (o a la carta entera)
  const inset = o.frame ? BORDER / 2 : 0;
  svg += `<clipPath id="${clip}"><rect x="${f(inset)}" y="${f(inset)}" `
    + `width="${f(CARD_W - 2 * inset)}" height="${f(CARD_H - 2 * inset)}"/></clipPath><g clip-path="url(#${clip})">`;
  if (!o.bw) {
    const step = 4;
    let lines = "";
    for (let k = -Math.floor(CARD_H / step); k < Math.floor(CARD_W / step) + 2; k++) {
      lines += `M${f(k * step)} ${CARD_H}L${f(k * step + CARD_H)} 0`;
    }
    svg += `<path d="${lines}" stroke="${css(mix(col, 0.9))}" stroke-width="1.6" fill="none"/>`;
    svg += `<rect x="0" y="0" width="${CARD_W}" height="15" fill="${css(col)}"/>`;
  } else { // en B/N la banda es solo una línea separadora
    svg += `<line x1="0" y1="15" x2="${CARD_W}" y2="15" stroke="#000" stroke-width="${f(1.2 * PT)}"/>`;
  }
  svg += "</g>" + cardFrame(BORDER, o, undefined, false); // repasa el marco por encima del fondo
  const es = o.lang === "es";
  svg += text(5, 9.3, es ? "ENTRENADOR" : "TRAINER", 6.5, o.bw ? [0, 0, 0] : [1, 1, 1]);
  svg += pill(es ? st.es : st.en, 6.5, { right: CARD_W - 4.5, cy: 8.5 }, o, { bg: [1, 1, 1], fg: col }).svg;
  if (s.subtypes.includes("ACE SPEC")) {
    svg += pill("ACE SPEC", 6, { cx: CX, cy: 18.5 }, o, { bg: [0.85, 0.15, 0.4] }).svg;
  }
  svg += title(CX, 25, s.name, CARD_W - 10, 10.5);
  const cy = CARD_H / 2 + 6, r = 15;
  if (asset.type === "bust") svg += bustMedallion(asset.href, cy, r, col, o, `med-${id}`);
  else if (asset.type === "item") svg += itemIcon(asset.href, cy, r, col, o);
  else if (asset.type === "vector") svg += vectorIcon(st.icon, CX, cy, r, col, o);
  else svg += circle(CX, cy, r, css(mix(col, o.bw ? 0.93 : 0.82)));
  return svg + footer(s.number, s.rarity, s.variant, o);
}

/** Tipo de una Energía a partir de su nombre inglés ("Basic Lightning Energy" -> Lightning). */
export const energyType = (nameEn: string) =>
  Object.keys(TYPE_COLORS).find((t) => nameEn.includes(t)) ?? "Colorless";

function drawEnergy(s: EnergySpec, asset: Asset, o: RenderOpts): string {
  const special = s.subtypes.includes("Special");
  const col = o.bw ? BW_INK : TYPE_COLORS[energyType(s.nameEn)];
  let svg = cardFrame(BORDER, o, mix(col, 0.93));
  const es = o.lang === "es";
  const label = es ? (special ? "ENERGÍA ESPECIAL" : "ENERGÍA BÁSICA")
    : (special ? "SPECIAL ENERGY" : "BASIC ENERGY");
  svg += pill(label, 6.5, { left: 4, cy: 8.5 }, o, { bg: col }).svg;
  svg += title(CX, 19, s.name, CARD_W - 10, 10.5);
  const cy = CARD_H / 2 + 4;
  const item = asset.type === "item" ? asset.href : null;
  svg += energyOrb(CX, cy, 14, col, special, item === null, o);
  if (item) svg += image(item, CX - 10, cy - 10, 20, 20);
  return svg + footer(s.number, s.rarity, s.variant, o);
}

/** Orbe de energía: anillos concéntricos y destello. Diseño propio, no el símbolo oficial. */
function energyOrb(cx: number, cy: number, r: number, col: RGB, special: boolean, core: boolean, o: RenderOpts): string {
  let tones = core ? [0.88, 0.7, 0.45, 0.0] : [0.9, 0.8, 0.68, 0.55];
  if (o.bw && !core) tones = [0.95, 0.9, 0.85, 0.8];
  let svg = tones.map((t, i) => circle(cx, cy, r * (1 - i * 0.2), css(mix(col, t)))).join("");
  if (core) svg += star(cx, cy, r * 0.32, 4, 0.3, "#fff");
  if (special) { // pequeños destellos orbitando
    for (const a of [30, 150, 270]) {
      const rad = (a * Math.PI) / 180;
      svg += star(cx + r * 1.05 * Math.cos(rad), cy - r * 1.05 * Math.sin(rad), r * 0.13, 4, 0.35, "#fff");
    }
  }
  return svg;
}

/** Objeto del juego sobre un círculo suave del color del subtipo. */
function itemIcon(href: string, cy: number, r: number, col: RGB, o: RenderOpts): string {
  const box = r * 1.45;
  return circle(CX, cy, r, css(mix(col, o.bw ? 0.93 : 0.82))) + image(href, CX - box / 2, cy - box / 2, box, box);
}

/** Busto dentro del mismo círculo que los iconos de objeto, con el marco del subtipo. */
function bustMedallion(href: string, cy: number, r: number, col: RGB, o: RenderOpts, clip: string): string {
  const side = r * 2.05;
  return circle(CX, cy, r, css(mix(col, o.bw ? 0.93 : 0.82)))
    + `<clipPath id="${clip}"><circle cx="${f(CX)}" cy="${f(cy)}" r="${f(r)}"/></clipPath>`
    + image(href, CX - side / 2, cy - r * 1.03, side, side, `clip-path="url(#${clip})"`)
    + circle(CX, cy, r, "none", `stroke="${o.bw ? "#000" : css(col)}" stroke-width="${f(1.4 * PT)}"`);
}

/** Sin imagen: círculo del color del tipo con el número de la Pokédex. */
function dexBadge(s: PokemonSpec, cy: number, r: number, o: RenderOpts): string {
  const col = o.bw ? BW_INK : s.topLeftColor;
  const label = s.dex ? `#${String(s.dex).padStart(4, "0")}` : "?";
  return circle(CX, cy, r, css(mix(col, o.bw ? 0.93 : 0.82)))
    + text(CX, cy + 1.6, label, s.dex ? 12 : 20, o.bw ? [0, 0, 0] : col.map((v) => v * 0.7) as RGB, "middle");
}

/** Iconos vectoriales de respaldo (persona, cápsula, llave inglesa, estadio). */
function vectorIcon(kind: string, cx: number, cy: number, r: number, col: RGB, o: RenderOpts): string {
  const c = css(col);
  let svg = circle(cx, cy, r, css(mix(col, o.bw ? 0.93 : 0.82)));
  if (kind === "person") {
    svg += circle(cx, cy - r * 0.32, r * 0.26, c);
    svg += `<path d="M${f(cx - r * 0.55)} ${f(cy + r * 0.62)}C${f(cx - r * 0.55)} ${f(cy - r * 0.05)} `
      + `${f(cx + r * 0.55)} ${f(cy - r * 0.05)} ${f(cx + r * 0.55)} ${f(cy + r * 0.62)}Z" fill="${c}"/>`;
  } else if (kind === "capsule") {
    const w = r * 1.3, h = r * 0.56;
    svg += `<g transform="translate(${f(cx)} ${f(cy)}) rotate(35)">`
      + `<rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${c}"/>`
      + `<rect x="0" y="${f(-h / 2)}" width="${f(w / 2)}" height="${f(h)}" rx="${f(h / 2)}" fill="${css(mix(col, 0.55))}"/>`
      + `<rect x="0" y="${f(-h / 2)}" width="${f(h / 2)}" height="${f(h)}" fill="${css(mix(col, 0.55))}"/>`
      + `<rect x="${f(-w / 2 + h * 0.3)}" y="${f(-h * 0.24)}" width="${f(w * 0.35)}" height="${f(h * 0.16)}" `
      + `rx="${f(h * 0.08)}" fill="#fff" fill-opacity="0.5"/></g>`;
  } else if (kind === "wrench") {
    svg += `<g transform="translate(${f(cx)} ${f(cy)}) rotate(-45)">`
      + `<rect x="${f(-r * 0.12)}" y="${f(-r * 0.3)}" width="${f(r * 0.24)}" height="${f(r * 0.95)}" rx="${f(r * 0.1)}" fill="${c}"/>`
      + circle(0, -r * 0.38, r * 0.3, c)
      + `<rect x="${f(-r * 0.11)}" y="${f(-r * 0.75)}" width="${f(r * 0.22)}" height="${f(r * 0.35)}" fill="${css(mix(col, 0.82))}"/></g>`;
  } else if (kind === "stadium") {
    const sw = `stroke="${c}" stroke-width="${f(r * 0.09)}" fill="none"`;
    svg += `<ellipse cx="${f(cx)}" cy="${f(cy + r * 0.15)}" rx="${f(r * 0.7)}" ry="${f(r * 0.3)}" ${sw}/>`
      + `<path d="M${f(cx - r * 0.7)} ${f(cy + r * 0.15)}H${f(cx + r * 0.7)}`
      + `M${f(cx - r * 0.7)} ${f(cy + r * 0.15)}V${f(cy + r * 0.5)}`
      + `M${f(cx + r * 0.7)} ${f(cy + r * 0.15)}V${f(cy + r * 0.5)}`
      + `M${f(cx)} ${f(cy - r * 0.15)}V${f(cy - r * 0.62)}" ${sw}/>`
      + `<polygon points="${f(cx)},${f(cy - r * 0.62)} ${f(cx + r * 0.32)},${f(cy - r * 0.5)} ${f(cx)},${f(cy - r * 0.38)}" fill="${c}"/>`;
  }
  return svg;
}
