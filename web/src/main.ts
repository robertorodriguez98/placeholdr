import "./style.css";
import { LANGS, TYPE_COLORS, TYPE_ES, type Lang, type Paper } from "./config";
import {
  groupBySeries, loadSetCards, loadSets, loadTranslations, normNum, selectCards,
  type Collection, type Supertype, type TcgSet,
} from "./data/tcg";
import { loadSpecies, parseIds, parseRange, selectSpecies, type DexSelection } from "./data/species";
import { extraCopies, loadVariants, type Variants } from "./data/variants";
import { ItemResolver, knownItems } from "./assets/items";
import { trainerSlug } from "./assets/busts";
import { artJob, blobOf, bustJob, itemJob, peek, resolve } from "./assets/store";
import { drawCard, type CardSpec } from "./render/cards";
import { PER_PAGE, geometry } from "./render/layout";
import { pageSvg, type PlacedCard } from "./render/page";
import type { RenderOpts } from "./render/svg";

// ---------------------------------------------------------------- estado
interface State {
  mode: "set" | "dex";
  setId: string;
  only: Supertype[];
  collection: Collection;
  dexBy: DexSelection["by"];
  gens: number[];
  range: string;
  ids: string;
  lang: Lang;
  paper: Paper;
  bw: boolean;
  cutlines: boolean;
}

const DEFAULTS: State = {
  mode: "set", setId: "", only: ["pokemon", "trainer", "energy"], collection: "complete",
  dexBy: "gen", gens: [1], range: "1-151", ids: "", lang: "es", paper: "a4", bw: false, cutlines: true,
};
const STORE_KEY = "pokebinder:state";

function loadState(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    if ("mainOnly" in saved) { // estado guardado por la fase 1
      if (saved.mainOnly) saved.collection = "base";
      delete saved.mainOnly;
    }
    return { ...DEFAULTS, ...saved };
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
const progress = $<HTMLProgressElement>("#progress");
const pdfBtn = $<HTMLButtonElement>("#pdf");

function setStatus(msg: string, error = false) {
  status.textContent = msg;
  status.classList.toggle("error", error);
}
function setProgress(done: number | null, total = 1) {
  progress.hidden = done === null;
  if (done !== null) { progress.max = total; progress.value = done; }
}

document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) => {
  b.onclick = () => { state.mode = b.dataset.mode as State["mode"]; changed(); };
});

const langSel = $<HTMLSelectElement>("#lang");
langSel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
langSel.onchange = () => { state.lang = langSel.value as Lang; changed(); };
const paperSel = $<HTMLSelectElement>("#paper");
paperSel.onchange = () => { state.paper = paperSel.value as Paper; changed(); };
const bwChk = $<HTMLInputElement>("#bw");
bwChk.onchange = () => { state.bw = bwChk.checked; changed(); };
const cutChk = $<HTMLInputElement>("#cutlines");
cutChk.onchange = () => { state.cutlines = cutChk.checked; changed(); };

setSelect.onchange = () => { state.setId = setSelect.value; changed(); };
const onlyChks = [...document.querySelectorAll<HTMLInputElement>('input[name="only"]')];
onlyChks.forEach((c) => {
  c.onchange = () => {
    state.only = onlyChks.filter((x) => x.checked).map((x) => x.value as Supertype);
    changed();
  };
});
const collRadios = [...document.querySelectorAll<HTMLInputElement>('input[name="collection"]')];
collRadios.forEach((r) => { r.onchange = () => { state.collection = r.value as Collection; changed(); }; });

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

function syncControls() {
  document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) =>
    b.setAttribute("aria-selected", String(b.dataset.mode === state.mode)));
  $("#set-panel").hidden = state.mode !== "set";
  $("#dex-panel").hidden = state.mode !== "dex";
  langSel.value = state.lang;
  paperSel.value = state.paper;
  bwChk.checked = state.bw;
  cutChk.checked = state.cutlines;
  if (sets) setSelect.value = state.setId;
  onlyChks.forEach((c) => (c.checked = state.only.includes(c.value as Supertype)));
  collRadios.forEach((r) => (r.checked = r.value === state.collection));
  dexBy.value = state.dexBy;
  genChks.forEach((c) => (c.checked = state.gens.includes(+c.value)));
  $("#dex-gen").hidden = state.dexBy !== "gen";
  $("#dex-range").hidden = state.dexBy !== "range";
  $("#dex-ids").hidden = state.dexBy !== "ids";
  rangeIn.value = state.range;
  idsIn.value = state.ids;
}

// ---------------------------------------------------------------- datos -> cartas
let sets: TcgSet[] | null = null;

