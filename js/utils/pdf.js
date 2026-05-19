// PDF document definition builders — both templates
// Requires pdfmake loaded globally (window.pdfMake)

// ── Shared helpers ─────────────────────────────────────────────────────────────

function _fmt(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount ?? 0);
}

function _fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Address parsing helpers ────────────────────────────────────────────────────
// clientAddress is a free textarea. Last line is treated as CP + city if it
// starts with a 5-digit postal code.

function extractCpCiudad(address) {
  if (!address) return '';
  const lines = address.split('\n').map(l => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  return /^\d{5}/.test(last) ? last : '';
}

function extractDireccion(address) {
  if (!address) return '';
  const lines = address.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return address.trim();
  const last = lines[lines.length - 1];
  return /^\d{5}/.test(last) ? lines.slice(0, -1).join(', ') : address.trim();
}

// ── Items table builder ────────────────────────────────────────────────────────
// Returns a pdfmake table node for the line-items list.
// borderColor must be a string used for all cell borders.

function _buildItemsTable(items, GRAY, BORDER) {
  const headerStyle = { fontSize: 9, bold: true, color: GRAY, fillColor: '#F4F4F5' };
  const cellStyle   = { fontSize: 10, color: GRAY };

  const header = [
    { text: 'DESCRIPCIÓN', ...headerStyle, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
    { text: 'CANT.',       ...headerStyle, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
    { text: 'PRECIO U.',   ...headerStyle, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
    { text: 'SUBTOTAL',    ...headerStyle, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
  ];

  const rows = items.map(item => {
    const qty      = parseFloat(item.quantity)  || 0;
    const price    = parseFloat(item.unitPrice) || 0;
    const subtotal = +(qty * price).toFixed(2);
    return [
      { text: item.description || '', ...cellStyle, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
      { text: String(qty),            ...cellStyle, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
      { text: _fmt(price),            ...cellStyle, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
      { text: _fmt(subtotal),         ...cellStyle, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
    ];
  });

  return {
    table: {
      widths: ['*', 40, 70, 70],
      headerRows: 1,
      body: [header, ...rows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => BORDER,
      paddingTop:    () => 5,
      paddingBottom: () => 5,
    },
    marginBottom: 16,
  };
}

// ── Modern template ────────────────────────────────────────────────────────────

function buildDocDefinition(inv) {
  const isQuote = inv.type === 'quote';
  const ACCENT  = '#2563EB';
  const GRAY    = '#71717A';
  const BORDER  = '#E4E4E7';

  const items = inv.items && inv.items.length > 0 ? inv.items : null;

  // Client block
  const clientLines = [
    { text: 'CLIENTE', style: 'sectionLabel' },
    { text: inv.clientName || '—', style: 'clientName' },
  ];
  if (inv.clientNif)     clientLines.push({ text: inv.clientNif,     color: GRAY, fontSize: 10 });
  if (inv.clientAddress) clientLines.push({ text: inv.clientAddress, color: GRAY, fontSize: 10 });

  // Concepto / items block
  const conceptoBlock = items
    ? _buildItemsTable(items, GRAY, BORDER)
    : { text: inv.description || '', fontSize: 11, color: GRAY, marginBottom: 20, lineHeight: 1.5 };

  // Payment info
  const paymentLines = [];
  if (inv.paymentMethod) paymentLines.push({ text: `Forma de pago: ${inv.paymentMethod}`, fontSize: 10, color: GRAY });
  if (inv.iban)          paymentLines.push({ text: `IBAN: ${inv.iban}`, fontSize: 10, color: GRAY });

  return {
    pageSize:     'A4',
    pageMargins:  [48, 48, 48, 48],
    defaultStyle: { font: 'Roboto', fontSize: 11, color: '#18181B' },

    content: [
      // Header
      {
        columns: [
          {
            stack: [
              { text: isQuote ? 'PRESUPUESTO' : 'FACTURA', fontSize: 22, bold: true, color: ACCENT, letterSpacing: 2 },
              ...(!isQuote && inv.number
                ? [{ text: `Nº ${inv.number}`, fontSize: 11, color: GRAY, marginTop: 4 }]
                : []),
            ],
          },
          {
            stack: [
              { text: `Emisión: ${_fmtDate(inv.issueDate)}`, alignment: 'right', fontSize: 10, color: GRAY },
              inv.dueDate
                ? { text: `Vencimiento: ${_fmtDate(inv.dueDate)}`, alignment: 'right', fontSize: 10, color: GRAY, marginTop: 2 }
                : {},
            ],
          },
        ],
        marginBottom: 12,
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 2, lineColor: ACCENT }], marginBottom: 16 },

      // Client
      {
        stack: clientLines,
        fillColor: '#F4F4F5',
        margin: [0, 0, 0, 16],
        padding: [12, 10, 12, 10],
      },

      // Concepto / items
      { text: 'CONCEPTO', style: 'sectionLabel', marginBottom: 4 },
      conceptoBlock,

      // Totals
      {
        table: {
          widths: ['*', 100],
          body: [
            [
              { text: 'Base imponible', fontSize: 11, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
              { text: _fmt(inv.baseAmount), alignment: 'right', fontSize: 11, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
            ],
            [
              { text: `IVA (${inv.vatRate}%)`, fontSize: 11, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
              { text: _fmt(inv.vatAmount), alignment: 'right', fontSize: 11, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
            ],
            ...(inv.irpfRate > 0 ? [[
              { text: `IRPF (${inv.irpfRate}%)`, fontSize: 11, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
              { text: `−${_fmt(inv.irpfAmount)}`, alignment: 'right', fontSize: 11, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
            ]] : []),
            [
              { text: 'TOTAL', bold: true, fontSize: 14, color: ACCENT, border: [false, false, false, false] },
              { text: _fmt(inv.total), bold: true, fontSize: 14, color: ACCENT, alignment: 'right', border: [false, false, false, false] },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => BORDER,
          paddingTop:    () => 6,
          paddingBottom: () => 6,
        },
        marginBottom: 16,
      },

      // Payment
      (!isQuote && paymentLines.length > 0) ? { stack: paymentLines, marginBottom: 16 } : {},

      // Notes
      inv.notes
        ? {
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.5, lineColor: BORDER }], marginBottom: 8 },
              { text: inv.notes, fontSize: 10, color: GRAY, lineHeight: 1.6 },
            ],
          }
        : {},
    ],

    styles: {
      sectionLabel: { fontSize: 9, bold: true, color: GRAY, characterSpacing: 1.5, marginBottom: 4 },
      clientName:   { fontSize: 13, bold: true, marginTop: 4, marginBottom: 2 },
    },
  };
}

// ── Classic template ───────────────────────────────────────────────────────────

function buildDocDefinitionClassic(inv) {
  const isQuote = inv.type === 'quote';
  const GRAY    = '#555555';
  const BORDER  = '#999999';

  const items = inv.items && inv.items.length > 0 ? inv.items : null;

  const docTitle = isQuote ? 'PRESUPUESTO' : 'FACTURA';

  // Right column date fields
  const rightFieldRows = [
    [{ text: 'Fecha',            style: 'fieldLabel' }, { text: _fmtDate(inv.issueDate), style: 'fieldValue' }],
    [{ text: 'Fecha vencimiento', style: 'fieldLabel' }, { text: _fmtDate(inv.dueDate),  style: 'fieldValue' }],
  ];
  if (!isQuote && inv.number) {
    rightFieldRows.unshift([
      { text: 'Nº Factura', style: 'fieldLabel' },
      { text: inv.number,   style: 'fieldValue' },
    ]);
  }

  const co = window.COMPANY || {};
  const coContact = [co.phone ? `Telf ${co.phone}` : '', co.email || ''].filter(Boolean).join('  ·  ');

  const header = {
    columns: [
      {
        stack: [
          { text: co.name    || '',                              fontSize: 28, bold: true, color: '#000000' },
          { text: co.owner   || '',                              fontSize: 10, marginTop: 2 },
          { text: `${co.address || ''}\n${co.cp || ''}`.trim(), fontSize: 9,  color: GRAY, marginTop: 4 },
          { text: coContact,                                     fontSize: 9,  color: GRAY, marginTop: 2 },
        ],
        width: '*',
      },
      {
        stack: [
          { text: docTitle, fontSize: 16, bold: true, alignment: 'right', marginBottom: 6 },
          {
            table: { widths: ['auto', 110], body: rightFieldRows },
            layout: {
              hLineWidth: () => 0.5, vLineWidth:  () => 0.5,
              hLineColor: () => BORDER, vLineColor: () => BORDER,
              paddingLeft: () => 5, paddingRight: () => 5,
              paddingTop:  () => 3, paddingBottom: () => 3,
            },
          },
        ],
        width: 'auto',
      },
    ],
    marginBottom: 14,
  };

  const separator = {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 1, lineColor: '#000000' }],
    marginBottom: 12,
  };

  const clienteSection = {
    stack: [
      { text: 'Cliente', bold: true, fontSize: 11, marginBottom: 4 },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: inv.clientName  || '', style: 'clientCell' },
              { text: extractCpCiudad(inv.clientAddress), style: 'clientCell' },
            ],
            [
              { text: inv.clientNif || '', style: 'clientCell' },
              { text: '',                  style: 'clientCell' },
            ],
            [
              { text: extractDireccion(inv.clientAddress), style: 'clientCell', colSpan: 2 },
              {},
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5, vLineWidth:  () => 0.5,
          hLineColor: () => BORDER, vLineColor: () => BORDER,
          paddingLeft: () => 5, paddingRight: () => 5,
          paddingTop:  () => 4, paddingBottom: () => 4,
        },
        marginBottom: 16,
      },
    ],
  };

  // Concepto / items
  const conceptoContent = items
    ? _buildItemsTable(items, GRAY, BORDER)
    : { text: inv.description || '', fontSize: 11, color: GRAY, lineHeight: 1.5, marginBottom: 20 };

  const conceptoSection = {
    stack: [
      { text: 'CONCEPTO', bold: true, fontSize: 11, decoration: 'underline', marginBottom: 6 },
      conceptoContent,
    ],
  };

  // Totals
  const totalsRows = [
    [{ text: 'Total base imponible', style: 'totalsLabel' }, { text: _fmt(inv.baseAmount),  style: 'totalsValue' }],
    [{ text: `IVA ${inv.vatRate}%`,  style: 'totalsLabel' }, { text: _fmt(inv.vatAmount),   style: 'totalsValue' }],
  ];
  if (inv.irpfRate > 0) {
    totalsRows.push([
      { text: `IRPF ${inv.irpfRate}%`, style: 'totalsLabel' },
      { text: `−${_fmt(inv.irpfAmount)}`, style: 'totalsValue' },
    ]);
  }
  totalsRows.push([
    { text: 'TOTAL', bold: true, fontSize: 12, border: [true, true, true, true] },
    { text: _fmt(inv.total), bold: true, fontSize: 12, alignment: 'right', border: [true, true, true, true] },
  ]);

  // Payment + totals side by side
  const paymentStack = [];
  if (!isQuote) {
    if (inv.paymentMethod || inv.iban) {
      paymentStack.push({ text: 'PAGO POR TRANSFERENCIA', bold: true, fontSize: 10, marginBottom: 4 });
      if (inv.iban) paymentStack.push({ text: inv.iban, fontSize: 10, color: GRAY });
      if (inv.paymentMethod && inv.paymentMethod.toLowerCase() !== 'transferencia bancaria') {
        paymentStack.push({ text: inv.paymentMethod, fontSize: 10, color: GRAY });
      }
    }
  }

  const bottomSection = {
    columns: [
      { stack: paymentStack, width: '*' },
      {
        table: { widths: ['*', 'auto'], body: totalsRows },
        layout: {
          hLineWidth: () => 0.5, vLineWidth:  () => 0.5,
          hLineColor: () => BORDER, vLineColor: () => BORDER,
          paddingLeft: () => 6, paddingRight: () => 6,
          paddingTop:  () => 4, paddingBottom: () => 4,
        },
        width: 220,
      },
    ],
  };

  const notesSection = inv.notes
    ? { text: inv.notes, fontSize: 10, color: GRAY, marginTop: 16, lineHeight: 1.5 }
    : {};

  return {
    pageSize:     'A4',
    pageMargins:  [48, 48, 48, 48],
    defaultStyle: { font: 'Roboto', fontSize: 11, color: '#000000' },

    content: [header, separator, clienteSection, conceptoSection, bottomSection, notesSection],

    styles: {
      fieldLabel:  { fontSize: 9, color: GRAY },
      fieldValue:  { fontSize: 9 },
      clientCell:  { fontSize: 10 },
      totalsLabel: { fontSize: 10, color: GRAY, border: [true, true, true, true] },
      totalsValue: { fontSize: 10, alignment: 'right', border: [true, true, true, true] },
    },
  };
}
