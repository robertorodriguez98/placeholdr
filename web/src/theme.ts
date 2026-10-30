// Tema de la interfaz: "card" (la carta de Partidario, por defecto) o "retro" (web de 2003 al
// estilo Neocities/GeoCities). Es el atributo data-theme de <html>, guardado en localStorage.
// Solo cambia la interfaz: las cartas y el PDF son iguales en los dos temas.
export type Theme = "card" | "retro";

const KEY = "placeholdr:theme";
let theme: Theme = "card";
try {
  if (localStorage.getItem(KEY) === "retro") theme = "retro";
} catch { /* modo privado */ }
document.documentElement.dataset.theme = theme;

export const currentTheme = () => theme;

export function setTheme(next: Theme) {
  theme = next;
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(KEY, next); } catch { /* modo privado */ }
}

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
    if (theme !== "retro" || still.matches || e.pointerType !== "mouse") return;
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
