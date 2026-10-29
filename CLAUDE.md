# Placeholdr — handover

**Placeholdr** (antes *pokebinder*; se renombró para no usar la marca "Poké" en el nombre) es un
generador de **placeholders imprimibles (PDF)** para un binder de Pokémon TCG: tarjetas de
63×88 mm (tamaño carta TCG), 9 por página A4 (3×3) con líneas de corte, pensadas para meter
en los bolsillos del binder mientras falta la carta real.

Es una aplicación web (`web/`) en TypeScript + Vite, sin framework, que se ejecuta **entera en
el navegador**: descargas, recortes, vista previa y PDF. El servidor solo sirve ficheros
estáticos. Empezó como un CLI en Python (`pokebinder.py`), del que se portó el diseño; se borró
del repo antes de hacerlo público (sigue en el historial de git: `git log --all -- pokebinder.py`).

Los comentarios del código y los mensajes de commit están en español. La interfaz de la web
está en inglés por defecto, con español como alternativa (`src/i18n.ts`). Se trabaja con una
rama y un pull request por cambio (`gh pr create` / `gh pr merge --merge --delete-branch`).
Las notas personales del mantenedor y de su equipo van en `CLAUDE.local.md`, que no se sube
al repo.

---

## Aplicación web (`web/`)

### Estado
Completa: las fases 1 a 5 están hechas (PR #2), y además el checklist y el rediseño (PR #3). Se ha probado en Chrome con Pitch Black:
120 cartas en 14 hojas, el master set (194 cartas) y el PDF (9.3 MB, 16 s). El resultado
reproduce el diseño del CLI.

- **Vista previa:** hojas 3×3 con exactamente el mismo SVG que el PDF. Los "bolsillos" del
  binder solo se ven en pantalla y marcan los huecos libres. Las imágenes se cargan al acercarse
  cada hoja a la pantalla (`IntersectionObserver`) y cada carta se redibuja al recibir la suya.
- **Colección** (modo Edición):
  - *Set base*: solo la numeración impresa, sin secretas.
  - *Set completo*: todas las cartas.
  - *Master set*: el completo más una copia por variante (`REVERSE`, `1ª EDICIÓN`). La copia
    va justo detrás de su carta, con una etiqueta gris encima del número. Las variantes salen
    de la ficha de cada carta en TCGdex (`/v2/en/cards/{id}`, 8 a la vez y cacheadas): el
    GraphQL de TCGdex devuelve `variants: null`. TCGdex **no** modela los patrones Poké
    Ball/Master Ball de algunas ediciones.
- **Sets japoneses** (selector "Catálogo": Internacional / Japón): salen de la API de TCGdex
  en japonés (`src/data/japan.ts`), con los **nombres en japonés**. La lista se arma por series
  (`/ja/series` + `/ja/series/{id}`): TCGdex no da la fecha de cada set, así que se ordenan
  dentro de la serie por número (M6a, M6, M5... y luego barajas y promos). El listado de un
  set solo trae nombres, así que se pide la ficha de cada carta (8 a la vez, con caché) y se
  convierte a `TcgCard`:
  - la rareza se normaliza ("Double rare" → "Double Rare"; "None" = sin rareza);
  - "Tool" pasa a "Pokémon Tool";
  - el tipo de las energías sale del kanji del nombre (炎 Fuego, 水 Agua, 鋼 Metal...);
  - a muchos Pokémon les falta `dexId` (マンムーex...): se deduce buscando el nombre japonés de
    especie más largo de PokeAPI (idiomas 1 y 11) contenido en el de la carta;
  - las insignias ex/MEGA ex se sacan del nombre (`jaNameEn`).

  Los ids llevan el prefijo `ja-` (`ja-M4`) para no chocar con los internacionales en el
  checklist (`ja-m4:1`). Los Partidarios japoneses no buscan busto, porque WikiDex se busca por
  el nombre en inglés o español, y usan su objeto. Las etiquetas (tipo, ENTRENADOR...) siguen
  el idioma de las cartas. **Fuente:** M PLUS 1p Bold (OFL, TrueType, 1,8 MB) desde jsDelivr,
  fijada a un commit de google/fonts (`CJK_FONT`). Cubre todos los caracteres de los 13.006
  nombres de TCGdex. Va como `@font-face` para la vista previa y `addCjkFont` la incrusta en el
  PDF. `text()` solo la usa en los textos con kana o kanji, y `textWidth` mide esos caracteres
  como un cuadratín. Verificado: M4 da 120 cartas en 14 hojas, el PDF ocupa 8,9 MB y el texto
  japonés se puede extraer. **Chino simplificado:** TCGdex lista los sets de China continental,
  pero casi todos sin cartas (8 de 57). Chino tradicional: completo hasta SV10 (mayo de 2025).
  No están en la app.
- **Checklist:** al hacer clic en una carta de la vista previa se marca como tuya y aparece el
  sello verde "LA TENGO", que solo se ve en pantalla. Con "Imprimir solo las que faltan" se
  quitan de la vista previa y del PDF; el fichero se llama `*_faltan.pdf`. Cada carta se
  identifica como `coleccion:numero[:variante]` (`me5:77`, `me5:1:REVERSE`, `dex:25`). Las
  marcas se guardan en `localStorage` (`placeholdr:owned`) y se pueden exportar o importar en
  CSV: `coleccion,numero,variante,nombre`, separado por comas, punto y coma o tabuladores.
  Hay botones para marcar o desmarcar todas las cartas de la selección. Está en `src/checklist.ts`.
- **Apariencia:** la interfaz imita una carta de Partidario. El panel lateral es la propia
  carta: marco negro, banda naranja con la pastilla "PLACEHOLDR" y el selector EN/ES, rayas, título subrayado y un
  medallón con un binder. Los títulos de sección son pastillas negras, como el número de
  colección, y los botones tienen sombra dura. La vista previa va sobre una "tapa de binder"
  oscura, con una barra naranja fija y las hojas de dos en dos, como un binder abierto. Los
  colores están en variables CSS, todos sacados del diseño de las cartas (`--orange`,
  `--stripe`, `--green` del Estadio, `--gold` de las rarezas).
- **Cartas juntas:** van pegadas, sin hueco, así cada corte separa dos a la vez (8 cortes por
  hoja en vez de 12) y no quedan tiras sueltas. Es el único modo: el hueco de 2 mm del CLI se
  quitó porque no aportaba nada (el margen de error ya lo da la banda negra de los bordes). Las
  hojas no cambian: en A4 y Carta solo caben 3×3 cartas de 63×88 mm. Las guías (con "Líneas de
  corte") van encima de las cartas: marcas en el margen en la prolongación de cada corte y,
  según el marco, una línea blanca fina en el centro de la banda negra entre dos cartas o una
  discontinua gris oscura por el borde. Está en `src/render/layout.ts`.
- **Bordes negros** (interruptor en "Impresión", desactivado por defecto; por defecto solo están
  activadas "Líneas de corte" e "Imágenes"): sin ellos, `cardFrame` no
  dibuja el marco y el fondo de la carta (rayas y banda de los Entrenadores incluidas) llega
  hasta el borde, que se recorta por la discontinua. Va en `RenderOpts.frame`.
- **Nombre y aviso legal:** el nombre no lleva "Poké" ni "Pokémon" para no usar la marca como
  propia; "Pokémon" solo aparece de forma descriptiva (título de la pestaña: "Placeholdr ·
  Binder placeholders for Pokémon TCG cards"; titular del panel: "Fill the gaps in your
  Pokémon TCG binder"). Al pie de la vista previa va el aviso de proyecto de fans sin relación
  con Nintendo, Creatures, GAME FREAK ni The Pokémon Company (clave `legal`). Nada de imitar el
  logo ni la tipografía de Pokémon. `src/migrate.ts` copia las claves antiguas `pokebinder:*`
  a `placeholdr:*` y borra la caché `pokebinder-v1`.
- **Guía de uso:** botón "?" en la banda, que abre un `<dialog>` con forma de carta de
  Partidario y 6 pasos: qué imprimir, checklist, impresión, imprimir al 100 % ("tamaño
  real", nunca "ajustar a la página"), recortar y al binder. Los textos son las claves
  `guide.*` de `i18n.ts`.
- **Legal, privacidad y créditos:** botón al pie de la vista previa que abre otro `<dialog>`
  como el de la guía (claves `legalpage.*` y `credits.*`). Incluye: proyecto de fans no oficial
  y que las imágenes son de sus dueños (las carga el navegador, Placeholdr no las aloja);
  uso personal y no comercial; contacto para titulares de derechos (`contact@placeholdr.org`,
  que `main.ts` monta en tiempo de ejecución para que no esté entero en el HTML; Email Routing
  de Cloudflare lo reenvía a un Gmail personal); privacidad
  (sin cookies ni analítica, `localStorage`, y a qué servicios se conecta el navegador); y
  créditos con licencias (pokemon-tcg-data, que no declara licencia; TCGdex, MIT; PokeAPI,
  BSD-3 en datos e imágenes de Nintendo; WikiDex; M PLUS 1p, OFL; jsPDF y svg2pdf.js, MIT).
  Si se añade una fuente de datos nueva, hay que añadirla a créditos y a privacidad.
- **Licencia y README:** el código es **AGPL-3.0-only** (`LICENSE`, campo `license` de
  `web/package.json`): quien publique una versión modificada, también como web, tiene que
  publicar su código con la misma licencia. No cubre los datos ni las imágenes de las fuentes.
  El `README.md` (en inglés) resume qué es, cómo ejecutarlo, créditos, aviso legal, licencia y
  Ko-fi; si cambian las fuentes o las funciones, hay que actualizarlo junto con la página legal.
  Los commits usan el correo noreply de GitHub (el historial se reescribió el 2026-10-29 para
  quitar el Gmail personal).
- **Donaciones:** Ko-fi (`https://ko-fi.com/krowno16`), solo para pagar el dominio y el
  servidor. Son enlaces normales, sin el widget de Ko-fi, para no cargar scripts de terceros
  que rastreen. Son pastillas con borde y sombra dura (`.donate`, `.kofi`): una bajo "Descargar
  PDF", un bloque con texto y botón naranja al pie de la vista previa, y otra en la guía y en la
  página legal (con el texto corto `donate.cta`, que no se parte en móvil). La herramienta es
  gratis entera: nada de funciones a cambio de donar.
- **Sin imágenes** (interruptor "Imágenes" en "Impresión", `state.images`): al desactivarlo,
  `update()` quita el `job` de cada carta, así que no se descarga nada y todas usan su dibujo
  vectorial: Entrenadores con `vectorIcon`, Energías con el orbe y su estrella, y Pokémon con
  `dexBadge` (círculo del color del tipo con el número de la Pokédex; `PokemonSpec.dex`). El PDF
  lleva el sufijo `_no-images`/`_sin-imagenes`, pesa ~0,1 MB y sale en un segundo. Sirve para
  ahorrar tinta y como plan B legal si algún día hubiera que dejar de mostrar imágenes de terceros.
- **Versión:** al pie de la vista previa, junto a "Legal". `vite.config.ts` inyecta
  `__APP_VERSION__` (de `package.json`) y `__APP_COMMIT__` (de `CF_PAGES_COMMIT_SHA` en Cloudflare
  Pages o de `git`; vacío en Docker y en el contenedor de desarrollo, que no tienen git). Si hay
  commit, enlaza a él en GitHub. Al publicar algo notable, subir la versión de `package.json`
  (y `package-lock.json`). La 1.0.0 es la del lanzamiento.
- **Móvil** (≤ 820 px): el panel va encima de la vista previa con la cabecera compacta, y el
  pie del panel (botón del PDF y estado) queda fijo abajo para descargar sin volver a subir; el
  donativo de esa barra se oculta porque está al pie. Los campos usan 16 px para que iOS no
  amplíe al enfocarlos. Los textos dicen "haz clic o toca". Probado a 390 px sin scroll horizontal.
- **Pantallas bajas de ordenador** (> 820 px de ancho y ≤ 860 px de alto, p. ej. 1366×768 o
  1280×720): cabecera del panel en una fila y pie más compacto; entre 821 y 1100 px de ancho el
  panel mide 300 px. Probado a 1440×900, 1366×768, 1280×720 y 1024×600. **Ojo con el panel:** es
  `overflow: clip` (no `hidden`) y `.switch` es `position: relative`. Antes, las casillas ocultas
  de los interruptores se colocaban respecto al panel; al hacer clic en uno, el navegador
  desplazaba el panel entero para enseñar la casilla y quedaba movido (el botón del PDF a media
  altura y un hueco debajo). Cualquier `position: absolute` nuevo dentro del panel necesita un
  contenedor con `position: relative`.
- **Idioma de la interfaz:** pastilla EN/ES a la derecha de la banda naranja. Por defecto, inglés. La
  elección se guarda en `localStorage` (`placeholdr:ui-lang`), igual que el resto del estado;
  no hace falta una cookie porque no hay servidor que tenga que leerla. Es **independiente del
  idioma de las cartas** (selector "Idioma de las cartas", con es/en/fr/de/it), que es lo que
  sale impreso; ese, en la primera visita, toma el idioma de la interfaz. Los textos están en
  `STRINGS` de `src/i18n.ts`: en el HTML se marcan con `data-i18n` (texto), `data-i18n-title`
  y `data-i18n-aria`, y en el código se piden con `t("clave", {param})` y `plural(n, "card",
  "cards")`. El sello "LA TENGO"/"GOT IT" va en el idioma de la interfaz porque solo se ve en
  pantalla. El CSV del checklist mantiene la cabecera en español; al importar se aceptan
  `coleccion` y `collection`. Para añadir un idioma: una entrada en `UI_LANGS` y su bloque en
  `STRINGS` (TypeScript avisa si falta alguna clave).
- **PDF:** botón "Descargar PDF". Primero resuelve todas las imágenes y después convierte cada
  hoja con `svg2pdf.js`, que se carga solo al exportar. Las URL `blob:` pasan a data URL.
- **Producción: Cloudflare Pages** (dominio `placeholdr.org`, registrado en Cloudflare). Pages
  compila cada push a `main` con raíz `web`, comando `npm run build` y salida `dist`
  (variable `NODE_VERSION=22`). `web/public/_headers` añade las cabeceras de seguridad: una CSP
  que solo deja ejecutar scripts propios y conectar con las fuentes de datos
  (raw.githubusercontent.com, api.tcgdex.net, cdn.jsdelivr.net, www.wikidex.net,
  images.wikidexcdn.net). **Si se añade una fuente nueva, o una `"url"` de otro dominio en
  `bustos.json`, hay que añadirla a `connect-src`**, o el navegador la bloqueará. Probado
  sirviendo `dist` con esas cabeceras: carga, sets japoneses con su fuente, WikiDex y PDF sin
  ninguna violación. La analítica de Cloudflare debe seguir desactivada (la página legal dice
  "sin analítica" y menciona Cloudflare Pages en privacidad). El correo `contact@placeholdr.org`
  va por Email Routing de Cloudflare.
- **Docker** (alternativa para un VPS, sin las cabeceras de `_headers`): `docker compose up -d --build` → http://localhost:8080. La imagen es multi-etapa
  (`node:22-alpine` compila y `nginx:1.27-alpine` sirve) y ocupa unos 75 MB. nginx **solo sirve
  los ficheros de la web**: no hace de proxy ni guarda imágenes de terceros.
- **Sin Showdown:** antes, los bustos que faltaban en WikiDex se buscaban en los sprites de
  Showdown, que no tienen CORS y pasaban por un proxy de nginx con caché de 30 días. Se quitó
  para que el servidor no almacene ni sirva ningún archivo de Nintendo/TPC (precaución legal).
  Si WikiDex no tiene al personaje, el Partidario usa su objeto.

### Desarrollo
Con Node 22: `cd web && npm install && npm run dev` (http://localhost:5173). Sin Node, en un
contenedor `node:22-alpine`:
```bash
# servidor de desarrollo en http://localhost:5173 (con recarga en caliente)
docker run -d --rm --name placeholdr-dev -p 5173:5173 -v "<repo>:/repo" -w /repo/web node:22-alpine npm run dev
# compilar (tsc + vite build -> web/dist)
docker run --rm -v "<repo>:/repo" -w /repo/web node:22-alpine sh -c "npm install && npm run build"
```
La primera vez que se exporta un PDF en desarrollo, Vite optimiza `svg2pdf.js` y recarga la
página una vez; en producción no pasa. Para probar la interfaz se puede usar la extensión
Claude in Chrome.

### Estructura
- `src/config.ts`: mapas portados del CLI original (`TYPE_COLORS`, `ITEM_KEYWORDS`…) y tamaños en mm.
- `src/data/`: `fetch.ts` (descargas con **Cache Storage**),
  `sources.ts` (URLs), `tcg.ts` (ediciones, cartas, selección y traducciones), `species.ts`
  (Pokédex) y `variants.ts` (master set).
- `src/render/`: `svg.ts` (primitivas, portadas de `pill`, `title`, `rarity_mark`…, en mm con el
  eje Y hacia abajo y letra en pt), `cards.ts` (Pokémon, Entrenador, Energía e iconos
  vectoriales), `layout.ts` (cuadrícula, líneas de corte, bolsillos) y `page.ts` (hoja
  completa). El texto se mide con las métricas de Helvetica-Bold de jsPDF para que la vista
  previa encaje igual que el PDF.
- `src/assets/`: `images.ts` (canvas: recorte, escalado, `toBW`, `cropBust`), `items.ts`
  (`ItemResolver`), `busts.ts` (WikiDex, lee `../../../bustos.json`) y `store.ts`
  (cola de 6 trabajos y caché por clave).
- `src/pdf.ts`: jsPDF + svg2pdf.js.
- `src/checklist.ts`: cartas que tienes (localStorage y CSV).
- `src/migrate.ts`: pasa los datos guardados con el nombre antiguo (se importa la primera).
- `src/data/japan.ts`: sets japoneses de TCGdex convertidos al formato de pokemon-tcg-data.
- `src/i18n.ts`: textos de la interfaz en inglés y español, `t()`, `plural()` y `applyStatic()`.
- `src/main.ts`: estado de la UI (`localStorage`), selección, vista previa y botón de PDF.
- Raíz del repo: `Dockerfile`, `docker/nginx.conf`, `compose.yaml` y `.dockerignore`.

### Notas sobre los datos
- **Traducciones:** API REST de TCGdex (`api.tcgdex.net/v2`). Son dos llamadas por edición:
  `/en/sets` para casarla por nombre inglés (`me5` → `me05`) y `/{lang}/sets/{id}` para los
  nombres. No se casa por código PTCGO, porque `30C` está repetido en dos ediciones.
- **Partidarios:** se resuelve siempre su objeto de `SUPPORTER_POOL` (por si no hay busto). Para
  forzar una imagen se usa `"url"` en `bustos.json` (y su dominio en `connect-src` de la CSP).
- **Idiomas de las cartas:** es, en, fr, de e it, más japonés en los sets japoneses.
- **CORS** (verificado): pokemon-tcg-data, PokeAPI, TCGdex, la API de WikiDex y su CDN
  permiten `*`. Showdown no, y por eso se quitó (ver "Sin Showdown").
- **Fuentes:** listado de ediciones y cartas de `PokemonTCG/pokemon-tcg-data` (solo inglés:
  `supertype`, `subtypes`, `types`, `rarity`, `number`, `nationalPokedexNumbers`); especies,
  nombres y objetos de los CSV de `PokeAPI/pokeapi` (idioma `es` = 7, `en` = 9); artwork en
  `PokeAPI/sprites` (`official-artwork/{id}.png`); objetos en `items/dream-world/{slug}.png`
  (ilustración de 90 px, primero) o `items/{slug}.png` (pixel art de 30 px, ampliado sin
  suavizar); bustos de la API MediaWiki de WikiDex (`prop=pageimages`, y si no,
  `prop=images` + `imageinfo`). Bulbapedia responde 403 (reto de Cloudflare).

---

## Diseño de las cartas

Modo **Pokédex**: una tarjeta por especie con `GEN N`, nombre, artwork oficial y `#0001`.
Modo **Edición**: una tarjeta por carta, en el orden de la colección, numerada `NNN/TTT` con
`TTT` = `printedTotal` (las secretas salen como `120/084`, igual que en la carta real). Junto al
número va la rareza: ● común, ◆ infrecuente, ★ rara, y para el resto una abreviatura dorada
(`IR`, `SIR`, `UR`, `MHR`…) de `RARITY_ABBR`.

| Supertipo | Diseño |
|---|---|
| Pokémon | Etiqueta del tipo arriba a la izquierda (color del tipo, en el idioma de las cartas), insignia `ex` / `MEGA ex` arriba a la derecha, artwork oficial por `nationalPokedexNumbers[0]` |
| Entrenador | Banda superior del color del subtipo (Partidario naranja, Objeto azul, Herramienta morado, Estadio verde), fondo de rayas diagonales, `ACE SPEC` si aplica e **icono de objeto de los juegos** en un círculo. Los Partidarios llevan **busto del personaje** si lo encuentra |
| Energía | Fondo teñido del color del tipo y orbe de anillos concéntricos con el objeto del tipo encima (Rayo → Piedra Trueno…), con destellos si es especial |

El objeto de cada carta lo resuelve `ItemResolver` en este orden: energía → objeto del tipo;
slug exacto en `items.csv`; regex de `ITEM_KEYWORDS` (gana la primera); Partidario →
`SUPPORTER_POOL` por orden de aparición (cada Partidario distinto recibe uno distinto);
`ITEM_DEFAULT` del subtipo.

## Decisiones de diseño (y lo que el usuario rechazó)

- Estética base: marco negro grueso, nombre subrayado y número en pastilla negra, a partir de
  una imagen de referencia del usuario. Hay que mantenerla.
- **Rechazado:** recortar la ilustración de la propia carta para los Partidarios. Rompía el
  diseño. Lo que quiere es **el busto del personaje dentro del mismo círculo que los iconos de
  objeto**. Además, nunca se reproducen escaneos ni ilustraciones de cartas (ver la página legal).
- Los iconos de las cartas que no son Pokémon deben ser **objetos de los juegos**. Los iconos
  vectoriales son el respaldo y el modo sin imágenes.
- Las energías no usan el símbolo oficial de energía: el orbe es un diseño propio.
- B/N: sin fondos de color, banda de Entrenador sustituida por una línea, etiquetas en
  contorno, artwork en grises aclarado y líneas de corte grises. Solo el número de colección
  mantiene el relleno negro.

## Bustos (`bustos.json`)

`cropBust` detecta la silueta por el alfa (o quita el fondo blanco), centra la cabeza con el
centroide de la franja superior y recorta un cuadrado. Asume un personaje de pie: Viona, Inma y
Gladio encuadran bien, pero **Misty** (inclinada) sale descentrada porque la coleta arrastra el
centroide; detectar la piel por color no funciona (confunde pelo y brazos). Se corrige a mano en
`bustos.json`, que admite un título de página de WikiDex, una URL o
`{"page"|"url", "dx", "dy", "zoom"}` (`dx`/`dy` en fracciones del lado, negativo =
izquierda/arriba; `zoom > 1` acerca). Ahora: Misty `dx -0.2, dy 0.05`; Gladio `dx 0.06, zoom 0.92`.
WikiDex redirige los nombres ingleses (Gladion → Gladio, Gwynn → Inma, Jett → Viona).
*Recluta del Clan Corrosión* no tiene página propia, así que usa su objeto.

## Limitaciones conocidas

1. El tipo de una Energía se deduce buscando la palabra del tipo en el nombre inglés: es frágil
   con energías especiales sin tipo en el nombre.
2. Los números no numéricos (`TG01`, `SV001`) se imprimen tal cual (`TG01/084`), sin revisar en
   sets con subcolecciones.
3. Si los nombres de una edición difieren entre pokemon-tcg-data y TCGdex, la traducción falla
   y las cartas se quedan en inglés.
4. Los iconos de objeto de 90 px quedan algo blandos impresos a ~30 mm.
5. TCGdex no modela los patrones Poké Ball/Master Ball del master set.

## Ideas que el usuario podría querer
- Orden por página de binder de 9 o de 12 bolsillos.
- Márgenes de impresión configurables.
- Tests de las funciones puras (`trainerSlug`, `ItemResolver`, `cropBust`, selección de cartas).
