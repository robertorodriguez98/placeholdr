// Iconos en pixel art para el estilo de carta retro cuando no hay imagen (modo sin imágenes o
// sin icono): cada sprite es una rejilla de caracteres que se pinta con rectángulos.
//   k contorno negro · c color del tipo/subtipo · l color aclarado · w blanco
//   r g b rojo, verde y azul del icono de "imagen rota"
import type { RGB } from "../config";
import { css, mix, num as f } from "./svg";

const SPRITES: Record<string, string[]> = {
  person: [ // Partidario
    "....kkkk....",
    "...kcllck...",
    "...kclcck...",
    "...kcccck...",
    "....kkkk....",
    "....kcck....",
    "..kkkkkkkk..",
    ".kclcccccck.",
    "kclcccccccck",
    "kcccccccccck",
    "kcccccccccck",
    "kkkkkkkkkkkk",
  ],
  capsule: [ // Objeto
    "............",
    "............",
    "............",
    "..kkkkkkkk..",
    ".kcllckwwwk.",
    "kclccckwwwwk",
    "kccccckwwwwk",
    "kccccckwwwwk",
    ".kccccklwwk.",
    "..kkkkkkkk..",
    "............",
    "............",
  ],
  wrench: [ // Herramienta
    "...kk..kk...",
    "..kck..kck..",
    "..kcckkcck..",
    "..kcccccck..",
    "...kcccck...",
    "....kcck....",
    "....kclk....",
    "....kcck....",
    "....kclk....",
    "....kcck....",
    "....kcck....",
    ".....kk.....",
  ],
  stadium: [ // Estadio
    ".....k......",
    ".....kcc....",
    ".....kccc...",
    ".....k......",
    "..kkkkkkkk..",
    ".kwwwwwwwwk.",
    "kclllllllllk",
    "kcccccccccck",
    "kckkckkckkck",
    "kcccccccccck",
    "kcccccccccck",
    "kkkkkkkkkkkk",
  ],
  gem: [ // Energía
    "............",
    "...kkkkkk...",
    "..kwlllllk..",
    ".kwllccccck.",
    "kkkkkkkkkkkk",
    ".kcccccccck.",
    "..kcccccck..",
    "...kcccck...",
    "....kcck....",
    ".....kk.....",
    "............",
    "............",
  ],
  broken: [ // "imagen rota" de los navegadores antiguos
    "kkkkkkkk..",
    "kwwwwwwk..",
    "kwrrwwwkk.",
    "kwrrwbbwk.",
    "kwwwwbbwk.",
    "kwggwwwwk.",
    "kwggwwk...",
    "kwwwwk....",
    "kkkkk.....",
    "..........",
  ],
};

/**
 * Sprite centrado en (cx, cy) con lado `size` mm. Cada fila se pinta por tramos del mismo color,
 * un poco solapados para que no se vean costuras entre píxeles al imprimir.
 */
export function pixelIcon(name: string, cx: number, cy: number, size: number, col: RGB, bw: boolean): string {
  const rows = SPRITES[name] ?? SPRITES.capsule;
  const n = rows[0].length, px = size / n;
  const x0 = cx - size / 2, y0 = cy - size / 2;
  const c = bw ? mix(col, 0.75) : col;
  const palette: Record<string, string> = {
    k: "#000", c: css(c), l: css(mix(c, 0.5)), w: "#fff",
    r: bw ? "#777" : "#e00", g: bw ? "#999" : "#0a0", b: bw ? "#555" : "#00c",
  };
  let svg = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < n;) {
      const ch = row[x];
      let end = x + 1;
      while (end < n && row[end] === ch) end++;
      if (ch !== ".") {
        svg += `<rect x="${f(x0 + x * px)}" y="${f(y0 + y * px)}" width="${f((end - x) * px + 0.03)}" `
          + `height="${f(px + 0.03)}" fill="${palette[ch]}"/>`;
      }
      x = end;
    }
  });
  return svg;
}
