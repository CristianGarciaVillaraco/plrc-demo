// Dexie must be loaded before this script via CDN script tag
const db = new Dexie('plrc');

db.version(1).stores({
  invoices: '++id, number, status, createdAt'
});

db.version(2).stores({
  invoices: '++id, number, status, type, createdAt'
}).upgrade(tx => {
  return tx.table('invoices').toCollection().modify(doc => {
    if (!doc.type) doc.type = 'invoice';
  });
});

// v3: adds items[] (line items) — old docs keep description + baseAmount as-is
db.version(3).stores({
  invoices: '++id, number, status, type, createdAt'
}).upgrade(tx => {
  return tx.table('invoices').toCollection().modify(doc => {
    if (!doc.items) doc.items = [];
  });
});

// v4: renumber invoices to F-YYYY-NNN format (quotes get P- prefix going forward)
db.version(4).stores({
  invoices: '++id, number, status, type, createdAt'
}).upgrade(tx => {
  return tx.table('invoices').toCollection().modify(doc => {
    if (doc.type === 'invoice' && doc.number && !doc.number.startsWith('F-')) {
      doc.number = `F-${doc.number}`;
    }
  });
});

// ── Document numbering ────────────────────────────────────────────────────────

/** Generate next invoice number for the current year: "F-YYYY-NNN" */
async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `F-${year}-`;
  const all = await db.invoices
    .where('number')
    .startsWith(prefix)
    .toArray();
  const max = all.reduce((acc, inv) => {
    const n = parseInt(inv.number.split('-')[2] || '0', 10);
    return n > acc ? n : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** Generate next quote number for the current year: "P-YYYY-NNN" */
async function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `P-${year}-`;
  const all = await db.invoices
    .where('number')
    .startsWith(prefix)
    .toArray();
  const max = all.reduce((acc, doc) => {
    const n = parseInt(doc.number.split('-')[2] || '0', 10);
    return n > acc ? n : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// ── Amount computation ────────────────────────────────────────────────────────

/** Compute vatAmount, irpfAmount and total from raw fields */
function computeAmounts(baseAmount, vatRate, irpfRate) {
  const base = parseFloat(baseAmount) || 0;
  const vat  = parseFloat(vatRate)  || 0;
  const irpf = parseFloat(irpfRate) || 0;
  const vatAmount  = +(base * vat  / 100).toFixed(2);
  const irpfAmount = +(base * irpf / 100).toFixed(2);
  const total      = +(base + vatAmount - irpfAmount).toFixed(2);
  return { vatAmount, irpfAmount, total };
}

/** Compute baseAmount from line items array */
function computeBaseFromItems(items) {
  if (!items || items.length === 0) return 0;
  return +items.reduce((sum, item) => {
    const qty   = parseFloat(item.quantity)  || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0).toFixed(2);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Save a new invoice or quote. Returns the auto-incremented id. */
async function createInvoice(data) {
  if (typeof pullSilentFromCloudflare === 'function') await pullSilentFromCloudflare();
  const items      = data.items || [];
  const baseAmount = items.length > 0
    ? computeBaseFromItems(items)
    : (parseFloat(data.baseAmount) || 0);
  const amounts = computeAmounts(baseAmount, data.vatRate, data.irpfRate);
  const id = await db.invoices.add({
    ...data,
    items,
    baseAmount,
    ...amounts,
    type:      data.type || 'invoice',
    status:    'draft',
    createdAt: new Date(),
  });
  if (typeof pushToCloudflare === 'function') {
    const doc = await db.invoices.get(id);
    pushToCloudflare(id, doc).catch(console.error);
  }
  return id;
}

/** Update an existing invoice by id. */
async function updateInvoice(id, data) {
  if (typeof pullSilentFromCloudflare === 'function') await pullSilentFromCloudflare();
  const items      = data.items || [];
  const baseAmount = items.length > 0
    ? computeBaseFromItems(items)
    : (parseFloat(data.baseAmount) || 0);
  const amounts = computeAmounts(baseAmount, data.vatRate, data.irpfRate);
  await db.invoices.update(Number(id), { ...data, items, baseAmount, ...amounts });
  if (typeof pushToCloudflare === 'function') {
    const doc = await db.invoices.get(Number(id));
    pushToCloudflare(Number(id), doc).catch(console.error);
  }
}

/** Get a single invoice by id. */
async function getInvoice(id) {
  return db.invoices.get(Number(id));
}

/** Get all documents of a given type ('invoice' | 'quote'), newest first. */
async function listByType(type) {
  return db.invoices.where('type').equals(type).reverse().sortBy('createdAt');
}

/** Delete an invoice by id. */
async function deleteInvoice(id) {
  if (typeof pullSilentFromCloudflare === 'function') await pullSilentFromCloudflare();
  if (typeof deleteFromCloudflare === 'function') {
    deleteFromCloudflare(Number(id)).catch(console.error);
  }
  return db.invoices.delete(Number(id));
}

/** Update only the status field of an invoice. */
async function setInvoiceStatus(id, status) {
  if (typeof pullSilentFromCloudflare === 'function') await pullSilentFromCloudflare();
  await db.invoices.update(Number(id), { status });
  if (typeof pushToCloudflare === 'function') {
    const doc = await db.invoices.get(Number(id));
    pushToCloudflare(Number(id), doc).catch(console.error);
  }
}
