// ── Template selection ────────────────────────────────────────────────────────

let selectedTemplate = 'classic';

document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedTemplate = btn.dataset.template;
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

// ── DOM renderer ──────────────────────────────────────────────────────────────

function renderDoc(inv) {
  const isQuote = inv.type === DOC_TYPES.QUOTE;

  // Title + number
  document.getElementById('doc-title').textContent = isQuote ? 'PRESUPUESTO' : 'FACTURA';
  const numberEl = document.getElementById('doc-number');
  if (isQuote || !inv.number) {
    numberEl.hidden = true;
  } else {
    numberEl.hidden = false;
    numberEl.textContent = `Nº ${inv.number}`;
  }
  document.getElementById('invoice-number').textContent = isQuote
    ? 'Presupuesto'
    : (inv.number || 'Factura');

  // Dates
  let datesHtml = `<div>Emisión: ${formatDate(inv.issueDate)}</div>`;
  if (inv.dueDate) datesHtml += `<div>Vencimiento: ${formatDate(inv.dueDate)}</div>`;
  document.getElementById('doc-dates').innerHTML = datesHtml;

  // Client
  let clientHtml = `<div class="section-label">Cliente</div>
    <div class="doc-client__name">${inv.clientName || '—'}</div>`;
  if (inv.clientNif)     clientHtml += `<div>${inv.clientNif}</div>`;
  if (inv.clientAddress) clientHtml += `<div>${inv.clientAddress.replace(/\n/g, '<br>')}</div>`;
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
      <div class="section-label">Concepto</div>
      <div class="doc-items-header">
        <span class="doc-items-row__desc">Descripción</span>
        <span class="doc-items-row__qty">Cant.</span>
        <span class="doc-items-row__price">Precio u.</span>
        <span class="doc-items-row__sub">Subtotal</span>
      </div>
      ${rowsHtml}`;
  } else {
    document.getElementById('doc-description').innerHTML =
      `<div class="section-label">Concepto</div><div>${inv.description || ''}</div>`;
  }

  // Totals
  let totalsHtml = `
    <div class="totals-line"><span>Base imponible</span><span>${formatAmount(inv.baseAmount)}</span></div>
    <div class="totals-line"><span>IVA (${inv.vatRate}%)</span><span>${formatAmount(inv.vatAmount)}</span></div>
    ${inv.irpfRate > 0
      ? `<div class="totals-line"><span>IRPF (${inv.irpfRate}%)</span><span>−${formatAmount(inv.irpfAmount)}</span></div>`
      : ''}
    <div class="totals-line totals-line--total"><span>Total</span><span>${formatAmount(inv.total)}</span></div>
  `;
  if (!isQuote && (inv.paymentMethod || inv.iban)) {
    totalsHtml += `<div class="doc-notes" style="border-top:none;margin-top:12px;padding-top:0;">`;
    if (inv.paymentMethod) totalsHtml += `<div>Forma de pago: ${inv.paymentMethod}</div>`;
    if (inv.iban)          totalsHtml += `<div>IBAN: ${inv.iban}</div>`;
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

  // Status badge
  document.getElementById('status-badge').innerHTML =
    `<span class="badge badge--${inv.status}" style="margin-bottom:10px;">${getStatusLabel(inv.status, inv.type)}</span>`;

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
  location.href = '../index.html';
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
  const filename = inv.type === DOC_TYPES.QUOTE
    ? 'presupuesto.pdf'
    : `factura-${inv.number}.pdf`;
  pdfMake.createPdf(docDef).download(filename);
});

// ── Share ─────────────────────────────────────────────────────────────────────

if (navigator.share) {
  const shareBtn = document.getElementById('btn-share');
  shareBtn.hidden = false;
  shareBtn.addEventListener('click', async () => {
    const inv      = await getInvoice(invoiceId);
    const docDef   = getDocDefinition(inv);
    const filename = inv.type === DOC_TYPES.QUOTE ? 'presupuesto.pdf' : `factura-${inv.number}.pdf`;
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
