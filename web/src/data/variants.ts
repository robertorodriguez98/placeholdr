// Variantes de cada carta para el master set (API de TCGdex, una ficha por carta).
// TCGdex distingue normal, holo, reverse y primera edición; no modela los patrones
// especiales de algunas expansiones (Poké Ball, Master Ball...).
import { fetchJson } from "./fetch";
import { TCGDEX_API } from "./sources";
import { normNum, tcgdexSetId, type TcgSet, type TcgdexSet } from "./tcg";

export interface Variants { normal: boolean; holo: boolean; reverse: boolean; firstEdition: boolean }

/** {número normalizado: variantes}. Vacío si TCGdex no tiene la expansión. */
export async function loadVariants(
  set: TcgSet, onProgress?: (done: number, total: number) => void,
): Promise<Map<string, Variants>> {
  const out = new Map<string, Variants>();
  const id = await tcgdexSetId(set);
  if (!id) return out;
  const { cards } = await fetchJson<TcgdexSet>(`${TCGDEX_API}/en/sets/${id}`);
  let i = 0, finished = 0;
  const worker = async () => {
    while (i < cards.length) {
      const c = cards[i++];
      try {
        const card = await fetchJson<{ variants?: Variants }>(`${TCGDEX_API}/en/cards/${c.id}`);
        if (card.variants) out.set(normNum(c.localId), card.variants);
      } catch { /* sin datos: la carta cuenta solo una vez */ }
      onProgress?.(++finished, cards.length);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return out;
}

/** Etiquetas de las copias extra que pide el master set además de la carta base. */
export function extraCopies(v: Variants | undefined, lang: string): string[] {
  if (!v) return [];
  const es = lang === "es";
  const extra: string[] = [];
  if (v.reverse) extra.push("REVERSE");
  // primera edición como copia aparte solo si también existe la edición normal
  if (v.firstEdition && (v.normal || v.holo)) extra.push(es ? "1ª EDICIÓN" : "1ST EDITION");
  return extra;
}
