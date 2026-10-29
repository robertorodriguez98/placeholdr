// Especies de la Pokédex nacional con nombre localizado (CSV de PokeAPI).
import { fetchText } from "./fetch";
import { NAMES_CSV, SPECIES_CSV } from "./sources";
import { LANG_IDS, type Lang } from "../config";

export interface Species {
  id: number;
  gen: number;
  name: string;
}

/** CSV sencillo de PokeAPI: sin comillas con comas dentro en las columnas que usamos. */
export function parseCsv(text: string): Record<string, string>[] {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split(",");
  return rows.map((r) => {
    const v = r.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ""]));
  });
}

export async function loadSpecies(lang: Lang): Promise<Species[]> {
  const [species, names] = await Promise.all([fetchText(SPECIES_CSV), fetchText(NAMES_CSV)]);
  const loc = new Map<number, string>();
  const eng = new Map<number, string>();
  for (const r of parseCsv(names)) {
    const lid = +r.local_language_id, sid = +r.pokemon_species_id;
    if (lid === LANG_IDS[lang]) loc.set(sid, r.name);
    if (lid === LANG_IDS.en) eng.set(sid, r.name);
  }
  return parseCsv(species)
    .map((r) => ({ id: +r.id, gen: +r.generation_id, identifier: r.identifier }))
    .filter((r) => r.id < 10000)
    .map((r) => ({
      id: r.id,
      gen: r.gen,
      name: loc.get(r.id) ?? eng.get(r.id) ?? r.identifier.replace(/^./, (c) => c.toUpperCase()),
    }))
    .sort((a, b) => a.id - b.id);
}

export type DexSelection =
  | { by: "gen"; gens: number[] }
  | { by: "range"; from: number; to: number }
  | { by: "ids"; ids: number[] };

export function selectSpecies(all: Species[], sel: DexSelection): Species[] {
  switch (sel.by) {
    case "gen": return all.filter((p) => sel.gens.includes(p.gen));
    case "range": return all.filter((p) => p.id >= sel.from && p.id <= sel.to);
    case "ids": {
      const want = new Set(sel.ids);
      return all.filter((p) => want.has(p.id));
    }
  }
}

/** "1-151" -> [1, 151]; "25" -> [25, 25]. */
export function parseRange(s: string): [number, number] | null {
  const m = s.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
  return m ? [+m[1], +(m[2] ?? m[1])] : null;
}

/** "1, 4, 7 25" -> [1, 4, 7, 25] */
export function parseIds(s: string): number[] {
  return s.split(/[\s,;]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}
