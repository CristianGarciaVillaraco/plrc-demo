const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

// ── State ─────────────────────────────────────────────────────────────────────

let activeType    = DOC_TYPES.INVOICE;
let allDocs       = [];
let activeStatus  = '';
let activeMonths  = new Set();
let activeYear    = String(new Date().getFullYear());
let allYears      = [];

// ── Navigation targets ────────────────────────────────────────────────────────

function newDocUrl() {
  return activeType === DOC_TYPES.QUOTE
    ? 'html/new-document.html?type=quote'
    : 'html/new-document.html';
}

function previewUrl(id) {
  return `html/preview.html?id=${id}`;
}

// ── Tab / nav switching ────────────────────────────────────────────────────────

function setActiveType(type) {
  activeType   = type;
  activeStatus = '';
  activeMonths = new Set();
  activeYear   = String(new Date().getFullYear());

  document.getElementById('month-panel').hidden = true;
  document.getElementById('year-panel').hidden  = true;
  updateMonthTriggerLabel();
  updateYearTriggerLabel();
  renderMonthPanel();

  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('tab--active', t.dataset.type === type);
  });
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('nav-item--active', n.dataset.type === type);
  });

  const isInvoice  = type === DOC_TYPES.INVOICE;
  const titleLabel = isInvoice ? 'Facturas' : 'Presupuestos';
  const newLabel   = isInvoice ? '+ Nueva factura' : '+ Nuevo presupuesto';

  if (document.getElementById('mobile-title'))  document.getElementById('mobile-title').textContent  = titleLabel;
  if (document.getElementById('list-title'))    document.getElementById('list-title').textContent    = titleLabel;
  if (document.getElementById('btn-new-label')) document.getElementById('btn-new-label').textContent = isInvoice ? 'Nueva factura' : 'Nuevo presupuesto';

  document.getElementById('filter-search').value = '';

  loadAndRender();
}

document.querySelectorAll('.tab, .nav-item').forEach(btn => {
  btn.addEventListener('click', () => setActiveType(btn.dataset.type));
});

// ── Stats ─────────────────────────────────────────────────────────────────────

function getMonthStatLabel() {
  if (activeMonths.size === 0) return 'Este mes';
  if (activeMonths.size === 1) {
    const m = [...activeMonths][0];
    const name = formatMonthLabel(m).split(' ')[0].replace(/^./, c => c.toUpperCase());
    return `Total ${name}`;
  }
  return 'Total selección';
}

