// Takes screenshots of the app for the README.
// Usage: node scripts/screenshots.js
// Requires: npm install && npx playwright install chromium

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT  = path.join(__dirname, '..', 'docs', 'screenshots');

async function run() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();

  // ── Desktop (1280x800) ─────────────────────────────────────────────────────
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await desktop.newPage();

  // 1. List — empty state
  await page.goto(`${BASE}/index.html`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/01-list-empty.png`, fullPage: false });

  // 2. New invoice form (filled)
  await page.goto(`${BASE}/html/new-document.html`);
  await page.waitForLoadState('networkidle');
  await page.fill('#clientName',    'Empresa Ejemplo S.L.');
  await page.fill('#clientNif',     'B12345678');
  await page.fill('#clientAddress', 'Calle Mayor 1\n50001, Zaragoza');
  await page.fill('#issueDate',     '2026-05-19');
  await page.fill('#dueDate',       '2026-06-19');
  await page.fill('[name="item-desc-0"]',  'Pintura interior vivienda');
  await page.fill('[name="item-qty-0"]',   '1');
  await page.fill('[name="item-price-0"]', '1200');
  await page.fill('#vatRate',  '21');
  await page.fill('#irpfRate', '15');
  await page.fill('#paymentMethod', 'Transferencia bancaria');
  await page.fill('#iban', 'ES91 2100 0418 4502 0005 1332');
  await page.screenshot({ path: `${OUT}/02-new-invoice.png`, fullPage: false });

  // 3. Preview (save + screenshot)
  await page.click('#btn-save');
  await page.waitForURL(/preview\.html/);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/03-preview.png`, fullPage: false });

  // 4. List — with one document
  await page.goto(`${BASE}/index.html`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/04-list-with-docs.png`, fullPage: false });

  await desktop.close();

  // ── Mobile (390x844) ──────────────────────────────────────────────────────
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp     = await mobile.newPage();

  await mp.goto(`${BASE}/index.html`);
  await mp.waitForLoadState('networkidle');
  await mp.screenshot({ path: `${OUT}/05-mobile-list.png`, fullPage: false });

  await mobile.close();
  await browser.close();

  console.log(`Screenshots saved to ${OUT}`);
}

run().catch(err => { console.error(err); process.exit(1); });
