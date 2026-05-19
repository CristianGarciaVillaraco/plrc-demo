# Invoice Generator

Offline-first PWA to generate invoices and quotes as PDF, directly in the browser — no server, no account required.

Built as a real production tool for a freelance business. This repository is a public demo with fictional company data.

## Features

- Create and manage invoices (`F-YYYY-NNN`) and quotes (`P-YYYY-NNN`)
- Two PDF templates: modern (blue accent) and classic (formal layout)
- Line items with quantity, unit price, VAT and IRPF calculations
- Draft / pending / paid / sent / accepted status tracking
- JSON export for full data backup
- Installable PWA — works 100% offline after first load
- Optional Cloudflare Workers sync between devices (disabled in this demo)

## Tech stack

| Layer | Technology |
|---|---|
| UI | HTML5 + CSS3 + Vanilla JS (no framework) |
| Database | [Dexie.js](https://dexie.org/) (IndexedDB wrapper) |
| PDF | [pdfmake](https://pdfmake.github.io/) (client-side) |
| PWA | Web App Manifest + Service Worker |
| Share | Web Share API |
| Sync (optional) | Cloudflare Workers D1 |
| Tests | `node:test` (unit) + Playwright (e2e) |
| CI | GitHub Actions |

## Getting started

No build step required. Open `index.html` directly or use the dev server:

```bash
npm install       # installs Playwright for e2e tests only
npm run dev       # starts a local server on http://localhost:3000
```

### Company data

Edit `js/company-config.js` to set your own company details (name, address, tax ID, etc.). This file is included in the demo with fictional data — replace it before deploying.

### Optional sync

To enable multi-device sync via Cloudflare Workers, set `SYNC_URL` and `SYNC_TOKEN` in `js/sync-config.js`. See [plrc-worker](https://github.com/CristianGarciaVillaraco) for the backend.

## Running tests

```bash
npm test           # unit tests (node:test, no dependencies)
npm run test:e2e   # Playwright e2e tests
```

## Architecture

```
index.html                  ← document list
html/new-document.html      ← creation form
html/preview.html           ← PDF preview + download
css/styles.css              ← single stylesheet, responsive
js/
  db.js                     ← Dexie CRUD, numbering, calculations
  cloudflare.js             ← optional sync (no-op if unconfigured)
  company-config.js         ← company data (replace with your own)
  sync-config.js            ← sync credentials (empty in demo)
  pages/                    ← page controllers
  utils/                    ← constants, formatting, PDF builders
sw.js                       ← service worker (offline cache)
manifest.json               ← PWA manifest
test/
  db.test.js                ← unit tests
  e2e/invoice.spec.js       ← Playwright e2e
```

## PDF templates

**Modern** — minimalist, blue accent (#2563EB), company name from config.

**Classic** — formal two-column layout with company header block, suitable for traditional invoices.

## License

MIT
