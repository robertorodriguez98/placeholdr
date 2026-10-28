// URLs de las fuentes de datos. Todas responden con CORS abierto salvo Showdown,
// que pasa por el proxy de nginx (/proxy/showdown/) en el contenedor.

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

export const WIKIDEX_API = "https://www.wikidex.net/api.php";
export const showdownTrainer = (slug: string) => `/proxy/showdown/sprites/trainers/${slug}.png`;
