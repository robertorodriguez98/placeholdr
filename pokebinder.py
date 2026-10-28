#!/usr/bin/env python3
"""
pokebinder.py - Placeholders imprimibles (PDF) para un binder de Pokémon TCG.

CONGELADO (2026-10-28): la versión principal es la aplicación web de web/. Este script
sigue funcionando, pero ya no recibe cambios de diseño ni funciones nuevas.

Dos modos:
  dex  -> por número de Pokédex / generación (datos de PokeAPI)
  set  -> por expansión del TCG (datos de PokemonTCG/pokemon-tcg-data),
          incluyendo Entrenadores y Energías, con numeración 003/084.

Fuentes abiertas (GitHub, sin API key):
  - PokemonTCG/pokemon-tcg-data : sets/en.json y cards/en/<set>.json
  - PokeAPI/pokeapi             : CSV de especies y nombres
  - PokeAPI/sprites             : official artwork por número de Pokédex
  - tcgdex/cards-database       : nombres traducidos de las cartas (es, fr, de, it, pt)
  - PokeAPI/sprites (items)     : ilustraciones de objetos de los juegos (iconos de
                                  Entrenadores y Energías)

Ejemplos:
  python pokebinder.py set --list                      # lista expansiones
  python pokebinder.py set "Pitch Black"               # o por id: me5
  python pokebinder.py set me5 --only trainer energy   # solo no-Pokémon
  python pokebinder.py set me5 --main-only             # sin secretas (1-84)
  python pokebinder.py set me5 --bw                    # optimizado para B/N
  python pokebinder.py set me5 --icons iconos.json     # objetos elegidos a mano
  python pokebinder.py set me5 --busts mis_retratos    # carpeta con ilustraciones de entrenadores
  python pokebinder.py set me5 --bust-map bustos.json  # página de wiki o URL por personaje
  python pokebinder.py dex --gen 8
  python pokebinder.py dex --range 1-151 --lang en

Dependencias:  pip install reportlab pillow requests
"""
import argparse
import csv
import io
import json
import math
import re
import sys
from pathlib import Path

import requests
from PIL import Image, ImageOps
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

RAW = "https://raw.githubusercontent.com"
TCG_SETS = f"{RAW}/PokemonTCG/pokemon-tcg-data/master/sets/en.json"
TCG_CARDS = f"{RAW}/PokemonTCG/pokemon-tcg-data/master/cards/en/{{set}}.json"
SPECIES_CSV = f"{RAW}/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv"
NAMES_CSV = f"{RAW}/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv"
ARTWORK = f"{RAW}/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{{id}}.png"
ITEMS_CSV = f"{RAW}/PokeAPI/pokeapi/master/data/v2/csv/items.csv"
ITEM_ART = f"{RAW}/PokeAPI/sprites/master/sprites/items/dream-world/{{slug}}.png"  # ilustración
ITEM_PX = f"{RAW}/PokeAPI/sprites/master/sprites/items/{{slug}}.png"               # pixel art

TCGDEX = f"{RAW}/tcgdex/cards-database/master/data/{{serie}}/{{set}}"

LANG_IDS = {"ja": 1, "ko": 3, "zh": 4, "fr": 5, "de": 6, "es": 7, "it": 8, "en": 9}

# Modo blanco y negro: sin fondos de color, etiquetas en contorno, arte en grises aclarado
BW = False
BW_INK = (0.25, 0.25, 0.25)   # gris de los iconos en B/N
BW_LIGHTEN = 0.18             # cuánto se aclara el artwork en B/N (ahorro de tóner)

CARD_W, CARD_H = 63 * mm, 88 * mm
COLS, ROWS = 3, 3
GAP = 2 * mm

# Colores por tipo de energía (RGB 0-1)
TYPE_COLORS = {
    "Grass": (0.30, 0.65, 0.30), "Fire": (0.90, 0.35, 0.20), "Water": (0.20, 0.50, 0.85),
    "Lightning": (0.95, 0.78, 0.10), "Psychic": (0.60, 0.35, 0.70), "Fighting": (0.70, 0.40, 0.20),
    "Darkness": (0.20, 0.25, 0.30), "Metal": (0.55, 0.60, 0.65), "Dragon": (0.70, 0.60, 0.20),
    "Fairy": (0.90, 0.45, 0.65), "Colorless": (0.65, 0.65, 0.62),
}
TYPE_ES = {
    "Grass": "PLANTA", "Fire": "FUEGO", "Water": "AGUA", "Lightning": "RAYO",
    "Psychic": "PSÍQUICO", "Fighting": "LUCHA", "Darkness": "OSCURIDAD", "Metal": "METÁLICO",
    "Dragon": "DRAGÓN", "Fairy": "HADA", "Colorless": "INCOLORO",
}
# Estilo de las cartas que no son Pokémon: (color, etiqueta ES, etiqueta EN, icono)
TRAINER_STYLE = {
    "Supporter":    ((0.86, 0.36, 0.20), "PARTIDARIO", "SUPPORTER", "person"),
    "Item":         ((0.18, 0.45, 0.80), "OBJETO", "ITEM", "capsule"),
    "Pokémon Tool": ((0.50, 0.30, 0.70), "HERRAMIENTA", "TOOL", "wrench"),
    "Stadium":      ((0.20, 0.60, 0.40), "ESTADIO", "STADIUM", "stadium"),
}
# Palabras de tipo que TCGdex deja a veces en inglés dentro de nombres traducidos
TYPE_WORD_ES = {"Grass": "Planta", "Fire": "Fuego", "Water": "Agua", "Lightning": "Rayo",
                "Psychic": "Psíquica", "Fighting": "Lucha", "Darkness": "Oscuridad",
                "Metal": "Metálica", "Dragon": "Dragón", "Fairy": "Hada", "Colorless": "Incolora"}
