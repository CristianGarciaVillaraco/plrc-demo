// ── Currency ──────────────────────────────────────────────────────────────────

function formatAmount(amount) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount ?? 0);
}

// ── Date ──────────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });
}

/** Returns "YYYY-MM" from a date string or Date object, for month filtering */
function formatYearMonth(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(0, 7); // "YYYY-MM"
}

/** Returns "Marzo 2025" style label for a "YYYY-MM" string */
function formatMonthLabel(yearMonth) {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
