import "./migrate"; // la primera: pasa los datos guardados con el nombre antiguo
import { countVisit, startSparkles } from "./theme"; // antes de pintar
import "./style.css";
import "./retro.css";
import { LANGS, TYPE_COLORS, TYPE_ES, type Lang, type Paper } from "./config";
import {
  groupBySeries, loadSetCards, loadSets, loadTranslations, normNum, selectCards,
  type Collection, type Supertype, type TcgCard, type TcgSet,
} from "./data/tcg";
import { jaNameEn, loadJaCards, loadJaSets } from "./data/japan";
import { loadSpecies, parseIds, parseRange, selectSpecies, type DexSelection } from "./data/species";
import { extraCopies, loadVariants, type Variants } from "./data/variants";
import { ItemResolver, knownItems } from "./assets/items";
import { trainerSlug } from "./assets/busts";
import { artJob, blobOf, bustJob, itemJob, peek, resolve } from "./assets/store";
import * as checklist from "./checklist";
import { UI_LANGS, applyStatic, plural, setUiLang, t, uiLang, type UiLang } from "./i18n";
import type { CardSpec } from "./render/cards";
import { PER_PAGE, geometry } from "./render/layout";
import { cardInner, pageSvg, type PlacedCard } from "./render/page";
import type { CardStyle, RenderOpts } from "./render/svg";

// ---------------------------------------------------------------- estado
type Region = "intl" | "ja";

interface State {
  mode: "set" | "dex";
  region: Region;     // catálogo de ediciones: internacional o japonés
  setId: string;
  setIdJa: string;
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
  images: boolean;    // artwork, bustos e iconos de objeto; sin ellos, solo dibujos vectoriales
  cardStyle: CardStyle; // clásico (marco negro) o retro (ventana de Windows 98)
  hideOwned: boolean; // checklist: imprimir solo las que faltan
}

const DEFAULTS: State = {
  mode: "set", region: "intl", setId: "", setIdJa: "", only: ["pokemon", "trainer", "energy"], collection: "complete",
  dexBy: "gen", gens: [1], range: "1-151", ids: "", lang: uiLang, paper: "a4", bw: false,
  cutlines: true, frame: false, images: true, cardStyle: "retro", hideOwned: false,
};
const STORE_KEY = "placeholdr:state";

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

function setStatus(msg: string, error = false) {
  status.textContent = msg;
  status.classList.toggle("error", error);
}
function setProgress(done: number | null, total = 1) {
  progress.hidden = done === null;
  if (done !== null) (progress.firstElementChild as HTMLElement).style.width = `${(100 * done) / total}%`;
}

// idioma de la interfaz: al cambiarlo se traducen los textos fijos y se rehace la selección
// (nombres de colección, recuentos, sello...). No toca el idioma de las cartas.
const uiLangBox = $<HTMLElement>(".ui-lang");
uiLangBox.innerHTML = Object.entries(UI_LANGS).map(([k, v]) =>
  `<button role="radio" data-lang="${k}" aria-checked="${k === uiLang}">${v}</button>`).join("");
uiLangBox.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
  b.onclick = () => {
    if (b.dataset.lang === uiLang) return;
    setUiLang(b.dataset.lang as UiLang);
    uiLangBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    changed();
  };
});
applyStatic();

// diálogos (guía de uso y legal): se cierran con su botón, Esc o un clic fuera
const guide = $<HTMLDialogElement>("#guide");
const legal = $<HTMLDialogElement>("#legal");
$<HTMLButtonElement>("#guide-open").onclick = () => guide.showModal();
$<HTMLButtonElement>("#legal-open").onclick = () => legal.showModal();
for (const d of [guide, legal]) d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
// web retro: contador de visitas de este navegador y estrellitas tras el ratón
$("#visits").textContent = String(countVisit()).padStart(6, "0");
startSparkles();

// versión al pie: la de package.json y el commit compilado, que enlaza a GitHub
const version = $<HTMLAnchorElement>("#version");
version.textContent = `v${__APP_VERSION__}${__APP_COMMIT__ ? ` · ${__APP_COMMIT__}` : ""}`;
if (__APP_COMMIT__) version.href = `https://github.com/robertorodriguez98/placeholdr/commit/${__APP_COMMIT__}`;
// el correo de contacto se monta aquí para que no aparezca entero en el HTML (bots de spam)
const mail = ["contact", "placeholdr.org"].join("@");
Object.assign($<HTMLAnchorElement>("#contact-mail"), { href: `mailto:${mail}`, textContent: mail });

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
const styleRadios = [...document.querySelectorAll<HTMLInputElement>('input[name="card-style"]')];
styleRadios.forEach((r) => { r.onchange = () => { state.cardStyle = r.value as CardStyle; changed(); }; });
const imagesChk = $<HTMLInputElement>("#images");
imagesChk.onchange = () => { state.images = imagesChk.checked; changed(); };
const hideChk = $<HTMLInputElement>("#hide-owned");
hideChk.onchange = () => { state.hideOwned = hideChk.checked; saveState(); rerender(); };