# --- Objetos de los juegos usados como icono -------------------------------------------
# 1) Si el nombre inglés de la carta es un objeto real (Ultra Ball, Rare Candy...), se usa ese.
# 2) Si no, se busca por palabras clave (primera coincidencia gana).
# 3) Si no, el objeto por defecto del subtipo. Todo se puede sobreescribir con --icons.
ITEM_KEYWORDS = [
    (r"armor fossil", "armor-fossil"), (r"skull fossil", "skull-fossil"),
    (r"helix fossil", "helix-fossil"), (r"dome fossil", "dome-fossil"),
    (r"claw fossil", "claw-fossil"), (r"root fossil", "root-fossil"),
    (r"cover fossil", "cover-fossil"), (r"plume fossil", "plume-fossil"),
    (r"jaw fossil", "jaw-fossil"), (r"sail fossil", "sail-fossil"),
    (r"amber|fossil", "old-amber"),
    (r"master ball", "master-ball"), (r"ultra ball", "ultra-ball"), (r"great ball", "great-ball"),
    (r"\bball\b", "poke-ball"),
    (r"potion|heal|cure", "potion"), (r"candy", "rare-candy"), (r"revive|stretcher", "max-revive"),
    (r"bell", "soothe-bell"), (r"bomb|smoke", "smoke-ball"), (r"hammer|crush", "iron-ball"),
    (r"rope|escape|retreat", "escape-rope"), (r"belt", "black-belt"),
    (r"band|bangle|brace", "choice-band"), (r"badge|coin|medal", "amulet-coin"),
    (r"defender|armor|shield|guard", "hard-stone"), (r"energy|switch", "energy-root"),
    (r"scarf|cape|cloak", "silk-scarf"), (r"glasses|goggles", "black-glasses"),
    (r"berry", "sitrus-berry"), (r"sash", "focus-sash"), (r"leftover", "leftovers"),
    (r"share|exp", "exp-share"), (r"vitality|vitamin|vigor", "hp-up"), (r"map|quarry|city|town|tower|gym|forest|cave|lake", "town-map"),
]
ITEM_DEFAULT = {"Supporter": "exp-share", "Item": "poke-ball",
                "Pokémon Tool": "leftovers", "Stadium": "town-map"}
# Partidarios: son personas, así que se reparte entre objetos "de entrenador".
# Se asignan por orden de aparición: cada Partidario distinto recibe un objeto distinto
# y sus reimpresiones (full art, SIR...) repiten el mismo.
SUPPORTER_POOL = ["exp-share", "amulet-coin", "lucky-egg", "macho-brace", "scope-lens",
                  "quick-claw", "kings-rock", "cleanse-tag", "everstone", "lucky-punch"]
ITEM_ENERGY = {
    "Grass": "leaf-stone", "Fire": "fire-stone", "Water": "water-stone",
    "Lightning": "thunder-stone", "Psychic": "twisted-spoon", "Fighting": "black-belt",
    "Darkness": "dusk-stone", "Metal": "metal-coat", "Dragon": "dragon-scale",
    "Fairy": "moon-stone", "Colorless": "silk-scarf",
}

# --- Bustos de Partidarios -----------------------------------------------------------------
# Para cada Partidario se busca la ilustración del personaje ("Gladion's Final Battle" ->
# gladion) y se recorta el busto automáticamente. Orden de búsqueda:
#   1) carpeta local (--busts, por defecto ./retratos): gladion.png / .webp / .jpg
#   2) WikiDex (nombre en español: "Combate Final de Gladio" -> página "Gladio")
#   3) Bulbapedia (desactivada: Cloudflare bloquea la API, ver WIKIS)
#   4) sprites de entrenador de Pokémon Showdown (pixel art, cobertura parcial)
# Se usa la imagen principal de la página (la del cuadro de información) vía API MediaWiki.
# Si no hay imagen, la carta usa su icono de objeto como hasta ahora.
SHOWDOWN_TRAINER = "https://play.pokemonshowdown.com/sprites/trainers/{slug}.png"
WIKIS = [  # (nombre, endpoint API, idioma del título a buscar)
    # WikiDex vive en wikidex.net; pokemon.fandom.com/es es otro wiki casi vacío.
    ("WikiDex", "https://www.wikidex.net/api.php", "es"),
    # Bulbapedia (y archives.bulbagarden.net) responde 403 con el reto de Cloudflare
    # a cualquier cliente que no sea un navegador, así que no se consulta.
    # ("Bulbapedia", "https://bulbapedia.bulbagarden.net/w/api.php", "en"),
]
HTTP_HEADERS = {"User-Agent": "pokebinder/1.0 (generador personal de placeholders para binder)"}
BUST_FRACTION = 0.42   # alto del busto respecto al alto total del personaje

RARITY_ABBR = {
    "Common": "C", "Uncommon": "U", "Rare": "R", "Double Rare": "RR", "Ultra Rare": "UR",
    "Illustration Rare": "IR", "Special Illustration Rare": "SIR", "Hyper Rare": "HR",
    "Mega Hyper Rare": "MHR", "ACE SPEC Rare": "ACE", "Shiny Rare": "SR",
    "Shiny Ultra Rare": "SUR", "Black White Rare": "BWR", "Promo": "PR",
}


# =========================================================================== datos
def fetch_cached(url: str, path: Path) -> bytes:
    if path.exists():
        return path.read_bytes()
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(r.content)
    return r.content


def load_species(cache: Path, lang: str):
    species = csv.DictReader(io.StringIO(
        fetch_cached(SPECIES_CSV, cache / "pokemon_species.csv").decode()))
    names = csv.DictReader(io.StringIO(
        fetch_cached(NAMES_CSV, cache / "pokemon_species_names.csv").decode()))
    loc, eng = {}, {}
    for r in names:
        lid, sid = int(r["local_language_id"]), int(r["pokemon_species_id"])
        if lid == LANG_IDS[lang]:
            loc[sid] = r["name"]
        if lid == LANG_IDS["en"]:
            eng[sid] = r["name"]
    out = []
    for r in species:
        sid = int(r["id"])
        if sid < 10000:
            out.append({"id": sid, "gen": int(r["generation_id"]),
                        "name": loc.get(sid) or eng.get(sid) or r["identifier"].title()})
    return sorted(out, key=lambda p: p["id"])


def load_sets(cache: Path, refresh=False):
    p = cache / "tcg_sets.json"
    if refresh and p.exists():
        p.unlink()
    return json.loads(fetch_cached(TCG_SETS, p))