function renderStats(yearDocs) {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = '';

  if (activeType === DOC_TYPES.INVOICE) {
    const byStatus = { draft: 0, pending: 0, paid: 0 };
    let totalPending = 0, totalThisMonth = 0, totalThisYear = 0;
    const thisCalMonth = formatYearMonth(new Date().toISOString());

    allDocs.forEach(d => {
      if (d.status === STATUSES.PENDING) totalPending += d.total || 0;
    });

    yearDocs.forEach(d => {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      const emitted = d.status === STATUSES.PENDING || d.status === STATUSES.PAID;
      if (!emitted) return;

      totalThisYear += d.total || 0;

      const docMonth = formatYearMonth(d.issueDate);
      if (activeMonths.size === 0) {
        if (docMonth === thisCalMonth) totalThisMonth += d.total || 0;
      } else {
        if (activeMonths.has(docMonth)) totalThisMonth += d.total || 0;
      }
    });

    const monthLabel = getMonthStatLabel();

    grid.innerHTML = `
      <div class="stat-card stat-card--gray">
        <div class="stat-card__top">
          <span class="stat-card__icon stat-card__icon--gray"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
          <p class="stat-card__label">Estados</p>
        </div>
        <div class="stat-card__counts">
          <div class="stat-card__count">
            <span class="stat-card__count-num stat-card__count-num--draft">${byStatus.draft}</span>
            <span class="stat-card__count-lbl">Borrador</span>
          </div>
          <div class="stat-card__count">
            <span class="stat-card__count-num stat-card__count-num--pending">${byStatus.pending}</span>
            <span class="stat-card__count-lbl stat-card__count-lbl--pending">Pendiente</span>
          </div>
          <div class="stat-card__count">
            <span class="stat-card__count-num stat-card__count-num--paid">${byStatus.paid}</span>
            <span class="stat-card__count-lbl stat-card__count-lbl--paid">Cobrada</span>
          </div>
        </div>
      </div>
      <div class="stat-card stat-card--amber">
        <div class="stat-card__top">
          <span class="stat-card__icon stat-card__icon--amber"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
          <p class="stat-card__label">Pendiente de cobro</p>
        </div>
        <p class="stat-card__value stat-card__value--warning">${formatAmount(totalPending)}</p>
      </div>
      <div class="stat-card stat-card--green">
        <div class="stat-card__top">
          <span class="stat-card__icon stat-card__icon--green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <p class="stat-card__label">${monthLabel}</p>
        </div>
        <p class="stat-card__value stat-card__value--success">${formatAmount(totalThisMonth)}</p>
      </div>
      <div class="stat-card stat-card--blue">
        <div class="stat-card__top">
          <span class="stat-card__icon stat-card__icon--blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></span>
          <p class="stat-card__label">Total ${activeYear}</p>
        </div>
        <p class="stat-card__value stat-card__value--accent">${formatAmount(totalThisYear)}</p>
      </div>
    `;
  } else {
    const counts = { total: yearDocs.length, draft: 0, sent: 0, accepted: 0 };
    yearDocs.forEach(d => {
      if (d.status in counts) counts[d.status]++;
    });

    grid.innerHTML = `
      <div class="stat-card stat-card--gray">
        <div class="stat-card__top">
          <span class="stat-card__icon stat-card__icon--gray"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>
          <p class="stat-card__label">Total</p>
        </div>
        <p class="stat-card__value">${counts.total}</p>
      </div>
      <div class="stat-card stat-card--gray">
        <div class="stat-card__top">
          <span class="stat-card__icon stat-card__icon--gray"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
          <p class="stat-card__label">Borrador</p>
        </div>
        <p class="stat-card__value">${counts.draft}</p>
      </div>
      <div class="stat-card stat-card--blue">
        <div class="stat-card__top">
          <span class="stat-card__icon stat-card__icon--blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span>
          <p class="stat-card__label">Enviado</p>
        </div>
        <p class="stat-card__value">${counts.sent}</p>
      </div>
      <div class="stat-card stat-card--green">
        <div class="stat-card__top">
          <span class="stat-card__icon stat-card__icon--green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>
          <p class="stat-card__label">Aceptado</p>
        </div>
        <p class="stat-card__value stat-card__value--success">${counts.accepted}</p>
      </div>
    `;
  }
}

// ── Delete modal ──────────────────────────────────────────────────────────────

let deletePendingId = null;

function showDeleteModal(id, docLabel) {
  deletePendingId = id;
  document.getElementById('delete-modal-doc').textContent = docLabel;
  document.getElementById('delete-modal').hidden = false;
}

document.getElementById('delete-modal-cancel').addEventListener('click', () => {
  document.getElementById('delete-modal').hidden = true;
  deletePendingId = null;
});

document.getElementById('delete-modal-confirm').addEventListener('click', async () => {
  if (!deletePendingId) return;
  document.getElementById('delete-modal').hidden = true;
  await deleteInvoice(deletePendingId);
  deletePendingId = null;
  await loadAndRender();
});

document.getElementById('delete-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('delete-modal').hidden = true;
    deletePendingId = null;
  }
});

// ── Year dropdown ──────────────────────────────────────────────────────────────

function updateYearTriggerLabel() {
  document.getElementById('year-trigger').textContent = activeYear;
}

