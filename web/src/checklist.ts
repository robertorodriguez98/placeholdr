// Checklist: qué cartas tienes ya. Se guarda en este navegador (localStorage) y se puede
// exportar/importar como CSV para tener copia o pasarlo a otro equipo.
//
// Cada carta se identifica por "colección:número[:variante]":
//   me5:77          Combate Final de Gladio
//   me5:1:REVERSE   la copia reverse holo de Tropius (master set)
//   dex:25          Pikachu (modo Pokédex)

const KEY = "pokebinder:owned";

let owned: Set<string> = load();

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify([...owned])); } catch { /* modo privado */ }
}

/** "077" y "77" son la misma carta; "TG01" se deja tal cual. */
const norm = (n: string) => (/^\d+$/.test(n) ? String(parseInt(n, 10)) : n.toUpperCase());

export function cardKey(collection: string, number: string, variant?: string): string {
  return [collection.toLowerCase(), norm(number), ...(variant ? [variant] : [])].join(":");
}

export const has = (key: string) => owned.has(key);

export function toggle(key: string): boolean {
  if (owned.has(key)) owned.delete(key);
  else owned.add(key);
  save();
  return owned.has(key);
}

export function setMany(keys: string[], value: boolean) {
  for (const k of keys) {
    if (value) owned.add(k);
    else owned.delete(k);
  }
  save();
}

// ---------------------------------------------------------------- CSV
const HEADER = "coleccion,numero,variante,nombre";

const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV con las cartas que tienes de la selección actual (con nombre, para leerlo a gusto). */
export function exportCsv(rows: { key: string; name: string }[]): string {
  const lines = rows.filter((r) => owned.has(r.key)).map((r) => {
    const [coll, num, variant = ""] = r.key.split(":");
    return [coll, num, variant, r.name].map(cell).join(",");
  });
  return [HEADER, ...lines].join("\r\n") + "\r\n";
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Importa un CSV (coleccion,numero[,variante[,nombre]]), separado por comas, punto y coma o
 * tabuladores. Las filas que no se entienden se cuentan como ignoradas. Devuelve cuántas se
 * marcaron y cuántas se ignoraron.
 */
export function importCsv(text: string): { added: number; skipped: number } {
  let added = 0, skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, "").trim();
    if (!line) continue;
    const [coll, num, variant] = parseLine(line);
    if (!coll || !num || /^colecci/i.test(coll)) { if (!/^colecci/i.test(coll)) skipped++; continue; }
    const key = cardKey(coll, num, variant || undefined);
    if (!owned.has(key)) { owned.add(key); added++; }
  }
  save();
  return { added, skipped };
}
