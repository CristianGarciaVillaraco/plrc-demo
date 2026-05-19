// Cloudflare Workers sync
// URL and token are injected at build time via js/sync-config.js (gitignored)
// which sets window.SYNC_URL and window.SYNC_TOKEN

function _isConfigured() {
  return !!(window.SYNC_URL && window.SYNC_TOKEN);
}

async function _apiFetch(path, options = {}) {
  const res = await fetch(`${window.SYNC_URL}${path}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${window.SYNC_TOKEN}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`[cloudflare] ${res.status} ${path}`);
  return res.json();
}

// ── Offline strip ─────────────────────────────────────────────────────────────

function _updateStrip() {
  const strip = document.getElementById('sync-strip');
  if (!strip) return;
  strip.classList.toggle('sync-strip--visible', _isConfigured() && !navigator.onLine);
}

// ── Sync ─────────────────────────────────────────────────────────────────────

async function _pullData() {
  const docs = await _apiFetch('/invoices');
  for (const doc of docs) {
    if (doc.createdAt) doc.createdAt = new Date(doc.createdAt);
    await db.invoices.put(doc);
  }
}

async function pullFromCloudflare() {
  if (!_isConfigured()) return;
  try {
    await _pullData();
    if (typeof loadAndRender === 'function') loadAndRender();
  } catch (err) {
    console.error('[cloudflare] pull error', err);
  }
}

async function pullSilentFromCloudflare() {
  if (!_isConfigured()) return;
  try {
    await _pullData();
  } catch (err) {
    console.error('[cloudflare] pull error', err);
  }
}

async function pushToCloudflare(id, data) {
  if (!_isConfigured()) return;
  try {
    await _apiFetch(`/invoices/${id}`, {
      method: 'POST',
      body: JSON.stringify({ id, ...data }),
    });
  } catch (err) {
    console.error('[cloudflare] push error', err);
  }
}

async function deleteFromCloudflare(id) {
  if (!_isConfigured()) return;
  try {
    await _apiFetch(`/invoices/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.error('[cloudflare] delete error', err);
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('online',  _updateStrip);
window.addEventListener('offline', _updateStrip);

document.addEventListener('DOMContentLoaded', () => {
  _updateStrip();
  if (_isConfigured()) pullFromCloudflare();
});