setSelect.onchange = () => {
  if (state.region === "ja") state.setIdJa = setSelect.value;
  else state.setId = setSelect.value;
  changed();
};
const regionRadios = [...document.querySelectorAll<HTMLInputElement>('input[name="region"]')];
regionRadios.forEach((r) => { r.onchange = () => { state.region = r.value as Region; changed(); }; });
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
  imagesChk.checked = state.images;
  styleRadios.forEach((r) => (r.checked = r.value === state.cardStyle));
  hideChk.checked = state.hideOwned;
  regionRadios.forEach((r) => (r.checked = r.value === state.region));
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
// Listas de ediciones por catálogo; la japonesa se carga la primera vez que se elige Japón.
const setLists: Partial<Record<Region, Promise<TcgSet[]>>> = {};
let shownRegion: Region | null = null; // catálogo que hay ahora en el desplegable

async function setsFor(region: Region): Promise<TcgSet[]> {
  const p = setLists[region] ??= region === "ja" ? loadJaSets() : loadSets();
  p.catch(() => delete setLists[region]); // si falla, se reintenta en el próximo cambio
  return p;
}

/** Rellena el desplegable con las ediciones del catálogo y devuelve la elegida. */
function showSets(region: Region, sets: TcgSet[]): TcgSet {
  if (shownRegion !== region) {
    setSelect.innerHTML = groupBySeries(sets).map(([series, list]) =>
      `<optgroup label="${esc(series)}">${list.map((s) => s.tcgdexId
        ? `<option value="${s.id}">${esc(s.name)} · ${esc(s.tcgdexId)}</option>`
        : `<option value="${s.id}">${esc(s.name)} · ${s.releaseDate.slice(0, 4)} · ${s.ptcgoCode ?? s.id}</option>`,
      ).join("")}</optgroup>`).join("");
    shownRegion = region;
  }
  const key = region === "ja" ? "setIdJa" : "setId";
  if (!sets.some((s) => s.id === state[key])) { state[key] = groupBySeries(sets)[0][1][0].id; saveState(); }
  setSelect.value = state[key];
  setSelect.disabled = false;
  return sets.find((s) => s.id === state[key])!;
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
  let sets: TcgSet[];
  try {
    if (shownRegion !== state.region) { setSelect.disabled = true; setStatus(t("set.loading")); }
    sets = await setsFor(state.region);
  } catch (e) {
    setStatus(t("err.sets", { e: String(e) }), true);
    return null;
  }
  if (my !== token) return null;
  const set = showSets(state.region, sets);
  setStatus(t("loading", { name: set.name }));
  const ja = !!set.tcgdexId;
  let cards: TcgCard[], tr: Awaited<ReturnType<typeof loadTranslations>> = null;
  let variants = new Map<string, Variants>();
  const known = knownItems();
  if (ja) { // nombres en japonés; las variantes vienen en las mismas fichas
    ({ cards, variants } = await loadJaCards(set, (d, n) => {
      if (my === token) { setStatus(t("ja.cards", { d, t: n })); setProgress(d, n); }
    }));
    setProgress(null);
    if (!cards.length) throw new Error(t("ja.empty"));
  } else {
    [cards, tr] = await Promise.all([loadSetCards(set.id), loadTranslations(set, state.lang).catch(() => null)]);
  }
  if (!ja && state.collection === "master") {
    variants = await loadVariants(set, (d, n) => {
      if (my === token) { setStatus(t("variants", { d, t: n })); setProgress(d, n); }
    });
    setProgress(null);
  }
  const sel = selectCards(set, cards, { only: state.only, collection: state.collection },
    tr?.names ?? null, (c) => extraCopies(variants.get(normNum(c.number)), state.lang));
  if (ja) sel.forEach((c) => (c.nameEn = jaNameEn(c)));
  const bw = state.bw, es = state.lang === "es";
  const icons = new ItemResolver(await known);
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
          dex,
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
      // los bustos se buscan por el nombre del personaje en inglés/español: no hay en japonés
      job: subtypes.includes("Supporter") && !ja
        ? bustJob(c.nameEn, c.name, trainerSlug(c.nameEn), slug, bw)
        : itemJob(slug, bw),
    };
  });
  const coll = t(`coll.name.${state.collection}`);
  const name = tr?.setName ?? set.name;
  return {
    kicker: `${ja ? "JP · " + set.tcgdexId : set.ptcgoCode ?? set.id.toUpperCase()} · /${String(set.printedTotal).padStart(3, "0")}`,
    name: `${name} · ${coll}`,
    title: `${name} (${set.id}) · ${coll}`,
    file: `binder_${set.id}${state.collection === "complete" ? "" : "_" + state.collection}`,
    items,
  };
}

