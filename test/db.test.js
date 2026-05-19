/**
 * Unit tests for db.js pure logic.
 * Run: node --test test/db.test.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

// ── Load db.js in a controlled context ───────────────────────────────────────

// Capture the Dexie instance so we can swap out db.invoices per test
let dbInstance;

class MockDexie {
  constructor() { dbInstance = this; }
  version()     { return { stores: () => ({ upgrade: () => {} }), upgrade: () => {} }; }
}

const src = fs.readFileSync(path.join(__dirname, '../js/db.js'), 'utf8');
const ctx = { Dexie: MockDexie, console };
vm.createContext(ctx);
vm.runInContext(src, ctx);

// Functions exported into the vm context
const {
  computeAmounts, computeBaseFromItems,
  nextInvoiceNumber, nextQuoteNumber,
  createInvoice, updateInvoice, getInvoice, deleteInvoice, setInvoiceStatus,
  listByType,
} = ctx;

// ── Mock helpers ──────────────────────────────────────────────────────────────

let storedDocs = [];

/** Full mock supporting all db.invoices operations */
function mockDb(rows) {
  storedDocs = rows.map((r, i) => ({ id: i + 1, ...r }));
  dbInstance.invoices = {
    where: (field) => ({
      startsWith: (prefix) => ({
        toArray: async () => storedDocs.filter(r => r.number && r.number.startsWith(prefix)),
      }),
      equals: (value) => ({
        reverse: () => ({
          sortBy: async (key) =>
            [...storedDocs.filter(r => r[field] === value)].sort((a, b) =>
              b[key] > a[key] ? 1 : -1
            ),
        }),
      }),
    }),
    add: async (doc) => {
      const id = storedDocs.length + 1;
      storedDocs.push({ id, ...doc });
      return id;
    },
    get: async (id) => storedDocs.find(r => r.id === id) ?? null,
    update: async (id, data) => {
      const idx = storedDocs.findIndex(r => r.id === id);
      if (idx === -1) return 0;
      storedDocs[idx] = { ...storedDocs[idx], ...data };
      return 1;
    },
    delete: async (id) => {
      const idx = storedDocs.findIndex(r => r.id === id);
      if (idx !== -1) storedDocs.splice(idx, 1);
    },
  };
}

// Backwards-compat alias used by nextInvoiceNumber tests below
function mockInvoices(rows) { mockDb(rows); }

// ── computeAmounts ────────────────────────────────────────────────────────────

describe('computeAmounts', () => {

  test('standard case: 1000 base, 21% VAT, 15% IRPF', () => {
    const result = computeAmounts(1000, 21, 15);
    assert.equal(result.vatAmount,  210);
    assert.equal(result.irpfAmount, 150);
    assert.equal(result.total,      1060);
  });

  test('zero VAT and zero IRPF returns base as total', () => {
    const result = computeAmounts(500, 0, 0);
    assert.equal(result.vatAmount,  0);
    assert.equal(result.irpfAmount, 0);
    assert.equal(result.total,      500);
  });

  test('rounds to 2 decimal places', () => {
    // 100 * 10% = 10.00, 100 * 3.33% = 3.33, total = 106.67
    const result = computeAmounts(100, 10, 3.33);
    assert.equal(result.vatAmount,  10);
    assert.equal(result.irpfAmount, 3.33);
    assert.equal(result.total,      106.67);
  });

  test('invalid inputs treated as 0', () => {
    const result = computeAmounts('abc', null, undefined);
    assert.equal(result.vatAmount,  0);
    assert.equal(result.irpfAmount, 0);
    assert.equal(result.total,      0);
  });

  test('full IRPF wipeout: total equals base when IRPF = VAT', () => {
    const result = computeAmounts(1000, 21, 21);
    assert.equal(result.vatAmount,  210);
    assert.equal(result.irpfAmount, 210);
    assert.equal(result.total,      1000);
  });

});

// ── nextInvoiceNumber ─────────────────────────────────────────────────────────

