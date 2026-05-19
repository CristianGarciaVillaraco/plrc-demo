// ── Document types ────────────────────────────────────────────────────────────

const DOC_TYPES = {
  INVOICE: 'invoice',
  QUOTE:   'quote',
};

// ── Statuses ──────────────────────────────────────────────────────────────────

const STATUSES = {
  DRAFT:   'draft',
  PENDING: 'pending',
  PAID:    'paid',
  SENT:    'sent',
  ACCEPTED:'accepted',
};

const STATUS_LABELS_INVOICE = {
  draft:   'Borrador',
  pending: 'Pendiente',
  paid:    'Cobrada',
};

const STATUS_LABELS_QUOTE = {
  draft:    'Borrador',
  sent:     'Enviado',
  accepted: 'Aceptado',
};

function getStatusLabel(status, type) {
  if (type === DOC_TYPES.QUOTE) return STATUS_LABELS_QUOTE[status] ?? status;
  return STATUS_LABELS_INVOICE[status] ?? status;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS = {
  VAT_RATE:  21,
  IRPF_RATE: 15,
};

// ── Routes ────────────────────────────────────────────────────────────────────

const ROUTES = {
  LIST:         '/index.html',
  NEW_DOCUMENT: '/html/new-document.html',
  PREVIEW:      '/html/preview.html',
};
