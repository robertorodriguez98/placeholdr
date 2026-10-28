import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0", // accesible desde fuera del contenedor de desarrollo
    port: 5173,
    // bustos.json vive en la raíz del repo (lo comparte el CLI congelado)
    fs: { allow: [".."] },
    watch: { usePolling: true }, // los bind mounts de Windows no emiten eventos de cambio
  },
});