function renderYearPanel() {
  const panel = document.getElementById('year-panel');
  panel.innerHTML = '';

  allYears.forEach(y => {
    const item = document.createElement('button');
    item.className = 'year-dropdown__item' + (activeYear === y ? ' year-dropdown__item--selected' : '');
    item.textContent = y;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      activeYear   = y;
      activeMonths = new Set();
      panel.hidden = true;
      updateYearTriggerLabel();
      const yearDocs = getYearFilteredDocs();
      renderStats(yearDocs);
      buildMonthDropdown(yearDocs);
      renderFilteredList();
    });
    panel.appendChild(item);
  });
}

function buildYearDropdown() {
  const yearsInDocs = [...new Set(allDocs.map(d => (d.issueDate || '').slice(0, 4)).filter(Boolean))];
  const currentYear = String(new Date().getFullYear());
  if (!yearsInDocs.includes(currentYear)) yearsInDocs.push(currentYear);
  allYears = yearsInDocs.sort((a, b) => b.localeCompare(a));

  if (!allYears.includes(activeYear)) activeYear = allYears[0] || currentYear;

  updateYearTriggerLabel();
  renderYearPanel();
}

document.getElementById('year-trigger').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('month-panel').hidden = true;
  const panel = document.getElementById('year-panel');
  panel.hidden = !panel.hidden;
});

// ── Month dropdown (multi-select) ──────────────────────────────────────────────

let allMonths = [];

function updateMonthTriggerLabel() {
  const trigger = document.getElementById('month-trigger');
  if (activeMonths.size === 0) {
    trigger.textContent = 'Todos los meses';
  } else if (activeMonths.size === 1) {
    trigger.textContent = formatMonthLabel([...activeMonths][0]).split(' ')[0].replace(/^./, c => c.toUpperCase());
  } else {
    trigger.textContent = `${activeMonths.size} meses`;
  }
}

function renderMonthPanel() {
  const panel = document.getElementById('month-panel');
  panel.innerHTML = '';

  if (allMonths.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'month-dropdown__empty';
    empty.textContent = 'Sin datos';
    panel.appendChild(empty);
    return;
  }

  allMonths.forEach(m => {
    const item = document.createElement('button');
    item.className = 'month-dropdown__item' + (activeMonths.has(m) ? ' month-dropdown__item--selected' : '');
    item.textContent = formatMonthLabel(m).split(' ')[0].replace(/^./, c => c.toUpperCase());
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeMonths.has(m)) {
        activeMonths.delete(m);
      } else {
        activeMonths.add(m);
      }
      renderMonthPanel();
      updateMonthTriggerLabel();
      renderStats(getYearFilteredDocs());
      renderFilteredList();
    });
    panel.appendChild(item);
  });
}

function buildMonthDropdown(yearDocs) {
  allMonths = [...new Set(yearDocs.map(d => formatYearMonth(d.issueDate)).filter(Boolean))].sort();
  activeMonths = new Set();
  updateMonthTriggerLabel();
  renderMonthPanel();
}

document.getElementById('month-trigger').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('year-panel').hidden = true;
  const panel = document.getElementById('month-panel');
  panel.hidden = !panel.hidden;
});

// Close on outside click
document.addEventListener('click', () => {
  document.getElementById('month-panel').hidden = true;
  document.getElementById('year-panel').hidden  = true;
});

// ── Status pills ──────────────────────────────────────────────────────────────

const PILL_COLOR = { '': 'blue', draft: 'gray', pending: 'amber', paid: 'green', sent: 'blue', accepted: 'green' };

