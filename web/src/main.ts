import "./style.css";
import { COLS, LANGS, ROWS, type Lang, type Paper } from "./config";
import {
  groupBySeries, loadSetCards, loadSets, loadTranslations, selectCards,
  type Supertype, type TcgSet,
} from "./data/tcg";
import { loadSpecies, parseIds, parseRange, selectSpecies, type DexSelection } from "./data/species";

// ---------------------------------------------------------------- estado
interface State {
  mode: "set" | "dex";
  setId: string;
  only: Supertype[];
  mainOnly: boolean;
  dexBy: DexSelection["by"];
  gens: number[];
  range: string;
  ids: string;
  lang: Lang;
  paper: Paper;
  bw: boolean;
}

const DEFAULTS: State = {
  mode: "set", setId: "", only: ["pokemon", "trainer", "energy"], mainOnly: false,
  dexBy: "gen", gens: [1], range: "1-151", ids: "", lang: "es", paper: "a4", bw: false,
};
const STORE_KEY = "pokebinder:state";

function loadState(): State {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* modo privado */ }
}

const state = loadState();

// ---------------------------------------------------------------- DOM
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const setSelect = $<HTMLSelectElement>("#set-select");
const preview = $<HTMLElement>("#preview");
const status = $<HTMLElement>("#status");

function setStatus(msg: string, error = false) {
  status.textContent = msg;
  status.classList.toggle("error", error);
}

// pestañas
document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) => {
  b.onclick = () => { state.mode = b.dataset.mode as State["mode"]; changed(); };
});

// idioma y papel
const langSel = $<HTMLSelectElement>("#lang");
langSel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
langSel.onchange = () => { state.lang = langSel.value as Lang; changed(); };
const paperSel = $<HTMLSelectElement>("#paper");
paperSel.onchange = () => { state.paper = paperSel.value as Paper; changed(); };
const bwChk = $<HTMLInputElement>("#bw");
bwChk.onchange = () => { state.bw = bwChk.checked; changed(); };

// modo edición
setSelect.onchange = () => { state.setId = setSelect.value; changed(); };
const onlyChks = [...document.querySelectorAll<HTMLInputElement>('input[name="only"]')];
onlyChks.forEach((c) => {
  c.onchange = () => {
    state.only = onlyChks.filter((x) => x.checked).map((x) => x.value as Supertype);
    changed();
  };
});
const mainOnly = $<HTMLInputElement>("#main-only");
mainOnly.onchange = () => { state.mainOnly = mainOnly.checked; changed(); };

// modo Pokédex
const dexBy = $<HTMLSelectElement>("#dex-by");
dexBy.onchange = () => { state.dexBy = dexBy.value as DexSelection["by"]; changed(); };
const genBox = $<HTMLElement>("#dex-gen");
genBox.innerHTML = Array.from({ length: 9 }, (_, i) =>
  `<label class="check"><input type="checkbox" value="${i + 1}" /> Gen ${i + 1}</label>`).join("");
const genChks = [...genBox.querySelectorAll<HTMLInputElement>("input")];
genChks.forEach((c) => {
  c.onchange = () => { state.gens = genChks.filter((x) => x.checked).map((x) => +x.value); changed(); };
});
const rangeIn = $<HTMLInputElement>("#dex-range-input");
rangeIn.oninput = () => { state.range = rangeIn.value; changed(); };
const idsIn = $<HTMLInputElement>("#dex-ids-input");
idsIn.oninput = () => { state.ids = idsIn.value; changed(); };

/** Vuelca el estado en los controles. */
function syncControls() {
  document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.mode === state.mode)));
  $("#set-panel").hidden = state.mode !== "set";
  $("#dex-panel").hidden = state.mode !== "dex";
  langSel.value = state.lang;
  paperSel.value = state.paper;
  bwChk.checked = state.bw;
  if (sets) setSelect.value = state.setId;
  onlyChks.forEach((c) => (c.checked = state.only.includes(c.value as Supertype)));
  mainOnly.checked = state.mainOnly;
  dexBy.value = state.dexBy;
  genChks.forEach((c) => (c.checked = state.gens.includes(+c.value)));
  $("#dex-gen").hidden = state.dexBy !== "gen";
  $("#dex-range").hidden = state.dexBy !== "range";
  $("#dex-ids").hidden = state.dexBy !== "ids";
  rangeIn.value = state.range;
  idsIn.value = state.ids;
}

