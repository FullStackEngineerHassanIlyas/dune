// The Mentat's face, drawn into his portrait's SVG (notes docs/superpowers/notes/2026-10-05-mentat-face.md). Built
// once per face: a group around the head (it tilts and nods about the head's pivot, inside the portrait's own CSS
// sway) and, over the head painting, the face's parts: the brows and the mouth's corners and chin (a warp of the
// painting or a sprite of their own, each under a soft mask), the mouth's sprites (one per viseme, cross-faded, on
// a jaw that opens), and the lids (the closed-eyes layer, drawn down over each eye). Every frame write(pose) sets
// only what changed, and only to strings made once here: each value is quantised to a step far under a pixel and
// looked up in a table, so a frame allocates nothing. restore() puts the portrait back as it was.

const NS = 'http://www.w3.org/2000/svg';

/** The pose: what the engine computes each frame and write() shows (frame units, degrees, opacities). */
export const POSE = {
  tilt: 0, nod: 1,
  browLy: 2, browLx: 3, browLr: 4, browRy: 5, browRx: 6, browRr: 7,
  cornerLy: 8, cornerRy: 9, jawY: 10,
  mouthY: 11, mouthSkew: 12, mouthSx: 13, mouthSy: 14,
  lidL: 15, lidR: 16,
  alpha: 17,         // … one per viseme (VISEMES order)
};
export const POSE_SIZE = POSE.alpha + 7;

const fmt = (v) => String(Math.round(v * 1e4) / 1e4);

/** A table of the strings for v in min..max by step; index(v) is the nearest one (NaN goes to the first). */
class Quant {
  constructor(min, max, step, text) {
    this.min = min; this.inv = 1 / step;
    this.n = Math.round((max - min) / step) + 1;
    this.s = Array.from({ length: this.n }, (_, i) => text(fmt(min + i * step)));
  }

  index(v) {
    const i = Math.round((v - this.min) * this.inv);
    return i >= 0 ? (i < this.n ? i : this.n - 1) : 0;
  }
}

let TABLES = null;
/** The shared tables (made once for every face): 1/32 unit, 1/50 degree, 1/256 of a scale, 1/255 of an opacity. */
export function tables() {
  return (TABLES ??= {
    ty: new Quant(-16, 16, 1 / 32, (v) => `translate(0 ${v})`),
    tx: new Quant(-8, 8, 1 / 32, (v) => `translate(${v} 0)`),
    rot: new Quant(-20, 20, 1 / 50, (v) => `rotate(${v})`),
    sx: new Quant(0.6, 1.4, 1 / 256, (v) => `scale(${v} 1)`),
    sy: new Quant(0.4, 2, 1 / 256, (v) => `scale(1 ${v})`),
    skew: new Quant(-25, 25, 1 / 20, (v) => `skewY(${v})`),
    unit: new Quant(0, 1, 1 / 255, (v) => v),
  });
}

// the write slots (one per attribute the frame may change)
const W_HEAD_TY = 0, W_HEAD_ROT = 1, W_BROWS = 2, W_CORNERS = 8, W_JAW = 10, W_MOUTH = 11, W_LIDS = 15, W_ALPHA = 21, W_COUNT = 28;

/**
 * Builds the face into `svg` (the portrait's <svg>, as portraits.js makes it: a `.cpm-sway` group holding the head
 * image and the `.cpm-blink` lids). `rig`: a valid rig (mentat-face-rig.js). `uid` keeps the ids unique when two
 * portraits are on the page. Returns { root, write(pose), setActive(on, ownBlinks), restore(), written }.
 */