describe('nextInvoiceNumber', () => {
  const year = new Date().getFullYear();

  test('returns F-YYYY-001 when no invoices exist for the current year', async () => {
    mockInvoices([]);
    const num = await nextInvoiceNumber();
    assert.equal(num, `F-${year}-001`);
  });

  test('returns max + 1 when invoices exist', async () => {
    mockInvoices([
      { number: `F-${year}-001` },
      { number: `F-${year}-003` },
      { number: `F-${year}-002` },
    ]);
    const num = await nextInvoiceNumber();
    assert.equal(num, `F-${year}-004`);
  });

  test('pads sequence number to 3 digits', async () => {
    mockInvoices([{ number: `F-${year}-009` }]);
    const num = await nextInvoiceNumber();
    assert.equal(num, `F-${year}-010`);
  });

  test('handles gaps in sequence correctly', async () => {
    // Only 001 and 005 exist → next should be 006, not 002
    mockInvoices([
      { number: `F-${year}-001` },
      { number: `F-${year}-005` },
    ]);
    const num = await nextInvoiceNumber();
    assert.equal(num, `F-${year}-006`);
  });

  test('ignores quote numbers (P- prefix) when computing next invoice number', async () => {
    mockInvoices([
      { number: `F-${year}-002` },
      { number: `P-${year}-005` },
    ]);
    const num = await nextInvoiceNumber();
    assert.equal(num, `F-${year}-003`);
  });

});

// ── nextQuoteNumber ───────────────────────────────────────────────────────────

describe('nextQuoteNumber', () => {
  const year = new Date().getFullYear();

  test('returns P-YYYY-001 when no quotes exist for the current year', async () => {
    mockInvoices([]);
    const num = await nextQuoteNumber();
    assert.equal(num, `P-${year}-001`);
  });

  test('returns max + 1 when quotes exist', async () => {
    mockInvoices([
      { number: `P-${year}-001` },
      { number: `P-${year}-003` },
    ]);
    const num = await nextQuoteNumber();
    assert.equal(num, `P-${year}-004`);
  });

  test('pads sequence number to 3 digits', async () => {
    mockInvoices([{ number: `P-${year}-009` }]);
    const num = await nextQuoteNumber();
    assert.equal(num, `P-${year}-010`);
  });

  test('ignores invoice numbers (F- prefix) when computing next quote number', async () => {
    mockInvoices([
      { number: `F-${year}-010` },
      { number: `P-${year}-002` },
    ]);
    const num = await nextQuoteNumber();
    assert.equal(num, `P-${year}-003`);
  });

});

// ── createInvoice type field ───────────────────────────────────────────────────

describe('createInvoice', () => {

  test('defaults type to invoice when not provided', async () => {
    mockDb([]);
    await createInvoice({ baseAmount: 100, vatRate: 21, irpfRate: 0 });
    assert.equal(storedDocs[0].type, 'invoice');
  });

  test('saves type=quote when provided', async () => {
    mockDb([]);
    await createInvoice({ type: 'quote', baseAmount: 200, vatRate: 21, irpfRate: 0 });
    assert.equal(storedDocs[0].type, 'quote');
  });

  test('always sets status to draft', async () => {
    mockDb([]);
    await createInvoice({ baseAmount: 100, vatRate: 0, irpfRate: 0 });
    assert.equal(storedDocs[0].status, 'draft');
  });

});

// ── listByType ────────────────────────────────────────────────────────────────

describe('listByType', () => {

  test('returns only invoices when type=invoice', async () => {
    mockDb([
      { type: 'invoice', createdAt: new Date('2026-01-01') },
      { type: 'quote',   createdAt: new Date('2026-01-02') },
      { type: 'invoice', createdAt: new Date('2026-01-03') },
    ]);
    const result = await listByType('invoice');
    assert.equal(result.length, 2);
    assert.ok(result.every(r => r.type === 'invoice'));
  });

  test('returns only quotes when type=quote', async () => {
    mockDb([
      { type: 'invoice', createdAt: new Date('2026-01-01') },
      { type: 'quote',   createdAt: new Date('2026-01-02') },
    ]);
    const result = await listByType('quote');
    assert.equal(result.length, 1);
    assert.equal(result[0].type, 'quote');
  });

  test('returns empty array when no documents of that type', async () => {
    mockDb([{ type: 'invoice', createdAt: new Date('2026-01-01') }]);
    const result = await listByType('quote');
    assert.equal(result.length, 0);
  });

});

// ── computeBaseFromItems ──────────────────────────────────────────────────────

