// PDF document definition builders — both templates
// Requires pdfmake loaded globally (window.pdfMake)

// ── Shared helpers ─────────────────────────────────────────────────────────────

function _continuationHeader(docLabel) {
  const co = window.COMPANY || {};
  return (currentPage) => {
    if (currentPage === 1) return null;
    return {
      stack: [
        {
          columns: [
            { text: co.name || '', fontSize: 9, bold: true,  color: '#444444', margin: [48, 14, 0,  4] },
            { text: docLabel,      fontSize: 8, bold: false, color: '#888888', margin: [0,  15, 48, 4], alignment: 'right' },
          ],
        },
        {
          canvas: [{ type: 'line', x1: 48, y1: 0, x2: 547, y2: 0, lineWidth: 0.5, lineColor: '#CCCCCC' }],
        },
      ],
    };
  };
}

function _pageFooter(currentPage, pageCount) {
  if (pageCount <= 1) return null;
  return {
    text: `${currentPage} / ${pageCount}`,
    fontSize: 8,
    color: '#BBBBBB',
    alignment: 'center',
    margin: [0, 10, 0, 0],
  };
}

function _fmt(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount ?? 0);
}

function _fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Address helpers ────────────────────────────────────────────────────────────
// Supports both new structured fields and legacy free-text clientAddress.

