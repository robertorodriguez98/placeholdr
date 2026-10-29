# Placeholdr — handover

**Placeholdr** (antes *pokebinder*; se renombró para no usar la marca "Poké" en el nombre) es un
generador de **placeholders imprimibles (PDF)** para un binder de Pokémon TCG: tarjetas de
63×88 mm (tamaño carta TCG), 9 por página A4 (3×3) con líneas de corte, pensadas para meter
en los bolsillos del binder mientras falta la carta real.

Hay dos implementaciones:

- **`web/` — la versión principal** (en desarrollo por fases). Es una aplicación web en
  TypeScript + Vite, sin framework, que se ejecuta **entera en el navegador**: descargas,
  recortes, vista previa y PDF. El servidor solo sirve ficheros estáticos.
- **`pokebinder.py` — CLI en Python, CONGELADO** desde 2026-10-28. Sigue funcionando, pero
  no recibe cambios. Todo lo nuevo va a la web. El resto de este documento, salvo la sección
  "Aplicación web", describe el CLI, que sirve de referencia para portar el diseño.

El usuario (Roberto) habla en español; los mensajes de consola y los comentarios están en
español. La interfaz de la web está en inglés por defecto, con español como alternativa
(`src/i18n.ts`). Prefiere instrucciones directas, comando a comando, y que se explique el porqué
cuando aporta. Trabajamos con una rama y un pull request por cambio
(`gh pr create` / `gh pr merge --merge --delete-branch`).

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
- **Bordes negros** (por defecto, interruptor en "Impresión"): si se desactiva, `cardFrame` no
  dibuja el marco y el fondo de la carta (rayas y banda de los Entrenadores incluidas) llega
  hasta el borde, que se recorta por la discontinua. Va en `RenderOpts.frame`.
