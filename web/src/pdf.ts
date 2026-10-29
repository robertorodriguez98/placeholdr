// Exportación a PDF en el navegador: cada hoja se dibuja con el mismo SVG que la vista previa
// y svg2pdf.js lo convierte en vectores dentro de jsPDF.
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import type { Asset } from "./render/cards";
import { PER_PAGE, type PageGeometry } from "./render/layout";
import { pageSvg, type PlacedCard } from "./render/page";
import { CJK_FAMILY, type RenderOpts } from "./render/svg";
import { fetchBlob } from "./data/fetch";
import { CJK_FONT } from "./data/sources";

const dataUrls = new Map<string, Promise<string>>();

/** Las URL de objeto (blob:) solo existen en esta página: en el PDF van como data URL. */
function toDataUrl(href: string, blob: Blob): Promise<string> {
  let p = dataUrls.get(href);
  if (!p) {
    p = new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = () => ko(r.error);
      r.readAsDataURL(blob);
    });
    dataUrls.set(href, p);
  }
  return p;
}

export interface PdfJob {
  cards: PlacedCard[];
  blobOf: (asset: Asset) => Blob | undefined;
  geometry: PageGeometry;
  opts: RenderOpts;
  cutlines: boolean;
  title: string;
  cjk: boolean; // hay texto japonés: se incrusta M PLUS 1p
  onProgress?: (page: number, pages: number) => void;
}

/** Registra M PLUS 1p en el documento (jsPDF solo admite TrueType, en base64). */
async function addCjkFont(doc: jsPDF) {
  const bytes = new Uint8Array(await (await fetchBlob(CJK_FONT)).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  doc.addFileToVFS("MPLUS1p-Bold.ttf", btoa(bin));
  doc.addFont("MPLUS1p-Bold.ttf", CJK_FAMILY, "bold");
}

export async function buildPdf(job: PdfJob): Promise<Blob> {
  const g = job.geometry;
  const doc = new jsPDF({ unit: "mm", format: [g.pw, g.ph], orientation: "portrait", compress: true });
  doc.setProperties({ title: job.title, creator: "Placeholdr" });
  if (job.cjk) await addCjkFont(doc);
  const cards = await Promise.all(job.cards.map(async (c) => {
    if (!("href" in c.asset)) return c;
    const blob = job.blobOf(c.asset);
    return blob ? { ...c, asset: { ...c.asset, href: await toDataUrl(c.asset.href, blob) } } : c;
  }));
  // svg2pdf necesita el SVG en el documento para resolver estilos y clipPath
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden";
  document.body.append(host);
  try {
    const pages = Math.ceil(cards.length / PER_PAGE);
    for (let p = 0; p < pages; p++) {
      job.onProgress?.(p + 1, pages);
      if (p > 0) doc.addPage([g.pw, g.ph], "portrait");
      host.innerHTML = pageSvg(g, cards.slice(p * PER_PAGE, (p + 1) * PER_PAGE), job.opts,
        { cutlines: job.cutlines, preview: false });
      await doc.svg(host.firstElementChild as SVGSVGElement, { x: 0, y: 0, width: g.pw, height: g.ph });
      await new Promise((ok) => setTimeout(ok)); // deja respirar a la interfaz entre hojas
    }
  } finally {
    host.remove();
  }
  return doc.output("blob");
}
