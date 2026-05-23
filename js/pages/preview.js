const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

// ── Template selection ────────────────────────────────────────────────────────

const TEMPLATE_KEY  = 'plrc_template';
let selectedTemplate = localStorage.getItem(TEMPLATE_KEY) || 'classic';

// Reflect stored preference on the buttons
document.querySelectorAll('.template-btn').forEach(btn => {
  btn.classList.toggle('template-btn--active', btn.dataset.template === selectedTemplate);
});

document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedTemplate = btn.dataset.template;
    localStorage.setItem(TEMPLATE_KEY, selectedTemplate);
    document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('template-btn--active'));
    btn.classList.add('template-btn--active');
  });
});

function getDocDefinition(inv) {
  return selectedTemplate === 'classic'
    ? buildDocDefinitionClassic(inv)
    : buildDocDefinition(inv);
}

// ── Params ────────────────────────────────────────────────────────────────────

const params    = new URLSearchParams(location.search);
const invoiceId = params.get('id') ? Number(params.get('id')) : null;

if (!invoiceId) { location.href = '../index.html'; }

let currentIsQuote = false;

// ── DOM renderer ──────────────────────────────────────────────────────────────

function renderDoc(inv) {
  const isQuote = inv.type === DOC_TYPES.QUOTE;
  currentIsQuote = isQuote;

  // Title + number
  document.getElementById('doc-number').hidden = true;
  document.getElementById('invoice-number').textContent = isQuote ? 'Presupuesto' : 'Factura';
  document.getElementById('doc-title').textContent = inv.number || '';

  // Dates
  let datesHtml = `
    <div class="doc-date-row">
      ${isMobile() ? '' : '<span class="doc-label">Emisión</span>'}
      <span class="doc-val">${formatDate(inv.issueDate)}</span>
    </div>`;
  if (inv.dueDate) datesHtml += `
    <div class="doc-date-row">
      <span class="doc-label">Vencimiento</span>
      <span class="doc-val">${formatDate(inv.dueDate)}</span>
    </div>`;
  document.getElementById('doc-dates').innerHTML = datesHtml;

  // Client
  let clientHtml = `<div class="doc-section-title">Cliente</div>
    <div class="doc-client__name">${inv.clientName || '—'}</div>`;
  if (inv.clientNif) clientHtml += `<div>${inv.clientNif}</div>`;
  if (inv.clientStreetName) {
    const street = [inv.clientStreetType, inv.clientStreetName, inv.clientStreetNumber].filter(Boolean).join(' ');
    const cpCity = [inv.clientCp, inv.clientCity].filter(Boolean).join(' ');
    if (street) clientHtml += `<div>${street}</div>`;
    if (cpCity) clientHtml += `<div>${cpCity}</div>`;
  } else if (inv.clientAddress) {
    clientHtml += `<div>${inv.clientAddress.replace(/\n/g, '<br>')}</div>`;
  }
  if (inv.clientPhone) clientHtml += `<div>${inv.clientPhone}</div>`;
  document.getElementById('doc-client').innerHTML = clientHtml;

  // Description / items
  const hasItems = inv.items && inv.items.length > 0;
  if (hasItems) {
    const rowsHtml = inv.items.map(it => {
      const qty      = parseFloat(it.quantity)  || 0;
      const price    = parseFloat(it.unitPrice) || 0;
      const subtotal = +(qty * price).toFixed(2);
      return `
        <div class="doc-items-row">
          <span class="doc-items-row__desc">${it.description || ''}</span>
          <span class="doc-items-row__qty">${qty}</span>
          <span class="doc-items-row__price">${formatAmount(price)}</span>
          <span class="doc-items-row__sub">${formatAmount(subtotal)}</span>
        </div>`;
    }).join('');
    document.getElementById('doc-description').innerHTML = `
      <div class="doc-section-title">Concepto</div>
      <div class="doc-items-header">
        <span class="doc-items-row__desc">Descripción</span>
        <span class="doc-items-row__qty">Cant.</span>
        <span class="doc-items-row__price">Precio u.</span>
        <span class="doc-items-row__sub">Subtotal</span>
      </div>
      ${rowsHtml}`;
  } else {
    document.getElementById('doc-description').innerHTML =
      `<div class="doc-section-title">Concepto</div><div>${inv.description || ''}</div>`;
  }

  // Totals
  let totalsHtml = `
    <div class="totals-line"><span class="doc-label">Base imponible</span><span class="doc-val">${formatAmount(inv.baseAmount)}</span></div>
    <div class="totals-line"><span class="doc-label">IVA (${inv.vatRate}%)</span><span class="doc-val">${formatAmount(inv.vatAmount)}</span></div>
    ${inv.irpfRate > 0
      ? `<div class="totals-line"><span class="doc-label">IRPF (${inv.irpfRate}%)</span><span class="doc-val">−${formatAmount(inv.irpfAmount)}</span></div>`
      : ''}
    <div class="totals-line totals-line--total"><span>Total</span><span>${formatAmount(inv.total)}</span></div>
  `;
  if (!isQuote && (inv.paymentMethod || inv.iban)) {
    totalsHtml += `<div class="doc-notes">`;
    if (inv.paymentMethod) totalsHtml += `<div><span class="doc-label">Forma de pago</span> <span class="doc-val">${inv.paymentMethod}</span></div>`;
    if (inv.iban)          totalsHtml += `<div><span class="doc-label">IBAN</span> <span class="doc-val">${inv.iban}</span></div>`;
    totalsHtml += `</div>`;
  }
  document.getElementById('doc-totals').innerHTML = totalsHtml;

  // Notes
  const notesEl = document.getElementById('doc-notes');
  if (inv.notes) {
    notesEl.textContent = inv.notes;
    notesEl.hidden = false;
  } else {
    notesEl.hidden = true;
  }

  // Status buttons
  const btnsEl = document.getElementById('status-buttons');
  if (isQuote) {
    btnsEl.innerHTML = `
      <button class="btn ${inv.status === 'draft'    ? 'btn--primary' : 'btn--outline'}" id="btn-draft">Borrador</button>
      <button class="btn ${inv.status === 'sent'     ? 'btn--primary' : 'btn--outline'}" id="btn-sent">Enviado</button>
      <button class="btn ${inv.status === 'accepted' ? 'btn--primary' : 'btn--outline'}" id="btn-accepted">Aceptado</button>
    `;
    btnsEl.querySelector('#btn-draft').addEventListener('click',    () => changeStatus('draft'));
    btnsEl.querySelector('#btn-sent').addEventListener('click',     () => changeStatus('sent'));
    btnsEl.querySelector('#btn-accepted').addEventListener('click', () => changeStatus('accepted'));
  } else {
    btnsEl.innerHTML = `
      <button class="btn ${inv.status === 'draft'   ? 'btn--primary' : 'btn--outline'}" id="btn-draft">Borrador</button>
      <button class="btn ${inv.status === 'pending' ? 'btn--primary' : 'btn--outline'}" id="btn-pending">Pendiente</button>
      <button class="btn ${inv.status === 'paid'    ? 'btn--primary' : 'btn--outline'}" id="btn-paid">Cobrada</button>
    `;
    btnsEl.querySelector('#btn-draft').addEventListener('click',   () => changeStatus('draft'));
    btnsEl.querySelector('#btn-pending').addEventListener('click', () => changeStatus('pending'));
    btnsEl.querySelector('#btn-paid').addEventListener('click',    () => changeStatus('paid'));
  }
}

