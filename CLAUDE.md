# pokebinder — handover

Generador de **placeholders imprimibles (PDF)** para un binder de Pokémon TCG: tarjetas de
63×88 mm (tamaño carta TCG), 9 por página A4 (3×3) con líneas de corte, pensadas para meter
en los bolsillos del binder mientras falta la carta real.

Todo el código vive hoy en un único script: `pokebinder.py` (~900 líneas, Python 3).
El usuario (Roberto) habla en español; la UI, los mensajes de consola y los comentarios están
en español. Prefiere instrucciones directas, comando a comando, y que se explique el porqué
cuando aporta.

---

## Estado actual

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
  - `--bust-map` acepta un título de página o una URL directa.
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
   rubio y los brazos con la cara. Opciones pendientes: offset manual por personaje en
   `--bust-map` o un detector anime-face de OpenCV.
5. Helvetica (fuente estándar de reportlab) usa WinAnsi: **ja/ko/zh no se renderizan**. Para
   esos idiomas habría que registrar una TTF (Noto Sans CJK).
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
3. Ajustar el encuadre de los bustos que fallan (punto 4 de "Pendiente"). Los puntos 1 y 2 ya
   están verificados.
4. Mover `ITEM_KEYWORDS`, `SUPPORTER_POOL` y los demás mapas a un YAML o JSON editable.
5. Ideas que el usuario podría querer:
   - modo "checklist": marcar qué cartas tiene ya, leyendo un CSV, para imprimir solo las que faltan;
   - orden por página de binder de 9 o de 12 bolsillos;
   - márgenes de impresión configurables.

---

## Ficheros de usuario (fuera del repo)

- `retratos/` — ilustraciones de entrenadores puestas a mano, con el nombre `{slug}.png`.
- `iconos.json` — `{"Gwynn": "town-map", "084": "zap-plate"}` (clave: carta en/es o número).
- `bustos.json` — `{"Misty": "Misty (videojuegos)", "Inma": "https://…/Inma.png"}`.
- `.pokecache/` — caché; se puede borrar sin riesgo. Las subcarpetas `trainers/` y
  `tcg_cards/` son las que conviene borrar al cambiar mapas o en sets nuevos.

Conviene añadir `.pokecache/`, `retratos/` y `*.pdf` al `.gitignore`.
