// Migración del nombre antiguo (pokebinder → Placeholdr). Copia a las claves nuevas lo que
// este navegador tenía guardado (estado, checklist e idioma) y borra la caché de descargas
// antigua, que se vuelve a llenar sola. main.ts la importa la primera, para que corra antes
// de que checklist.ts o i18n.ts lean sus claves.
for (const k of ["state", "owned", "ui-lang"]) {
  try {
    const old = localStorage.getItem(`pokebinder:${k}`);
    if (old === null) continue;
    if (localStorage.getItem(`placeholdr:${k}`) === null) localStorage.setItem(`placeholdr:${k}`, old);
    localStorage.removeItem(`pokebinder:${k}`);
  } catch { /* modo privado */ }
}
globalThis.caches?.delete("pokebinder-v1").catch(() => {});