async function dexSelection(): Promise<Selection> {
  setStatus(t("dex.loading"));
  const all = await loadSpecies(state.lang);
  let sel: DexSelection, file: string, name: string;
  const pad = (n: number) => String(n).padStart(4, "0");
  if (state.dexBy === "gen") {
    sel = { by: "gen", gens: state.gens };
    file = `binder_gen${state.gens.join("-")}`;
    name = state.gens.length ? t("dex.gen", { g: state.gens.join(", ") }) : t("dex.noGen");
  } else if (state.dexBy === "range") {
    const r = parseRange(state.range);
    if (!r) throw new Error(t("dex.badRange"));
    sel = { by: "range", from: r[0], to: r[1] };
    file = `binder_${pad(r[0])}-${pad(r[1])}`;
    name = `#${pad(r[0])} – #${pad(r[1])}`;
  } else {
    sel = { by: "ids", ids: parseIds(state.ids) };
    file = "binder_custom";
    name = t("dex.custom");
  }
  return {
    kicker: "POKÉDEX",
    name,
    title: t("dex.title", { name }),
    file,
    items: selectSpecies(all, sel).map((p) => ({
      key: checklist.cardKey("dex", String(p.id)),
      spec: {
        type: "pokemon", name: p.name, number: `#${pad(p.id)}`,
        topLeft: `GEN ${p.gen}`, topLeftColor: [0, 0, 0], dex: p.id,
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
    // sin imágenes no se descarga nada: las cartas usan sus dibujos vectoriales
    if (!state.images) sel.items.forEach((it) => delete it.job);
    current = { sel, visible: [], opts: { bw: state.bw, lang: state.lang, frame: state.frame, style: state.cardStyle } };
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
  $("#owned-of").textContent = t("tally.of", { n: total });
  $("#owned-pct").textContent = uiLang === "es" ? `${pct} %` : `${pct}%`;
  $("#owned-bar").style.width = `${pct}%`;
  const pages = Math.ceil(visible.length / PER_PAGE);
  $("#stage-pills").innerHTML =
    `<span>${plural(visible.length, "card", "cards")}</span>`
    + `<span>${plural(pages, "sheet", "sheets")}</span>`
    + (have ? `<span class="green">✓ ${have}/${total}</span>` : "");
  setStatus(visible.length
    ? t("toPrint", { cards: plural(visible.length, "card", "cards"), sheets: plural(pages, "sheet", "sheets") })
    : total ? t("allOwned") : t("noCards"));
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
      ? `<p class="empty"><strong>${t("empty.complete")}</strong>${t("empty.complete.sub")}</p>`
      : `<p class="empty"><strong>${t("empty.none")}</strong>${t("empty.none.sub")}</p>`;
    return;
  }
  const g = geometry(state.paper);
  const pages = Math.ceil(visible.length / PER_PAGE);
  let html = "";
  for (let p = 0; p < pages; p++) {
    const cards = visible.slice(p * PER_PAGE, (p + 1) * PER_PAGE).map((it, k) => placed(it, p * PER_PAGE + k));
    html += `<div class="sheet" data-page="${p}" style="--n:${Math.min(p, 8)}">`
      + `<div class="retro-only sheet-bar"><span>📄 ${esc(sel.file)}_${String(p + 1).padStart(2, "0")}.pdf</span>`
      + `<span class="wbtns" aria-hidden="true"><i>_</i><i>□</i><i>×</i></span></div>`
      + pageSvg(g, cards, opts, { cutlines: state.cutlines, preview: true })
      + `<span class="label">${t("sheetLabel", { p: p + 1, n: pages })}</span></div>`;
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
  setStatus(t("imported", { cards: plural(added, "card", "cards") })
    + (skipped ? ` · ${plural(skipped, "row.skipped", "rows.skipped")}` : ""));
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
    setStatus(t("pdf.images"));
    setProgress(0, jobs.length);
    await Promise.all(jobs.map((it) => resolve(it.job!.key, it.job!.load).then(() => {
      setProgress(++done, jobs.length);
      setStatus(t("pdf.imagesN", { d: done, t: jobs.length }));
    })));
    if (my !== token) return;
    const { buildPdf } = await import("./pdf"); // svg2pdf solo se carga al exportar
    const blob = await buildPdf({
      cards: visible.map(placed),
      blobOf,
      geometry: geometry(state.paper),
      opts,
      cutlines: state.cutlines,
      cjk: state.mode === "set" && state.region === "ja",
      title: `${sel.title} — binder placeholders`,
      onProgress: (p, n) => { setStatus(t("pdf.page", { p, n })); setProgress(p, n); },
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sel.file}${state.hideOwned ? "_" + t("file.missing") : ""}`
      + `${state.images ? "" : "_" + t("file.noImages")}${state.bw ? "_bw" : ""}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    setStatus(t("pdf.done", { file: a.download, mb: (blob.size / 1e6).toFixed(1) }));
  } catch (e) {
    setStatus(t("pdf.error", { e: String(e) }), true);
    console.error(e);
  } finally {
    setProgress(null);
    if (my === token) pdfBtn.disabled = !current?.visible.length;
  }
};

changed(); // carga las ediciones del catálogo elegido (o la Pokédex) y dibuja
