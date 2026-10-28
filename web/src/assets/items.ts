// Qué objeto de los juegos representa cada carta (ItemIcons del CLI).
import { ITEM_DEFAULT, ITEM_ENERGY, ITEM_KEYWORDS, SUPPORTER_POOL } from "../config";
import { fetchText } from "../data/fetch";
import { ITEMS_CSV } from "../data/sources";
import { energyType } from "../render/cards";

let known: Promise<Set<string>> | null = null;

/** Identificadores de objeto de PokeAPI (items.csv). */
export function knownItems(): Promise<Set<string>> {
  known ??= fetchText(ITEMS_CSV).then((t) =>
    new Set(t.trim().split(/\r?\n/).slice(1).map((r) => r.split(",")[1])));
  return known;
}

export const itemSlug = (name: string) =>
  name.toLowerCase().replace(/é/g, "e").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Resolutor de iconos para una lista de cartas. Se crea uno por cada lista porque el reparto
 * de SUPPORTER_POOL depende del orden de aparición.
 */
export class ItemResolver {
  private sup = new Map<string, string>();
  constructor(private known: Set<string>) {}

  resolve(card: { nameEn: string; supertype: string; subtypes?: string[] }): string {
    const en = card.nameEn;
    if (card.supertype === "Energy") return ITEM_ENERGY[energyType(en)];
    const s = itemSlug(en);
    if (this.known.has(s)) return s;
    for (const [pat, item] of ITEM_KEYWORDS) if (pat.test(en)) return item;
    const sub = (card.subtypes ?? []).find((x) => x in ITEM_DEFAULT) ?? "Item";
    if (sub === "Supporter") {
      if (!this.sup.has(en)) this.sup.set(en, SUPPORTER_POOL[this.sup.size % SUPPORTER_POOL.length]);
      return this.sup.get(en)!;
    }
    return ITEM_DEFAULT[sub];
  }
}
