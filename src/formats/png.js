// PNG files written in the browser from RGBA pixels: the original game's pictures, read from the player's files,
// are shown through them (a PNG keeps every pixel exactly, so pixel art stays crisp). Pictures of up to 256
// colours (the original's always are) are written as palette PNGs, the rest as RGBA. The pixels are deflated by
// the browser's CompressionStream when it has one, else kept in stored (unpacked) zlib blocks, which every PNG
// reader takes. scaleNearest() enlarges by whole pixels first, so a picture drawn bigger stays sharp even where a
// browser smooths what it scales.

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes, crc = 0xffffffff) {
  for (let i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return crc;
}

function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i += 4096) {
    const end = Math.min(bytes.length, i + 4096);
    for (let k = i; k < end; k++) { a += bytes[k]; b += a; }
    a %= 65521; b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** A zlib stream of stored (unpacked) blocks: valid everywhere, no compression. */
export function storedZlib(raw) {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  out[0] = 0x78; out[1] = 0x01;
  let o = 2;
  for (let k = 0; k < blocks; k++) {
    const from = k * 65535, len = Math.min(65535, raw.length - from);
    out[o++] = k === blocks - 1 ? 1 : 0;
    out[o++] = len & 255; out[o++] = len >> 8; out[o++] = ~len & 255; out[o++] = (~len >> 8) & 255;
    out.set(raw.subarray(from, from + len), o);
    o += len;
  }
  const ad = adler32(raw);
  out[o++] = ad >>> 24; out[o++] = (ad >>> 16) & 255; out[o++] = (ad >>> 8) & 255; out[o++] = ad & 255;
  return out;
}

/** zlib-deflated by the platform (CompressionStream), or stored when it has none. */
export async function zlib(raw) {
  if (typeof CompressionStream !== 'function') return storedZlib(raw);
  try {
    const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return storedZlib(raw); }
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, (crc32(out.subarray(4, 8 + data.length)) ^ 0xffffffff) >>> 0);
  return out;
}

/**
 * The PNG's parts before packing: the header, the palette chunks (if any) and the filtered rows — the picture
 * enlarged `k` times by whole pixels on the way (each pixel a k x k block), which costs only the copying.
 */
function layout(rgba, width, height, k = 1) {
  const n = width * height, colours = new Map(), view = new Uint32Array(rgba.buffer, rgba.byteOffset, n), index = new Uint8Array(n);
  let indexed = true;
  for (let i = 0; i < n; i++) {
    const c = rgba[i * 4 + 3] === 0 ? 0 : view[i];   // every see-through pixel is one colour
    let at = colours.get(c);
    if (at === undefined) {
      if (colours.size === 256) { indexed = false; break; }
      at = colours.size;
      colours.set(c, at);
    }
    index[i] = at;
  }
  const W = width * k, H = height * k;
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = indexed ? 3 : 6;   // 8 bits; palette or RGBA
  const extra = [];
  const bpp = indexed ? 1 : 4, stride = W * bpp + 1, raw = new Uint8Array(stride * H);   // each row: filter 0, then the pixels
  if (indexed) {
    const plte = new Uint8Array(colours.size * 3), trns = new Uint8Array(colours.size);
    let lastSeeThrough = -1;
    for (const [c, at] of colours) {
      const bytes = new Uint8Array(new Uint32Array([c]).buffer);
      plte.set(bytes.subarray(0, 3), at * 3);
      trns[at] = bytes[3];
      if (bytes[3] !== 255) lastSeeThrough = at;
    }
    extra.push(chunk('PLTE', plte));
    if (lastSeeThrough >= 0) extra.push(chunk('tRNS', trns.subarray(0, lastSeeThrough + 1)));
  }
  const px = indexed ? null : new Uint32Array(1), pxBytes = indexed ? null : new Uint8Array(px.buffer);
  for (let y = 0; y < height; y++) {
    const row = y * k * stride;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, o = row + 1 + x * k * bpp;
      if (indexed) raw.fill(index[i], o, o + k);
      else { px[0] = view[i]; for (let d = 0; d < k; d++) raw.set(pxBytes, o + d * 4); }
    }
    for (let d = 1; d < k; d++) raw.copyWithin(row + d * stride, row, row + stride);
  }
  return { ihdr, extra, raw };
}

