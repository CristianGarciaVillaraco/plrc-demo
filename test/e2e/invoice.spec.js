const { test, expect } = require('@playwright/test');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fillDocForm(page, data) {
  if (data.issueDate)    await page.fill('#issueDate',     data.issueDate);
  if (data.dueDate)      await page.fill('#dueDate',       data.dueDate);
  if (data.clientName)   await page.fill('#clientName',    data.clientName);
  if (data.clientNif)    await page.fill('#clientNif',     data.clientNif);
  if (data.clientAddress) await page.fill('#clientAddress', data.clientAddress);
  if (data.vatRate  !== undefined) await page.fill('#vatRate',  String(data.vatRate));
  if (data.irpfRate !== undefined) await page.fill('#irpfRate', String(data.irpfRate));
  if (data.paymentMethod) await page.fill('#paymentMethod', data.paymentMethod);
  if (data.iban)          await page.fill('#iban',          data.iban);
  if (data.notes)         await page.fill('#notes',         data.notes);
}

async function fillFirstItem(page, description, unitPrice) {
  // First item row is rendered on load (index 0)
  await page.fill('[name="item-desc-0"]',  description);
  await page.fill('[name="item-qty-0"]',   '1');
  await page.fill('[name="item-price-0"]', String(unitPrice));
}

// ── Invoice flow ──────────────────────────────────────────────────────────────

test.describe('Invoice', () => {

  test('create invoice, check preview fields, download PDF', async ({ page }) => {
    await page.goto('/index.html');

    // Click FAB to create new invoice
    await page.click('#fab-new');
    await expect(page).toHaveURL(/html\/new-document\.html$/);
    await expect(page.locator('#page-title')).toHaveText('Nueva factura');

    // Invoice number field must be visible
    await expect(page.locator('#group-number')).toBeVisible();

    // Payment section must be visible
    await expect(page.locator('#section-payment')).toBeVisible();

    // Fill form
    await fillDocForm(page, {
      issueDate:     '2026-03-21',
      clientName:    'Empresa Test S.L.',
      clientNif:     'B12345678',
      clientAddress: 'Calle Mayor 1\n50001, Zaragoza',
      vatRate:       21,
      irpfRate:      15,
      paymentMethod: 'Transferencia bancaria',
      iban:          'ES91 2100 0418 4502 0005 1332',
    });

    await fillFirstItem(page, 'Servicios de consultoría marzo 2026', 500);

    // Save
    await page.click('#btn-save');
    await expect(page).toHaveURL(/html\/preview\.html\?id=\d+/);

    // Check preview fields
    await expect(page.locator('#doc-number')).toContainText('Nº');
    await expect(page.locator('#doc-title')).toHaveText('FACTURA');
    await expect(page.locator('#doc-client')).toContainText('Empresa Test S.L.');
    await expect(page.locator('#doc-client')).toContainText('B12345678');
    await expect(page.locator('#doc-description')).toContainText('Servicios de consultoría');
    await expect(page.locator('#doc-totals')).toContainText('500,00');   // base
    await expect(page.locator('#doc-totals')).toContainText('105,00');   // IVA
    await expect(page.locator('#doc-totals')).toContainText('75,00');    // IRPF
    await expect(page.locator('#doc-totals')).toContainText('530,00');   // total
    await expect(page.locator('#doc-totals')).toContainText('Transferencia bancaria');

    // PDF download button must be visible
    await expect(page.locator('#btn-download')).toBeVisible();

    // Template selector must be visible with Classic selected by default
    await expect(page.locator('.template-selector')).toBeVisible();
    await expect(page.locator('[data-template="classic"]')).toHaveClass(/template-btn--active/);
  });

  test('invoice without IRPF does not show IRPF row in preview', async ({ page }) => {
    await page.goto('/html/new-document.html');

    await fillDocForm(page, {
      issueDate:  '2026-03-21',
      clientName: 'Cliente Sin IRPF',
      vatRate:    21,
      irpfRate:   0,
    });

    await fillFirstItem(page, 'Servicio sin retención', 500);

    await page.click('#btn-save');
    await expect(page).toHaveURL(/html\/preview\.html\?id=\d+/);

    // IRPF row should NOT appear
    await expect(page.locator('#doc-totals')).not.toContainText('IRPF');
    // Total = 500 + 105 = 605
    await expect(page.locator('#doc-totals')).toContainText('605,00');
  });

});

// ── Quote flow ────────────────────────────────────────────────────────────────

test.describe('Quote', () => {

  test('create quote — no invoice number, no payment fields', async ({ page }) => {
    await page.goto('/index.html');

    // Switch to Presupuestos tab
    await page.click('.tab[data-type="quote"]');

    // Click FAB
    await page.click('#fab-new');
    await expect(page).toHaveURL(/html\/new-document\.html\?type=quote/);
    await expect(page.locator('#page-title')).toHaveText('Nuevo presupuesto');

    // Invoice number field must be HIDDEN
    await expect(page.locator('#group-number')).toBeHidden();

    // Payment section must be HIDDEN
    await expect(page.locator('#section-payment')).toBeHidden();

    // Fill form
    await fillDocForm(page, {
      issueDate:  '2026-03-21',
      clientName: 'Cliente Presupuesto',
      clientNif:  'A98765432',
      vatRate:    10,
      irpfRate:   0,
    });

    await fillFirstItem(page, 'Presupuesto de obra pintado interior', 800);

    await page.click('#btn-save');
    await expect(page).toHaveURL(/html\/preview\.html\?id=\d+/);

    // Preview must show PRESUPUESTO not FACTURA
    await expect(page.locator('#doc-title')).toHaveText('PRESUPUESTO');

    // Number must be hidden in preview
    await expect(page.locator('#doc-number')).toBeHidden();

    // Payment info must NOT appear
    await expect(page.locator('#doc-totals')).not.toContainText('Transferencia');
    await expect(page.locator('#doc-totals')).not.toContainText('IBAN');

    // IRPF must NOT appear (rate = 0)
    await expect(page.locator('#doc-totals')).not.toContainText('IRPF');

    // Total = 800 + 80 = 880
    await expect(page.locator('#doc-totals')).toContainText('880,00');

    // PDF download available
    await expect(page.locator('#btn-download')).toBeVisible();
  });

});
