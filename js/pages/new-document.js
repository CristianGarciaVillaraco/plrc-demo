// ── URL params ────────────────────────────────────────────────────────────────

const params  = new URLSearchParams(location.search);
const editId  = params.get('id') ? Number(params.get('id')) : null;
const docType = params.get('type') === 'quote' ? DOC_TYPES.QUOTE : DOC_TYPES.INVOICE;
const isQuote = docType === DOC_TYPES.QUOTE;

// ── Items state ───────────────────────────────────────────────────────────────

let items = [];   // [{ description, quantity, unitPrice }]

function computeItemSubtotal(item) {
  return +((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2);
}

// ── Totals preview ────────────────────────────────────────────────────────────

function updateTotalsPreview() {
  const base = items.reduce((s, it) => s + computeItemSubtotal(it), 0);
  const vat  = parseFloat(document.getElementById('vatRate').value)  || 0;
  const irpf = parseFloat(document.getElementById('irpfRate').value) || 0;
  const { vatAmount, irpfAmount, total } = computeAmounts(base, vat, irpf);

  document.getElementById('preview-base').textContent  = formatAmount(base);
  document.getElementById('preview-vat').textContent   = formatAmount(vatAmount);
  document.getElementById('preview-irpf').textContent  = formatAmount(irpfAmount);
  document.getElementById('preview-total').textContent = formatAmount(total);
}

// ── Items table ───────────────────────────────────────────────────────────────

function buildItemRow(index) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.dataset.index = index;

  const it = items[index];
  row.innerHTML = `
    <input class="input items-col--desc" type="text"   name="item-desc-${index}"  placeholder="Descripción"  value="${it.description || ''}" />
    <input class="input items-col--qty"  type="number" name="item-qty-${index}"   placeholder="1"   min="0" step="any" value="${it.quantity || ''}" />
    <input class="input items-col--price" type="number" name="item-price-${index}" placeholder="0.00" min="0" step="0.01" value="${it.unitPrice || ''}" />
    <span  class="items-col--sub item-subtotal">${formatAmount(computeItemSubtotal(it))}</span>
    <button type="button" class="items-col--del item-del-btn" aria-label="Eliminar línea">×</button>
  `;

  row.querySelector('[name="item-desc-${index}"]'.replace('${index}', index))?.addEventListener('input', e => {
    items[index].description = e.target.value;
  });
  row.querySelector(`[name="item-qty-${index}"]`).addEventListener('input', e => {
    items[index].quantity = e.target.value;
    updateRowSubtotal(row, index);
    updateTotalsPreview();
  });
  row.querySelector(`[name="item-price-${index}"]`).addEventListener('input', e => {
    items[index].unitPrice = e.target.value;
    updateRowSubtotal(row, index);
    updateTotalsPreview();
  });
  row.querySelector('.item-del-btn').addEventListener('click', () => {
    items.splice(index, 1);
    renderItemsTable();
    updateTotalsPreview();
  });

  return row;
}

function updateRowSubtotal(row, index) {
  const sub = row.querySelector('.item-subtotal');
  if (sub) sub.textContent = formatAmount(computeItemSubtotal(items[index]));
}

function renderItemsTable() {
  const body = document.getElementById('items-body');
  body.innerHTML = '';
  items.forEach((_, i) => body.appendChild(buildItemRow(i)));
}

function addItem() {
  items.push({ description: '', quantity: 1, unitPrice: '' });
  renderItemsTable();
  // Focus description of new row
  const rows = document.querySelectorAll('.item-row');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('input')?.focus();
}

document.getElementById('btn-add-item').addEventListener('click', addItem);

['vatRate', 'irpfRate'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateTotalsPreview);
});

// ── Form data ─────────────────────────────────────────────────────────────────