describe('computeBaseFromItems', () => {

  test('returns 0 for empty array', () => {
    assert.equal(computeBaseFromItems([]), 0);
  });

  test('returns 0 for null or undefined', () => {
    assert.equal(computeBaseFromItems(null),      0);
    assert.equal(computeBaseFromItems(undefined), 0);
  });

  test('single item: quantity × unitPrice', () => {
    assert.equal(computeBaseFromItems([{ quantity: 3, unitPrice: 50 }]), 150);
  });

  test('sums multiple items', () => {
    const items = [
      { quantity: 2, unitPrice: 100 },
      { quantity: 1, unitPrice:  50 },
    ];
    assert.equal(computeBaseFromItems(items), 250);
  });

  test('rounds result to 2 decimal places', () => {
    assert.equal(computeBaseFromItems([{ quantity: 3, unitPrice: 0.1 }]), 0.30);
  });

  test('treats invalid quantity or unitPrice as 0', () => {
    const items = [
      { quantity: 'abc', unitPrice: 100 },
      { quantity: 2,     unitPrice: null },
    ];
    assert.equal(computeBaseFromItems(items), 0);
  });

});

// ── createInvoice — line items ────────────────────────────────────────────────

describe('createInvoice with items', () => {

  test('computes baseAmount from items when items are provided', async () => {
    mockDb([]);
    await createInvoice({ items: [{ quantity: 2, unitPrice: 100 }], vatRate: 21, irpfRate: 0 });
    assert.equal(storedDocs[0].baseAmount, 200);
    assert.equal(storedDocs[0].vatAmount,   42);
    assert.equal(storedDocs[0].total,       242);
  });

  test('ignores flat baseAmount when items array is non-empty', async () => {
    mockDb([]);
    await createInvoice({ items: [{ quantity: 1, unitPrice: 50 }], baseAmount: 999, vatRate: 0, irpfRate: 0 });
    assert.equal(storedDocs[0].baseAmount, 50);
  });

});

// ── updateInvoice ─────────────────────────────────────────────────────────────

describe('updateInvoice', () => {

  test('recomputes amounts when baseAmount changes', async () => {
    mockDb([{ type: 'invoice', baseAmount: 100, vatAmount: 21, total: 121 }]);
    await updateInvoice(1, { items: [], baseAmount: 200, vatRate: 21, irpfRate: 0 });
    const doc = storedDocs.find(r => r.id === 1);
    assert.equal(doc.baseAmount, 200);
    assert.equal(doc.vatAmount,   42);
    assert.equal(doc.total,       242);
  });

  test('uses items to compute baseAmount when items are non-empty', async () => {
    mockDb([{ type: 'invoice' }]);
    await updateInvoice(1, { items: [{ quantity: 3, unitPrice: 100 }], vatRate: 0, irpfRate: 0 });
    const doc = storedDocs.find(r => r.id === 1);
    assert.equal(doc.baseAmount, 300);
  });

});

// ── setInvoiceStatus ──────────────────────────────────────────────────────────

describe('setInvoiceStatus', () => {

  test('updates only the status field, leaves the rest intact', async () => {
    mockDb([{ type: 'invoice', status: 'draft', baseAmount: 500 }]);
    await setInvoiceStatus(1, 'paid');
    const doc = storedDocs.find(r => r.id === 1);
    assert.equal(doc.status,     'paid');
    assert.equal(doc.baseAmount,  500);
  });

  test('can transition to every valid status', async () => {
    for (const status of ['draft', 'pending', 'paid']) {
      mockDb([{ type: 'invoice', status: 'draft' }]);
      await setInvoiceStatus(1, status);
      assert.equal(storedDocs.find(r => r.id === 1).status, status);
    }
  });

});

// ── getInvoice ────────────────────────────────────────────────────────────────

describe('getInvoice', () => {

  test('returns the document for a valid id', async () => {
    mockDb([{ type: 'invoice', number: 'F-2026-001' }]);
    const doc = await getInvoice(1);
    assert.equal(doc.number, 'F-2026-001');
  });

  test('returns null for a non-existent id', async () => {
    mockDb([]);
    const doc = await getInvoice(99);
    assert.equal(doc, null);
  });

});

// ── deleteInvoice ─────────────────────────────────────────────────────────────

describe('deleteInvoice', () => {

  test('removes the target document', async () => {
    mockDb([{ type: 'invoice' }, { type: 'invoice' }]);
    await deleteInvoice(1);
    assert.equal(storedDocs.length, 1);
    assert.equal(storedDocs[0].id,  2);
  });

  test('leaves other documents untouched', async () => {
    mockDb([{ type: 'invoice', number: 'F-2026-001' }, { type: 'invoice', number: 'F-2026-002' }]);
    await deleteInvoice(1);
    assert.equal(storedDocs[0].number, 'F-2026-002');
  });

});