def find_set(sets, query):
    q = query.strip().lower()
    for s in sets:
        if s["id"].lower() == q or s["name"].lower() == q or s.get("ptcgoCode", "").lower() == q:
            return s
    hits = [s for s in sets if q in s["name"].lower()]
    if len(hits) == 1:
        return hits[0]
    if hits:
        sys.exit("Varias coincidencias: " + ", ".join(f"{s['id']} ({s['name']})" for s in hits))
    sys.exit(f"No encuentro la expansión '{query}'. Usa 'set --list'.")


def load_set_cards(cache: Path, set_id: str, refresh=False):
    p = cache / "tcg_cards" / f"{set_id}.json"
    if refresh and p.exists():
        p.unlink()
    cards = json.loads(fetch_cached(TCG_CARDS.format(set=set_id), p))

    def key(c):  # orden natural: 1, 2, ..., 10, TG01...
        m = re.match(r"([A-Za-z]*)(\d+)", c["number"])
        return (m.group(1), int(m.group(2))) if m else (c["number"], 0)
    return sorted(cards, key=key)


def _ts_field(text, lang):
    """Extrae name.<lang> del primer bloque `name: {...}` de un fichero .ts de TCGdex."""
    m = re.search(r"\bname\s*:\s*\{(.*?)\}", text, re.S)
    if not m:
        return None
    key = re.escape(lang)
    v = re.search(rf"(?:'{key}'|\b{key})\s*:\s*\"((?:[^\"\\]|\\.)*)\"", m.group(1))
    return json.loads(f'"{v.group(1)}"') if v else None


def _fetch_text(url, path: Path):
    try:
        return fetch_cached(url, path).decode("utf-8")
    except requests.HTTPError:
        return None


def load_translations(cache: Path, st, numbers, lang):
    """Devuelve (nombre_del_set, {numero: nombre}) traducidos con TCGdex. Vacío si no hay datos."""
    if lang == "en":
        return None, {}
    from concurrent.futures import ThreadPoolExecutor
    from urllib.parse import quote
    base = TCGDEX.format(serie=quote(st["series"]), set=quote(st["name"]))
    cdir = cache / "tcgdex" / st["id"]

    set_ts = _fetch_text(base + ".ts", cdir / "_set.ts")
    if set_ts is None:
        print(f"  ! TCGdex no tiene '{st['series']}/{st['name']}': nombres en inglés",
              file=sys.stderr)
        return None, {}
    set_name = _ts_field(set_ts, lang)

    def one(num):
        cands = [f"{int(num):03d}", num] if num.isdigit() else [num]
        for cand in dict.fromkeys(cands):
            txt = _fetch_text(f"{base}/{quote(cand)}.ts", cdir / f"{cand}.ts")
            if txt:
                return num, _ts_field(txt, lang)
        return num, None

    with ThreadPoolExecutor(8) as ex:
        res = dict(ex.map(one, numbers))
    names = {k: v for k, v in res.items() if v}
    if lang == "es":  # "Energía Lightning Voltaica" -> "Energía Rayo Voltaica"
        for k, v in names.items():
            for en, es in TYPE_WORD_ES.items():
                v = re.sub(rf"\b{en}\b", es, v)
            names[k] = v
    missing = len(numbers) - len(names)
    if missing:
        print(f"  ! {missing} cartas sin traducción, se quedan en inglés", file=sys.stderr)
    return set_name, names


def to_bw(img):
    """RGBA -> grises con contraste automático y aclarado (para --bw)."""
    alpha = img.getchannel("A")
    gray = ImageOps.autocontrast(ImageOps.grayscale(img), cutoff=1)
    gray = gray.point(lambda v: int(v * (1 - BW_LIGHTEN) + 255 * BW_LIGHTEN))
    return Image.merge("LA", (gray, alpha))


class ItemIcons:
    """Resuelve qué objeto de los juegos representa cada carta y descarga su imagen."""

    def __init__(self, cache: Path, overrides=None):
        self.cache = cache
        self.over = {k.lower(): v for k, v in (overrides or {}).items()}
        rows = csv.DictReader(io.StringIO(
            fetch_cached(ITEMS_CSV, cache / "items.csv").decode()))
        self.known = {r["identifier"] for r in rows}
        self._img = {}
        self._sup = {}

    @staticmethod
    def slug(name):
        return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("é", "e")).strip("-")

    def resolve(self, card):
        en = card.get("name_en", card["name"])
        for key in (en.lower(), card["name"].lower(), card["number"]):
            if key in self.over:
                return self.over[key]
        if card["supertype"] == "Energy":
            t = next((t for t in TYPE_COLORS if t in en), "Colorless")
            return ITEM_ENERGY[t]
        s = self.slug(en)
        if s in self.known:
            return s
        for pat, item in ITEM_KEYWORDS:
            if re.search(pat, en, re.I):
                return item
        sub = next((x for x in card.get("subtypes", []) if x in ITEM_DEFAULT), "Item")
        if sub == "Supporter":
            if en not in self._sup:
                self._sup[en] = SUPPORTER_POOL[len(self._sup) % len(SUPPORTER_POOL)]
            return self._sup[en]
        return ITEM_DEFAULT[sub]

    def image(self, slug):
        """Ilustración dream-world si existe; si no, pixel art ampliado sin suavizar."""
        if slug in self._img:
            return self._img[slug]
        img = None
        for url, sub, pixel in ((ITEM_ART, "art", False), (ITEM_PX, "px", True)):
            try:
                data = fetch_cached(url.format(slug=slug), self.cache / "items" / sub / f"{slug}.png")
            except requests.HTTPError:
                continue
            img = Image.open(io.BytesIO(data)).convert("RGBA")
            img = img.crop(img.getbbox() or (0, 0, *img.size))
            f = 360 / max(img.size)
            img = img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))),
                             Image.NEAREST if pixel else Image.LANCZOS)
            break
        if img is None:
            print(f"  ! objeto '{slug}' sin imagen, se usa icono vectorial", file=sys.stderr)
        elif BW:
            img = to_bw(img)
        self._img[slug] = ImageReader(img) if img else None
        return self._img[slug]


