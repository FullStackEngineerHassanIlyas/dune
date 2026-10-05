// The Mentat's face, drawn over his portrait (notes docs/superpowers/notes/2026-10-05-mentat-face.md). The portrait is
// a stack of HTML images (portraits.js); built once per face, the head (its image and the closed eyes) goes inside two
// boxes that tilt and nod about the head's pivot (CSS transforms, inside the portrait's own CSS sway), and an SVG laid
// over the head painting holds the face's parts: the brows and the mouth's corners and chin (a warp of the painting or
// a sprite of their own, each under a soft mask), the mouth's sprites (one per viseme, cross-faded, on a jaw that
// opens), and the lids (the closed-eyes layer, drawn down over each eye). Every frame write(pose) sets only what
// changed, and only to strings made once here: each value is quantised to a step far under a pixel and looked up in a
// table, so a frame allocates nothing. restore() puts the portrait back as it was.

const NS = 'http://www.w3.org/2000/svg';

/** The pose: what the engine computes each frame and write() shows (frame units, degrees, opacities). */
export const POSE = {
  tilt: 0, nod: 1,
  browLy: 2, browLx: 3, browLr: 4, browRy: 5, browRx: 6, browRr: 7,
  cornerLy: 8, cornerRy: 9, jawY: 10,
  mouthY: 11, mouthSkew: 12, mouthSx: 13, mouthSy: 14,   // mouthSkew: the left half's skew (degrees) …
  lidL: 15, lidR: 16,
  mouthSkewR: 17,    // … and the right half's: a corner up on each side, or a sneer on one
  alpha: 18,         // … one per viseme (VISEMES order)
};
export const POSE_SIZE = POSE.alpha + 7;

const fmt = (v) => String(Math.round(v * 1e4) / 1e4);

/** A table of the strings for v in min..max by step; index(v) is the nearest one (NaN goes to the first). */
class Quant {
  constructor(min, max, step, text) {
    this.min = min; this.inv = 1 / step;
    this.n = Math.round((max - min) / step) + 1;
    this.s = Array.from({ length: this.n }, (_, i) => text(fmt(min + i * step)));
    this.zero = this.index(0);   // the index of "no change"
  }

  index(v) {
    const i = Math.round((v - this.min) * this.inv);
    return i >= 0 ? (i < this.n ? i : this.n - 1) : 0;
  }
}

const TABLES = new Map();
/**
 * The shared tables (made once for every face of a frame `fh` units high): 1/32 unit, 1/50 degree, 1/256 of a scale,
 * 1/255 of an opacity; `ty` and `rot` for the SVG's attributes, `cssTy` and `cssRot` for the head's boxes.
 */
export function tables(fh = 500) {
  let t = TABLES.get(fh);
  if (!t) {
    t = {
      ty: new Quant(-16, 16, 1 / 32, (v) => `translate(0 ${v})`),
      tx: new Quant(-8, 8, 1 / 32, (v) => `translate(${v} 0)`),
      rot: new Quant(-20, 20, 1 / 50, (v) => `rotate(${v})`),
      sx: new Quant(0.6, 1.4, 1 / 256, (v) => `scale(${v} 1)`),
      sy: new Quant(0.4, 2, 1 / 256, (v) => `scale(1 ${v})`),
      skew: new Quant(-25, 25, 1 / 20, (v) => `skewY(${v})`),
      unit: new Quant(0, 1, 1 / 255, (v) => v),
      // the head's boxes: a nod in units is a share of the frame's height
      cssTy: new Quant(-16, 16, 1 / 32, (v) => `translateY(${fmt((v * 100) / fh)}%)`),
      cssRot: new Quant(-20, 20, 1 / 50, (v) => `rotate(${v}deg)`),
    };
    TABLES.set(fh, t);
  }
  return t;
}

/**
 * A vector sprite drawn once into a bitmap (in a browser): an SVG image, filters and all, would be drawn again every
 * frame its transform changes (the jaw scales the mouth every frame). Resolves true once `img` shows the bitmap.
 */
function rasterize(img, src, box, perUnit, urls) {
  if (typeof Image !== 'function' || typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return Promise.resolve(false);
  if (!/^data:image\/svg\+xml|\.svg(\?|#|$)/.test(src)) return Promise.resolve(false);
  const im = new Image();
  im.src = src;
  return im.decode().then(() => new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(box[2] * perUnit); c.height = Math.ceil(box[3] * perUnit);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      if (!b) { resolve(false); return; }
      const u = URL.createObjectURL(b);
      urls.push(u);
      img.setAttribute('href', u);
      resolve(true);
    }, 'image/png');
  })).catch(() => false);
}

