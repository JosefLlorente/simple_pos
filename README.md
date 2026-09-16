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

## Releases

Push a version tag to build Windows, macOS, and Linux packages with GitHub
Actions and attach them to a GitHub Release:

```bash
git add .
git commit -m "Prepare v1.0.0"
git tag v1.0.0
git push origin main --tags
```

The generated downloads appear on the release page after the workflow
finishes. Update the version in `package.json` before creating each tag.

### Downloads

Users only need to download the file for their operating system from the
GitHub Release assets:

- **Windows:** the `.exe` installer
- **macOS:** the `.zip` file; open it and move Simple POS to Applications
- **Linux Debian/Ubuntu:** the `.deb` package
- **Linux Fedora/RHEL:** the `.rpm` package

No Node.js, npm, or source code is required to run a downloaded release.

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

## License

This project is licensed under the [MIT License](LICENSE).
