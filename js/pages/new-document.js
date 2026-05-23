// ── URL params ────────────────────────────────────────────────────────────────

const params  = new URLSearchParams(location.search);
const editId  = params.get('id') ? Number(params.get('id')) : null;
const docType = params.get('type') === 'quote' ? DOC_TYPES.QUOTE : DOC_TYPES.INVOICE;
const isQuote = docType === DOC_TYPES.QUOTE;

// ── Dirty state ───────────────────────────────────────────────────────────────

let isDirty          = false;
let formInitialized  = false;

function markDirty() { if (formInitialized) isDirty = true; }

function navigateBack() {
  if (editId) {
    location.href = `preview.html?id=${editId}`;
  } else {
    location.href = isQuote ? '../index.html?type=quote' : '../index.html';
  }
}

document.getElementById('discard-modal-stay').addEventListener('click', () => {
  document.getElementById('discard-modal').hidden = true;
});
document.getElementById('discard-modal-discard').addEventListener('click', () => {
  document.getElementById('discard-modal').hidden = true;
  navigateBack();
});
document.getElementById('discard-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('discard-modal').hidden = true;
});

// ── Custom select (payment method) ───────────────────────────────────────────

function initPaymentSelect() {
  const wrap    = document.getElementById('paymentMethod-wrap');
  const btn     = document.getElementById('paymentMethod-btn');
  const dropdown = document.getElementById('paymentMethod-dropdown');
  const hidden  = document.getElementById('paymentMethod');
  const display = document.getElementById('paymentMethod-display');

  const open  = () => { dropdown.hidden = false; wrap.classList.add('custom-select--open'); btn.setAttribute('aria-expanded', 'true'); };
  const close = () => { dropdown.hidden = true;  wrap.classList.remove('custom-select--open'); btn.setAttribute('aria-expanded', 'false'); };

  btn.addEventListener('click', () => dropdown.hidden ? open() : close());

  dropdown.querySelectorAll('.custom-select__option').forEach(opt => {
    opt.addEventListener('click', () => {
      markDirty();
      setPaymentMethod(opt.dataset.value);
      close();
    });
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) close();
  });
}

function setPaymentMethod(value) {
  const hidden  = document.getElementById('paymentMethod');
  const display = document.getElementById('paymentMethod-display');
  const dropdown = document.getElementById('paymentMethod-dropdown');
  hidden.value    = value;
  display.textContent = value;
  dropdown.querySelectorAll('.custom-select__option').forEach(opt => {
    opt.classList.toggle('custom-select__option--selected', opt.dataset.value === value);
  });
}

function initStreetTypeSelect() {
  const wrap     = document.getElementById('streetType-wrap');
  const btn      = document.getElementById('streetType-btn');
  const dropdown = document.getElementById('streetType-dropdown');

  const open  = () => { dropdown.hidden = false; wrap.classList.add('custom-select--open'); btn.setAttribute('aria-expanded', 'true'); };
  const close = () => { dropdown.hidden = true;  wrap.classList.remove('custom-select--open'); btn.setAttribute('aria-expanded', 'false'); };

  btn.addEventListener('click', () => dropdown.hidden ? open() : close());

  dropdown.querySelectorAll('.custom-select__option').forEach(opt => {
    opt.addEventListener('click', () => {
      markDirty();
      setStreetType(opt.dataset.value);
      close();
    });
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) close();
  });
}

function setStreetType(value) {
  const hidden   = document.getElementById('clientStreetType');
  const display  = document.getElementById('streetType-display');
  const dropdown = document.getElementById('streetType-dropdown');
  hidden.value        = value;
  display.textContent = value;
  dropdown.querySelectorAll('.custom-select__option').forEach(opt => {
    opt.classList.toggle('custom-select__option--selected', opt.dataset.value === value);
  });
}

// ── Form validation (enable/disable save button) ─────────────────────────────