// the write slots (one per attribute the frame may change)
const W_HEAD_TY = 0, W_HEAD_ROT = 1, W_BROWS = 2, W_CORNERS = 8, W_JAW = 10, W_MOUTH = 11, W_LIDS = 16, W_ALPHA = 22, W_COUNT = 29;
// the display slots: a part out of the picture while it would only repaint the painting (a warp at rest, a sprite at 0)
const D_BROWS = 0, D_CORNERS = 2, D_JAW = 4, D_LIDS = 5, D_ALPHA = 7, D_BASE = 14, D_COUNT = 16;

/** The portrait's head painting (the `<img>` in its `.cpm-sway` that is not the blink), or null; only before the face is built. */
export function headImageOf(art) {
  const sway = art?.querySelector?.('.cpm-sway');
  if (!sway) return null;
  return Array.from(sway.childNodes).find((n) => n.nodeType === 1 && (n.localName ?? n.tagName ?? '').toLowerCase() === 'img' && !n.matches?.('.cpm-blink')) ?? null;
}

/**
 * Builds the face into the portrait `art` (the `.cp-mentat-art` element portraits.js makes: a `.cpm-sway` box holding the
 * head `<img>` and the `.cpm-blink` closed eyes). `rig`: a valid rig (mentat-face-rig.js). `uid` keeps the ids unique
 * when two portraits are on the page. Returns { root, write(pose), setActive(on, ownBlinks), restore(), written }.
 */