class TrainerBusts:
    def __init__(self, cache: Path, folder, online=True, overrides=None):
        self.cache, self.folder, self.online = cache, Path(folder), online
        # {carta (en/es) o personaje: "Título de página" o "https://.../imagen.png"}
        # o, para ajustar el encuadre, un objeto:
        #   {"page": "Título" | "url": "https://...", "dx": -0.1, "dy": 0.05, "zoom": 1.2}
        # dx/dy mueven el encuadre en fracciones de su lado (negativo = izquierda/arriba)
        # y zoom > 1 acerca. Todo es opcional.
        self.over = {}
        for k, v in (overrides or {}).items():
            self.over[k.lower()] = v if isinstance(v, dict) else {"url" if v.startswith("http") else "page": v}
        self._done = {}

    def _entry(self, card):
        """Entrada de --bust-map para la carta (por nombre de carta o de personaje), o {}."""
        person_en, person_es = self.person_names(card)
        keys = [card.get("name_en", "").lower(), card["name"].lower(),
                person_en.lower(), person_es.lower()]
        return next((self.over[k] for k in keys if k in self.over), {})

    @staticmethod
    def person_names(card):
        """Nombre del personaje en inglés y español a partir de los nombres de la carta.
        'Gladion's Final Battle' / 'Combate Final de Gladio' -> ('Gladion', 'Gladio')."""
        en = card.get("name_en", card["name"])
        es = card["name"]
        parts = re.split(r"['’]s\b", en)
        person_en = parts[0].strip()
        if len(parts) > 1 and " de " in es:          # "X de Persona" -> Persona
            person_es = es.rsplit(" de ", 1)[1].strip()
        else:
            person_es = es.strip()
        return person_en, person_es

    def _wiki_image_url(self, api, title):
        """URL de la imagen principal de una página MediaWiki (o None)."""
        q = {"action": "query", "format": "json", "redirects": 1, "titles": title,
             "prop": "pageimages", "piprop": "original|thumbnail", "pithumbsize": 1200}
        r = requests.get(api, params=q, headers=HTTP_HEADERS, timeout=20)
        r.raise_for_status()
        pages = r.json().get("query", {}).get("pages", {})
        for pg in pages.values():
            if "missing" in pg:
                return None
            src = (pg.get("original") or pg.get("thumbnail") or {}).get("source")
            if src:
                return src
            # sin PageImages: primera imagen de la página cuyo nombre contenga el título
            q2 = {"action": "query", "format": "json", "titles": pg["title"],
                  "prop": "images", "imlimit": 100}
            imgs = requests.get(api, params=q2, headers=HTTP_HEADERS, timeout=20).json()
            files = [i["title"] for p in imgs.get("query", {}).get("pages", {}).values()
                     for i in p.get("images", [])]
            key = pg["title"].split(" (")[0].lower()
            files = [f for f in files if key in f.lower() and f.lower().endswith((".png", ".webp"))]
            if not files:
                return None
            q3 = {"action": "query", "format": "json", "titles": files[0],
                  "prop": "imageinfo", "iiprop": "url"}
            info = requests.get(api, params=q3, headers=HTTP_HEADERS, timeout=20).json()
            for p in info.get("query", {}).get("pages", {}).values():
                return (p.get("imageinfo") or [{}])[0].get("url")
        return None

    def _download(self, url, path: Path):
        if path.exists():
            return path.read_bytes()
        r = requests.get(url, headers=HTTP_HEADERS, timeout=30)
        r.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(r.content)
        return r.content

    def _load_online(self, card, slug):
        person_en, person_es = self.person_names(card)
        entry = self._entry(card)
        if entry.get("url"):
            data = self._download(entry["url"], self.cache / "trainers" / "manual" / f"{slug}.img")
            return Image.open(io.BytesIO(data)), False, "URL manual"
        for wname, api, lang in WIKIS:
            title = entry.get("page") or (person_es if lang == "es" else person_en)
            path = self.cache / "trainers" / wname.lower() / f"{slug}.img"
            try:
                if not path.exists():
                    url = self._wiki_image_url(api, title)
                    if not url:
                        continue
                    self._download(url, path)
                return Image.open(path), False, f"{wname}: {title}"
            except Exception as e:
                print(f"           ({wname} no disponible: {e.__class__.__name__})",
                      file=sys.stderr)
        try:
            data = fetch_cached(SHOWDOWN_TRAINER.format(slug=slug),
                                self.cache / "trainers" / "showdown" / f"{slug}.png")
            return Image.open(io.BytesIO(data)), True, "Showdown"
        except Exception:
            return None, False, None

    @staticmethod
    def trainer_slug(name_en):
        """'Gladion's Final Battle' -> 'gladion'; 'Misty's Vitality' -> 'misty'; 'Gwynn' -> 'gwynn'."""
        base = re.split(r"['’]s\b", name_en)[0]
        return re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")

    def _load(self, card, slug):
        for ext in (".png", ".webp", ".jpg", ".jpeg"):
            f = self.folder / f"{slug}{ext}"
            if f.exists():
                return Image.open(f), False, f"local: {f}"
        if self.online:
            return self._load_online(card, slug)
        return None, False, None

    def get(self, card):
        slug = self.trainer_slug(card.get("name_en", card["name"]))
        if slug in self._done:
            return self._done[slug]
        img, pixel, origin = self._load(card, slug)
        if img is not None:
            print(f"           busto de {origin}")
            if max(img.size) > 1600:
                img.thumbnail((1600, 1600))
        if img is None:
            print(f"           (sin ilustración: añade {self.folder / (slug + '.png')})")
            self._done[slug] = None
            return None
        e = self._entry(card)
        bust = self.crop_bust(img.convert("RGBA"), pixel, e.get("dx", 0), e.get("dy", 0),
                              e.get("zoom", 1))
        if BW:
            bust = to_bw(bust)
        self._done[slug] = ImageReader(bust)
        return self._done[slug]

    @staticmethod
    def crop_bust(img, pixel=False, dx=0, dy=0, zoom=1):
        """Recorte cuadrado de cabeza y hombros, centrado en la cabeza.
        dx/dy desplazan el encuadre (fracción del lado) y zoom > 1 lo acerca."""
        alpha = img.getchannel("A")
        if alpha.getextrema()[0] == 255:  # sin transparencia: quita el fondo claro uniforme
            gray = ImageOps.grayscale(img)
            alpha = gray.point(lambda v: 0 if v > 245 else 255)
            img.putalpha(alpha)
        l, t, r, b = alpha.getbbox() or (0, 0, *img.size)
        h = b - t
        side = max(8, round(h * BUST_FRACTION / zoom))
        # centro horizontal de la cabeza: media de píxeles opacos en la franja superior
        band = alpha.crop((l, t, r, t + max(1, round(h * 0.12))))
        cols = [sum(1 for yy in range(band.height) if band.getpixel((xx, yy)) > 128)
                for xx in range(band.width)]
        tot = sum(cols) or 1
        head_x = l + sum(i * v for i, v in enumerate(cols)) / tot
        pad = round(side * 0.06)
        x0 = round(head_x - side / 2 + dx * side)
        y0 = round(t - pad + dy * side)
        canvas_img = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        canvas_img.paste(img.crop((x0, y0, x0 + side, y0 + side)), (0, 0))
        target = 480
        return canvas_img.resize((target, target), Image.NEAREST if pixel or side < 120
                                 else Image.LANCZOS)