export function createFaceSvg({ svg, rig, uid = 'cpmf', visemes }) {
  const doc = svg.ownerDocument ?? globalThis.document;
  const T = tables();
  const sway = svg.querySelector('.cpm-sway');
  if (!sway) throw new Error('mentat face: the portrait has no head group (.cpm-sway)');
  const blink = svg.querySelector('.cpm-blink');
  const make = (tag, attrs, parent) => {
    const el = doc.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(el);
    return el;
  };
  const boxAttrs = ([x, y, width, height]) => ({ x, y, width, height });
  const image = (src, box, parent, extra = {}) => make('image', { href: src, ...boxAttrs(box), preserveAspectRatio: 'none', ...extra }, parent);

  const defs = make('defs', { class: 'cpmf-defs' });
  svg.insertBefore(defs, svg.firstChild);

  // the head: nod (translate), then roll about the pivot; the portrait's own children move inside
  const [px, py] = rig.head.pivot;
  const head = make('g', { class: 'cpmf-head' });
  const headRoll = make('g', { transform: `translate(${fmt(px)} ${fmt(py)})` }, head);
  const headRot = make('g', {}, headRoll);
  const content = make('g', { transform: `translate(${fmt(-px)} ${fmt(-py)})` }, headRot);
  const moved = Array.from(sway.childNodes);
  for (const n of moved) content.appendChild(n);
  sway.appendChild(head);

  const root = make('g', { class: 'cpmf-face', display: 'none' });
  const headImage = moved.find((n) => n.nodeType === 1 && (n.localName ?? n.tagName) === 'image') ?? null;
  content.insertBefore(root, headImage ? headImage.nextSibling : content.firstChild);

  // a soft mask: a box whose centre is opaque and whose edge fades over `feather` of its half-size
  const softMask = (name, box, feather) => {
    const id = `${uid}-${name}`;
    const grad = make('radialGradient', { id: `${id}-f`, cx: 0.5, cy: 0.5, r: 0.5 }, defs);
    make('stop', { offset: 0, 'stop-color': '#fff' }, grad);
    make('stop', { offset: fmt(Math.max(0, 1 - feather)), 'stop-color': '#fff' }, grad);
    make('stop', { offset: 1, 'stop-color': '#000' }, grad);
    const mask = make('mask', { id, maskUnits: 'userSpaceOnUse', ...boxAttrs(box) }, defs);
    make('rect', { ...boxAttrs(box), fill: `url(#${id}-f)` }, mask);
    return `url(#${id})`;
  };

  // a part: its own sprite (src) at its box, or a warp of the head painting seen through its box; the mask stays put
  // and the picture inside moves (ty, and for a brow tx and a roll about `origin`)
  const part = (name, p, { roll = null } = {}) => {
    const masked = !p.src || p.feather !== undefined;
    const g = make('g', { class: `cpmf-${name}`, ...(masked ? { mask: softMask(name, p.box, p.feather ?? 0.45) } : {}) }, root);
    const ty = make('g', {}, g);
    let inner = ty, tx = null, rot = null;
    if (roll) {
      tx = make('g', {}, ty);
      const at = make('g', { transform: `translate(${fmt(roll[0])} ${fmt(roll[1])})` }, tx);
      rot = make('g', {}, at);
      inner = make('g', { transform: `translate(${fmt(-roll[0])} ${fmt(-roll[1])})` }, rot);
    }
    if (p.src) image(p.src, p.box, inner); else image(rig.head.src, rig.head.box, inner);
    return { ty, tx, rot };
  };

  const brow = (side) => {
    const p = rig.brows[side], [x, y, w, h] = p.box;
    return part(`brow-${side}`, p, { roll: p.origin ?? (side === 'left' ? [x + w * 0.1, y + h / 2] : [x + w * 0.9, y + h / 2]) });
  };
  const brows = rig.brows ? [brow('left'), brow('right')] : null;
  const corners = rig.corners ? [part('corner-left', rig.corners.left), part('corner-right', rig.corners.right)] : null;
  const jaw = rig.jaw ? part('jaw', rig.jaw) : null;

  // the mouth: about (centre, hinge) it moves up, skews (one corner up), widens and opens (scale y)
  const m = rig.mouth, cx = m.center ?? m.box[0] + m.box[2] / 2, hy = m.hinge;
  const mouth = make('g', { class: 'cpmf-mouth' }, root);
  const mAt = make('g', { transform: `translate(${fmt(cx)} ${fmt(hy)})` }, mouth);
  const mTy = make('g', {}, mAt), mSkew = make('g', {}, mTy), mSx = make('g', {}, mSkew), mSy = make('g', {}, mSx);
  const mBack = make('g', { transform: `translate(${fmt(-cx)} ${fmt(-hy)})` }, mSy);
  const names = visemes ?? ['rest', 'MBP', 'FV', 'A', 'E', 'O', 'L'];
  const sprites = names.map((v) => (m.sprites[v] ? image(m.sprites[v], m.box, mBack, { opacity: 0, class: `cpmf-v-${v}` }) : null));

  // the lids: the closed eyes, shown down to an edge that falls from the eye's top to the lids' foot
  const lid = (side) => {
    const e = rig.lids[side], id = `${uid}-lid-${side}`;
    const grad = make('linearGradient', { id: `${id}-f`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    const s0 = make('stop', { offset: 0, 'stop-color': '#fff' }, grad);
    const s1 = make('stop', { offset: 0, 'stop-color': '#000' }, grad);
    const mask = make('mask', { id, maskUnits: 'userSpaceOnUse', ...boxAttrs(e.box) }, defs);
    make('rect', { ...boxAttrs(e.box), fill: `url(#${id}-f)` }, mask);
    const img = image(rig.lids.src, rig.lids.box, root, { mask: `url(#${id})`, opacity: 0, class: `cpmf-lid-${side}` });
    // [eye top, lids box foot, box y, box height]
    return { s0, s1, img, g: new Float64Array([e.open[0], e.box[1] + e.box[3], e.box[1], e.box[3]]) };
  };
  const lids = rig.lids ? [lid('left'), lid('right')] : null;
  const soft = rig.lids?.soft ?? 0.12;

  // put(): the attribute `attr` of `el` to the table's string for arr[k], when it changed. Numbers are read from
  // arrays here, never passed as arguments: a call that is not inlined would box each one (an allocation a frame).
  const last = new Int32Array(W_COUNT).fill(-1);
  const lidv = new Float64Array(3);
  let written = 0;
  const put = (slot, el, attr, q, arr, k) => {
    let i = Math.round((arr[k] - q.min) * q.inv);
    i = i >= 0 ? (i < q.n ? i : q.n - 1) : 0;
    if (last[slot] !== i) { last[slot] = i; el.setAttribute(attr, q.s[i]); written++; }
  };
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

  let active = false;
  return {
    root, defs, head, sprites,
    /** Attribute writes made so far (a test's measure of a frame's work). */
    get written() { return written; },
    /** Shows the pose (only the attributes whose quantised value changed). */
    write(pose) {
      put(W_HEAD_TY, head, 'transform', T.ty, pose, POSE.nod);
      put(W_HEAD_ROT, headRot, 'transform', T.rot, pose, POSE.tilt);
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
      }
      if (jaw) put(W_JAW, jaw.ty, 'transform', T.ty, pose, POSE.jawY);
      put(W_MOUTH, mTy, 'transform', T.ty, pose, POSE.mouthY);
      put(W_MOUTH + 1, mSkew, 'transform', T.skew, pose, POSE.mouthSkew);
      put(W_MOUTH + 2, mSx, 'transform', T.sx, pose, POSE.mouthSx);
      put(W_MOUTH + 3, mSy, 'transform', T.sy, pose, POSE.mouthSy);
      if (lids) { putLid(W_LIDS, lids[0], pose, POSE.lidL); putLid(W_LIDS + 3, lids[1], pose, POSE.lidR); }
      for (let i = 0; i < sprites.length; i++) if (sprites[i]) put(W_ALPHA + i, sprites[i], 'opacity', T.unit, pose, POSE.alpha + i);
    },
    /** On: the face shows over the painting and (ownBlinks) the portrait's own CSS blink is hidden for ours. Off: the painting alone. */
    setActive(on, ownBlinks = true) {
      if (on === active) return;
      active = on;
      root.setAttribute('display', on ? 'inline' : 'none');
      if (blink?.style) blink.style.visibility = on && ownBlinks ? 'hidden' : '';
      if (!on) last.fill(-1);
    },
    get active() { return active; },
    /** Takes the face out and puts the portrait's head group back as it was. */
    restore() {
      if (blink?.style) blink.style.visibility = '';
      for (const n of Array.from(content.childNodes)) if (n !== root) sway.insertBefore(n, head);
      head.parentNode?.removeChild(head);
      defs.parentNode?.removeChild(defs);
      active = false;
    },
  };
}