function checkFormValid() {
  const f        = document.getElementById('invoice-form');
  const hasName  = f.clientName.value.trim().length > 0;
  const hasNif   = f.clientNif.value.trim().length > 0;
  const hasDate  = document.getElementById('issueDate').value.length > 0;
  const hasItems = items.some(it =>
    it.description?.trim().length > 0 && (parseFloat(it.unitPrice) || 0) > 0
  );
  document.getElementById('btn-save').disabled = !(hasName && hasNif && hasDate && hasItems);
}

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
    <span class="items-col--idx">${index + 1}</span>
    <input class="input items-col--desc" type="text"   name="item-desc-${index}"  placeholder="Descripción"  value="${it.description || ''}" />
    <input class="input items-col--qty"  type="number" name="item-qty-${index}"   placeholder="1"   min="0" step="any" value="${it.quantity || ''}" />
    <input class="input items-col--price" type="number" name="item-price-${index}" placeholder="0.00" min="0" step="0.01" value="${it.unitPrice || ''}" />
    <span  class="items-col--sub item-subtotal">${formatAmount(computeItemSubtotal(it))}</span>
    <button type="button" class="items-col--del item-del-btn" aria-label="Eliminar línea" title="Eliminar línea">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
    </button>
  `;

  row.querySelector('[name="item-desc-${index}"]'.replace('${index}', index))?.addEventListener('input', e => {
    items[index].description = e.target.value;
    checkFormValid();
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
    checkFormValid();
  });
  row.querySelector('.item-del-btn').addEventListener('click', () => {
    markDirty();
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
  const body  = document.getElementById('items-body');
  const empty = document.getElementById('items-empty');
  body.innerHTML = '';
  const builder = isMobile() ? buildItemCard : buildItemRow;
  items.forEach((_, i) => body.appendChild(builder(i)));
  if (empty) empty.hidden = items.length > 0;
  checkFormValid();
}

function addItem() {
  markDirty();
  items.push({ description: '', quantity: 1, unitPrice: '' });
  renderItemsTable();
  const rows = document.querySelectorAll('.item-row');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('input')?.focus();
}

// ── Mobile items ──────────────────────────────────────────────────────────────

const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

// ── Item modal ────────────────────────────────────────────────────────────────

let _editingItemIndex = null;

function openItemModal(index) {
  _editingItemIndex = index;
  const isEdit = index !== null;
  document.getElementById('item-modal-title').textContent   = isEdit ? 'Editar concepto' : 'Añadir concepto';
  document.getElementById('item-modal-confirm').textContent = isEdit ? 'Guardar' : 'Añadir';
  document.getElementById('modal-item-desc').value  = isEdit ? (items[index].description || '') : '';
  document.getElementById('modal-item-qty').value   = isEdit ? (items[index].quantity   ?? 1)  : 1;
  document.getElementById('modal-item-price').value = isEdit ? (items[index].unitPrice  || '') : '';
  document.getElementById('item-modal').hidden = false;
  setTimeout(() => document.getElementById('modal-item-desc').focus(), 50);
}

function closeItemModal() {
  document.getElementById('item-modal').hidden = true;
  _editingItemIndex = null;
}

document.getElementById('item-modal-cancel').addEventListener('click', closeItemModal);

document.getElementById('item-modal-confirm').addEventListener('click', () => {
  const desc  = document.getElementById('modal-item-desc').value.trim();
  const qty   = document.getElementById('modal-item-qty').value;
  const price = document.getElementById('modal-item-price').value;
  if (!desc) { document.getElementById('modal-item-desc').focus(); return; }
  markDirty();
  const item = { description: desc, quantity: qty || 1, unitPrice: price };
  if (_editingItemIndex !== null) {
    items[_editingItemIndex] = item;
  } else {
    items.push(item);
  }
  closeItemModal();
  renderItemsTable();
  updateTotalsPreview();
  checkFormValid();
});

// ── Delete mode ───────────────────────────────────────────────────────────────

let _deleteMode    = false;
let _selectedItems = new Set();

function enterDeleteMode() {
  _deleteMode = true;
  _selectedItems.clear();
  document.getElementById('btn-delete-mode').classList.add('items-toolbar__btn--active');
  const addBtn = document.getElementById('btn-add-item');
  addBtn.innerHTML = '<span>Cancelar</span>';
  addBtn.classList.add('items-toolbar__btn--cancel');
  renderItemsTable();
}

function exitDeleteMode() {
  _deleteMode = false;
  _selectedItems.clear();
  const delBtn = document.getElementById('btn-delete-mode');
  delBtn.classList.remove('items-toolbar__btn--active');
  delBtn.blur();
  const addBtn = document.getElementById('btn-add-item');
  addBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span class="items-toolbar__label">Añadir línea</span>`;
  addBtn.classList.remove('items-toolbar__btn--cancel');
  renderItemsTable();
}