// ---------------------------------------------------------------- datos
let sets: TcgSet[] | null = null;

async function initSets() {
  try {
    sets = await loadSets();
  } catch (e) {
    setStatus(`No se pudieron cargar las ediciones: ${e}`, true);
    return;
  }
  setSelect.innerHTML = groupBySeries(sets).map(([series, list]) =>
    `<optgroup label="${series}">${list.map((s) =>
      `<option value="${s.id}">${s.name} · ${s.releaseDate.slice(0, 4)} · ${s.ptcgoCode ?? s.id}</option>`,
    ).join("")}</optgroup>`).join("");
  if (!sets.some((s) => s.id === state.setId)) state.setId = groupBySeries(sets)[0][1][0].id;
  setSelect.disabled = false;
  changed();
}

/** Elemento que acabará siendo una carta dibujada; en la fase 1 solo se lista. */
interface Entry { num: string; name: string; kind: string }

let token = 0;
let timer: number | undefined;

/** Cualquier cambio: guarda, refresca controles y recalcula (con un pequeño retardo al teclear). */
function changed() {
  saveState();
  syncControls();
  clearTimeout(timer);
  timer = window.setTimeout(update, 150);
}

async function update() {
  const my = ++token; // descarta resultados de peticiones que ya no son las últimas
  try {
    const { title, entries } = state.mode === "set" ? await setEntries() : await dexEntries();
    if (my !== token) return;
    render(title, entries);
  } catch (e) {
    if (my === token) setStatus(String(e), true);
  }
}

async function setEntries(): Promise<{ title: string; entries: Entry[] }> {
  if (!sets) return { title: "", entries: [] };
  const set = sets.find((s) => s.id === state.setId)!;
  setStatus(`Cargando ${set.name}…`);
  const [cards, tr] = await Promise.all([
    loadSetCards(set.id),
    loadTranslations(set, state.lang).catch(() => null),
  ]);
  const sel = selectCards(set, cards, { only: state.only, mainOnly: state.mainOnly }, tr?.names ?? null);
  const kinds = { "Pokémon": "Pokémon", "Trainer": "Entrenador", "Energy": "Energía" };
  return {
    title: `${tr?.setName ?? set.name} (${set.id}) · numeración /${String(set.printedTotal).padStart(3, "0")}`,
    entries: sel.map((c) => ({ num: c.label, name: c.name, kind: kinds[c.supertype] })),
  };
}

async function dexEntries(): Promise<{ title: string; entries: Entry[] }> {
  setStatus("Cargando Pokédex…");
  const all = await loadSpecies(state.lang);
  let sel: DexSelection;
  if (state.dexBy === "gen") sel = { by: "gen", gens: state.gens };
  else if (state.dexBy === "range") {
    const r = parseRange(state.range);
    if (!r) throw new Error("Rango no válido: usa el formato 1-151");
    sel = { by: "range", from: r[0], to: r[1] };
  } else sel = { by: "ids", ids: parseIds(state.ids) };
  const pokes = selectSpecies(all, sel);
  return {
    title: "Pokédex nacional",
    entries: pokes.map((p) => ({ num: `#${String(p.id).padStart(4, "0")}`, name: p.name, kind: `Gen ${p.gen}` })),
  };
}

function render(title: string, entries: Entry[]) {
  const perPage = COLS * ROWS;
  const pages = Math.ceil(entries.length / perPage);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  setStatus(entries.length
    ? `${plural(entries.length, "carta", "cartas")} · ${plural(pages, "página", "páginas")}`
    : "No hay cartas con esta selección");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  preview.innerHTML = `
    <p class="summary">${esc(title)}</p>
    <div class="cardlist">${entries.map((e) =>
      `<div><span class="num">${esc(e.num)}</span><span>${esc(e.name)}</span></div>`).join("")}</div>`;
}

syncControls();
initSets(); // al terminar recalcula; el modo Pokédex no necesita esperar a las ediciones
if (state.mode === "dex") changed();
