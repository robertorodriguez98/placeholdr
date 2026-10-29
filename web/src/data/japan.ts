// Sets japoneses, de la API de TCGdex en japonés (pokemon-tcg-data solo tiene los
// internacionales). Los nombres se quedan en japonés; el PDF los escribe con M PLUS 1p.
//
// El listado de un set solo trae el nombre de cada carta, así que se pide la ficha de cada
// una (8 a la vez y con caché, como las variantes del master set). Las fichas se convierten
// al formato de pokemon-tcg-data (TcgCard) para que el resto del código no distinga regiones.
import { fetchJson, fetchText } from "./fetch";
import { NAMES_CSV, TCGDEX_API } from "./sources";
import { parseCsv } from "./species";
import { byNumber, normNum, type TcgCard, type TcgSet, type TcgdexSet } from "./tcg";
import type { Variants } from "./variants";
import { RARITY_ABBR } from "../config";

/** Los ids de los sets japoneses llevan este prefijo para no chocar con los internacionales (SV9 / sv9). */
export const JA_PREFIX = "ja-";

const api = (path: string) => `${TCGDEX_API}/ja/${path.split("/").map(encodeURIComponent).join("/")}`;

interface Serie {
  name: string;
  releaseDate?: string;
  sets: { id: string; name: string; cardCount: { official: number; total: number } }[];
}

/**
 * Orden dentro de una serie sin fechas por set: primero las expansiones numeradas, de la más
 * nueva a la más vieja (M4, M3, M2, M1S...), y después barajas y promos (MC, MF, M-P...).
 */
function newestFirst(a: { id: string }, b: { id: string }): number {
  const num = (id: string) => parseFloat(id.match(/\d+(\.\d+)?/)?.[0] ?? "NaN");
  const na = num(a.id), nb = num(b.id);
  if (Number.isNaN(na) !== Number.isNaN(nb)) return Number.isNaN(na) ? 1 : -1;
  return (nb - na) || b.id.localeCompare(a.id, undefined, { numeric: true });
}

/** Todos los sets japoneses, agrupables por serie (la fecha es la de la serie: TCGdex no da la del set). */
export async function loadJaSets(): Promise<TcgSet[]> {
  const series = await fetchJson<{ id: string }[]>(api("series"));
  const full = await Promise.all(series.map((s) => fetchJson<Serie>(api(`series/${s.id}`))));
  return full.flatMap((se) =>
    [...se.sets]
      .sort(newestFirst)
      .map((s) => ({
        id: JA_PREFIX + s.id,
        tcgdexId: s.id,
        name: s.name,
        series: se.name,
        printedTotal: s.cardCount.official || s.cardCount.total,
        total: s.cardCount.total,
        releaseDate: se.releaseDate ?? "",
      })));
}

interface JaCard {
  localId: string;
  name: string;
  category: "Pokemon" | "Trainer" | "Energy";
  dexId?: number[];
  types?: string[];
  rarity?: string;
  trainerType?: string;
  energyType?: "Normal" | "Special";
  variants?: Variants;
}

/** La rareza viene como "Double rare" o "None": se pasa a la forma de RARITY_ABBR ("Double Rare"). */
const RARITY = new Map(["Common", "Uncommon", "Rare", ...Object.keys(RARITY_ABBR)].map((r) => [r.toLowerCase(), r]));
const rarityOf = (r?: string) => (!r || r === "None" ? undefined : RARITY.get(r.toLowerCase()) ?? r);

const TRAINER_SUBTYPE: Record<string, string> = { Tool: "Pokémon Tool" };

/** Las energías japonesas no traen tipo: se saca del kanji del nombre (基本炎エネルギー, ニトロ炎エネルギー). */
const ENERGY_KANJI: [RegExp, string][] = [
  [/草/, "Grass"], [/炎/, "Fire"], [/水/, "Water"], [/雷/, "Lightning"], [/超/, "Psychic"],
  [/闘/, "Fighting"], [/悪/, "Darkness"], [/鋼/, "Metal"], [/フェアリー/, "Fairy"], [/ドラゴン/, "Dragon"],
];

/**
 * Número de Pokédex por el nombre, para las cartas sin dexId (pasa en muchas: マンムーex,
 * ナンジャモのハラバリーex...): gana la especie de nombre más largo contenida en el de la
 * carta, así "ミュウツー" no se queda en "ミュウ".
 */
async function speciesByName(): Promise<[string, number][]> {
  const rows = parseCsv(await fetchText(NAMES_CSV));
  const out = new Map<string, number>();
  for (const r of rows) if (r.local_language_id === "1" || r.local_language_id === "11") out.set(r.name, +r.pokemon_species_id);
  return [...out].filter(([n]) => n).sort((a, b) => b[0].length - a[0].length);
}

function toTcgCard(c: JaCard, species: [string, number][]): TcgCard {
  const rarity = rarityOf(c.rarity);
  if (c.category === "Pokemon") {
    const dex = c.dexId?.length ? c.dexId : species.filter(([n]) => c.name.includes(n)).slice(0, 1).map(([, id]) => id);
    return { id: c.localId, name: c.name, number: c.localId, supertype: "Pokémon", types: c.types, rarity, nationalPokedexNumbers: dex };
  }
  if (c.category === "Energy") {
    return {
      id: c.localId, name: c.name, number: c.localId, supertype: "Energy", rarity,
      subtypes: [c.energyType === "Special" ? "Special" : "Basic"],
    };
  }
  const subtypes = [TRAINER_SUBTYPE[c.trainerType ?? ""] ?? c.trainerType ?? "Item"];
  if (/ace spec/i.test(c.rarity ?? "")) subtypes.push("ACE SPEC");
  return { id: c.localId, name: c.name, number: c.localId, supertype: "Trainer", subtypes, rarity };
}

/**
 * Nombre "inglés" sintético para lo que el dibujo deduce del nombre inglés: el tipo de las
 * energías ("Fire Energy") y las insignias ex / MEGA ex.
 */
export function jaNameEn(c: TcgCard): string {
  if (c.supertype === "Energy") {
    const type = ENERGY_KANJI.find(([re]) => re.test(c.name))?.[1];
    return type ? `${type} Energy` : "Energy";
  }
  if (c.supertype === "Pokémon" && c.name.endsWith("ex")) return (c.name.startsWith("メガ") ? "Mega " : "") + "Pokémon ex";
  return c.name;
}

/** Cartas de un set japonés en orden de colección, con sus variantes (para el master set). */
export async function loadJaCards(
  set: TcgSet, onProgress?: (done: number, total: number) => void,
): Promise<{ cards: TcgCard[]; variants: Map<string, Variants> }> {
  const [{ cards: brief }, species] = await Promise.all([
    fetchJson<TcgdexSet>(api(`sets/${set.tcgdexId}`)),
    speciesByName(),
  ]);
  const list = brief ?? [];
  const cards: (TcgCard | null)[] = new Array(list.length).fill(null);
  const variants = new Map<string, Variants>();
  let i = 0, finished = 0;
  const worker = async () => {
    while (i < list.length) {
      const k = i++;
      try {
        const c = await fetchJson<JaCard>(api(`cards/${list[k].id}`));
        cards[k] = toTcgCard(c, species);
        if (c.variants) variants.set(normNum(c.localId), c.variants);
      } catch { /* ficha que falta: la carta se salta */ }
      onProgress?.(++finished, list.length);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return { cards: cards.filter((c): c is TcgCard => c !== null).sort(byNumber), variants };
}