def load_artwork(pid: int, cache: Path):
    try:
        data = fetch_cached(ARTWORK.format(id=pid), cache / "artwork" / f"{pid}.png")
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        img.thumbnail((600, 600))
        if BW:
            img = to_bw(img)
        return ImageReader(img)
    except Exception as e:
        print(f"  ! sin imagen para #{pid}: {e}", file=sys.stderr)
        return None


# =========================================================================== primitivas
def fit_font(c, text, font, max_size, max_width, min_size=5.5):
    size = max_size
    while size > min_size and c.stringWidth(text, font, size) > max_width:
        size -= 0.25
    return size


def pill(c, text, size=7, *, cx=None, left=None, right=None, cy=0,
         bg=(0, 0, 0), fg=(1, 1, 1), h=5.5 * mm, pad=2.4 * mm, font="Helvetica-Bold"):
    w = c.stringWidth(text, font, size) + 2 * pad
    x = left if left is not None else (right - w if right is not None else cx - w / 2)
    outline = BW and tuple(bg) != (0, 0, 0)
    if outline:
        c.setFillColorRGB(1, 1, 1)
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(0.9)
        c.roundRect(x, cy - h / 2, w, h, h / 2.6, stroke=1, fill=1)
        fg = (0, 0, 0)
    else:
        c.setFillColorRGB(*bg)
        c.roundRect(x, cy - h / 2, w, h, h / 2.6, stroke=0, fill=1)
    c.setFillColorRGB(*fg)
    c.setFont(font, size)
    c.drawCentredString(x + w / 2, cy - size * 0.35, text)
    return x, w


def mix(col, t):  # aclara un color hacia blanco (t=0 color, t=1 blanco)
    return tuple(v + (1 - v) * t for v in col)


def card_frame(c, x, y, border, bg=(0.975, 0.98, 0.99)):
    c.setFillColorRGB(*((1, 1, 1) if BW else bg))
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(border)
    c.rect(x + border / 2, y + border / 2, CARD_W - border, CARD_H - border, stroke=1, fill=1)


def clip_inner(c, x, y, border):
    p = c.beginPath()
    p.rect(x + border / 2, y + border / 2, CARD_W - border, CARD_H - border)
    c.clipPath(p, stroke=0, fill=0)


def title(c, cx, ty, text, max_w, size=11):
    fs = fit_font(c, text, "Helvetica-Bold", size, max_w)
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.setFont("Helvetica-Bold", fs)
    c.drawCentredString(cx, ty, text)
    uw = min(c.stringWidth(text, "Helvetica-Bold", fs) + 8 * mm, max_w + 4 * mm)
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(1.4)
    c.line(cx - uw / 2, ty - 2.2 * mm, cx + uw / 2, ty - 2.2 * mm)


def star(c, cx, cy, r, points=5, inner=0.45):
    p = c.beginPath()
    for i in range(points * 2):
        rad = r if i % 2 == 0 else r * inner
        a = math.pi / 2 + i * math.pi / points
        (p.moveTo if i == 0 else p.lineTo)(cx + rad * math.cos(a), cy + rad * math.sin(a))
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def rarity_mark(c, rarity, x, cy):
    """Símbolo de rareza a la derecha del número: ● ◆ ★ o abreviatura."""
    if not rarity:
        return
    c.setFillColorRGB(0, 0, 0)
    s = 1.5 * mm
    if rarity == "Common":
        c.circle(x + s, cy, s, stroke=0, fill=1)
    elif rarity == "Uncommon":
        p = c.beginPath()
        p.moveTo(x + s, cy + s * 1.2); p.lineTo(x + 2 * s, cy)
        p.lineTo(x + s, cy - s * 1.2); p.lineTo(x, cy); p.close()
        c.drawPath(p, stroke=0, fill=1)
    elif rarity == "Rare":
        star(c, x + s * 1.2, cy, s * 1.4)
    else:
        abbr = RARITY_ABBR.get(rarity, "".join(w[0] for w in rarity.split()))
        gold = (0.78, 0.62, 0.15)
        pill(c, abbr, 6, left=x, cy=cy, bg=gold, h=4.2 * mm, pad=1.6 * mm)


