// Tema de la interfaz: la web de 2003 al estilo Neocities/GeoCities (retro.css), que es el
// único. El diseño anterior (la carta de Partidario) sigue entero en style.css, que es la base
// del retro: para recuperarlo basta con poner THEME = "card" (el atributo data-theme de <html>
// deja de ser "retro" y no se aplica nada de retro.css).
export type Theme = "card" | "retro";

const THEME: Theme = "retro";
document.documentElement.dataset.theme = THEME;
try { localStorage.removeItem("placeholdr:theme"); } catch { /* lo guardaba el botón ★, ya quitado */ }

export const currentTheme = () => THEME;

/** Visitas desde este navegador (una por sesión). Es un contador real, no uno inventado. */
export function countVisit(): number {
  try {
    let n = Number(localStorage.getItem("placeholdr:visits")) || 0;
    if (!sessionStorage.getItem("placeholdr:visited")) {
      localStorage.setItem("placeholdr:visits", String(++n));
      sessionStorage.setItem("placeholdr:visited", "1");
    }
    return Math.max(n, 1);
  } catch {
    return 1;
  }
}

/** Estrellitas que siguen al ratón en el tema retro (no con pantalla táctil ni movimiento reducido). */
export function startSparkles() {
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let last = 0;
  document.addEventListener("pointermove", (e) => {
    if (THEME !== "retro" || still.matches || e.pointerType !== "mouse") return;
    const now = performance.now();
    if (now - last < 45) return;
    last = now;
    const s = document.createElement("span");
    s.className = "sparkle";
    s.textContent = "✦✧★⋆"[Math.floor(Math.random() * 4)];
    s.style.left = `${e.clientX + 6}px`;
    s.style.top = `${e.clientY + 6}px`;
    s.style.color = `hsl(${Math.floor(Math.random() * 360)} 100% 60%)`;
    s.addEventListener("animationend", () => s.remove());
    document.body.appendChild(s);
  });
}