function assemble({ ihdr, extra }, idat) {
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), ...extra, chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const rgbaOf = (rgba, width, height) => {
  const b = rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  if (b.length !== width * height * 4) throw new RangeError(`png: ${b.length} bytes are not ${width} x ${height} RGBA pixels`);
  return b.byteOffset % 4 ? b.slice() : b;
};

/** A PNG (Uint8Array) of `rgba` (4 bytes a pixel), unpacked: synchronous. `scale`: whole-pixel enlargement. */
export function encodePngSync(rgba, width, height, { scale = 1 } = {}) {
  const l = layout(rgbaOf(rgba, width, height), width, height, scale);
  return assemble(l, storedZlib(l.raw));
}

/** A PNG (Uint8Array) of `rgba` (4 bytes a pixel), deflated where the platform can. `scale`: whole-pixel enlargement. */
export async function encodePng(rgba, width, height, { scale = 1 } = {}) {
  const l = layout(rgbaOf(rgba, width, height), width, height, scale);
  return assemble(l, await zlib(l.raw));
}

/**
 * A palette PNG (Uint8Array) straight from colour indices: `index` a byte a pixel (width x height) into `colours`,
 * at most 256 words r | g << 8 | b << 16 | a << 24. For a picture already in indices (a palette picture enlarged by a
 * pixel-art scaler, ui/campaign/pixel-scale.js) it skips looking every pixel's colour up. Deflated where the
 * platform can.
 */
export async function encodeIndexedPng(index, width, height, colours) {
  if (index.length !== width * height) throw new RangeError(`png: ${index.length} indices are not ${width} x ${height} pixels`);
  if (!(colours.length >= 1 && colours.length <= 256)) throw new RangeError(`png: ${colours.length} colours do not fit a palette`);
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 3;   // 8 bits, palette
  const plte = new Uint8Array(colours.length * 3), trns = new Uint8Array(colours.length);
  let lastSeeThrough = -1;
  colours.forEach((c, k) => {
    plte[k * 3] = c & 255; plte[k * 3 + 1] = (c >>> 8) & 255; plte[k * 3 + 2] = (c >>> 16) & 255;
    trns[k] = c >>> 24;
    if (trns[k] !== 255) lastSeeThrough = k;
  });
  const extra = [chunk('PLTE', plte)];
  if (lastSeeThrough >= 0) extra.push(chunk('tRNS', trns.subarray(0, lastSeeThrough + 1)));
  const raw = new Uint8Array((width + 1) * height);   // each row: filter 0, then the indices
  for (let y = 0; y < height; y++) raw.set(index.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  return assemble({ ihdr, extra }, await zlib(raw));
}

/** `rgba` enlarged `k` times by whole pixels (each pixel becomes a k x k block). */
export function scaleNearest(rgba, width, height, k) {
  if (k === 1) return rgba;
  const w = width * k, out = new Uint8Array(w * height * k * 4), s = rgbaOf(rgba, width, height);
  const src = new Uint32Array(s.buffer, s.byteOffset, width * height), dst = new Uint32Array(out.buffer);
  for (let y = 0; y < height; y++) {
    const row = y * k * w;
    for (let x = 0; x < width; x++) {
      const c = src[y * width + x];
      for (let dx = 0; dx < k; dx++) dst[row + x * k + dx] = c;
    }
    for (let dy = 1; dy < k; dy++) dst.copyWithin(row + dy * w, row, row + w);
  }
  return out;
}

/** A data: URL for PNG bytes. */
export function pngDataUrl(png) {
  let s = '';
  for (let i = 0; i < png.length; i += 0x8000) s += String.fromCharCode.apply(null, png.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(s)}`;
}
