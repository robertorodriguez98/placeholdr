// Idioma de la interfaz (inglés por defecto). Es independiente del idioma de las cartas, que
// es el del selector "Idioma de las cartas" y lo que sale impreso. La elección se guarda en
// este navegador (localStorage), igual que el resto del estado.
//
// En el HTML, los textos se marcan con data-i18n (texto), data-i18n-title (title),
// y data-i18n-aria (aria-label); applyStatic() los rellena.

export const UI_LANGS = { en: "EN", es: "ES" } as const;
export type UiLang = keyof typeof UI_LANGS;

const KEY = "placeholdr:ui-lang";

const STRINGS = {
  en: {
    "doc.title": "Placeholdr · Binder placeholders for Pokémon TCG cards",
    "hero": "Fill the gaps in your Pokémon TCG binder",
    "ui.lang": "Interface language",
    "mode": "Mode",
    "mode.set": "Set",
    "mode.dex": "Pokédex",
    "set": "Set",
    "set.loading": "Loading sets…",
    "collection": "Collection",
    "coll.base": "Base",
    "coll.base.tip": "Only the printed numbering (001-084): no secret cards",
    "coll.complete": "Complete",
    "coll.complete.tip": "One card per number, secret cards included",
    "coll.master": "Master",
    "coll.master.tip": "Complete set plus one copy per variant: reverse holo and first edition",
    "types": "Card types",
    "type.pokemon": "Pokémon",
    "type.trainer": "Trainer",
    "type.energy": "Energy",
    "dex.selection": "Selection",
    "dex.byGen": "By generation",
    "dex.byRange": "By range",
    "dex.byIds": "Individual numbers",
    "dex.range": "Range",
    "dex.ids": "Numbers",
    "checklist": "Checklist",
    "tally.of": "of {n}",
    "hideOwned": "Print only missing cards",
    "checklist.hint": "Click a card in the preview to mark it as yours.",
    "markAll": "Mark all",
    "unmarkAll": "Unmark",
    "importCsv": "Import CSV",
    "exportCsv": "Export CSV",
    "print": "Printing",
    "cardLang": "Card language",
    "paper": "Paper",
    "paper.letter": "Letter",
    "bw": "Black & white",
    "frame": "Black borders",
    "frame.tip": "Without borders, the card reaches the dashed cutting line",
    "cutlines": "Cutting guides",
    "pdf": "Download PDF",
    "stage.mode": "SET",
    "card": "card", "cards": "cards",
    "sheet": "sheet", "sheets": "sheets",
    "row.skipped": "row skipped", "rows.skipped": "rows skipped",
    "sheetLabel": "SHEET {p} / {n}",
    "stamp": "GOT IT",
    "toPrint": "{cards} to print on {sheets}",
    "allOwned": "You have them all! Nothing left to print",
    "noCards": "No cards match this selection",
    "empty.complete": "Collection complete!",
    "empty.complete.sub": "You have every card in this selection.",
    "empty.none": "Nothing to show",
    "empty.none.sub": "Try changing the filters.",
    "err.sets": "Could not load the sets: {e}",
    "loading": "Loading {name}…",
    "variants": "Checking variants {d}/{t}…",
    "coll.name.base": "base set",
    "coll.name.complete": "complete set",
    "coll.name.master": "master set",
    "dex.loading": "Loading Pokédex…",
    "dex.gen": "Generation {g}",
    "dex.noGen": "No generation",
    "dex.badRange": "Invalid range: use the format 1-151",
    "dex.custom": "Custom selection",
    "dex.title": "National Pokédex · {name}",
    "imported": "Imported {cards}",
    "pdf.images": "Preparing images…",
    "pdf.imagesN": "Preparing images {d}/{t}…",
    "pdf.page": "Generating PDF: sheet {p}/{n}…",
    "pdf.done": "Done: {file} ({mb} MB)",
    "pdf.error": "Error generating the PDF: {e}",
    "file.missing": "missing",
    "legal": "Unofficial fan project. Not affiliated with, sponsored or endorsed by Nintendo, Creatures Inc., GAME FREAK or The Pokémon Company. Pokémon and card names are trademarks of their respective owners.",
  },
  es: {
    "doc.title": "Placeholdr · Placeholders de binder para cartas Pokémon TCG",
    "hero": "Rellena los huecos de tu binder de Pokémon TCG",
    "ui.lang": "Idioma de la interfaz",
    "mode": "Modo",
    "mode.set": "Edición",
    "mode.dex": "Pokédex",
    "set": "Edición",
    "set.loading": "Cargando ediciones…",
    "collection": "Colección",
    "coll.base": "Base",
    "coll.base.tip": "Solo la numeración impresa (001-084): sin cartas secretas",
    "coll.complete": "Completo",
    "coll.complete.tip": "Una carta por número, incluidas las secretas",
    "coll.master": "Master",
    "coll.master.tip": "Set completo más una copia por variante: reverse holo y primera edición",
    "types": "Tipos de carta",
    "type.pokemon": "Pokémon",
    "type.trainer": "Entrenador",
    "type.energy": "Energía",
    "dex.selection": "Selección",
    "dex.byGen": "Por generación",
    "dex.byRange": "Por rango",
    "dex.byIds": "Números sueltos",
    "dex.range": "Rango",
    "dex.ids": "Números",
    "checklist": "Checklist",
    "tally.of": "de {n}",
    "hideOwned": "Imprimir solo las que faltan",
    "checklist.hint": "Haz clic en una carta de la vista previa para marcarla como tuya.",
    "markAll": "Marcar todas",
    "unmarkAll": "Desmarcar",
    "importCsv": "Importar CSV",
    "exportCsv": "Exportar CSV",
    "print": "Impresión",
    "cardLang": "Idioma de las cartas",
    "paper": "Papel",
    "paper.letter": "Carta",
    "bw": "Blanco y negro",
    "frame": "Bordes negros",
    "frame.tip": "Sin marco, la carta llega hasta la línea de corte discontinua",
    "cutlines": "Líneas de corte",
    "pdf": "Descargar PDF",
    "stage.mode": "EDICIÓN",
    "card": "carta", "cards": "cartas",
    "sheet": "hoja", "sheets": "hojas",
    "row.skipped": "fila ignorada", "rows.skipped": "filas ignoradas",
    "sheetLabel": "HOJA {p} / {n}",
    "stamp": "LA TENGO",
    "toPrint": "{cards} para imprimir en {sheets}",
    "allOwned": "¡Las tienes todas! No queda nada por imprimir",
    "noCards": "No hay cartas con esta selección",
    "empty.complete": "¡Colección completa!",
    "empty.complete.sub": "Tienes todas las cartas de esta selección.",
    "empty.none": "Nada que mostrar",
    "empty.none.sub": "Prueba a cambiar los filtros.",
    "err.sets": "No se pudieron cargar las ediciones: {e}",
    "loading": "Cargando {name}…",
    "variants": "Consultando variantes {d}/{t}…",
    "coll.name.base": "set base",
    "coll.name.complete": "set completo",
    "coll.name.master": "master set",
    "dex.loading": "Cargando Pokédex…",
    "dex.gen": "Generación {g}",
    "dex.noGen": "Ninguna generación",
    "dex.badRange": "Rango no válido: usa el formato 1-151",
    "dex.custom": "Selección personalizada",
    "dex.title": "Pokédex nacional · {name}",
    "imported": "Importadas {cards}",
    "pdf.images": "Preparando imágenes…",
    "pdf.imagesN": "Preparando imágenes {d}/{t}…",
    "pdf.page": "Generando PDF: hoja {p}/{n}…",
    "pdf.done": "Listo: {file} ({mb} MB)",
    "pdf.error": "Error al generar el PDF: {e}",
    "file.missing": "faltan",
    "legal": "Proyecto de fans no oficial. Sin relación con Nintendo, Creatures Inc., GAME FREAK ni The Pokémon Company, ni patrocinado ni respaldado por ellos. Pokémon y los nombres de las cartas son marcas de sus respectivos propietarios.",
  },
} satisfies Record<UiLang, Record<string, string>>;

