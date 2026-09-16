# Simple POS

Local-first point of sale for a single till. Inventory, sales, capital, and
statistics live in SQLite on this machine. There is no cloud account.

## Run

```bash
npm install
npm start
```

```bash
npm test
npm run package
```

`npm start` opens the desktop app (Windows / macOS / Linux via Electron).
`npm run make` builds platform installers with Electron Forge.

## Data

On first launch the app creates:

- `pos.db` — products, sales, capital, settings
- `images/` — product photos (files, not database blobs)
- `exports/` — CSV files you generate

Those folders sit in the OS app-data directory (for example
`~/Library/Application Support/Simple POS` on macOS). Change the CSV folder
from Settings; that picker uses the native file dialog.

Exports from Statistics land in that folder.

## Screens

1. **Inventory** — catalog with image, price, cost, category, stock
2. **Sale** — tap to cart, keypad qty, cash/card checkout, stock decrement
3. **Capital** — money put into the business vs sales revenue
4. **Statistics** — range totals, revenue vs capital, best/slow sellers, CSV export
5. **History** — past sales; edit or void with the owner password
6. **Settings** — business name, currency, palette, owner password, CSV folder

Prices are stored as integer cents.

## Mobile

The UI is built for touch and mouse together (44px primary actions, no
hover-only controls). Electron itself is desktop-only. A later Android/iOS
shell can wrap the same renderer; that is not part of this desktop build.
