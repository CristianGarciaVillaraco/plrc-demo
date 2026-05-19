// ── State ─────────────────────────────────────────────────────────────────────

let activeType    = DOC_TYPES.INVOICE;
let allDocs       = [];
let activeStatus  = '';         // '' = all
let activeMonths  = new Set();  // empty = all months

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
  document.getElementById('month-panel').hidden = true;
  updateMonthTriggerLabel();
  renderMonthPanel();

  // Mobile tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('tab--active', t.dataset.type === type);
  });
  // PC sidebar nav
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('nav-item--active', n.dataset.type === type);
  });

  const isInvoice  = type === DOC_TYPES.INVOICE;
  const titleLabel = isInvoice ? 'Facturas' : 'Presupuestos';
  const newLabel   = isInvoice ? '+ Nueva factura' : '+ Nuevo presupuesto';

  if (document.getElementById('mobile-title'))   document.getElementById('mobile-title').textContent   = titleLabel;
  if (document.getElementById('list-title'))     document.getElementById('list-title').textContent     = titleLabel;
  if (document.getElementById('btn-new-desktop')) document.getElementById('btn-new-desktop').textContent = newLabel;

  document.getElementById('filter-search').value = '';

  loadAndRender();
}

document.querySelectorAll('.tab, .nav-item').forEach(btn => {
  btn.addEventListener('click', () => setActiveType(btn.dataset.type));
});

// ── Stats ─────────────────────────────────────────────────────────────────────

function renderStats(docs) {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = '';

  if (activeType === DOC_TYPES.INVOICE) {
    const byStatus = { draft: 0, pending: 0, paid: 0 };
    let totalAll = 0, totalPending = 0, totalThisMonth = 0;
    const thisMonth = formatYearMonth(new Date().toISOString());

    docs.forEach(d => {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      totalAll += d.total || 0;
      if (d.status === STATUSES.PENDING) totalPending += d.total || 0;
      if (formatYearMonth(d.issueDate) === thisMonth) totalThisMonth += d.total || 0;
    });

    grid.innerHTML = `
      <div class="stat-card">
        <p class="stat-card__label">Estados</p>
        <div class="stat-card__counts">
          <div class="stat-card__count">
            <span class="stat-card__count-num stat-card__count-num--draft">${byStatus.draft}</span>
            <span class="stat-card__count-lbl">Borrador</span>
          </div>
          <div class="stat-card__count">
            <span class="stat-card__count-num stat-card__count-num--pending">${byStatus.pending}</span>
            <span class="stat-card__count-lbl">Pendiente</span>
          </div>
          <div class="stat-card__count">
            <span class="stat-card__count-num stat-card__count-num--paid">${byStatus.paid}</span>
            <span class="stat-card__count-lbl">Cobrada</span>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Total facturado</p>
        <p class="stat-card__value">${formatAmount(totalAll)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Pendiente de cobro</p>
        <p class="stat-card__value stat-card__value--warning">${formatAmount(totalPending)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Este mes</p>
        <p class="stat-card__value">${formatAmount(totalThisMonth)}</p>
      </div>
    `;
  } else {
    const counts = { total: docs.length, draft: 0, sent: 0, accepted: 0 };
    docs.forEach(d => {
      if (d.status in counts) counts[d.status]++;
    });

    grid.innerHTML = `
      <div class="stat-card">
        <p class="stat-card__label">Total</p>
        <p class="stat-card__value">${counts.total}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Borrador</p>
        <p class="stat-card__value">${counts.draft}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Enviado</p>
        <p class="stat-card__value">${counts.sent}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Aceptado</p>
        <p class="stat-card__value stat-card__value--success">${counts.accepted}</p>
      </div>
    `;
  }
}

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
      renderFilteredList();
    });
    panel.appendChild(item);
  });
}

function buildMonthDropdown() {
  const year = new Date().getFullYear();
  allMonths = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return `${year}-${m}`;
  });

  activeMonths = new Set();

  updateMonthTriggerLabel();
  renderMonthPanel();
}

// Toggle panel open/close
document.getElementById('month-trigger').addEventListener('click', (e) => {
  e.stopPropagation();
  const panel = document.getElementById('month-panel');
  panel.hidden = !panel.hidden;
});

// Close on outside click
document.addEventListener('click', () => {
  document.getElementById('month-panel').hidden = true;
});

// ── Status pills ──────────────────────────────────────────────────────────────

function renderStatusPills() {
  const container = document.getElementById('status-pills');
  const statuses  = activeType === DOC_TYPES.INVOICE
    ? [{ value: '', label: 'Todos' }, { value: 'draft', label: 'Borrador' }, { value: 'pending', label: 'Pendiente' }, { value: 'paid', label: 'Cobrada' }]
    : [{ value: '', label: 'Todos' }, { value: 'draft', label: 'Borrador' }, { value: 'sent', label: 'Enviado' }, { value: 'accepted', label: 'Aceptado' }];

  container.innerHTML = statuses.map(s => `
    <button class="pill ${activeStatus === s.value ? 'pill--active' : ''}" data-status="${s.value}">${s.label}</button>
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

function getFilteredDocs() {
  const query = document.getElementById('filter-search').value.trim().toLowerCase();
  return allDocs.filter(d => {
    if (activeStatus && d.status !== activeStatus) return false;
    if (activeMonths.size > 0 && !activeMonths.has(formatYearMonth(d.issueDate))) return false;
    if (query) {
      const haystack = `${d.number || ''} ${d.clientName || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
      </button>
      <button class="doc-row__btn action-delete" aria-label="Eliminar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    </div>
  `;

  row.querySelector('.action-view').addEventListener('click', () => {
    location.href = previewUrl(doc.id);
  });

  row.querySelector('.action-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    const label = activeType === DOC_TYPES.INVOICE ? `la factura ${doc.number}` : 'este presupuesto';
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    await deleteInvoice(doc.id);
    await loadAndRender();
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
    emptyTxt.textContent = allDocs.length === 0
      ? (activeType === DOC_TYPES.INVOICE ? 'No hay facturas todavía.' : 'No hay presupuestos todavía.')
      : 'No hay resultados para los filtros aplicados.';
    return;
  }

  listEl.hidden  = false;
  emptyEl.hidden = true;

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

// ── Load and full render ───────────────────────────────────────────────────────

async function loadAndRender() {
  allDocs = await listByType(activeType);
  renderStats(allDocs);
  buildMonthDropdown();
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

loadAndRender();
