import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// versión que se muestra al pie de la web: la de package.json y el commit compilado.
// Cloudflare Pages da el commit en CF_PAGES_COMMIT_SHA; en local se pregunta a git, y en
// Docker (sin .git) se queda vacío.
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
function commit(): string {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return ""; }
}

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit()),
  },
  server: {
    host: "0.0.0.0", // accesible desde fuera del contenedor de desarrollo
    port: 5173,
    // bustos.json vive en la raíz del repo (lo comparte el CLI congelado)
    fs: { allow: [".."] },
    watch: { usePolling: true }, // los bind mounts de Windows no emiten eventos de cambio
  },
});