function getFormData() {
  const f = document.getElementById('invoice-form');

  // Sync description values from inputs
  document.querySelectorAll('.item-row').forEach((row, i) => {
    if (items[i]) {
      items[i].description = row.querySelector(`[name="item-desc-${i}"]`)?.value?.trim() || '';
    }
  });

  const data = {
    type:          docType,
    issueDate:     f.issueDate.value,
    dueDate:       f.dueDate.value,
    clientName:    f.clientName.value.trim(),
    clientNif:     f.clientNif.value.trim(),
    clientAddress: f.clientAddress.value.trim(),
    vatRate:       parseFloat(f.vatRate.value)   || 0,
    irpfRate:      parseFloat(f.irpfRate.value)  || 0,
    notes:         f.notes.value.trim(),
    items:         items.filter(it => it.description || (parseFloat(it.quantity) > 0 && parseFloat(it.unitPrice) > 0)),
  };

  data.number = f.number.value.trim();
  if (!isQuote) {
    data.paymentMethod = f.paymentMethod.value.trim();
    data.iban          = f.iban.value.trim();
  }

  return data;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(data) {
  if (!data.number) return isQuote ? 'El número de presupuesto es obligatorio.' : 'El número de factura es obligatorio.';
  if (!data.issueDate)          return 'La fecha de emisión es obligatoria.';
  if (!data.clientName)         return 'El nombre del cliente es obligatorio.';
  if (data.items.length === 0)  return 'Añade al menos una línea de concepto.';
  const base = data.items.reduce((s, it) =>
    s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
  if (base <= 0) return 'La base imponible debe ser mayor que 0.';
  return null;
}

// ── Submit ────────────────────────────────────────────────────────────────────

document.getElementById('invoice-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data  = getFormData();
  const error = validate(data);
  if (error) { alert(error); return; }

  const btn = document.getElementById('btn-save');
  btn.disabled    = true;
  btn.textContent = 'Guardando…';

  try {
    let id;
    if (editId) {
      await updateInvoice(editId, data);
      id = editId;
    } else {
      id = await createInvoice(data);
    }
    location.href = `preview.html?id=${id}`;
  } catch (err) {
    console.error(err);
    alert('Error al guardar. Inténtalo de nuevo.');
    btn.disabled    = false;
    btn.textContent = isQuote ? 'Crear presupuesto' : 'Crear factura';
  }
});

// ── Back button ───────────────────────────────────────────────────────────────

document.getElementById('btn-back').addEventListener('click', () => {
  location.href = editId ? `preview.html?id=${editId}` : '../index.html';
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  if (isQuote) {
    document.getElementById('label-number').textContent = 'Número de presupuesto';
    document.getElementById('section-payment').hidden = true;
    document.getElementById('section-label-meta').textContent = 'Presupuesto';
  } else {
    document.getElementById('label-number').textContent = 'Número de factura';
  }

  if (editId) {
    const inv = await getInvoice(editId);
    if (!inv) { location.href = '../index.html'; return; }

    const editingQuote = inv.type === DOC_TYPES.QUOTE;
    document.getElementById('page-title').textContent = editingQuote ? 'Editar presupuesto' : 'Editar factura';
    document.getElementById('btn-save').textContent   = 'Guardar cambios';

    if (editingQuote) {
      document.getElementById('label-number').textContent = 'Número de presupuesto';
      document.getElementById('section-payment').hidden = true;
      document.getElementById('section-label-meta').textContent = 'Presupuesto';
    } else {
      document.getElementById('label-number').textContent = 'Número de factura';
    }

    // Load items: if old doc has no items, convert description+baseAmount to one item
    if (inv.items && inv.items.length > 0) {
      items = inv.items.map(it => ({ ...it }));
    } else if (inv.description || inv.baseAmount) {
      items = [{
        description: inv.description || '',
        quantity:    1,
        unitPrice:   inv.baseAmount  || 0,
      }];
    }

    // Fill remaining fields
    const f = document.getElementById('invoice-form');
    f.number.value        = inv.number        ?? '';
    f.issueDate.value     = inv.issueDate     ?? '';
    f.dueDate.value       = inv.dueDate       ?? '';
    f.clientName.value    = inv.clientName    ?? '';
    f.clientNif.value     = inv.clientNif     ?? '';
    f.clientAddress.value = inv.clientAddress ?? '';
    f.vatRate.value       = inv.vatRate       ?? DEFAULTS.VAT_RATE;
    f.irpfRate.value      = inv.irpfRate      ?? DEFAULTS.IRPF_RATE;
    if (!editingQuote) {
      f.paymentMethod.value = inv.paymentMethod ?? '';
      f.iban.value          = inv.iban          ?? '';
    }
    f.notes.value = inv.notes ?? '';
  } else {
    // New document
    document.getElementById('page-title').textContent = isQuote ? 'Nuevo presupuesto' : 'Nueva factura';
    document.getElementById('btn-save').textContent   = isQuote ? 'Crear presupuesto' : 'Crear factura';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;

    document.getElementById('number').value = isQuote
      ? await nextQuoteNumber()
      : await nextInvoiceNumber();

    // Start with one empty item row
    items = [{ description: '', quantity: 1, unitPrice: '' }];
  }

  renderItemsTable();
  updateTotalsPreview();
}

init();
