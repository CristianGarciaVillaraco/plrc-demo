// Simple dev server — no clean URLs, no redirects
// Fallback: /preview → preview.html (handles stale browser-cached redirects)
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const base    = urlPath === '/' ? 'index.html' : urlPath;

  // If no extension, try appending .html (handles stale 301 redirects from old serve)
  const candidates = path.extname(base)
    ? [base]
    : [base, base + '.html'];

  const tryNext = (list) => {
    if (!list.length) {
      process.stdout.write(`  404  ${req.url}\n`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const filePath = path.join(__dirname, list[0]);
    fs.readFile(filePath, (err, data) => {
      if (err) { tryNext(list.slice(1)); return; }
      const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      process.stdout.write(`  200  ${req.url}\n`);
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  };

  tryNext(candidates);
}).listen(PORT, () => {
  process.stdout.write(`\n  Dev server → http://localhost:${PORT}\n\n`);
});
