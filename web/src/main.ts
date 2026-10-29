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
import * as checklist from "./checklist";
import type { CardSpec } from "./render/cards";
import { PER_PAGE, geometry } from "./render/layout";
import { cardInner, pageSvg, type PlacedCard } from "./render/page";
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
  frame: boolean;     // marco negro de las cartas
  hideOwned: boolean; // checklist: imprimir solo las que faltan
}

const DEFAULTS: State = {
  mode: "set", setId: "", only: ["pokemon", "trainer", "energy"], collection: "complete",
  dexBy: "gen", gens: [1], range: "1-151", ids: "", lang: "es", paper: "a4", bw: false,
  cutlines: true, frame: true, hideOwned: false,
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
const progress = $<HTMLElement>("#progress");
const pdfBtn = $<HTMLButtonElement>("#pdf");

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function setStatus(msg: string, error = false) {
  status.textContent = msg;
  status.classList.toggle("error", error);
}
function setProgress(done: number | null, total = 1) {
  progress.hidden = done === null;
  if (done !== null) (progress.firstElementChild as HTMLElement).style.width = `${(100 * done) / total}%`;
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
const frameChk = $<HTMLInputElement>("#frame");
frameChk.onchange = () => { state.frame = frameChk.checked; changed(); };
const hideChk = $<HTMLInputElement>("#hide-owned");
hideChk.onchange = () => { state.hideOwned = hideChk.checked; saveState(); rerender(); };

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
  `<label class="chip"><input type="checkbox" value="${i + 1}" /><span>Gen ${i + 1}</span></label>`).join("");
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
  frameChk.checked = state.frame;
  hideChk.checked = state.hideOwned;
  if (sets) setSelect.value = state.setId;
  onlyChks.forEach((c) => (c.checked = state.only.includes(c.value as Supertype)));
  collRadios.forEach((r) => (r.checked = r.value === state.collection));
  dexBy.value = state.dexBy;
  genChks.forEach((c) => (c.checked = state.gens.includes(+c.value)));
  genBox.hidden = state.dexBy !== "gen";
  rangeIn.hidden = state.dexBy !== "range";
  idsIn.hidden = state.dexBy !== "ids";
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
  setSelect.innerHTML = groupBySeries(sets).map(([series, list]) =>
    `<optgroup label="${esc(series)}">${list.map((s) =>
      `<option value="${s.id}">${esc(s.name)} · ${s.releaseDate.slice(0, 4)} · ${s.ptcgoCode ?? s.id}</option>`,
    ).join("")}</optgroup>`).join("");
  if (!sets.some((s) => s.id === state.setId)) state.setId = groupBySeries(sets)[0][1][0].id;
  setSelect.disabled = false;
  changed();
}

/** Una carta de la selección: qué dibujar, cómo conseguir su imagen y su clave del checklist. */
interface Item {
  spec: CardSpec;
  key: string;
  job?: { key: string; load: Parameters<typeof resolve>[1] };
}

interface Selection {
  kicker: string; // pastilla de la barra superior
  name: string; // título de la barra superior
  title: string; // título del PDF
  file: string; // nombre del PDF sin extensión
  items: Item[];
}

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
    const key = checklist.cardKey(set.id, c.number, c.variant);
    if (c.supertype === "Pokémon") {
      const dex = c.nationalPokedexNumbers?.[0];
      const tp = c.types?.[0] ?? "Colorless";
      const en = c.nameEn;
      return {
        key,
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
      return { key, spec: { ...base, type: "energy", nameEn: c.nameEn, subtypes }, job: itemJob(slug, bw) };
    }
    return {
      key,
      spec: { ...base, type: "trainer", subtypes },
      job: subtypes.includes("Supporter")
        ? bustJob(c.nameEn, c.name, trainerSlug(c.nameEn), slug, bw)
        : itemJob(slug, bw),
    };
  });
  const coll = { base: "set base", complete: "set completo", master: "master set" }[state.collection];
  const name = tr?.setName ?? set.name;
  return {
    kicker: `${set.ptcgoCode ?? set.id.toUpperCase()} · /${String(set.printedTotal).padStart(3, "0")}`,
    name: `${name} · ${coll}`,
    title: `${name} (${set.id}) · ${coll}`,
    file: `binder_${set.id}${state.collection === "complete" ? "" : "_" + state.collection}`,
    items,
  };
}