// ── Status controls ───────────────────────────────────────────────────────────

async function changeStatus(status) {
  await setInvoiceStatus(invoiceId, status);
  const inv = await getInvoice(invoiceId);
  renderDoc(inv);
}

// ── Navigation ────────────────────────────────────────────────────────────────

document.getElementById('btn-back').addEventListener('click', () => {
  location.href = currentIsQuote ? '../index.html?type=quote' : '../index.html';
});

document.getElementById('btn-edit').addEventListener('click', async () => {
  const inv    = await getInvoice(invoiceId);
  const suffix = inv.type === DOC_TYPES.QUOTE
    ? `?id=${invoiceId}&type=quote`
    : `?id=${invoiceId}`;
  location.href = `new-document.html${suffix}`;
});

// ── PDF download ──────────────────────────────────────────────────────────────

document.getElementById('btn-download').addEventListener('click', async () => {
  const inv      = await getInvoice(invoiceId);
  const docDef   = getDocDefinition(inv);
  const filename = `${inv.number}.pdf`;
  pdfMake.createPdf(docDef).download(filename);
});

document.getElementById('btn-view-pdf').addEventListener('click', async () => {
  const inv    = await getInvoice(invoiceId);
  const docDef = getDocDefinition(inv);
  pdfMake.createPdf(docDef).open();
});

// ── Share ─────────────────────────────────────────────────────────────────────

if (navigator.share) {
  const shareBtn = document.getElementById('btn-share');
  shareBtn.hidden = false;
  shareBtn.addEventListener('click', async () => {
    const inv      = await getInvoice(invoiceId);
    const docDef   = getDocDefinition(inv);
    const filename = `${inv.number}.pdf`;
    pdfMake.createPdf(docDef).getBlob(async (blob) => {
      const file = new File([blob], filename, { type: 'application/pdf' });
      try {
        await navigator.share({ files: [file], title: filename });
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const inv = await getInvoice(invoiceId);
  if (!inv) { location.href = '../index.html'; return; }
  renderDoc(inv);
}

init();