function _buildStreet(inv) {
  if (inv.clientStreetName) {
    return [inv.clientStreetType, inv.clientStreetName, inv.clientStreetNumber]
      .filter(Boolean).join(' ');
  }
  // Legacy: extract street from free-text textarea
  if (!inv.clientAddress) return '';
  const lines = inv.clientAddress.split('\n').map(l => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  return /^\d{5}/.test(last) ? lines.slice(0, -1).join(', ') : inv.clientAddress.trim();
}

function _buildCpCiudad(inv) {
  if (inv.clientCp || inv.clientCity) {
    return [inv.clientCp, inv.clientCity].filter(Boolean).join(' ');
  }
  // Legacy: extract CP+city from free-text textarea
  if (!inv.clientAddress) return '';
  const lines = inv.clientAddress.split('\n').map(l => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  return /^\d{5}/.test(last) ? last : '';
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
  const co      = window.COMPANY || {};

  const items    = inv.items && inv.items.length > 0 ? inv.items : null;
  const street   = _buildStreet(inv);
  const cpCiudad = _buildCpCiudad(inv);

  // ── Company + document title ───────────────────────────────────────────────
  const coAddressLine = [co.address, co.cp].filter(Boolean).join('  ·  ');
  const coContactLine = [co.phone, co.email].filter(Boolean).join('  ·  ');

  const pageHeader = {
    columns: [
      {
        stack: [
          { text: co.name  || '', fontSize: 18, bold: true, color: '#18181B' },
          ...(co.owner        ? [{ text: co.owner,        fontSize: 9, color: GRAY, marginTop: 2 }] : []),
          ...(coAddressLine   ? [{ text: coAddressLine,   fontSize: 9, color: GRAY, marginTop: 1 }] : []),
          ...(coContactLine   ? [{ text: coContactLine,   fontSize: 9, color: GRAY, marginTop: 1 }] : []),
        ],
        width: '*',
      },
      {
        stack: [
          { text: isQuote ? 'PRESUPUESTO' : 'FACTURA', fontSize: 20, bold: true, color: ACCENT, alignment: 'right' },
          ...(inv.number ? [{ text: inv.number, fontSize: 11, color: GRAY, alignment: 'right', marginTop: 3 }] : []),
        ],
        width: 'auto',
      },
    ],
    marginBottom: 14,
  };

  const divider = {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 2, lineColor: ACCENT }],
    marginBottom: 18,
  };

  // ── Dates + client (two columns) ──────────────────────────────────────────
  const datesTable = {
    table: {
      widths: ['auto', '*'],
      body: [
        [
          { text: 'Emisión',     style: 'metaLabel' },
          { text: _fmtDate(inv.issueDate), style: 'metaValue' },
        ],
        ...(inv.dueDate ? [[
          { text: 'Vencimiento', style: 'metaLabel' },
          { text: _fmtDate(inv.dueDate),  style: 'metaValue' },
        ]] : []),
      ],
    },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 0, paddingRight: () => 8 },
  };

  const infoRow = {
    columns: [
      {
        stack: [
          { text: 'FECHAS', style: 'sectionLabel' },
          datesTable,
        ],
        width: 150,
      },
      {
        stack: [
          { text: 'FACTURAR A', style: 'sectionLabel' },
          { text: inv.clientName || '—', fontSize: 12, bold: true, marginBottom: 6 },
          {
            table: {
              widths: [60, '*'],
              body: [
                ...(inv.clientNif ? [[
                  { text: 'NIF / CIF',  style: 'metaLabel' },
                  { text: inv.clientNif, style: 'metaValue' },
                ]] : []),
                ...((street || cpCiudad) ? [[
                  { text: 'Dirección', style: 'metaLabel' },
                  { text: [street, cpCiudad].filter(Boolean).join('\n'), style: 'metaValue' },
                ]] : []),
                ...(inv.clientPhone ? [[
                  { text: 'Teléfono',  style: 'metaLabel' },
                  { text: inv.clientPhone, style: 'metaValue' },
                ]] : []),
              ],
            },
            layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 2, paddingBottom: () => 2, paddingLeft: () => 0, paddingRight: () => 6 },
          },
        ],
        width: '*',
      },
    ],
    marginBottom: 20,
  };

  // ── Items ─────────────────────────────────────────────────────────────────
  const conceptoBlock = items
    ? _buildItemsTable(items, GRAY, BORDER)
    : { text: inv.description || '', fontSize: 11, color: GRAY, marginBottom: 20, lineHeight: 1.5 };

  // ── Totals (right-aligned, TOTAL row with blue fill) ──────────────────────
  const totalsBody = [
    [
      { text: 'Base imponible',    fontSize: 10, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
      { text: _fmt(inv.baseAmount), alignment: 'right', fontSize: 10, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
    ],
    [
      { text: `IVA (${inv.vatRate}%)`, fontSize: 10, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
      { text: _fmt(inv.vatAmount),     alignment: 'right', fontSize: 10, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
    ],
  ];
  if (inv.irpfRate > 0) {
    totalsBody.push([
      { text: `IRPF (${inv.irpfRate}%)`, fontSize: 10, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
      { text: `−${_fmt(inv.irpfAmount)}`, alignment: 'right', fontSize: 10, color: GRAY, border: [false, false, false, true], borderColor: [null, null, null, BORDER] },
    ]);
  }
  totalsBody.push([
    { text: 'TOTAL', bold: true, fontSize: 12, color: '#FFFFFF', fillColor: ACCENT, border: [false, false, false, false] },
    { text: _fmt(inv.total), bold: true, fontSize: 12, color: '#FFFFFF', fillColor: ACCENT, alignment: 'right', border: [false, false, false, false] },
  ]);

  const conceptoSection = {
    stack: [
      { text: 'CONCEPTO', style: 'sectionLabel', marginBottom: 4 },
      conceptoBlock,
    ],
  };

  const totalsColumns = {
    columns: [
      { text: '', width: '*' },
      {
        table: { widths: ['*', 110], body: totalsBody },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => BORDER,
          paddingTop:    () => 5,
          paddingBottom: () => 5,
          paddingLeft:   () => 8,
          paddingRight:  () => 8,
        },
        width: 270,
      },
    ],
    marginBottom: 16,
  };

  // ── Payment ────────────────────────────────────────────────────────────────
  const paymentLines = (!isQuote && (inv.paymentMethod || inv.iban))
    ? [
        { text: 'FORMA DE PAGO', style: 'sectionLabel' },
        ...(inv.paymentMethod ? [{ text: inv.paymentMethod, fontSize: 10, color: GRAY }] : []),
        ...(inv.iban          ? [{ text: inv.iban,          fontSize: 10, color: GRAY }] : []),
      ]
    : [];

  // Totals + payment together — never split across pages
  const bottomBlock = {
    stack: [
      totalsColumns,
      ...(paymentLines.length > 0 ? [{ stack: paymentLines, marginBottom: 14 }] : []),
    ],
    unbreakable: true,
  };

  // ── Notes ──────────────────────────────────────────────────────────────────
  const notesBlock = inv.notes
    ? {
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.5, lineColor: BORDER }], marginBottom: 10 },
          { text: 'NOTAS', style: 'sectionLabel' },
          { text: inv.notes, fontSize: 10, color: GRAY, lineHeight: 1.6 },
        ],
      }
    : {};

  const docLabelModern = isQuote
    ? `PRESUPUESTO${inv.number ? '  ·  ' + inv.number : ''}`
    : `FACTURA${inv.number ? '  ·  ' + inv.number : ''}`;

  return {
    pageSize:     'A4',
    pageMargins:  [48, 55, 48, 40],
    defaultStyle: { font: 'Roboto', fontSize: 11, color: '#18181B' },

    header: _continuationHeader(docLabelModern),
    footer: _pageFooter,

    content: [pageHeader, divider, infoRow, conceptoSection, bottomBlock, notesBlock],

    styles: {
      sectionLabel: { fontSize: 8, bold: true, color: GRAY, characterSpacing: 1.5, marginBottom: 6 },
      metaLabel:    { fontSize: 9, color: GRAY },
      metaValue:    { fontSize: 9, bold: true },
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
              {
                stack: [
                  { text: 'Nombre / Razón social', style: 'clientLabel' },
                  { text: inv.clientName || '—', style: 'clientCell' },
                ],
              },
              {
                stack: [
                  { text: 'CP / Ciudad', style: 'clientLabel' },
                  { text: _buildCpCiudad(inv) || '—', style: 'clientCell' },
                ],
              },
            ],
            [
              {
                stack: [
                  { text: 'NIF / CIF', style: 'clientLabel' },
                  { text: inv.clientNif || '—', style: 'clientCell' },
                ],
              },
              {
                stack: [
                  { text: 'Teléfono', style: 'clientLabel' },
                  { text: inv.clientPhone || '—', style: 'clientCell' },
                ],
              },
            ],
            [
              {
                stack: [
                  { text: 'Dirección', style: 'clientLabel' },
                  { text: _buildStreet(inv) || '—', style: 'clientCell' },
                ],
                colSpan: 2,
              },
              {},
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5, vLineWidth:  () => 0.5,
          hLineColor: () => BORDER, vLineColor: () => BORDER,
          paddingLeft: () => 5, paddingRight: () => 5,
          paddingTop:  () => 4, paddingBottom: () => 6,
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
    stack: [
      {
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
      },
    ],
    unbreakable: true,
  };

  const notesSection = inv.notes
    ? { text: inv.notes, fontSize: 10, color: GRAY, marginTop: 16, lineHeight: 1.5 }
    : {};

  const docLabel = isQuote
    ? `PRESUPUESTO${inv.number ? '  ·  ' + inv.number : ''}`
    : `FACTURA${inv.number ? '  ·  ' + inv.number : ''}`;

  return {
    pageSize:     'A4',
    pageMargins:  [48, 55, 48, 40],
    defaultStyle: { font: 'Roboto', fontSize: 11, color: '#000000' },

    header: _continuationHeader(docLabel),
    footer: _pageFooter,

    content: [header, separator, clienteSection, conceptoSection, bottomSection, notesSection],

    styles: {
      fieldLabel:  { fontSize: 9, color: GRAY },
      fieldValue:  { fontSize: 9 },
      clientLabel: { fontSize: 7, color: GRAY, marginBottom: 2 },
      clientCell:  { fontSize: 10 },
      totalsLabel: { fontSize: 10, color: GRAY, border: [true, true, true, true] },
      totalsValue: { fontSize: 10, alignment: 'right', border: [true, true, true, true] },
    },
  };
}
