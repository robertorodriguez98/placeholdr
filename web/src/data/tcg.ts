// Expansiones y cartas (PokemonTCG/pokemon-tcg-data) + nombres traducidos (API de TCGdex).
import { fetchJson } from "./fetch";
import { TCG_SETS, TCGDEX_API, tcgCards } from "./sources";
import { TYPE_WORD_ES } from "../config";

export interface TcgSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  ptcgoCode?: string;
  releaseDate: string; // "2026/07/17"
  tcgdexId?: string; // solo en los sets japoneses (data/japan.ts): su id en TCGdex
}

export interface TcgCard {
  id: string;
  name: string;
  number: string;
  supertype: "Pokémon" | "Trainer" | "Energy";
  subtypes?: string[];
  types?: string[];
  rarity?: string;
  nationalPokedexNumbers?: number[];
}

/** Carta lista para dibujar: nombre localizado y número formateado. */
export interface SetCard extends TcgCard {
  nameEn: string;
  label: string; // "077/084"
  variant?: string; // copia extra del master set ("REVERSE"...)
}

export async function loadSets(refresh = false): Promise<TcgSet[]> {
  const sets = await fetchJson<TcgSet[]>(TCG_SETS, refresh);
  // printedTotal falta en algunas colecciones especiales
  return sets.map((s) => ({ ...s, printedTotal: s.printedTotal ?? s.total }));
}

/** Series ordenadas de la más reciente a la más antigua, cada una con sus sets por fecha. */
export function groupBySeries(sets: TcgSet[]): [string, TcgSet[]][] {
  const by = new Map<string, TcgSet[]>();
  for (const s of [...sets].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))) {
    if (!by.has(s.series)) by.set(s.series, []);
    by.get(s.series)!.push(s);
  }
  return [...by];
}

function naturalKey(num: string): [string, number] {
  const m = num.match(/^([A-Za-z]*)(\d+)/);
  return m ? [m[1], parseInt(m[2], 10)] : [num, 0];
}

/** Orden de colección: 1, 2... 10, y las subcolecciones (TG01...) agrupadas por prefijo. */
export function byNumber(a: TcgCard, b: TcgCard): number {
  const [pa, na] = naturalKey(a.number);
  const [pb, nb] = naturalKey(b.number);
  return pa.localeCompare(pb) || na - nb;
}

export async function loadSetCards(setId: string, refresh = false): Promise<TcgCard[]> {
  const cards = await fetchJson<TcgCard[]>(tcgCards(setId), refresh);
  return cards.sort(byNumber);
}

export function fmtNumber(num: string, total: number): string {
  const t = String(total).padStart(3, "0");
  return /^\d+$/.test(num) ? `${num.padStart(3, "0")}/${t}` : `${num}/${t}`;
}

interface TcgdexSetBrief { id: string; name: string }
export interface TcgdexSet {
  name: string;
  cards: { id: string; localId: string; name: string }[];
}

/** Id de la expansión en TCGdex, casada por nombre inglés ("Pitch Black": me5 -> me05). */
export async function tcgdexSetId(set: TcgSet): Promise<string | null> {
  const list = await fetchJson<TcgdexSetBrief[]>(`${TCGDEX_API}/en/sets`);
  const match = list.find((s) => s.name.toLowerCase() === set.name.toLowerCase());
  if (!match) console.warn(`TCGdex no tiene '${set.name}': nombres en inglés y sin variantes`);
  return match?.id ?? null;
}

/**
 * Nombres traducidos de una expansión con la API de TCGdex: una llamada para casar la
 * expansión por su nombre inglés y otra para la expansión en el idioma pedido.
 * Devuelve null si TCGdex no la tiene (las cartas se quedan en inglés).
 */
export async function loadTranslations(
  set: TcgSet, lang: string,
): Promise<{ setName: string; names: Map<string, string> } | null> {
  if (lang === "en") return null;
  const id = await tcgdexSetId(set);
  if (!id) return null;
  const tr = await fetchJson<TcgdexSet>(`${TCGDEX_API}/${lang}/sets/${id}`);
  const names = new Map<string, string>();
  for (const c of tr.cards) {
    let name = c.name;
    if (lang === "es") { // "Energía Lightning" -> "Energía Rayo"
      for (const [en, es] of Object.entries(TYPE_WORD_ES)) {
        name = name.replace(new RegExp(`\\b${en}\\b`, "g"), es);
      }
    }
    names.set(normNum(c.localId), name);
  }
  return { setName: tr.name, names };
}

/** "001" y "1" son la misma carta; "TG01" se deja tal cual. */
export const normNum = (n: string) => (/^\d+$/.test(n) ? String(parseInt(n, 10)) : n);

export type Supertype = "pokemon" | "trainer" | "energy";
const SUPERTYPE: Record<Supertype, TcgCard["supertype"]> = {
  pokemon: "Pokémon", trainer: "Trainer", energy: "Energy",
};

/**
 * base: solo la numeración impresa (sin secretas); complete: todas las cartas;
 * master: todas más una copia por variante (reverse, primera edición).
 */
export type Collection = "base" | "complete" | "master";

export interface SetSelection {
  only: Supertype[]; // vacío = todas
  collection: Collection;
}

export function selectCards(
  set: TcgSet, cards: TcgCard[], sel: SetSelection, names: Map<string, string> | null,
  extras: (card: TcgCard) => string[] = () => [],
): SetCard[] {
  let out = cards;
  if (sel.only.length) {
    const want = new Set(sel.only.map((k) => SUPERTYPE[k]));
    out = out.filter((c) => want.has(c.supertype));
  }
  if (sel.collection === "base") {
    out = out.filter((c) => /^\d+$/.test(c.number) && parseInt(c.number, 10) <= set.printedTotal);
  }
  return out.flatMap((c) => {
    const card = {
      ...c,
      nameEn: c.name,
      name: names?.get(normNum(c.number)) ?? c.name,
      label: fmtNumber(c.number, set.printedTotal),
    };
    // las copias de variante van justo detrás de su carta, como en el binder
    const copies = sel.collection === "master" ? extras(c) : [];
    return [card, ...copies.map((variant) => ({ ...card, variant }))];
  });
}
