// URLs de las fuentes de datos. Todas responden con CORS abierto: el navegador de cada usuario
// las descarga directamente, y el servidor de Placeholdr solo sirve los ficheros de la web.

const RAW = "https://raw.githubusercontent.com";

export const TCG_SETS = `${RAW}/PokemonTCG/pokemon-tcg-data/master/sets/en.json`;
export const tcgCards = (setId: string) =>
  `${RAW}/PokemonTCG/pokemon-tcg-data/master/cards/en/${setId}.json`;

export const SPECIES_CSV = `${RAW}/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv`;
export const NAMES_CSV = `${RAW}/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv`;
export const ITEMS_CSV = `${RAW}/PokeAPI/pokeapi/master/data/v2/csv/items.csv`;

export const artwork = (id: number) =>
  `${RAW}/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
export const itemArt = (slug: string) =>
  `${RAW}/PokeAPI/sprites/master/sprites/items/dream-world/${slug}.png`;
export const itemPixel = (slug: string) =>
  `${RAW}/PokeAPI/sprites/master/sprites/items/${slug}.png`;

export const TCGDEX_API = "https://api.tcgdex.net/v2";

// Fuente japonesa (M PLUS 1p Bold, licencia OFL) para los nombres de los sets japoneses, fijada
// a un commit de google/fonts. TrueType, que es lo que admite jsPDF: 1,8 MB, se descarga solo
// al mostrar texto japonés. Tiene todos los caracteres de los nombres de TCGdex (comprobado).
export const CJK_FONT = "https://cdn.jsdelivr.net/gh/google/fonts@9862abc066c9b83bf84c3e8ed1fc2d8d48f9bbf0/ofl/mplus1p/MPLUS1p-Bold.ttf";

export const WIKIDEX_API = "https://www.wikidex.net/api.php";