function renderStatusPills() {
  const container = document.getElementById('status-pills');
  const mobile    = isMobile();
  const statuses  = activeType === DOC_TYPES.INVOICE
    ? [
        { value: '',        label: 'Todos' },
        { value: 'draft',   label: mobile ? 'Borr.'   : 'Borrador'  },
        { value: 'pending', label: mobile ? 'Pend.'   : 'Pendiente' },
        { value: 'paid',    label: mobile ? 'Cobr.'   : 'Cobrada'   }
      ]
    : [
        { value: '',         label: 'Todos' },
        { value: 'draft',    label: mobile ? 'Borr.'   : 'Borrador'  },
        { value: 'sent',     label: mobile ? 'Enviad.' : 'Enviado'   },
        { value: 'accepted', label: mobile ? 'Acept.'  : 'Aceptado'  }
      ];

  container.innerHTML = statuses.map(s => `
    <button class="pill pill--${PILL_COLOR[s.value] || 'blue'} ${activeStatus === s.value ? 'pill--active' : ''}" data-status="${s.value}">${s.label}</button>
  `).join('');

  container.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeStatus = btn.dataset.status;
      renderStatusPills();
      renderFilteredList();
    });
  });
}

// ── Filtering ─────────────────────────────────────────────────────────────────

function getYearFilteredDocs() {
  return allDocs.filter(d => (d.issueDate || '').startsWith(activeYear));
}

function getFilteredDocs() {
  const query = document.getElementById('filter-search').value.trim().toLowerCase();
  return allDocs.filter(d => {
    if (!(d.issueDate || '').startsWith(activeYear)) return false;
    if (activeStatus && d.status !== activeStatus) return false;
    if (activeMonths.size > 0 && !activeMonths.has(formatYearMonth(d.issueDate))) return false;
    if (query) {
      const haystack = `${d.number || ''} ${d.clientName || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

// ── Document card renderer (mobile) ──────────────────────────────────────────

function buildDocCard(doc) {
  const card = document.createElement('div');
  card.className = 'doc-card';
  const statusLabel = getStatusLabel(doc.status, activeType);
  const total = activeType === DOC_TYPES.INVOICE ? formatAmount(doc.total) : '';

  card.innerHTML = `
    <div class="doc-card__top">
      <span class="doc-card__number">${doc.number || '—'}</span>
      <div class="doc-card__top-right">
        <span class="badge badge--${doc.status}">${statusLabel}</span>
        <button class="doc-card__del" aria-label="Eliminar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    <div class="doc-card__client">${doc.clientName || '—'}</div>
    <div class="doc-card__bottom">
      <span class="doc-card__date">${formatDate(doc.issueDate)}</span>
      ${total ? `<span class="doc-card__total">${total}</span>` : ''}
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (!e.target.closest('button')) location.href = previewUrl(doc.id);
  });

  card.querySelector('.doc-card__del').addEventListener('click', (e) => {
    e.stopPropagation();
    const docType = activeType === DOC_TYPES.INVOICE ? 'la factura' : 'el presupuesto';
    const docNum  = doc.number ? ` ${doc.number}` : '';
    showDeleteModal(doc.id, `${docType}${docNum}`);
  });

  return card;
}

// ── Document row renderer ─────────────────────────────────────────────────────

function renderDocRow(doc) {
  const row = document.createElement('div');
  row.className = 'doc-row';
  row.dataset.id = doc.id;

  const statusLabel = getStatusLabel(doc.status, activeType);
  const total = activeType === DOC_TYPES.INVOICE ? formatAmount(doc.total) : '';

  row.innerHTML = `
    <div class="doc-row__number">${doc.number || '—'}</div>
    <div class="doc-row__client">${doc.clientName || '—'}</div>
    <div class="doc-row__date">${formatDate(doc.issueDate)}</div>
    ${activeType === DOC_TYPES.INVOICE ? `<div class="doc-row__total">${total}</div>` : '<div class="doc-row__total"></div>'}
    <div class="doc-row__status"><span class="badge badge--${doc.status}">${statusLabel}</span></div>
    <div class="doc-row__actions">
      <button class="doc-row__btn action-view" aria-label="Ver">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="doc-row__btn action-delete" aria-label="Eliminar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    </div>
  `;

  row.querySelector('.action-view').addEventListener('click', () => {
    location.href = previewUrl(doc.id);
  });

  row.querySelector('.action-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    const docType = activeType === DOC_TYPES.INVOICE ? 'la factura' : 'el presupuesto';
    const docNum  = doc.number ? ` ${doc.number}` : '';
    showDeleteModal(doc.id, `${docType}${docNum}`);
  });

  row.addEventListener('click', (e) => {
    if (!e.target.closest('button')) location.href = previewUrl(doc.id);
  });

  return row;
}

