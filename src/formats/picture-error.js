// The error the picture readers throw (pal.js, cps.js, shp.js, wsa.js and their two packers, format80.js and
// format40.js): a damaged file is refused with a sentence that names the file and the byte where it went wrong,
// rather than handing back a garbled picture.

export class PictureError extends Error {
  constructor(message) { super(message); this.name = 'PictureError'; }
}

/** The bytes of `data` (an ArrayBuffer or any typed array) as a Uint8Array view, without a copy. */
export function bytesOf(data, label = 'file') {
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  throw new PictureError(`${label}: not binary data`);
}
