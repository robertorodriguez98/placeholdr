// Constantes y mapas portados de pokebinder.py (CLI congelado).

export const LANGS = { es: "Español", en: "English", fr: "Français", de: "Deutsch", it: "Italiano" } as const;
export type Lang = keyof typeof LANGS;
// ids de idioma en los CSV de PokeAPI
export const LANG_IDS: Record<Lang, number> = { fr: 5, de: 6, es: 7, it: 8, en: 9 };

export type RGB = [number, number, number]; // 0-1, como en reportlab

export const TYPE_COLORS: Record<string, RGB> = {
  Grass: [0.30, 0.65, 0.30], Fire: [0.90, 0.35, 0.20], Water: [0.20, 0.50, 0.85],
  Lightning: [0.95, 0.78, 0.10], Psychic: [0.60, 0.35, 0.70], Fighting: [0.70, 0.40, 0.20],
  Darkness: [0.20, 0.25, 0.30], Metal: [0.55, 0.60, 0.65], Dragon: [0.70, 0.60, 0.20],
  Fairy: [0.90, 0.45, 0.65], Colorless: [0.65, 0.65, 0.62],
};

export const TYPE_ES: Record<string, string> = {
  Grass: "PLANTA", Fire: "FUEGO", Water: "AGUA", Lightning: "RAYO",
  Psychic: "PSÍQUICO", Fighting: "LUCHA", Darkness: "OSCURIDAD", Metal: "METÁLICO",
  Dragon: "DRAGÓN", Fairy: "HADA", Colorless: "INCOLORO",
};

// Estilo de las cartas que no son Pokémon: color, etiqueta ES, etiqueta EN, icono vectorial
export const TRAINER_STYLE: Record<string, { color: RGB; es: string; en: string; icon: string }> = {
  "Supporter": { color: [0.86, 0.36, 0.20], es: "PARTIDARIO", en: "SUPPORTER", icon: "person" },
  "Item": { color: [0.18, 0.45, 0.80], es: "OBJETO", en: "ITEM", icon: "capsule" },
  "Pokémon Tool": { color: [0.50, 0.30, 0.70], es: "HERRAMIENTA", en: "TOOL", icon: "wrench" },
  "Stadium": { color: [0.20, 0.60, 0.40], es: "ESTADIO", en: "STADIUM", icon: "stadium" },
};

// Palabras de tipo que TCGdex deja a veces en inglés dentro de nombres traducidos
export const TYPE_WORD_ES: Record<string, string> = {
  Grass: "Planta", Fire: "Fuego", Water: "Agua", Lightning: "Rayo",
  Psychic: "Psíquica", Fighting: "Lucha", Darkness: "Oscuridad",
  Metal: "Metálica", Dragon: "Dragón", Fairy: "Hada", Colorless: "Incolora",
};

// --- Objetos de los juegos usados como icono ---------------------------------------------
// 1) Si el nombre inglés de la carta es un objeto real (Ultra Ball, Rare Candy...), se usa ese.
// 2) Si no, se busca por palabras clave (primera coincidencia gana).
// 3) Si no, el objeto por defecto del subtipo.
export const ITEM_KEYWORDS: [RegExp, string][] = [
  [/armor fossil/i, "armor-fossil"], [/skull fossil/i, "skull-fossil"],
  [/helix fossil/i, "helix-fossil"], [/dome fossil/i, "dome-fossil"],
  [/claw fossil/i, "claw-fossil"], [/root fossil/i, "root-fossil"],
  [/cover fossil/i, "cover-fossil"], [/plume fossil/i, "plume-fossil"],
  [/jaw fossil/i, "jaw-fossil"], [/sail fossil/i, "sail-fossil"],
  [/amber|fossil/i, "old-amber"],
  [/master ball/i, "master-ball"], [/ultra ball/i, "ultra-ball"], [/great ball/i, "great-ball"],
  [/\bball\b/i, "poke-ball"],
  [/potion|heal|cure/i, "potion"], [/candy/i, "rare-candy"], [/revive|stretcher/i, "max-revive"],
  [/bell/i, "soothe-bell"], [/bomb|smoke/i, "smoke-ball"], [/hammer|crush/i, "iron-ball"],
  [/rope|escape|retreat/i, "escape-rope"], [/belt/i, "black-belt"],
  [/band|bangle|brace/i, "choice-band"], [/badge|coin|medal/i, "amulet-coin"],
  [/defender|armor|shield|guard/i, "hard-stone"], [/energy|switch/i, "energy-root"],
  [/scarf|cape|cloak/i, "silk-scarf"], [/glasses|goggles/i, "black-glasses"],
  [/berry/i, "sitrus-berry"], [/sash/i, "focus-sash"], [/leftover/i, "leftovers"],
  [/share|exp/i, "exp-share"], [/vitality|vitamin|vigor/i, "hp-up"],
  [/map|quarry|city|town|tower|gym|forest|cave|lake/i, "town-map"],
];
export const ITEM_DEFAULT: Record<string, string> = {
  "Supporter": "exp-share", "Item": "poke-ball", "Pokémon Tool": "leftovers", "Stadium": "town-map",
};
// Partidarios sin busto: cada Partidario distinto recibe un objeto distinto, por orden de
// aparición, y sus reimpresiones (full art, SIR...) repiten el mismo.
export const SUPPORTER_POOL = ["exp-share", "amulet-coin", "lucky-egg", "macho-brace", "scope-lens",
  "quick-claw", "kings-rock", "cleanse-tag", "everstone", "lucky-punch"];
export const ITEM_ENERGY: Record<string, string> = {
  Grass: "leaf-stone", Fire: "fire-stone", Water: "water-stone",
  Lightning: "thunder-stone", Psychic: "twisted-spoon", Fighting: "black-belt",
  Darkness: "dusk-stone", Metal: "metal-coat", Dragon: "dragon-scale",
  Fairy: "moon-stone", Colorless: "silk-scarf",
};

export const BUST_FRACTION = 0.42; // alto del busto respecto al alto total del personaje

export const RARITY_ABBR: Record<string, string> = {
  "Common": "C", "Uncommon": "U", "Rare": "R", "Double Rare": "RR", "Ultra Rare": "UR",
  "Illustration Rare": "IR", "Special Illustration Rare": "SIR", "Hyper Rare": "HR",
  "Mega Hyper Rare": "MHR", "ACE SPEC Rare": "ACE", "Shiny Rare": "SR",
  "Shiny Ultra Rare": "SUR", "Black White Rare": "BWR", "Promo": "PR",
};

// Modo blanco y negro
export const BW_INK: RGB = [0.25, 0.25, 0.25]; // gris de los iconos en B/N
export const BW_LIGHTEN = 0.18; // cuánto se aclara el artwork en B/N (ahorro de tóner)

// Tamaños en mm
export const CARD_W = 63, CARD_H = 88, GAP = 2, COLS = 3, ROWS = 3;
export const PAPER = { a4: [210, 297], letter: [215.9, 279.4] } as const;
export type Paper = keyof typeof PAPER;