# =========================================================================== iconos (originales, vectoriales)
def icon(c, kind, cx, cy, r, col):
    c.saveState()
    c.setFillColorRGB(*mix(col, 0.93 if BW else 0.82))
    c.circle(cx, cy, r, stroke=0, fill=1)
    c.setFillColorRGB(*col)
    c.setStrokeColorRGB(*col)
    if kind == "person":
        c.circle(cx, cy + r * 0.32, r * 0.26, stroke=0, fill=1)
        p = c.beginPath()
        p.moveTo(cx - r * 0.55, cy - r * 0.62)
        p.curveTo(cx - r * 0.55, cy + r * 0.05, cx + r * 0.55, cy + r * 0.05, cx + r * 0.55, cy - r * 0.62)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
    elif kind == "capsule":
        c.translate(cx, cy); c.rotate(-35)
        w, h = r * 1.3, r * 0.56
        c.roundRect(-w / 2, -h / 2, w, h, h / 2, stroke=0, fill=1)
        c.setFillColorRGB(*mix(col, 0.55))
        c.roundRect(0, -h / 2, w / 2, h, h / 2, stroke=0, fill=1)
        c.rect(0, -h / 2, h / 2, h, stroke=0, fill=1)
        c.setFillColorRGB(1, 1, 1, 0.5)
        c.roundRect(-w / 2 + h * 0.3, h * 0.08, w * 0.35, h * 0.16, h * 0.08, stroke=0, fill=1)
    elif kind == "wrench":
        c.translate(cx, cy); c.rotate(45)
        c.roundRect(-r * 0.12, -r * 0.65, r * 0.24, r * 0.95, r * 0.1, stroke=0, fill=1)
        c.circle(0, r * 0.38, r * 0.3, stroke=0, fill=1)
        c.setFillColorRGB(*mix(col, 0.82))
        c.rect(-r * 0.11, r * 0.4, r * 0.22, r * 0.35, stroke=0, fill=1)
    elif kind == "stadium":
        c.setLineWidth(r * 0.09)
        c.ellipse(cx - r * 0.7, cy - r * 0.45, cx + r * 0.7, cy + r * 0.15, stroke=1, fill=0)
        c.rect(cx - r * 0.7, cy - r * 0.15, r * 1.4, r * 0.0001, stroke=1, fill=0)
        c.line(cx - r * 0.7, cy - r * 0.15, cx - r * 0.7, cy - r * 0.5)
        c.line(cx + r * 0.7, cy - r * 0.15, cx + r * 0.7, cy - r * 0.5)
        c.line(cx, cy + r * 0.15, cx, cy + r * 0.62)
        p = c.beginPath()
        p.moveTo(cx, cy + r * 0.62); p.lineTo(cx + r * 0.32, cy + r * 0.5); p.lineTo(cx, cy + r * 0.38)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
    c.restoreState()