export function createFaceSvg({ art, svg, rig, uid = 'cpmf', visemes }) {
  const host = art ?? svg;
  const doc = host.ownerDocument ?? globalThis.document;
  const [fw, fh] = rig.frame;
  const T = tables(fh);
  const sway = host.querySelector('.cpm-sway');
  if (!sway) throw new Error('mentat face: the portrait has no head box (.cpm-sway)');
  const blink = host.querySelector('.cpm-blink');
  const make = (tag, attrs, parent) => {
    const el = doc.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(el);
    return el;
  };
  const box = (cls, style, parent) => {
    const el = doc.createElement('div');
    el.setAttribute('class', cls);
    el.setAttribute('style', style);
    parent?.appendChild(el);
    return el;
  };
  const boxAttrs = ([x, y, width, height]) => ({ x, y, width, height });
  const image = (src, box, parent, extra = {}) => make('image', { href: src, ...boxAttrs(box), preserveAspectRatio: 'none', ...extra }, parent);

  // the head: a box that nods (translateY) holding one that rolls about the pivot; the portrait's own children move
  // inside, and the face's SVG lies over the head painting, under the portrait's own blink
  const [px, py] = rig.head.pivot;
  const share = (v, of) => `${fmt((v / of) * 100)}%`;
  const head = box('cpmf-head', 'position:absolute;inset:0;will-change:transform');
  const headRot = box('cpmf-roll', `position:absolute;inset:0;will-change:transform;transform-origin:${share(px, fw)} ${share(py, fh)}`, head);
  const moved = Array.from(sway.childNodes);
  for (const n of moved) headRot.appendChild(n);
  sway.appendChild(head);

  // the SVG covers only the face (every part's box, with room for the moves), as a layer of its own: a frame's changes
  // repaint that small layer and nothing else, and the compositor lays it over the head
  const spots = [rig.mouth.box, rig.brows?.left.box, rig.brows?.right.box, rig.corners?.left.box, rig.corners?.right.box, rig.jaw?.box, rig.lids?.left.box, rig.lids?.right.box].filter(Boolean);
  const pad = 8;
  const fx0 = Math.max(0, Math.min(...spots.map((b) => b[0])) - pad), fy0 = Math.max(0, Math.min(...spots.map((b) => b[1])) - pad);
  const fx1 = Math.min(fw, Math.max(...spots.map((b) => b[0] + b[2])) + pad), fy1 = Math.min(fh, Math.max(...spots.map((b) => b[1] + b[3])) + pad);
  const overlay = make('svg', {
    class: 'cpmf-svg', viewBox: `${fmt(fx0)} ${fmt(fy0)} ${fmt(fx1 - fx0)} ${fmt(fy1 - fy0)}`, preserveAspectRatio: 'none', 'aria-hidden': 'true',
    style: `position:absolute;left:${share(fx0, fw)};top:${share(fy0, fh)};width:${share(fx1 - fx0, fw)};height:${share(fy1 - fy0, fh)};overflow:hidden;pointer-events:none;will-change:transform`,
  });
  const headImage = moved.find((n) => n.nodeType === 1 && (n.localName ?? n.tagName).toLowerCase() === 'img' && !n.matches?.('.cpm-blink')) ?? null;
  headRot.insertBefore(overlay, headImage ? headImage.nextSibling : headRot.firstChild);
  const defs = make('defs', { class: 'cpmf-defs' }, overlay);
  const root = make('g', { class: 'cpmf-face', display: 'none' }, overlay);
  // the layers: the brows' bare patches of head first, the brows' own sprites last (over the lids: a brow that comes
  // down passes over the eyelid, not under it)
  const baseLayer = make('g', { class: 'cpmf-bases' }, root);
  const browLayer = make('g', { class: 'cpmf-brows' });

  // a soft mask: a box whose middle is opaque and whose edges fade over `feather` of its half-size on each side: a ramp
  // across and a ramp down, in two masks one inside the other (their product is a soft rectangle, not an ellipse: the
  // corners of a brow's box stay opaque, so a moved brow leaves no ghost of itself in them)
  const softMask = (name, box, feather) => {
    const id = `${uid}-${name}`, f = fmt(Math.min(0.5, Math.max(0, feather / 2)));
    const one = (axis) => {
      const grad = make('linearGradient', { id: `${id}-${axis}f`, x1: 0, y1: 0, x2: axis === 'x' ? 1 : 0, y2: axis === 'y' ? 1 : 0 }, defs);
      make('stop', { offset: 0, 'stop-color': '#000' }, grad);
      make('stop', { offset: f, 'stop-color': '#fff' }, grad);
      make('stop', { offset: fmt(1 - f), 'stop-color': '#fff' }, grad);
      make('stop', { offset: 1, 'stop-color': '#000' }, grad);
      const mask = make('mask', { id: `${id}-${axis}`, maskUnits: 'userSpaceOnUse', ...boxAttrs(box) }, defs);
      make('rect', { ...boxAttrs(box), fill: `url(#${id}-${axis}f)` }, mask);
      return `url(#${id}-${axis})`;
    };
    return [one('x'), one('y')];
  };

  // a warp's patch: the head painting cut to the part's box with its edges faded (a canvas, once, from the head <img>
  // already on the page). Drawn small and moved, it costs the compositor next to nothing; the masks it replaces made a
  // layer the size of the whole head image for every part, every frame. Null where there is no canvas (the masks serve).
  const patchOf = (box, feather) => {
    try {
      const k = headImage?.complete ? headImage.naturalWidth / rig.head.box[2] : 0;
      if (!(k > 0) || typeof doc.createElement !== 'function') return null;
      const c = doc.createElement('canvas');
      if (typeof c.getContext !== 'function') return null;
      const [x, y, w, h] = box;
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      const g = c.getContext('2d', { willReadFrequently: true });   // read back once, at once: a CPU canvas, no wait for the GPU
      g.drawImage(headImage, (x - rig.head.box[0]) * k, (y - rig.head.box[1]) * k, w * k, h * k, 0, 0, c.width, c.height);
      const f = Math.min(0.5, Math.max(0, feather / 2));
      g.globalCompositeOperation = 'destination-in';
      for (const [x2, y2] of [[c.width, 0], [0, c.height]]) {
        const ramp = g.createLinearGradient(0, 0, x2, y2);
        ramp.addColorStop(0, 'rgba(0,0,0,0)'); ramp.addColorStop(f, '#000'); ramp.addColorStop(1 - f, '#000'); ramp.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = ramp; g.fillRect(0, 0, c.width, c.height);
      }
      return c.toDataURL('image/png');
    } catch { return null; }
  };

  // a part: its own sprite (src) at its box, over a bare patch of the head that stays (base: a brow cut-out), or a warp
  // of the head painting (a faded patch of it, or the whole painting under masks that stay put while the picture inside
  // moves); it moves (ty, and for a brow tx and a roll about `origin`)
  const part = (name, p, { roll = null, into = root } = {}) => {
    const patch = !p.src ? patchOf(p.box, p.feather ?? 0.45) : null;
    const masked = !patch && (!p.src || p.feather !== undefined);
    const masks = masked ? softMask(name, p.box, p.feather ?? 0.45) : null;
    const g = make('g', { class: `cpmf-${name}`, ...(masks ? { mask: masks[0] } : {}) }, into);
    const base = p.base ? image(p.base.src, p.base.box, baseLayer, { class: `cpmf-${name}-base` }) : null;
    const gy = masks ? make('g', { mask: masks[1] }, g) : g;
    const ty = make('g', {}, gy);
    let inner = ty, tx = null, rot = null;
    if (roll) {
      tx = make('g', {}, ty);
      const at = make('g', { transform: `translate(${fmt(roll[0])} ${fmt(roll[1])})` }, tx);
      rot = make('g', {}, at);
      inner = make('g', { transform: `translate(${fmt(-roll[0])} ${fmt(-roll[1])})` }, rot);
    }
    if (p.src) image(p.src, p.box, inner); else if (patch) image(patch, p.box, inner); else image(rig.head.src, rig.head.box, inner);
    // a part that leaves the painting as it is at rest is out of the picture then (a warp, or a cut-out over its patch)
    return { g, base, ty, tx, rot, warp: !p.src || !!p.base };
  };

  const brow = (side) => {
    const p = rig.brows[side], [x, y, w, h] = p.box;
    return part(`brow-${side}`, p, { into: browLayer, roll: p.origin ?? (side === 'left' ? [x + w * 0.08, y + h / 2] : [x + w * 0.92, y + h / 2]) });
  };
  const brows = rig.brows ? [brow('left'), brow('right')] : null;
  const corners = rig.corners ? [part('corner-left', rig.corners.left), part('corner-right', rig.corners.right)] : null;
  const jaw = rig.jaw ? part('jaw', rig.jaw) : null;

  // the mouth: about (centre, hinge) it moves up, widens and opens (scale y), and each half of it skews on its own (a
  // corner up on either side). The sprites are drawn once, in a stack in the defs, and shown twice: as a left and a right
  // half, each under a soft mask that hands over to the other across a unit or so in the middle (their opacities add up
  // to one) and the two added together (plus-lighter, in a group of their own), so the seam where they meet is exactly
  // the sprite, however far the sprites are cross-faded, and no hairline shows
  const m = rig.mouth, cx = m.center ?? m.box[0] + m.box[2] / 2, hy = m.hinge;
  const mouth = make('g', { class: 'cpmf-mouth' }, root);
  const mAt = make('g', { transform: `translate(${fmt(cx)} ${fmt(hy)})` }, mouth);
  const mTy = make('g', {}, mAt), mSx = make('g', {}, mTy), mSy = make('g', {}, mSx);
  const stack = make('g', { id: `${uid}-stack`, transform: `translate(${fmt(-cx)} ${fmt(-hy)})` }, defs);
  const names = visemes ?? ['rest', 'MBP', 'FV', 'A', 'E', 'O', 'L'];
  const sprites = names.map((v) => (m.sprites[v] ? image(m.sprites[v], m.box, stack, { opacity: 0, display: 'none', class: `cpmf-v-${v}` }) : null));
  const urls = [];
  const ready = Promise.all(sprites.map((el, i) => (el ? rasterize(el, m.sprites[names[i]], m.box, m.raster ?? 5, urls) : false)));
  const bw = m.box[2], bh = m.box[3];
  const joined = make('g', { style: 'isolation:isolate' }, mSy);
  const half = (name) => {
    const id = `${uid}-half-${name}`, left = name === 'left';
    const grad = make('linearGradient', { id: `${id}-f`, gradientUnits: 'userSpaceOnUse', x1: -0.8, y1: 0, x2: 0.8, y2: 0 }, defs);
    make('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': left ? 1 : 0 }, grad);
    make('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': left ? 0 : 1 }, grad);
    // the mask's box, in the mouth's own space (about the centre and the hinge), with room for the moves
    const mask = make('mask', { id, maskUnits: 'userSpaceOnUse', x: fmt(-bw), y: fmt(-bh), width: fmt(bw * 2), height: fmt(bh * 2) }, defs);
    make('rect', { x: fmt(-bw), y: fmt(-bh), width: fmt(bw * 2), height: fmt(bh * 2), fill: `url(#${id}-f)` }, mask);
    const skew = make('g', { style: 'mix-blend-mode:plus-lighter' }, joined);
    const g = make('g', { mask: `url(#${id})` }, skew);
    make('use', { href: `#${uid}-stack` }, g);
    return skew;
  };
  const mSkewL = half('left'), mSkewR = half('right');

  // the lids: the closed eyes, shown down to an edge that falls from the eye's top to the lids' foot
  const lid = (side) => {
    const e = rig.lids[side], id = `${uid}-lid-${side}`;
    const grad = make('linearGradient', { id: `${id}-f`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    const s0 = make('stop', { offset: 0, 'stop-color': '#fff' }, grad);
    const s1 = make('stop', { offset: 0, 'stop-color': '#000' }, grad);
    const mask = make('mask', { id, maskUnits: 'userSpaceOnUse', ...boxAttrs(e.box) }, defs);
    make('rect', { ...boxAttrs(e.box), fill: `url(#${id}-f)` }, mask);
    // the eye's own sprite (its box is the sprite's), or the portrait's one lids layer
    const img = image(e.src ?? rig.lids.src, e.src ? e.box : rig.lids.box, root, { mask: `url(#${id})`, opacity: 0, display: 'none', class: `cpmf-lid-${side}` });
    // [eye top, lids box foot, box y, box height]
    return { s0, s1, img, g: new Float64Array([e.open[0], e.box[1] + e.box[3], e.box[1], e.box[3]]) };
  };
  const lids = rig.lids ? [lid('left'), lid('right')] : null;
  root.appendChild(browLayer);
  const soft = rig.lids?.soft ?? 0.12;

  // put(): the attribute `attr` of `el` to the table's string for arr[k], when it changed. Numbers are read from
  // arrays here, never passed as arguments: a call that is not inlined would box each one (an allocation a frame).
  const last = new Int32Array(W_COUNT).fill(-1);
  const shown = new Int8Array(D_COUNT).fill(-1);
  const lidv = new Float64Array(3);
  let written = 0;
  const put = (slot, el, attr, q, arr, k) => {
    let i = Math.round((arr[k] - q.min) * q.inv);
    i = i >= 0 ? (i < q.n ? i : q.n - 1) : 0;
    if (last[slot] !== i) { last[slot] = i; el.setAttribute(attr, q.s[i]); written++; }
  };
  // putCss(): the same for the style's transform of an HTML box
  const putCss = (slot, el, q, arr, k) => {
    let i = Math.round((arr[k] - q.min) * q.inv);
    i = i >= 0 ? (i < q.n ? i : q.n - 1) : 0;
    if (last[slot] !== i) { last[slot] = i; el.style.transform = q.s[i]; written++; }
  };
  // display(): `el` in (on) or out of the picture, when that changed
  const display = (slot, el, on) => {
    const v = on ? 1 : 0;
    if (shown[slot] !== v) { shown[slot] = v; el.setAttribute('display', on ? 'inline' : 'none'); written++; }
  };
  const moved1 = (slot, q) => last[slot] !== q.zero;
  const putLid = (slot, l, pose, k) => {
    const g = l.g, c = pose[k], kk = c < 0 ? 0 : c > 1 ? 1 : c;
    const edge = g[0] + kk * (g[1] - g[0]);
    let e1 = (edge - g[2]) / g[3];
    e1 = e1 < 0 ? 0 : e1 > 1 ? 1 : e1;
    const e0 = e1 - soft * (1 - kk);
    lidv[0] = e0 < 0 ? 0 : e0; lidv[1] = e1; lidv[2] = kk * 25;
    put(slot, l.s0, 'offset', T.unit, lidv, 0);
    put(slot + 1, l.s1, 'offset', T.unit, lidv, 1);
    put(slot + 2, l.img, 'opacity', T.unit, lidv, 2);
  };

  let active = false, ownEyes = false;
  return {
    root, defs, head, overlay, sprites,
    /** Resolves once the vector sprites are bitmaps (in a browser; at once elsewhere). */
    ready,
    /** Attribute writes made so far (a test's measure of a frame's work). */
    get written() { return written; },
    /** Shows the pose (only the attributes whose quantised value changed). */
    write(pose) {
      putCss(W_HEAD_TY, head, T.cssTy, pose, POSE.nod);
      putCss(W_HEAD_ROT, headRot, T.cssRot, pose, POSE.tilt);
      if (brows) {
        put(W_BROWS, brows[0].ty, 'transform', T.ty, pose, POSE.browLy);
        put(W_BROWS + 1, brows[0].tx, 'transform', T.tx, pose, POSE.browLx);
        put(W_BROWS + 2, brows[0].rot, 'transform', T.rot, pose, POSE.browLr);
        put(W_BROWS + 3, brows[1].ty, 'transform', T.ty, pose, POSE.browRy);
        put(W_BROWS + 4, brows[1].tx, 'transform', T.tx, pose, POSE.browRx);
        put(W_BROWS + 5, brows[1].rot, 'transform', T.rot, pose, POSE.browRr);
      }
      if (corners) {
        put(W_CORNERS, corners[0].ty, 'transform', T.ty, pose, POSE.cornerLy);
        put(W_CORNERS + 1, corners[1].ty, 'transform', T.ty, pose, POSE.cornerRy);
        display(D_CORNERS, corners[0].g, !corners[0].warp || moved1(W_CORNERS, T.ty));
        display(D_CORNERS + 1, corners[1].g, !corners[1].warp || moved1(W_CORNERS + 1, T.ty));
      }
      if (brows) {
        const on0 = !brows[0].warp || moved1(W_BROWS, T.ty) || moved1(W_BROWS + 1, T.tx) || moved1(W_BROWS + 2, T.rot);
        const on1 = !brows[1].warp || moved1(W_BROWS + 3, T.ty) || moved1(W_BROWS + 4, T.tx) || moved1(W_BROWS + 5, T.rot);
        display(D_BROWS, brows[0].g, on0);
        display(D_BROWS + 1, brows[1].g, on1);
        if (brows[0].base) display(D_BASE, brows[0].base, on0);
        if (brows[1].base) display(D_BASE + 1, brows[1].base, on1);
      }
      if (jaw) { put(W_JAW, jaw.ty, 'transform', T.ty, pose, POSE.jawY); display(D_JAW, jaw.g, !jaw.warp || moved1(W_JAW, T.ty)); }
      put(W_MOUTH, mTy, 'transform', T.ty, pose, POSE.mouthY);
      put(W_MOUTH + 1, mSkewL, 'transform', T.skew, pose, POSE.mouthSkew);
      put(W_MOUTH + 2, mSx, 'transform', T.sx, pose, POSE.mouthSx);
      put(W_MOUTH + 3, mSy, 'transform', T.sy, pose, POSE.mouthSy);
      put(W_MOUTH + 4, mSkewR, 'transform', T.skew, pose, POSE.mouthSkewR);
      if (lids) {
        putLid(W_LIDS, lids[0], pose, POSE.lidL); putLid(W_LIDS + 3, lids[1], pose, POSE.lidR);
        display(D_LIDS, lids[0].img, last[W_LIDS + 2] > 0); display(D_LIDS + 1, lids[1].img, last[W_LIDS + 5] > 0);
      }
      for (let i = 0; i < sprites.length; i++) {
        if (!sprites[i]) continue;
        put(W_ALPHA + i, sprites[i], 'opacity', T.unit, pose, POSE.alpha + i);
        display(D_ALPHA + i, sprites[i], last[W_ALPHA + i] > 0);
      }
    },
    /**
     * On: the face shows over the painting and (ownBlinks) the portrait's own CSS blink is hidden for ours. Off: the
     * painting alone. Called again while on with the other ownBlinks (reduced motion switched), it gives the eyes back.
     */
    setActive(on, ownBlinks = true) {
      const mine = on && ownBlinks;
      if (on === active && mine === ownEyes) return;
      if (on !== active) {
        active = on;
        root.setAttribute('display', on ? 'inline' : 'none');
        if (!on) { last.fill(-1); shown.fill(-1); }
      }
      ownEyes = mine;
      if (blink?.style) blink.style.visibility = mine ? 'hidden' : '';
    },
    get active() { return active; },
    /** Takes the face out and puts the portrait's head box back as it was. */
    restore() {
      if (blink?.style) blink.style.visibility = '';
      for (const u of urls.splice(0)) URL.revokeObjectURL(u);
      for (const n of Array.from(headRot.childNodes)) if (n !== overlay) sway.insertBefore(n, head);
      head.parentNode?.removeChild(head);
      active = false; ownEyes = false;
    },
  };
}