// ── Render list ───────────────────────────────────────────────────────────────

function renderFilteredList() {
  const listEl   = document.getElementById('doc-list');
  const emptyEl  = document.getElementById('empty-state');
  const emptyTxt = document.getElementById('empty-text');

  const docs = getFilteredDocs();
  listEl.innerHTML = '';

  if (docs.length === 0) {
    listEl.hidden  = true;
    emptyEl.hidden = false;
    if (allDocs.length === 0) {
      emptyTxt.textContent = activeType === DOC_TYPES.INVOICE ? 'No hay facturas todavía.' : 'No hay presupuestos todavía.';
    } else if (activeMonths.size > 0) {
      emptyTxt.textContent = activeMonths.size === 1
        ? 'Sin datos en el mes seleccionado.'
        : 'Sin datos en los meses seleccionados.';
    } else {
      emptyTxt.textContent = 'No hay resultados para los filtros aplicados.';
    }
    return;
  }

  listEl.hidden  = false;
  emptyEl.hidden = true;

  if (isMobile()) {
    docs.forEach(d => listEl.appendChild(buildDocCard(d)));
    return;
  }

  const totalLabel = activeType === DOC_TYPES.INVOICE ? 'Importe' : '';
  const header = document.createElement('div');
  header.className = 'doc-list-header';
  header.innerHTML = `
    <span class="doc-list-header__col--number">Número</span>
    <span class="doc-list-header__col--client">Cliente</span>
    <span class="doc-list-header__col--date">Fecha</span>
    <span class="doc-list-header__col--total">${totalLabel}</span>
    <span class="doc-list-header__col--status">Estado</span>
    <span class="doc-list-header__col--actions"></span>
  `;
  listEl.appendChild(header);

  docs.forEach(d => listEl.appendChild(renderDocRow(d)));
}

// ── Stats toggle (mobile) ─────────────────────────────────────────────────────

function initStatsToggle() {
  const btn  = document.getElementById('stats-toggle');
  const grid = document.getElementById('stats-grid');
  if (!btn || !grid) return;
  btn.addEventListener('click', () => {
    const open = grid.classList.toggle('stats-grid--open');
    btn.classList.toggle('stats-toggle--open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
}

// ── Load and full render ───────────────────────────────────────────────────────

async function loadAndRender() {
  allDocs = await listByType(activeType);
  buildYearDropdown();
  const yearDocs = getYearFilteredDocs();
  renderStats(yearDocs);
  buildMonthDropdown(yearDocs);
  renderStatusPills();
  renderFilteredList();
}

// ── Filter events ─────────────────────────────────────────────────────────────

document.getElementById('filter-search').addEventListener('input', renderFilteredList);

// ── Export backup ─────────────────────────────────────────────────────────────

async function exportBackup() {
  const invoices = await db.invoices.toArray();
  const payload  = { exportedAt: new Date().toISOString(), version: 4, invoices };
  const blob     = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `plrc-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('btn-export-mobile')?.addEventListener('click', exportBackup);
document.getElementById('btn-export-sidebar')?.addEventListener('click', exportBackup);

// ── New document navigation ────────────────────────────────────────────────────

document.getElementById('fab-new').addEventListener('click', () => {
  location.href = newDocUrl();
});

document.getElementById('btn-new-desktop').addEventListener('click', () => {
  location.href = newDocUrl();
});

// ── Init ──────────────────────────────────────────────────────────────────────

initStatsToggle();
const _initType = new URLSearchParams(location.search).get('type');
if (_initType === 'quote') setActiveType(DOC_TYPES.QUOTE);
else loadAndRender();