def energy_orb(c, cx, cy, r, col, special, core=True):
    """Orbe de energía: anillos concéntricos + destello. Diseño propio, no el símbolo oficial.
    Con core=False los anillos son más suaves para poner encima la ilustración de un objeto."""
    c.saveState()
    tones = (0.88, 0.7, 0.45, 0.0) if core else (0.9, 0.8, 0.68, 0.55)
    if BW and not core:
        tones = (0.95, 0.9, 0.85, 0.8)
    for i, t in enumerate(tones):
        c.setFillColorRGB(*mix(col, t))
        c.circle(cx, cy, r * (1 - i * 0.2), stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    if core:
        star(c, cx, cy, r * 0.32, points=4, inner=0.3)
    if special:  # pequeños destellos orbitando
        for a in (30, 150, 270):
            rad = math.radians(a)
            star(c, cx + r * 1.05 * math.cos(rad), cy + r * 1.05 * math.sin(rad), r * 0.13, 4, 0.35)
    c.restoreState()


def item_icon(c, img, cx, cy, r, col):
    """Objeto del juego sobre un círculo suave del color del subtipo."""
    c.setFillColorRGB(*mix(col, 0.93 if BW else 0.82))
    c.circle(cx, cy, r, stroke=0, fill=1)
    box = r * 1.45
    c.drawImage(img, cx - box / 2, cy - box / 2, box, box, mask="auto",
                preserveAspectRatio=True, anchor="c")


def bust_medallion(c, img, cx, cy, r, col):
    """Busto dentro del mismo círculo que los iconos de objeto, con el marco del subtipo."""
    c.setFillColorRGB(*mix(col, 0.93 if BW else 0.82))
    c.circle(cx, cy, r, stroke=0, fill=1)
    c.saveState()
    p = c.beginPath()
    p.circle(cx, cy, r)
    c.clipPath(p, stroke=0, fill=0)
    side = r * 2.05
    c.drawImage(img, cx - side / 2, cy - r * 1.02, side, side, mask="auto")
    c.restoreState()
    c.setStrokeColorRGB(*((0, 0, 0) if BW else col))
    c.setLineWidth(1.4)
    c.circle(cx, cy, r, stroke=1, fill=0)


def stripes(c, x, y, col, step=4 * mm):
    if BW:
        return
    c.setStrokeColorRGB(*mix(col, 0.9))
    c.setLineWidth(1.6 * mm)
    for k in range(-int(CARD_H / step), int(CARD_W / step) + 2):
        x0 = x + k * step
        c.line(x0, y, x0 + CARD_H, y + CARD_H)


# =========================================================================== cartas
def draw_pokemon(c, x, y, *, name, number, art, border, top_left, top_left_color=(0, 0, 0),
                 badge=None, rarity=None):
    card_frame(c, x, y, border)
    top, cx = y + CARD_H, x + CARD_W / 2
    pill(c, top_left, 6.5, left=x + 4 * mm, cy=top - 8.5 * mm, bg=top_left_color)
    if badge:
        pill(c, badge, 6.5, right=x + CARD_W - 4 * mm, cy=top - 8.5 * mm,
             bg=(0.78, 0.62, 0.15))
    title(c, cx, top - 19 * mm, name, CARD_W - 12 * mm)
    box, icy = 40 * mm, y + CARD_H / 2 - 4 * mm
    if art:
        c.drawImage(art, cx - box / 2, icy - box / 2, box, box, mask="auto",
                    preserveAspectRatio=True, anchor="c")
    nx, nw = pill(c, number, 9, cx=cx, cy=y + 10 * mm)
    rarity_mark(c, rarity, nx + nw + 1.8 * mm, y + 10 * mm)


def draw_trainer(c, x, y, card, number, border, lang, item=None, portrait=None):
    sub = next((s for s in card.get("subtypes", []) if s in TRAINER_STYLE), "Item")
    col, es, en, kind = TRAINER_STYLE[sub]
    if BW:
        col = BW_INK
    card_frame(c, x, y, border)
    c.saveState(); clip_inner(c, x, y, border)
    stripes(c, x, y, col)
    if BW:  # en B/N la banda es solo una línea separadora
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(1.2)
        c.line(x, y + CARD_H - 15 * mm, x + CARD_W, y + CARD_H - 15 * mm)
    else:
        c.setFillColorRGB(*col)  # banda superior
        c.rect(x, y + CARD_H - 15 * mm, CARD_W, 15 * mm, stroke=0, fill=1)
    c.restoreState()
    c.setStrokeColorRGB(0, 0, 0)  # repasa el marco por encima del fondo
    c.setLineWidth(border)
    c.rect(x + border / 2, y + border / 2, CARD_W - border, CARD_H - border, stroke=1, fill=0)
    top, cx = y + CARD_H, x + CARD_W / 2
    c.setFillColorRGB(*((0, 0, 0) if BW else (1, 1, 1)))
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(x + 5 * mm, top - 9.3 * mm, "ENTRENADOR" if lang == "es" else "TRAINER")
    pill(c, es if lang == "es" else en, 6.5, right=x + CARD_W - 4.5 * mm, cy=top - 8.5 * mm,
         bg=(1, 1, 1), fg=col)
    if "ACE SPEC" in card.get("subtypes", []):
        pill(c, "ACE SPEC", 6, cx=cx, cy=top - 18.5 * mm, bg=(0.85, 0.15, 0.4))
    title(c, cx, top - 25 * mm, card["name"], CARD_W - 10 * mm, size=10.5)
    if portrait:
        bust_medallion(c, portrait, cx, y + CARD_H / 2 - 6 * mm, 15 * mm, col)
    elif item:
        item_icon(c, item, cx, y + CARD_H / 2 - 6 * mm, 15 * mm, col)
    else:
        icon(c, kind, cx, y + CARD_H / 2 - 6 * mm, 15 * mm, col)
    nx, nw = pill(c, number, 9, cx=cx, cy=y + 10 * mm)
    rarity_mark(c, card.get("rarity"), nx + nw + 1.8 * mm, y + 10 * mm)


def draw_energy(c, x, y, card, number, border, lang, item=None):
    special = "Special" in card.get("subtypes", [])
    etype = next((t for t in TYPE_COLORS if t in card.get("name_en", card["name"])), "Colorless")
    col = BW_INK if BW else TYPE_COLORS[etype]
    card_frame(c, x, y, border, bg=mix(col, 0.93))
    top, cx = y + CARD_H, x + CARD_W / 2
    label = ("ENERGÍA ESPECIAL" if special else "ENERGÍA BÁSICA") if lang == "es" \
        else ("SPECIAL ENERGY" if special else "BASIC ENERGY")
    pill(c, label, 6.5, left=x + 4 * mm, cy=top - 8.5 * mm, bg=col)
    title(c, cx, top - 19 * mm, card["name"], CARD_W - 10 * mm, size=10.5)
    energy_orb(c, cx, y + CARD_H / 2 - 4 * mm, 14 * mm, col, special, core=item is None)
    if item:
        box = 20 * mm
        c.drawImage(item, cx - box / 2, y + CARD_H / 2 - 4 * mm - box / 2, box, box,
                    mask="auto", preserveAspectRatio=True, anchor="c")
    nx, nw = pill(c, number, 9, cx=cx, cy=y + 10 * mm)
    rarity_mark(c, card.get("rarity"), nx + nw + 1.8 * mm, y + 10 * mm)


# =========================================================================== maquetación
def draw_cutlines(c, ox, oy, gw, gh):
    c.saveState()
    c.setStrokeColorRGB(*((0.55, 0.55, 0.55) if BW else (0.45, 0.45, 0.8)))
    c.setLineWidth(0.4)
    c.setDash(3, 2)
    for i in range(1, COLS):
        xx = ox + i * (CARD_W + GAP) - GAP / 2
        c.line(xx, oy - 3 * mm, xx, oy + gh + 3 * mm)
    for j in range(1, ROWS):
        yy = oy + j * (CARD_H + GAP) - GAP / 2
        c.line(ox - 3 * mm, yy, ox + gw + 3 * mm, yy)
    c.restoreState()


def render(items, out, page_size, cutlines, doc_title):
    """items: lista de callables draw(c, x, y)."""
    c = canvas.Canvas(str(out), pagesize=page_size)
    c.setTitle(doc_title)
    PW, PH = page_size
    gw = COLS * CARD_W + (COLS - 1) * GAP
    gh = ROWS * CARD_H + (ROWS - 1) * GAP
    ox, oy = (PW - gw) / 2, (PH - gh) / 2
    n = COLS * ROWS
    for s in range(0, len(items), n):
        if cutlines:
            draw_cutlines(c, ox, oy, gw, gh)
        for k, draw in enumerate(items[s:s + n]):
            col, row = k % COLS, k // COLS
            c.saveState()
            draw(c, ox + col * (CARD_W + GAP), oy + gh - (row + 1) * CARD_H - row * GAP)
            c.restoreState()
        c.showPage()
    c.save()
    return -(-len(items) // n)


# =========================================================================== modos
def fmt_number(num, total):
    return f"{int(num):03d}/{total:03d}" if num.isdigit() else f"{num}/{total:03d}"


def cmd_set(a, cache, page):
    sets = load_sets(cache, a.refresh)
    if a.list:
        for s in sorted(sets, key=lambda s: s["releaseDate"]):
            print(f"{s['id']:<12} {s['releaseDate']}  {s['printedTotal']:>3}/{s['total']:<3}  "
                  f"{s['series']} — {s['name']}")
        return
    if not a.set:
        sys.exit("Indica una expansión (id o nombre) o usa --list.")
    st = find_set(sets, a.set)
    cards = load_set_cards(cache, st["id"], a.refresh)
    total = st["printedTotal"]
    kinds = {"pokemon": "Pokémon", "trainer": "Trainer", "energy": "Energy"}
    if a.only:
        cards = [x for x in cards if x["supertype"] in {kinds[k] for k in a.only}]
    if a.main_only:
        cards = [x for x in cards if x["number"].isdigit() and int(x["number"]) <= total]

    icons = None
    if not a.vector_icons:
        over = json.loads(Path(a.icons).read_text(encoding="utf-8")) if a.icons else None
        icons = ItemIcons(cache, over)
    portraits = None
    if not a.no_busts:
        bpath = Path(a.bust_map) if a.bust_map else Path("bustos.json")
        bmap = None
        if a.bust_map or bpath.exists():  # bustos.json se usa por defecto si existe
            bmap = json.loads(bpath.read_text(encoding="utf-8"))
        portraits = TrainerBusts(cache, a.busts, online=not a.offline_busts, overrides=bmap)
    set_name, tr = load_translations(cache, st, [x["number"] for x in cards], a.lang)
    set_name = set_name or st["name"]
    print(f"{set_name} ({st['id']}): {len(cards)} cartas, numeración /{total:03d}")

    items = []
    for card in cards:
        num = fmt_number(card["number"], total)
        card = {**card, "name_en": card["name"], "name": tr.get(card["number"], card["name"])}
        print(f"  {num}  {card['name']}")
        if card["supertype"] == "Pokémon":
            dex = (card.get("nationalPokedexNumbers") or [None])[0]
            art = load_artwork(dex, cache) if dex else None
            tp = (card.get("types") or ["Colorless"])[0]
            label = TYPE_ES.get(tp, tp.upper()) if a.lang == "es" else tp.upper()
            nm, en = card["name"], card["name_en"]
            badge = "MEGA ex" if en.startswith("Mega ") and en.endswith(" ex") else \
                    "ex" if en.endswith(" ex") else None
            items.append(lambda c, x, y, nm=nm, num=num, art=art, label=label, tp=tp,
                         badge=badge, r=card.get("rarity"):
                         draw_pokemon(c, x, y, name=nm, number=num, art=art, border=a.border,
                                      top_left=label, top_left_color=TYPE_COLORS.get(tp, (0, 0, 0)),
                                      badge=badge, rarity=r))
        else:
            item = portrait = None
            if portraits and "Supporter" in card.get("subtypes", []):
                portrait = portraits.get(card)
            if icons and not portrait:
                slug = icons.resolve(card)
                item = icons.image(slug)
                print(f"           icono: {slug}")
            fn = draw_trainer if card["supertype"] == "Trainer" else draw_energy
            if fn is draw_trainer:
                items.append(lambda c, x, y, card=card, num=num, item=item, pt=portrait:
                             draw_trainer(c, x, y, card, num, a.border, a.lang, item, pt))
            else:
                items.append(lambda c, x, y, card=card, num=num, item=item:
                             draw_energy(c, x, y, card, num, a.border, a.lang, item))

    out = Path(a.out or f"binder_{st['id']}{'_bw' if BW else ''}.pdf")
    pages = render(items, out, page, not a.no_cutlines, f"{set_name} — binder placeholders")
    print(f"Listo: {out} ({pages} páginas)")


def cmd_dex(a, cache, page):
    allp = load_species(cache, a.lang)
    if a.gen:
        pokes = [p for p in allp if p["gen"] in a.gen]
        default = "binder_gen" + "-".join(map(str, a.gen)) + ".pdf"
    elif a.range:
        lo, hi = a.range
        pokes = [p for p in allp if lo <= p["id"] <= hi]
        default = f"binder_{lo:04d}-{hi:04d}.pdf"
    else:
        pokes = [p for p in allp if p["id"] in set(a.ids)]
        default = "binder_custom.pdf"
    if not pokes:
        sys.exit("No hay Pokémon que coincidan con la selección.")
    items = []
    for p in pokes:
        print(f"  #{p['id']:04d} {p['name']}")
        art = load_artwork(p["id"], cache)
        items.append(lambda c, x, y, p=p, art=art:
                     draw_pokemon(c, x, y, name=p["name"], number=f"#{p['id']:04d}", art=art,
                                  border=a.border, top_left=f"GEN {p['gen']}"))
    out = Path(a.out or default.replace(".pdf", "_bw.pdf" if BW else ".pdf"))
    pages = render(items, out, page, not a.no_cutlines, "Pokédex binder placeholders")
    print(f"Listo: {out} ({pages} páginas)")


def parse_range(s):
    a, _, b = s.partition("-")
    return int(a), int(b or a)


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--lang", default="es", choices=LANG_IDS,
                        help="idioma de nombres de Pokémon y etiquetas (por defecto: es)")
    common.add_argument("-o", "--out", help="PDF de salida")
    common.add_argument("--cache", default=".pokecache", help="carpeta de caché")
    common.add_argument("--paper", default="a4", choices=["a4", "letter"])
    common.add_argument("--border", type=float, default=3.5, help="grosor del marco (pt)")
    common.add_argument("--no-cutlines", action="store_true", help="sin líneas de corte")
    common.add_argument("--bw", action="store_true",
                        help="optimizado para impresión en blanco y negro (ahorra tóner)")

    ap = argparse.ArgumentParser(description="Placeholders para binder de Pokémon TCG")
    sub = ap.add_subparsers(dest="mode", required=True)

    ps = sub.add_parser("set", parents=[common], help="por expansión del TCG")
    ps.add_argument("set", nargs="?", help="id (me5), nombre (Pitch Black) o código (PBL)")
    ps.add_argument("--list", action="store_true", help="lista las expansiones disponibles")
    ps.add_argument("--only", nargs="+", choices=["pokemon", "trainer", "energy"])
    ps.add_argument("--main-only", action="store_true", help="excluye cartas secretas")
    ps.add_argument("--refresh", action="store_true", help="vuelve a descargar los datos del set")
    ps.add_argument("--icons", help="JSON {nombre de carta (en/es) o número: objeto} para forzar iconos")
    ps.add_argument("--busts", default="retratos",
                    help="carpeta con ilustraciones de entrenadores (gladion.png, misty.png...)")
    ps.add_argument("--offline-busts", action="store_true",
                    help="no buscar en WikiDex/Bulbapedia/Showdown, solo la carpeta local")
    ps.add_argument("--bust-map",
                    help='JSON {carta o personaje: "Página de la wiki" o URL de imagen, '
                         'u objeto {"page"|"url", "dx", "dy", "zoom"} para ajustar el encuadre}')
    ps.add_argument("--no-busts", action="store_true",
                    help="Partidarios con icono de objeto en vez de busto")
    ps.add_argument("--vector-icons", action="store_true",
                    help="usa los iconos vectoriales simples en vez de objetos de los juegos")

    pd = sub.add_parser("dex", parents=[common], help="por Pokédex nacional")
    g = pd.add_mutually_exclusive_group(required=True)
    g.add_argument("--gen", type=int, nargs="+")
    g.add_argument("--range", type=parse_range)
    g.add_argument("--ids", type=int, nargs="+")

    a = ap.parse_args()
    global BW
    BW = a.bw
    cache = Path(a.cache)
    page = A4 if a.paper == "a4" else LETTER
    (cmd_set if a.mode == "set" else cmd_dex)(a, cache, page)


if __name__ == "__main__":
    main()
