/**
 * Generates PWA icons (192x192 and 512x512 PNG) with no npm dependencies.
 * Run: node generate-icons.js
 *
 * Icon: paintbrush (wood handle + silver ferrule + amber bristles) on blue bg
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ─────────────────────────────────────────────────────────────────────

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

// ── PNG chunk builder ─────────────────────────────────────────────────────────

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const crcVal = Buffer.allocUnsafe(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

// ── Icon renderer ─────────────────────────────────────────────────────────────

/**
 * Generates a PNG icon with:
 *   - Solid accent background (#2563EB)
 *   - White rounded rectangle in the center (simulated by pixel map)
 *   - White "F" letter drawn as pixel blocks
 */
function generateIcon(size) {
  const W = size, H = size;

  // RGB pixel buffer: row-major, 3 bytes per pixel
  const pixels = Buffer.alloc(W * H * 3);

  const BG     = [37,  99,  235]; // blue  #2563EB
  const HANDLE = [210, 155,  90]; // wood  #D29B5A
  const SILVER = [220, 220, 230]; // ferrule (metal band)
  const PAINT  = [251, 191,  36]; // amber #FBD024 — paint on bristles

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    pixels[i]     = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
  }

  function fillRect(x, y, w, h, color) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        setPixel(x + dx, y + dy, color);
  }

  fillRect(0, 0, W, H, BG);

  // Paintbrush on a 12×18 unit grid, centered
  const unit   = Math.max(1, Math.floor(size / 32));
  const glyphW = 12 * unit;
  const glyphH = 18 * unit;
  const ox = Math.floor((W - glyphW) / 2);
  const oy = Math.floor((H - glyphH) / 2);

  // Wooden handle: center 2u wide, rows 0–9
  fillRect(ox + 5 * unit, oy,              2 * unit, 10 * unit, HANDLE);
  // Ferrule (silver band): 4u wide, rows 10–11
  fillRect(ox + 4 * unit, oy + 10 * unit,  4 * unit,  2 * unit, SILVER);
  // Bristle body (amber): 4u wide, rows 12–16
  fillRect(ox + 4 * unit, oy + 12 * unit,  4 * unit,  5 * unit, PAINT);
  // Tapered bristle tip: 2u wide, row 17
  fillRect(ox + 5 * unit, oy + 17 * unit,  2 * unit,  1 * unit, PAINT);

  // Build IDAT: scanlines with filter byte 0 (None) per row
  const scanlineSize = 1 + W * 3;
  const raw = Buffer.allocUnsafe(H * scanlineSize);
  for (let y = 0; y < H; y++) {
    raw[y * scanlineSize] = 0; // filter None
    pixels.copy(raw, y * scanlineSize + 1, y * W * 3, (y + 1) * W * 3);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Write files ───────────────────────────────────────────────────────────────

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generateIcon(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generateIcon(512));

console.log('✓ icons/icon-192.png');
console.log('✓ icons/icon-512.png');