async function initSets() {
  try {
    sets = await loadSets();
  } catch (e) {
    setStatus(`No se pudieron cargar las ediciones: ${e}`, true);
    return;
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  setSelect.innerHTML = groupBySeries(sets).map(([series, list]) =>
    `<optgroup label="${esc(series)}">${list.map((s) =>
      `<option value="${s.id}">${esc(s.name)} · ${s.releaseDate.slice(0, 4)} · ${s.ptcgoCode ?? s.id}</option>`,
    ).join("")}</optgroup>`).join("");
  if (!sets.some((s) => s.id === state.setId)) state.setId = groupBySeries(sets)[0][1][0].id;
  setSelect.disabled = false;
  changed();
}

/** Una carta de la selección y, si lleva imagen, cómo conseguirla. */
interface Item { spec: CardSpec; job?: { key: string; load: Parameters<typeof resolve>[1] } }

interface Selection { title: string; file: string; items: Item[] }

async function setSelection(my: number): Promise<Selection | null> {
  if (!sets) return null;
  const set = sets.find((s) => s.id === state.setId)!;
  setStatus(`Cargando ${set.name}…`);
  const [cards, tr, known] = await Promise.all([
    loadSetCards(set.id),
    loadTranslations(set, state.lang).catch(() => null),
    knownItems(),
  ]);
  let variants = new Map<string, Variants>();
  if (state.collection === "master") {
    variants = await loadVariants(set, (d, t) => {
      if (my === token) { setStatus(`Consultando variantes ${d}/${t}…`); setProgress(d, t); }
    });
    setProgress(null);
  }
  const sel = selectCards(set, cards, { only: state.only, collection: state.collection },
    tr?.names ?? null, (c) => extraCopies(variants.get(normNum(c.number)), state.lang));
  const bw = state.bw, es = state.lang === "es";
  const icons = new ItemResolver(known);
  const items: Item[] = sel.map((c) => {
    const base = { name: c.name, number: c.label, rarity: c.rarity, variant: c.variant };
    if (c.supertype === "Pokémon") {
      const dex = c.nationalPokedexNumbers?.[0];
      const tp = c.types?.[0] ?? "Colorless";
      const en = c.nameEn;
      return {
        spec: {
          ...base, type: "pokemon",
          topLeft: es ? TYPE_ES[tp] ?? tp.toUpperCase() : tp.toUpperCase(),
          topLeftColor: TYPE_COLORS[tp] ?? [0, 0, 0],
          badge: en.startsWith("Mega ") && en.endsWith(" ex") ? "MEGA ex" : en.endsWith(" ex") ? "ex" : undefined,
        },
        job: dex ? artJob(dex, bw) : undefined,
      };
    }
    const slug = icons.resolve(c);
    const subtypes = c.subtypes ?? [];
    if (c.supertype === "Energy") {
      return { spec: { ...base, type: "energy", nameEn: c.nameEn, subtypes }, job: itemJob(slug, bw) };
    }
    return {
      spec: { ...base, type: "trainer", subtypes },
      job: subtypes.includes("Supporter")
        ? bustJob(c.nameEn, c.name, trainerSlug(c.nameEn), slug, bw)
        : itemJob(slug, bw),
    };
  });
  const coll = { base: "set base", complete: "set completo", master: "master set" }[state.collection];
  return {
    title: `${tr?.setName ?? set.name} (${set.id}) · ${coll} · numeración /${String(set.printedTotal).padStart(3, "0")}`,
    file: `binder_${set.id}${state.collection === "complete" ? "" : "_" + state.collection}`,
    items,
  };
}

async function dexSelection(): Promise<Selection> {
  setStatus("Cargando Pokédex…");
  const all = await loadSpecies(state.lang);
  let sel: DexSelection, file: string;
  const pad = (n: number) => String(n).padStart(4, "0");
  if (state.dexBy === "gen") {
    sel = { by: "gen", gens: state.gens };
    file = `binder_gen${state.gens.join("-")}`;
  } else if (state.dexBy === "range") {
    const r = parseRange(state.range);
    if (!r) throw new Error("Rango no válido: usa el formato 1-151");
    sel = { by: "range", from: r[0], to: r[1] };
    file = `binder_${pad(r[0])}-${pad(r[1])}`;
  } else {
    sel = { by: "ids", ids: parseIds(state.ids) };
    file = "binder_custom";
  }
  return {
    title: "Pokédex nacional",
    file,
    items: selectSpecies(all, sel).map((p) => ({
      spec: {
        type: "pokemon", name: p.name, number: `#${pad(p.id)}`,
        topLeft: `GEN ${p.gen}`, topLeftColor: [0, 0, 0],
      },
      job: artJob(p.id, state.bw),
    })),
  };
}

// ---------------------------------------------------------------- vista previa
let token = 0;
let timer: number | undefined;
let current: { sel: Selection; opts: RenderOpts } | null = null;
let observer: IntersectionObserver | null = null;

function changed() {
  saveState();
  syncControls();
  clearTimeout(timer);
  timer = window.setTimeout(update, 150);
}

async function update() {
  const my = ++token; // descarta resultados de peticiones que ya no son las últimas
  pdfBtn.disabled = true;
  setProgress(null);
  try {
    const sel = state.mode === "set" ? await setSelection(my) : await dexSelection();
    if (my !== token || !sel) return;
    current = { sel, opts: { bw: state.bw, lang: state.lang } };
    renderPreview(my);
  } catch (e) {
    if (my === token) { setStatus(String(e), true); setProgress(null); }
  }
}

const placed = (it: Item, index: number): PlacedCard =>
  ({ spec: it.spec, asset: it.job ? peek(it.job.key) : { type: "vector" }, index });

function renderPreview(my: number) {
  const { sel, opts } = current!;
  const g = geometry(state.paper);
  const pages = Math.ceil(sel.items.length / PER_PAGE);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  observer?.disconnect();
  if (!sel.items.length) {
    preview.innerHTML = `<p class="summary">${sel.title}</p>`;
    setStatus("No hay cartas con esta selección");
    return;
  }
  setStatus(`${plural(sel.items.length, "carta", "cartas")} · ${plural(pages, "hoja", "hojas")}`);
  pdfBtn.disabled = false;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  let html = `<p class="summary">${esc(sel.title)}</p>`;
  for (let p = 0; p < pages; p++) {
    const cards = sel.items.slice(p * PER_PAGE, (p + 1) * PER_PAGE).map((it, k) => placed(it, p * PER_PAGE + k));
    html += `<div class="sheet" data-page="${p}">`
      + pageSvg(g, cards, opts, { cutlines: state.cutlines, preview: true })
      + `<span class="label">Hoja ${p + 1} de ${pages}</span></div>`;
  }
  preview.innerHTML = html;
  // las imágenes se cargan cuando la hoja se acerca a la pantalla
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      observer!.unobserve(e.target);
      loadPage(+(e.target as HTMLElement).dataset.page!, my);
    }
  }, { rootMargin: "600px" });
  preview.querySelectorAll(".sheet").forEach((s) => observer!.observe(s));
}