document.getElementById('btn-add-item').addEventListener('click', () => {
  if (_deleteMode)       { exitDeleteMode(); return; }
  if (isMobile())        { openItemModal(null); }
  else                   { addItem(); }
});

document.getElementById('btn-delete-mode').addEventListener('click', () => {
  if (!_deleteMode) { enterDeleteMode(); return; }
  if (_selectedItems.size === 0) { exitDeleteMode(); return; }
  markDirty();
  items = items.filter((_, i) => !_selectedItems.has(i));
  exitDeleteMode();
  updateTotalsPreview();
  checkFormValid();
});

// ── Item card (mobile) ────────────────────────────────────────────────────────

function buildItemCard(index) {
  const it    = items[index];
  const card  = document.createElement('div');
  const sub   = formatAmount(computeItemSubtotal(it));
  const qty   = parseFloat(it.quantity) || 1;
  const price = parseFloat(it.unitPrice) || 0;
  const selected = _selectedItems.has(index);

  card.className = 'item-card' + (_deleteMode ? ' item-card--delete-mode' : '') + (selected ? ' item-card--selected' : '');
  card.dataset.index = index;

  card.innerHTML = `
    ${_deleteMode ? `<div class="item-card__check">${selected ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}</div>` : ''}
    <div class="item-card__body">
      <div class="item-card__row1">
        <span class="item-card__desc">${it.description || '—'}</span>
        <span class="item-card__price">${formatAmount(price)}</span>
      </div>
      <div class="item-card__row2">
        <span class="item-card__qty">${qty} ud.</span>
        <span class="item-card__total">${sub}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    if (_deleteMode) {
      if (_selectedItems.has(index)) _selectedItems.delete(index);
      else _selectedItems.add(index);
      renderItemsTable();
    } else {
      openItemModal(index);
    }
  });

  return card;
}

['vatRate', 'irpfRate'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateTotalsPreview);
});

['clientName', 'clientNif'].forEach(id => {
  document.getElementById(id).addEventListener('input', checkFormValid);
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
    type:               docType,
    issueDate:          f.issueDate.value,
    dueDate:            f.dueDate.value,
    clientName:         f.clientName.value.trim(),
    clientNif:          f.clientNif.value.trim(),
    clientStreetType:   f.clientStreetType.value,
    clientStreetName:   f.clientStreetName.value.trim(),
    clientStreetNumber: f.clientStreetNumber.value.trim(),
    clientCp:           f.clientCp.value.trim(),
    clientCity:         f.clientCity.value.trim(),
    clientPhone:        f.clientPhone.value.trim(),
    vatRate:            parseFloat(f.vatRate.value)   || 0,
    irpfRate:           parseFloat(f.irpfRate.value)  || 0,
    notes:              f.notes.value.trim(),
    items:              items.filter(it => it.description || (parseFloat(it.quantity) > 0 && parseFloat(it.unitPrice) > 0)),
  };

  data.number = f.number.value.trim();
  if (!isQuote) {
    data.paymentMethod = f.paymentMethod.value.trim();
    data.iban          = document.getElementById('iban-display').textContent.trim();
  }

  return data;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(data) {
  if (!data.number) return isQuote ? 'El número de presupuesto es obligatorio.' : 'El número de factura es obligatorio.';
  if (!data.issueDate)          return 'La fecha de emisión es obligatoria.';
  if (!data.clientName)         return 'El nombre del cliente es obligatorio.';
  if (!data.clientNif)          return 'El NIF/CIF del cliente es obligatorio.';
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
  btn.disabled = true;
  btn.classList.add('btn--loading');

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
    btn.disabled = false;
    btn.classList.remove('btn--loading');
  }
});

// ── Back button ───────────────────────────────────────────────────────────────

document.getElementById('btn-back').addEventListener('click', () => {
  if (isDirty) {
    document.getElementById('discard-modal').hidden = false;
  } else {
    navigateBack();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  if (isQuote) {
    document.getElementById('label-number').textContent = 'Número de presupuesto';
    document.getElementById('section-payment').hidden = true;
    document.getElementById('section-label-meta').textContent = 'Presupuesto';
    document.querySelector('.form-area').classList.add('form-area--quote');
  } else {
    document.getElementById('label-number').textContent = 'Número de factura';
  }

  if (editId) {
    const inv = await getInvoice(editId);
    if (!inv) { location.href = '../index.html'; return; }

    const editingQuote = inv.type === DOC_TYPES.QUOTE;
    document.getElementById('page-title').textContent = editingQuote ? 'Editar presupuesto' : 'Editar factura';
    document.getElementById('btn-save').querySelector('.btn-save__label').textContent = 'Guardar cambios';

    if (editingQuote) {
      document.getElementById('label-number').textContent = 'Número de presupuesto';
      document.getElementById('section-payment').hidden = true;
      document.getElementById('section-label-meta').textContent = 'Presupuesto';
      document.querySelector('.form-area').classList.add('form-area--quote');
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
    f.number.value               = inv.number               ?? '';
    f.issueDate.value            = inv.issueDate            ?? '';
    f.dueDate.value              = inv.dueDate              ?? '';
    f.clientName.value           = inv.clientName           ?? '';
    f.clientNif.value            = inv.clientNif            ?? '';
    setStreetType(inv.clientStreetType ?? 'Calle');
    f.clientStreetName.value     = inv.clientStreetName     ?? '';
    f.clientStreetNumber.value   = inv.clientStreetNumber   ?? '';
    f.clientCp.value             = inv.clientCp             ?? '';
    f.clientCity.value           = inv.clientCity           ?? '';
    f.clientPhone.value          = inv.clientPhone          ?? '';
    f.vatRate.value              = inv.vatRate              ?? DEFAULTS.VAT_RATE;
    f.irpfRate.value             = inv.irpfRate             ?? DEFAULTS.IRPF_RATE;
    if (!editingQuote) {
      setPaymentMethod(inv.paymentMethod ?? 'Transferencia bancaria');
      document.getElementById('iban-display').textContent = inv.iban ?? '';
    }
    f.notes.value = inv.notes ?? '';
  } else {
    // New document
    document.getElementById('page-title').textContent = isQuote ? 'Nuevo presupuesto' : 'Nueva factura';
    document.getElementById('btn-save').querySelector('.btn-save__label').textContent = isQuote ? 'Crear presupuesto' : 'Crear factura';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;

    if (!isQuote && window.COMPANY?.iban) {
      document.getElementById('iban-display').textContent = window.COMPANY.iban;
    }

    document.getElementById('number').value = isQuote
      ? await nextQuoteNumber()
      : await nextInvoiceNumber();

    items = [];
  }

  renderItemsTable();
  updateTotalsPreview();

  const fpOpts = { wrap: true, dateFormat: 'Y-m-d', altInput: true, altFormat: 'd/m/Y', locale: 'es', allowInput: true, disableMobile: true, onChange: () => { markDirty(); checkFormValid(); } };
  flatpickr('#issueDate-wrap', fpOpts);
  flatpickr('#dueDate-wrap',   fpOpts);

  if (isMobile()) {
    document.querySelector('.items-header')?.remove();
    document.getElementById('items-table')?.classList.remove('items-table');
  }

  initStreetTypeSelect();
  if (!isQuote) initPaymentSelect();
  checkFormValid();

  document.getElementById('invoice-form').addEventListener('input', markDirty);
  formInitialized = true;
}

init();
