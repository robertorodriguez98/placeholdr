# Placeholdr

**Printable binder placeholders for Pokémon TCG cards.** Pick a set, print the cards you're
missing and slot them into your binder until you pull the real ones.

👉 **[placeholdr.org](https://placeholdr.org)**

Placeholdr runs entirely in your browser: no account, no cookies, no analytics. Card data and
images are downloaded straight from public sources and the PDF is built on your device.

## Features

- **Any set**: every English set, plus Japanese sets with Japanese names. Or a placeholder per
  species from the National Pokédex.
- **Base, complete or master set**: master set adds one copy per variant (reverse holo, 1st edition).
- **Checklist**: click the cards you own and print only the missing ones. Export and import it as CSV.
- **Card names** in English, Spanish, French, German or Italian (and Japanese for Japanese sets).
- **Print-friendly**: 9 cards per A4 or Letter sheet at real card size (63 × 88 mm), placed edge
  to edge so each cut separates two cards; optional black borders, cut lines and a black & white mode.
- Interface in English and Spanish.

## Running it locally

It's a static web app (TypeScript + Vite, no framework). With Node 22:

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in web/dist
```

Or with Docker (nginx serving the build): `docker compose up -d --build` → http://localhost:8080

## Data sources and credits

- Card lists: [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data)
- Translations, variants and Japanese sets: [TCGdex](https://tcgdex.dev) (MIT)
- Species, official artwork and item icons: [PokeAPI](https://pokeapi.co) (data under BSD-3-Clause;
  images © Nintendo, Creatures, GAME FREAK)
- Trainer illustrations: [WikiDex](https://www.wikidex.net)
- Japanese font: [M PLUS 1p](https://fonts.google.com/specimen/M+PLUS+1p) (SIL Open Font License 1.1)
- PDF: [jsPDF](https://github.com/parallax/jsPDF) and [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) (MIT)

## Legal

Placeholdr is an unofficial fan project. It is not affiliated with, sponsored or endorsed by
Nintendo, Creatures Inc., GAME FREAK or The Pokémon Company. Pokémon and card and character
names are trademarks of their respective owners and are only used to describe the cards.

Artwork and illustrations belong to their owners. Placeholdr doesn't host them: your browser loads
them from the sources above. It never reproduces card scans or card illustrations; the placeholders
are an original design. Please don't sell them.

Rights holders can reach out at **contact@placeholdr.org** and requests will be handled promptly.

## License

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE): you can use,
modify and share it, but if you publish a modified version, including as a website, you must
release its source code under the same license. The license covers the code only, not the data
or images from the sources above, which keep their own terms.

## Support

Placeholdr is free and will stay that way. If it saved you some binder space, you can help cover
the domain and server on [Ko-fi](https://ko-fi.com/krowno16) ☕