export type MsgKey = keyof typeof STRINGS.en;

function load(): UiLang {
  try {
    const v = localStorage.getItem(KEY);
    if (v && v in UI_LANGS) return v as UiLang;
  } catch { /* modo privado */ }
  return "en";
}

export let uiLang: UiLang = load();

export function setUiLang(l: UiLang) {
  uiLang = l;
  try { localStorage.setItem(KEY, l); } catch { /* modo privado */ }
  applyStatic();
}

/** Texto en el idioma de la interfaz; {nombre} se sustituye por params.nombre. */
export function t(key: MsgKey, params: Record<string, string | number> = {}): string {
  return STRINGS[uiLang][key].replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/** "1 carta", "3 cartas": `one` y `many` son las claves del singular y el plural. */
export const plural = (n: number, one: MsgKey, many: MsgKey) => `${n} ${t(n === 1 ? one : many)}`;

/** Rellena los textos fijos del HTML. */
export function applyStatic() {
  document.documentElement.lang = uiLang;
  document.title = t("doc.title");
  const each = (attr: string, set: (el: HTMLElement, s: string) => void) =>
    document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => set(el, t(el.getAttribute(attr) as MsgKey)));
  each("data-i18n", (el, s) => (el.textContent = s));
  each("data-i18n-title", (el, s) => (el.title = s));
  each("data-i18n-aria", (el, s) => el.setAttribute("aria-label", s));
}