/** Resuelve las imágenes de una hoja y redibuja cada carta en cuanto tiene la suya. */
function loadPage(p: number, my: number): Promise<unknown> {
  const { sel, opts } = current!;
  return Promise.all(sel.items.slice(p * PER_PAGE, (p + 1) * PER_PAGE).map(async (it, k) => {
    if (!it.job) return;
    const i = p * PER_PAGE + k;
    await resolve(it.job.key, it.job.load);
    if (my !== token) return;
    const g = preview.querySelector(`g[data-i="${i}"]`);
    if (g) g.innerHTML = drawCard(it.spec, peek(it.job.key), opts, String(i));
  }));
}

// ---------------------------------------------------------------- PDF
pdfBtn.onclick = async () => {
  if (!current) return;
  const my = token;
  const { sel, opts } = current;
  pdfBtn.disabled = true;
  try {
    // primero todas las imágenes (las de las hojas que aún no se han visto también)
    const jobs = sel.items.filter((it) => it.job);
    let done = 0;
    setStatus("Preparando imágenes…");
    setProgress(0, jobs.length);
    await Promise.all(jobs.map((it) => resolve(it.job!.key, it.job!.load).then(() => {
      setProgress(++done, jobs.length);
      setStatus(`Preparando imágenes ${done}/${jobs.length}…`);
    })));
    if (my !== token) return;
    const { buildPdf } = await import("./pdf"); // svg2pdf solo se carga al exportar
    const blob = await buildPdf({
      cards: sel.items.map(placed),
      blobOf,
      geometry: geometry(state.paper),
      opts,
      cutlines: state.cutlines,
      title: `${sel.title} — binder placeholders`,
      onProgress: (p, n) => { setStatus(`Generando PDF: hoja ${p}/${n}…`); setProgress(p, n); },
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sel.file}${state.bw ? "_bw" : ""}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    setStatus(`Listo: ${a.download} (${(blob.size / 1e6).toFixed(1)} MB)`);
  } catch (e) {
    setStatus(`Error al generar el PDF: ${e}`, true);
    console.error(e);
  } finally {
    setProgress(null);
    if (my === token) pdfBtn.disabled = false;
  }
};

syncControls();
initSets(); // al terminar recalcula; el modo Pokédex no necesita esperar a las ediciones
if (state.mode === "dex") changed();