- **Nombre y aviso legal:** el nombre no lleva "Poké" ni "Pokémon" para no usar la marca como
  propia; "Pokémon" solo aparece de forma descriptiva (título de la pestaña: "Placeholdr ·
  Binder placeholders for Pokémon TCG cards"; titular del panel: "Fill the gaps in your
  Pokémon TCG binder"). Al pie de la vista previa va el aviso de proyecto de fans sin relación
  con Nintendo, Creatures, GAME FREAK ni The Pokémon Company (clave `legal`). Nada de imitar el
  logo ni la tipografía de Pokémon. `src/migrate.ts` copia las claves antiguas `pokebinder:*`
  a `placeholdr:*` y borra la caché `pokebinder-v1`.
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
- **Docker:** `docker compose up -d --build` → http://localhost:8080. La imagen es multi-etapa
  (`node:22-alpine` compila y `nginx:1.27-alpine` sirve) y ocupa unos 75 MB. nginx solo hace
  de proxy, con caché de 30 días, para `/proxy/showdown/sprites/trainers/`; no es un proxy
  abierto. En desarrollo hace lo mismo el `server.proxy` de Vite.

### Desarrollo
No hay Node instalado: todo se ejecuta en un contenedor `node:22-alpine`. En este equipo,
Docker necesita un `DOCKER_CONFIG` temporal porque falta `docker-credential-desktop` (ver la
memoria del usuario).
```bash
# servidor de desarrollo en http://localhost:5173 (con recarga en caliente)
docker run -d --rm --name placeholdr-dev -p 5173:5173 -v "<repo>:/repo" -w /repo/web node:22-alpine npm run dev
# compilar (tsc + vite build -> web/dist)
docker run --rm -v "<repo>:/repo" -w /repo/web node:22-alpine sh -c "npm install && npm run build"
```
La primera vez que se exporta un PDF en desarrollo, Vite optimiza `svg2pdf.js` y recarga la
página una vez; en producción no pasa. Para probar la interfaz se puede usar la extensión
Claude in Chrome: el usuario navega con Firefox, pero instaló Chrome solo para las pruebas.

### Estructura
- `src/config.ts`: mapas portados del CLI (`TYPE_COLORS`, `ITEM_KEYWORDS`…) y tamaños en mm.
- `src/data/`: `fetch.ts` (descargas con **Cache Storage**, el equivalente a `.pokecache/`),
  `sources.ts` (URLs), `tcg.ts` (ediciones, cartas, selección y traducciones), `species.ts`
  (Pokédex) y `variants.ts` (master set).
- `src/render/`: `svg.ts` (primitivas, portadas de `pill`, `title`, `rarity_mark`…, en mm con el
  eje Y hacia abajo y letra en pt), `cards.ts` (Pokémon, Entrenador, Energía e iconos
  vectoriales), `layout.ts` (cuadrícula, líneas de corte, bolsillos) y `page.ts` (hoja
  completa). El texto se mide con las métricas de Helvetica-Bold de jsPDF para que la vista
  previa encaje igual que el PDF.
- `src/assets/`: `images.ts` (canvas: recorte, escalado, `toBW`, `cropBust`), `items.ts`
  (`ItemResolver`), `busts.ts` (WikiDex/Showdown, lee `../../../bustos.json`) y `store.ts`
  (cola de 6 trabajos y caché por clave).
- `src/pdf.ts`: jsPDF + svg2pdf.js.
- `src/checklist.ts`: cartas que tienes (localStorage y CSV).
- `src/migrate.ts`: pasa los datos guardados con el nombre antiguo (se importa la primera).
- `src/data/japan.ts`: sets japoneses de TCGdex convertidos al formato de pokemon-tcg-data.
- `src/i18n.ts`: textos de la interfaz en inglés y español, `t()`, `plural()` y `applyStatic()`.
- `src/main.ts`: estado de la UI (`localStorage`), selección, vista previa y botón de PDF.
- Raíz del repo: `Dockerfile`, `docker/nginx.conf`, `compose.yaml` y `.dockerignore`.

### Diferencias con el CLI
- **Traducciones:** se usa la API REST de TCGdex (`api.tcgdex.net/v2`), no los ficheros
  `.ts`. Son dos llamadas por edición: `/en/sets` para casarla por nombre inglés
  (`me5` → `me05`) y `/{lang}/sets/{id}` para los nombres. No se casa por código PTCGO,
  porque `30C` está repetido en dos ediciones.
- **Partidarios:** se resuelve siempre su objeto de `SUPPORTER_POOL` (por si no hay busto), así
  que el reparto de objetos puede diferir del CLI, que solo lo asignaba a los que no tenían
  busto. No hay carpeta `retratos/`: para forzar una imagen se usa `"url"` en `bustos.json`.
- **Idiomas:** es, en, fr, de e it. Se dejan fuera ja, ko y zh por el problema de fuentes en
  el PDF (punto 5 de "Pendiente").
- **CORS** (verificado): pokemon-tcg-data, PokeAPI, TCGdex, la API de WikiDex y su CDN
  permiten `*`. Showdown no, así que pasa por el proxy de nginx.

---

## CLI congelado: estado

Funciona y se ha probado de punta a punta con la expansión **Pitch Black (`me5`)**: 120 cartas,
14 páginas, en color y en blanco y negro.

Dependencias: `pip install reportlab pillow requests`

```bash
python pokebinder.py set --list                     # listar expansiones (id, fecha, totales)
python pokebinder.py set "Pitch Black"              # también: me5 o PBL
python pokebinder.py set me5 --only trainer energy  # filtrar por supertipo
python pokebinder.py set me5 --main-only            # sin secretas (001-084)
python pokebinder.py set me5 --bw                   # optimizado para B/N
python pokebinder.py set me5 --lang en              # idioma de nombres (es por defecto)
python pokebinder.py dex --gen 8                    # modo Pokédex nacional
python pokebinder.py dex --range 1-151 --bw
```

Para verificar visualmente: `pdftoppm -r 70 -png -f 9 -l 9 binder_me5.pdf out`
(en Pitch Black, la página 9 tiene Objetos, Herramienta, Estadio y Partidarios).

---

## Modos

### `dex` — por Pokédex nacional
Una tarjeta por especie: arriba `GEN N`, nombre (localizado), *official artwork* y el número
`#0001`. Se puede seleccionar con `--gen`, `--range` o `--ids`.

### `set` — por expansión del TCG
Una tarjeta por carta de la expansión, en el orden de la colección, numerada `NNN/TTT`. `TTT`
es `printedTotal`, así que las secretas salen como `120/084`, igual que en la carta real.
Junto al número va la rareza: ● común, ◆ infrecuente, ★ rara, y para el resto una abreviatura
dorada (`IR`, `SIR`, `UR`, `MHR`…) sacada de `RARITY_ABBR`.

| Supertipo | Diseño |
|---|---|
| Pokémon | Etiqueta del tipo arriba a la izquierda (color del tipo, texto en ES), insignia `ex` / `MEGA ex` arriba a la derecha, artwork oficial por `nationalPokedexNumbers[0]` |
| Entrenador | Banda superior con el color del subtipo (Partidario naranja, Objeto azul, Herramienta morado, Estadio verde), fondo de rayas diagonales, etiqueta `ACE SPEC` si aplica, **icono de objeto de los juegos** dentro de un círculo. Los Partidarios llevan **busto del personaje** si lo encuentra |
| Energía | Fondo teñido del color del tipo, orbe de anillos concéntricos con el objeto del tipo encima (Rayo → Piedra Trueno…), destellos si es especial |

---

## Fuentes de datos (todas abiertas, sin API key)

| Qué | URL | Notas |
|---|---|---|
| Listado de expansiones | `raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json` | `id`, `name`, `series`, `printedTotal`, `total`, `ptcgoCode` |
| Cartas de una expansión | `…/pokemon-tcg-data/master/cards/en/{set_id}.json` | Solo en inglés. Trae `supertype`, `subtypes`, `types`, `rarity`, `number`, `nationalPokedexNumbers`, `images` |
| Traducciones de cartas | `raw.githubusercontent.com/tcgdex/cards-database/master/data/{series}/{set name}.ts` y `…/{set name}/{NNN}.ts` | Ficheros TypeScript, se parsean con regex (`_ts_field`). Mapeo por `series` + `name` de pokemon-tcg-data. Idiomas: es, es-mx, fr, de, it, pt |
| Especies y nombres | `raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species*.csv` | Idioma `es` = 7 y `en` = 9 en `LANG_IDS` |
| Artwork de Pokémon | `…/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png` | |
| Objetos | `…/PokeAPI/sprites/master/sprites/items/dream-world/{slug}.png` (ilustración, 90 px) y `…/items/{slug}.png` (pixel art, 30 px) | Se prueba primero dream-world. El pixel art se amplía con NEAREST |
| Catálogo de objetos | `…/PokeAPI/pokeapi/master/data/v2/csv/items.csv` | Para detectar si el nombre de una carta coincide con un objeto real |
| Retratos de entrenadores | API MediaWiki de WikiDex (`www.wikidex.net/api.php`), `prop=pageimages` | Verificado en vivo: devuelve `original` (PNG con alfa, cuerpo entero). Si no hay PageImages, se cae a `prop=images` + `imageinfo`. Bulbapedia desactivada: Cloudflare responde 403 a clientes que no son navegador |
| Sprites de entrenadores | `play.pokemonshowdown.com/sprites/trainers/{slug}.png` | Pixel art 80×80, cobertura parcial (verificado en vivo) |

Todo se cachea en `.pokecache/` (`--cache`). `set --refresh` vuelve a descargar los JSON de la
expansión, que es útil en sets recién publicados.

---

## Arquitectura de `pokebinder.py`

Por orden de aparición en el fichero:

- **Constantes:** URLs, `LANG_IDS`, tamaños (`CARD_W/H`, `COLS/ROWS`, `GAP`), `TYPE_COLORS`,
  `TYPE_ES`, `TRAINER_STYLE`, `TYPE_WORD_ES`, `ITEM_KEYWORDS`, `ITEM_DEFAULT`,
  `SUPPORTER_POOL`, `ITEM_ENERGY`, `SHOWDOWN_TRAINER`, `WIKIS`, `BUST_FRACTION`, `RARITY_ABBR`.
- **Globales del modo B/N:** `BW` (lo activa `main()`), `BW_INK` y `BW_LIGHTEN`.
- **Datos:**
  - `fetch_cached`: GET con caché en disco.
  - `load_species`, `load_sets`, `find_set` (busca por id, nombre o código PTCGO, o por coincidencia parcial).
  - `load_set_cards` (orden natural por número).
  - `load_translations`: TCGdex en paralelo con `ThreadPoolExecutor(8)`; corrige palabras de tipo en inglés, p. ej. *Energía Lightning* → *Energía Rayo*.
  - `load_artwork`.
- **`to_bw(img)`:** escala de grises, autocontraste y aclarado; devuelve modo `LA`.
- **`ItemIcons`:** resuelve qué objeto representa cada carta y descarga su imagen. El orden de resolución es:
  1. override del JSON `--icons`;
  2. energía → objeto del tipo;
  3. slug exacto en `items.csv`;
  4. regex de `ITEM_KEYWORDS` (gana la primera coincidencia);
  5. Partidario → `SUPPORTER_POOL`, asignado por orden de aparición (cada Partidario distinto recibe uno distinto y las reimpresiones repiten);
  6. `ITEM_DEFAULT` del subtipo.
- **`TrainerBusts`:** bustos de Partidarios.
  - `trainer_slug`: `"Gladion's Final Battle"` → `gladion`.
  - `person_names`: devuelve el personaje en inglés y en español; en ES saca lo que va tras el último `" de "`.
  - `_load`: busca en la carpeta local `retratos/`, después en WikiDex y por último en Showdown.
  - `crop_bust`: detecta la silueta por el alfa (si no hay transparencia, quita el fondo blanco), calcula el centro de la cabeza con el centroide de la franja superior del 12 % y hace un recorte cuadrado de lado `BUST_FRACTION × alto`.
  - `--bust-map` (por defecto `bustos.json` si existe) acepta un título de página, una URL
    directa o un objeto `{"page"|"url", "dx", "dy", "zoom"}`. `dx` y `dy` desplazan el encuadre
    en fracciones de su lado (negativo = izquierda/arriba) y `zoom > 1` acerca. El ajuste se
    aplica a la imagen venga de donde venga (local, WikiDex o Showdown).
- **Primitivas de dibujo:** `fit_font`, `pill` (en B/N, cualquier pastilla que no sea negra pasa a contorno), `mix`, `card_frame`, `clip_inner`, `title`, `star`, `rarity_mark`, `icon` (iconos vectoriales de respaldo), `energy_orb`, `item_icon`, `bust_medallion`, `stripes`.
- **Cartas:** `draw_pokemon`, `draw_trainer`, `draw_energy`.
- **Maquetación:** `draw_cutlines` y `render(items, …)`. `items` es una lista de *callables* `draw(c, x, y)`, así que `render` no sabe nada del tipo de carta.
- **Modos:** `fmt_number`, `cmd_set`, `cmd_dex`.
- **CLI:** `main()` con subparsers `set` y `dex` que comparten las opciones comunes.

### Opciones de `set` añadidas por iteraciones
`--icons JSON`, `--vector-icons`, `--busts DIR`, `--offline-busts`, `--no-busts`,
`--bust-map JSON`, `--only`, `--main-only`, `--refresh`, `--list`.

### Opciones comunes
`--lang`, `-o/--out`, `--cache`, `--paper a4|letter`, `--border` (pt), `--no-cutlines`, `--bw`.
Con `--bw`, el nombre por defecto del PDF lleva el sufijo `_bw`.

---

## Decisiones de diseño (y lo que el usuario rechazó)

- Estética base: marco negro grueso, nombre subrayado y número en pastilla negra, a partir de
  una imagen de referencia del usuario. Hay que mantenerla.
- **Rechazado:** recortar la ilustración de la propia carta para los Partidarios (encuadre 3:4
  de la ventana de arte). El usuario lo descartó porque rompía el diseño; ese código ya se
  eliminó. Lo que quiere es **el busto del personaje dentro del mismo círculo que los iconos de
  objeto**.
- Los iconos de las cartas que no son Pokémon deben ser **objetos de los juegos**. Los iconos
  vectoriales solo quedan como respaldo (`--vector-icons`).
- Las energías no usan el símbolo oficial de energía: el orbe es un diseño propio.
- B/N: sin fondos de color, banda de Entrenador sustituida por una línea, etiquetas en
  contorno, artwork en grises aclarado un 18 % y líneas de corte grises. Solo el número de
  colección mantiene el relleno negro.

---

## Pendiente / sin verificar

1. ~~Bustos desde wikis sin probar~~ **Verificado con red real (2026-10-28, `set me5 --only trainer`)**:
   - El endpoint antiguo (`pokemon.fandom.com/es`) era otro wiki casi vacío, sin PageImages:
     todas las búsquedas devolvían `None` en silencio. Corregido a `www.wikidex.net/api.php`.
   - WikiDex acepta el User-Agent de `HTTP_HEADERS` y devuelve `original`. *Gladio*, *Misty*,
     *Inma* y *Viona* son ilustraciones oficiales de cuerpo entero en PNG con alfa. *Misty* no
     necesita desambiguación porque la página general usa el artwork de LGPE. Además, WikiDex
     redirige los nombres ingleses (Gladion→Gladio, Gwynn→Inma, Jett→Viona), así que
     `--lang en` también funciona.
   - La caché `.img` funciona y PIL detecta el formato. El CDN sirve PNG, no webp.
   - Bulbapedia y `archives.bulbagarden.net` responden 403 con el reto de Cloudflare: están
     comentadas en `WIKIS`.
2. ~~Showdown sin probar~~ **Verificado**: sprites 80×80 de gladion, gwynn y misty; 404 para
   jett y rust-syndicate-grunt.
3. *Recluta del Clan Corrosión* no tiene página en WikiDex (solo existe *Clan Corrosión*, cuya
   imagen es el logo), así que usa el icono de objeto. Para un busto hace falta `retratos/` o `--bust-map`.
4. `crop_bust` asume un personaje de pie y con la cabeza arriba. Con el arte real, Viona, Inma
   y Gladio encuadran bien con `BUST_FRACTION = 0.42`, aunque Gladio queda un poco
   descentrado. **Misty** (inclinada hacia delante) sale con la cara pegada al borde izquierdo
   y la barbilla cortada, porque la coleta arrastra el centroide de la franja superior. Se
   probó detección de piel por color (RGB y HSV) y **no sirve**: confunde el pelo naranja o
   rubio y los brazos con la cara. **Resuelto con ajuste manual** en `bustos.json`
   (Misty `dx -0.2, dy 0.05`; Gladio `dx 0.06, zoom 0.92`). Para personajes nuevos que encuadren
   mal se añade su entrada. Si llegan a ser muchos, valorar un detector anime-face de OpenCV.
5. Helvetica (fuente estándar de reportlab) usa WinAnsi: **ja/ko/zh no se renderizan en el CLI**.
   La web ya lo resuelve para el japonés con M PLUS 1p (ver "Sets japoneses").
6. El tipo de una Energía se deduce buscando la palabra del tipo en el nombre inglés, lo cual
   es frágil con energías especiales sin tipo en el nombre.
7. Los números no numéricos (`TG01`, `SV001`) se imprimen tal cual (`TG01/084`), sin revisar
   en sets con subcolecciones.
8. El mapeo con TCGdex se hace por `series/name` de pokemon-tcg-data. Si los nombres difieren
   entre ambos repos, falla en silencio y las cartas se quedan en inglés (con aviso por stderr).
9. Los iconos de objeto con ilustración de 90 px quedan algo blandos impresos a ~30 mm.

---

## Siguientes pasos sugeridos

1. **Estructurar el proyecto**:
   ```
   pokebinder/
     __init__.py
     cli.py          # argparse / main
     data/           # tcg.py, pokeapi.py, tcgdex.py, cache.py
     assets/         # items.py (ItemIcons), busts.py (TrainerBusts), images.py (to_bw)
     render/         # primitives.py, cards.py, layout.py
     config.py       # constantes y mapas (TYPE_COLORS, ITEM_KEYWORDS…)
   tests/
   pyproject.toml    # entry point: pokebinder = pokebinder.cli:main
   ```
   Al separarlo, sustituir el global `BW` por un objeto `Theme` o `RenderOptions` que se pase a
   las funciones de dibujo.
2. **Tests** con `pytest`:
   - funciones puras: `trainer_slug`, `person_names`, `fmt_number`, `_ts_field`, `ItemIcons.resolve` y `crop_bust` con imágenes sintéticas;
   - HTTP mockeado (`responses` o `requests-mock`);
   - un test de humo que genere un PDF con un set pequeño desde fixtures.
3. Mover `ITEM_KEYWORDS`, `SUPPORTER_POOL` y los demás mapas a un YAML o JSON editable.
4. Ideas que el usuario podría querer:
   - orden por página de binder de 9 o de 12 bolsillos;
   - márgenes de impresión configurables.

---

## Ficheros de usuario

- `retratos/` — ilustraciones de entrenadores puestas a mano, con el nombre `{slug}.png`.
- `iconos.json` — `{"Gwynn": "town-map", "084": "zap-plate"}` (clave: carta en/es o número).
- `bustos.json` — **sí está en el repo** (ajustes de encuadre compartidos): `{"Misty": {"dx": -0.2, "dy": 0.05}, "Inma": "https://…/Inma.png"}`.
- `.pokecache/` — caché; se puede borrar sin riesgo. Las subcarpetas `trainers/` y
  `tcg_cards/` son las que conviene borrar al cambiar mapas o en sets nuevos.

`.pokecache/`, `retratos/` y `*.pdf` están en `.gitignore`.