async function dexSelection(): Promise<Selection> {
  setStatus("Cargando Pokédex…");
  const all = await loadSpecies(state.lang);
  let sel: DexSelection, file: string, name: string;
  const pad = (n: number) => String(n).padStart(4, "0");
  if (state.dexBy === "gen") {
    sel = { by: "gen", gens: state.gens };
    file = `binder_gen${state.gens.join("-")}`;
    name = state.gens.length ? `Generación ${state.gens.join(", ")}` : "Ninguna generación";
  } else if (state.dexBy === "range") {
    const r = parseRange(state.range);
    if (!r) throw new Error("Rango no válido: usa el formato 1-151");
    sel = { by: "range", from: r[0], to: r[1] };
    file = `binder_${pad(r[0])}-${pad(r[1])}`;
    name = `#${pad(r[0])} – #${pad(r[1])}`;
  } else {
    sel = { by: "ids", ids: parseIds(state.ids) };
    file = "binder_custom";
    name = "Selección personalizada";
  }
  return {
    kicker: "POKÉDEX",
    name,
    title: `Pokédex nacional · ${name}`,
    file,
    items: selectSpecies(all, sel).map((p) => ({
      key: checklist.cardKey("dex", String(p.id)),
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
/** Selección actual; `visible` son las cartas que se imprimen (sin las que tienes, si se ocultan). */
let current: { sel: Selection; visible: Item[]; opts: RenderOpts } | null = null;
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
    current = { sel, visible: [], opts: { bw: state.bw, lang: state.lang, frame: state.frame } };
    rerender();
  } catch (e) {
    if (my === token) { setStatus(String(e), true); setProgress(null); }
  }
}

const placed = (it: Item, index: number): PlacedCard => ({
  spec: it.spec, index, owned: checklist.has(it.key),
  asset: it.job ? peek(it.job.key) : { type: "vector" },
});

/** Recuento del checklist (panel y barra superior), sin redibujar las hojas. */
function refreshTally() {
  if (!current) return;
  const { sel, visible } = current;
  const total = sel.items.length;
  const have = sel.items.filter((it) => checklist.has(it.key)).length;
  const pct = total ? Math.round((100 * have) / total) : 0;
  $("#owned-count").textContent = String(have);
  $("#owned-of").textContent = `de ${total}`;
  $("#owned-pct").textContent = `${pct} %`;
  $("#owned-bar").style.width = `${pct}%`;
  const pages = Math.ceil(visible.length / PER_PAGE);
  $("#stage-pills").innerHTML =
    `<span>${plural(visible.length, "carta", "cartas")}</span>`
    + `<span>${plural(pages, "hoja", "hojas")}</span>`
    + (have ? `<span class="green">✓ ${have}/${total}</span>` : "");
  setStatus(visible.length
    ? `${plural(visible.length, "carta", "cartas")} para imprimir en ${plural(pages, "hoja", "hojas")}`
    : total ? "¡Las tienes todas! No queda nada por imprimir" : "No hay cartas con esta selección");
  pdfBtn.disabled = !visible.length;
}

/** Recalcula qué se imprime y redibuja todas las hojas. */
function rerender() {
  if (!current) return;
  const my = token;
  const { sel, opts } = current;
  current.visible = state.hideOwned ? sel.items.filter((it) => !checklist.has(it.key)) : sel.items;
  const visible = current.visible;
  $("#stage-kicker").textContent = sel.kicker;
  $("#stage-name").textContent = sel.name;
  refreshTally();
  observer?.disconnect();
  if (!visible.length) {
    preview.innerHTML = sel.items.length
      ? `<p class="empty"><strong>¡Colección completa!</strong>Tienes todas las cartas de esta selección.</p>`
      : `<p class="empty"><strong>Nada que mostrar</strong>Prueba a cambiar los filtros.</p>`;
    return;
  }
  const g = geometry(state.paper);
  const pages = Math.ceil(visible.length / PER_PAGE);
  let html = "";
  for (let p = 0; p < pages; p++) {
    const cards = visible.slice(p * PER_PAGE, (p + 1) * PER_PAGE).map((it, k) => placed(it, p * PER_PAGE + k));
    html += `<div class="sheet" data-page="${p}" style="--n:${Math.min(p, 8)}">`
      + pageSvg(g, cards, opts, { cutlines: state.cutlines, preview: true })
      + `<span class="label">HOJA ${p + 1} / ${pages}</span></div>`;
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

/** Redibuja una carta de la vista previa (al llegar su imagen o al marcarla). */
function redrawCard(i: number) {
  const it = current!.visible[i];
  const g = preview.querySelector(`g[data-i="${i}"]`);
  if (it && g) g.innerHTML = cardInner(placed(it, i), current!.opts, true);
}

/** Resuelve las imágenes de una hoja y redibuja cada carta en cuanto tiene la suya. */
function loadPage(p: number, my: number): Promise<unknown> {
  return Promise.all(current!.visible.slice(p * PER_PAGE, (p + 1) * PER_PAGE).map(async (it, k) => {
    if (!it.job) return;
    await resolve(it.job.key, it.job.load);
    if (my === token) redrawCard(p * PER_PAGE + k);
  }));
}

// ---------------------------------------------------------------- checklist
let hideTimer: number | undefined;

preview.addEventListener("click", (e) => {
  const g = (e.target as Element).closest?.("g[data-i]");
  if (!g || !current) return;
  const i = +g.getAttribute("data-i")!;
  checklist.toggle(current.visible[i].key);
  redrawCard(i);
  refreshTally();
  // si se ocultan las que tienes, deja ver el sello un momento antes de recolocar las hojas
  if (state.hideOwned) {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(rerender, 650);
  }
});

$<HTMLButtonElement>("#mark-all").onclick = () => {
  if (!current) return;
  checklist.setMany(current.sel.items.map((it) => it.key), true);
  rerender();
};
$<HTMLButtonElement>("#unmark-all").onclick = () => {
  if (!current) return;
  checklist.setMany(current.sel.items.map((it) => it.key), false);
  rerender();
};

const csvFile = $<HTMLInputElement>("#csv-file");
$<HTMLButtonElement>("#import-csv").onclick = () => csvFile.click();
csvFile.onchange = async () => {
  const file = csvFile.files?.[0];
  csvFile.value = "";
  if (!file) return;
  const { added, skipped } = checklist.importCsv(await file.text());
  rerender();
  setStatus(`Importadas ${plural(added, "carta", "cartas")}`
    + (skipped ? ` · ${plural(skipped, "fila ignorada", "filas ignoradas")}` : ""));
};
$<HTMLButtonElement>("#export-csv").onclick = () => {
  if (!current) return;
  const csv = checklist.exportCsv(current.sel.items.map((it) => ({ key: it.key, name: it.spec.name })));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `checklist_${current.sel.file.replace(/^binder_/, "")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
};

// ---------------------------------------------------------------- PDF
pdfBtn.onclick = async () => {
  if (!current) return;
  const my = token;
  const { sel, visible, opts } = current;
  pdfBtn.disabled = true;
  try {
    // primero todas las imágenes (las de las hojas que aún no se han visto también)
    const jobs = visible.filter((it) => it.job);
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
      cards: visible.map(placed),
      blobOf,
      geometry: geometry(state.paper),
      opts,
      cutlines: state.cutlines,
      title: `${sel.title} — binder placeholders`,
      onProgress: (p, n) => { setStatus(`Generando PDF: hoja ${p}/${n}…`); setProgress(p, n); },
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sel.file}${state.hideOwned ? "_faltan" : ""}${state.bw ? "_bw" : ""}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    setStatus(`Listo: ${a.download} (${(blob.size / 1e6).toFixed(1)} MB)`);
  } catch (e) {
    setStatus(`Error al generar el PDF: ${e}`, true);
    console.error(e);
  } finally {
    setProgress(null);
    if (my === token) pdfBtn.disabled = !current?.visible.length;
  }
};

syncControls();
initSets(); // al terminar recalcula; el modo Pokédex no necesita esperar a las ediciones
if (state.mode === "dex") changed();
