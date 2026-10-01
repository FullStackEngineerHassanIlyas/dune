// Paintable multiply map over the terrain (spec §5.2): what a battle leaves on the ground — bullet pocks,
// shell and rocket craters, big blackened blast craters, cracked rock and concrete, scorch and track
// marks. White means untouched. Marks are stamped from a few pre-drawn variants of each kind, every stamp
// turned, squashed and sized at random so repeats never look stamped, and they never fade: the original
// keeps its sand craters and cracked concrete for the rest of the battle (docs/research/raw/
// mechanics-campaign.md §1.2 craterType; visual-structures.md: a scorched crater). The map has 32 pixels
// a tile, at most 2048 across. The texture uploads at most five times a second, and a map bigger than a
// megapixel less often, so a big map moves no more data than a small one.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const S = 96;          // stamp size in pixels; a stamp's marks reach about 0.48 of it from the centre
const VARIANTS = 4;
const HARD = new Set(['rock', 'mountain', 'concrete']);

function stampCanvas(n = S) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return c;
}

function spot(ctx, x, y, r, rgb, a0, a1 = 0) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a0})`);
  g.addColorStop(1, `rgba(${rgb},${a1})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A smooth closed loop round (cx, cy) whose radius wanders by `wobble` of r: a crater's lip, a blot's edge. */
function wobbly(ctx, cx, cy, r, wobble, n = 14) {
  const pts = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * TAU, rr = r * (1 + rnd(-wobble, wobble));
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  const mid = (k) => [(pts[k % n][0] + pts[(k + 1) % n][0]) / 2, (pts[k % n][1] + pts[(k + 1) % n][1]) / 2];
  ctx.beginPath();
  ctx.moveTo(...mid(0));
  for (let k = 1; k <= n; k++) ctx.quadraticCurveTo(pts[k % n][0], pts[k % n][1], ...mid(k));
  ctx.closePath();
}

/** Tapering rays out of the centre, filled with one fading gradient: soot flung out, or ejecta. */
function rays(ctx, n, r0, r1, width, rgb, alpha) {
  const c = S / 2, g = ctx.createRadialGradient(c, c, r0, c, c, r1);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const a = rnd(0, TAU), len = rnd(0.7, 1) * r1, w = rnd(0.5, 1) * width / r0;
    ctx.moveTo(c + Math.cos(a - w) * r0, c + Math.sin(a - w) * r0);
    ctx.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
    ctx.lineTo(c + Math.cos(a + w) * r0, c + Math.sin(a + w) * r0);
  }
  ctx.fill();
}

/** Specks scattered between r0 and r1 from the centre, thinning outward: clods, grit, flecks of soot. */
function specks(ctx, n, r0, r1, size, rgb, alpha) {
  const c = S / 2;
  for (let k = 0; k < n; k++) {
    const a = rnd(0, TAU), r = r0 + Math.pow(Math.random(), 1.7) * (r1 - r0);
    spot(ctx, c + Math.cos(a) * r, c + Math.sin(a) * r, rnd(0.4, 1) * size, rgb, rnd(0.5, 1) * alpha);
  }
}

/** A bullet's pock: a small dark hole and a speck or two thrown beside it. */
function pockStamp() {
  const cv = stampCanvas(32), ctx = cv.getContext('2d');
  spot(ctx, 16, 16, 9, '24,19,15', 0.95, 0);
  spot(ctx, 16, 16, 4, '14,11,9', 0.8, 0);
  for (let k = 0; k < 3; k++) { const a = rnd(0, TAU), r = rnd(6, 12); spot(ctx, 16 + Math.cos(a) * r, 16 + Math.sin(a) * r, rnd(1.5, 3), '40,32,24', rnd(0.4, 0.7)); }
  return cv;
}

/** Soot: broad tongues and a few sharp streaks flung outward, overlapping blotches black at the heart, flecks beyond. */
function scorchStamp() {
  const cv = stampCanvas(), ctx = cv.getContext('2d'), c = S / 2;
  rays(ctx, 7, S * 0.12, S * 0.48, S * 0.07, '58,45,33', 0.3);
  rays(ctx, 6, S * 0.1, S * 0.42, S * 0.022, '34,27,20', 0.35);
  for (let k = 0; k < 12; k++) { const a = rnd(0, TAU), r = rnd(0, 0.22) * S; spot(ctx, c + Math.cos(a) * r, c + Math.sin(a) * r, rnd(0.08, 0.2) * S, '50,39,29', rnd(0.25, 0.45)); }
  specks(ctx, 30, S * 0.2, S * 0.46, 1.8, '24,20,16', 0.55);
  spot(ctx, c, c, S * 0.15, '28,22,17', 0.7);
  return cv;
}

/** A crater: a dark pit in a bowl that pales toward its uneven lip, a soft dark rim, ejecta rays and clods beyond. */
function craterStamp() {
  const cv = stampCanvas(), ctx = cv.getContext('2d'), c = S / 2, R = S * rnd(0.22, 0.27);
  rays(ctx, 7, R * 0.9, S * 0.47, S * 0.05, '70,54,38', 0.35);
  specks(ctx, 40, R * 1.05, S * 0.47, 2.2, '60,46,32', 0.6);
  for (let k = 0; k < 3; k++) {   // the rim: a soft band, three times off-centre so it runs unevenly
    const x = c + rnd(-0.05, 0.05) * R, y = c + rnd(-0.05, 0.05) * R, g = ctx.createRadialGradient(x, y, R * 0.6, x, y, R * 1.4);
    g.addColorStop(0, 'rgba(46,36,26,0)');
    g.addColorStop(0.45, 'rgba(46,36,26,0.24)');
    g.addColorStop(1, 'rgba(46,36,26,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R * 1.4, 0, TAU);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(c, c, 0, c, c, R);
  g.addColorStop(0, 'rgba(22,18,14,0.95)');
  g.addColorStop(0.3, 'rgba(40,32,25,0.85)');
  g.addColorStop(0.65, 'rgba(96,78,60,0.45)');
  g.addColorStop(1, 'rgba(120,100,80,0.1)');
  ctx.fillStyle = g;
  wobbly(ctx, c + rnd(-0.06, 0.06) * R, c + rnd(-0.06, 0.06) * R, R, 0.16);
  ctx.fill();
  return cv;
}

/** Cracked rock or concrete: jagged, branching cracks out of a dark heart. */
function cracksStamp() {
  const cv = stampCanvas(), ctx = cv.getContext('2d'), c = S / 2;
  spot(ctx, c, c, S * 0.12, '20,17,14', 0.75);
  ctx.strokeStyle = 'rgba(18,16,13,0.85)';
  ctx.lineCap = 'round';
  const crack = (x, y, a, len, w) => {
    let px = x, py = y;
    for (let d = 0; d < len; d += S * 0.05) {
      a += rnd(-0.55, 0.55);
      const nx = px + Math.cos(a) * S * 0.05, ny = py + Math.sin(a) * S * 0.05;
      ctx.lineWidth = Math.max(0.6, w * (1 - d / len));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      if (w > 1.2 && Math.random() < 0.12) crack(nx, ny, a + rnd(-1, 1), (len - d) * 0.5, w * 0.5);
      px = nx;
      py = ny;
    }
  };
  const n = 6 + Math.floor(Math.random() * 3);
  for (let k = 0; k < n; k++) crack(c, c, (k / n) * TAU + rnd(-0.3, 0.3), rnd(0.28, 0.46) * S, rnd(1.6, 2.6));
  return cv;
}

let stamps = null;   // drawn once, shared by every battle's map
function allStamps() {
  if (!stamps) {
    const make = (f) => Array.from({ length: VARIANTS }, f);
    stamps = { pock: make(pockStamp), scorch: make(scorchStamp), crater: make(craterStamp), cracks: make(cracksStamp) };
  }
  return stamps;
}

export class DecalMap {
  constructor(w, h) {
    this.px = Math.min(2048, Math.max(512, w * 32)) / w;   // pixels per tile
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * this.px);
    this.canvas.height = Math.round(h * this.px);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingQuality = 'high';
    this.stamps = allStamps();
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;   // canvas row y is map row y: the shader samples at (x, z) / map size
    this.texture.anisotropy = 4;
    this.dirty = false;
    this.lastFlush = 0;
    this.interval = Math.max(200, (200 * this.canvas.width * this.canvas.height) / (1024 * 1024));   // ms between uploads
  }

  /** One stamp of `kind` centred on (x, y) tiles, `size` tiles across, turned and squashed at random. */
  stamp(kind, x, y, size, alpha = 1, squash = 0.18) {
    const set = this.stamps[kind], c = this.ctx, px = this.px, d = size * px, k = rnd(1 - squash, 1 + squash);
    c.save();
    c.globalAlpha = Math.min(1, alpha);
    c.translate(x * px, y * px);
    c.rotate(Math.random() * TAU);
    c.scale(k, 1 / k);
    c.drawImage(set[(Math.random() * set.length) | 0], -d / 2, -d / 2, d, d);
    c.restore();
    this.dirty = true;
  }

  blob(x, y, radius, inner, outer) {
    const c = this.ctx, px = this.px, cx = x * px, cy = y * px, r = radius * px;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, inner);
    g.addColorStop(0.65, outer);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    this.dirty = true;
  }

  /** A crater `radius` tiles out to its ejecta; strength darkens it. */
  crater(x, y, radius, strength = 0.55) { this.stamp('crater', x, y, radius * 2, strength * 1.6); }

  /** Soot `radius` tiles across its outer streaks, black at the heart. */
  scorch(x, y, radius) { this.stamp('scorch', x, y, radius * 2, 0.9); }

  /** A bullet's pock where it struck the ground, sometimes with a second one beside it. */
  pock(x, y, surface = 'sand') {
    const a = HARD.has(surface) ? 0.6 : 0.75;
    this.stamp('pock', x, y, rnd(0.26, 0.36), a, 0.3);
    if (Math.random() < 0.35) this.stamp('pock', x + rnd(-0.14, 0.14), y + rnd(-0.14, 0.14), rnd(0.18, 0.24), a * 0.8, 0.3);
  }

  /**
   * What a shot leaves where it lands on `surface` (sand, dune, rock, mountain, concrete): a pock for a bullet;
   * a small crater with a scorch for a shell; for a rocket a scorch round a crater, `scale` by weapon. Rock and
   * concrete crack rather than dig.
   */
  mark(x, y, kind, surface = 'sand', scale = 1) {
    const hard = HARD.has(surface);
    if (kind === 'bullet') { this.pock(x, y, surface); return; }
    if (kind === 'shell') {
      this.stamp('scorch', x, y, rnd(0.55, 0.7), hard ? 0.6 : 0.45);
      if (hard) this.stamp('cracks', x, y, rnd(0.6, 0.8), 0.65);
      this.stamp('crater', x, y, hard ? rnd(0.4, 0.5) : rnd(0.65, 0.8), hard ? 0.6 : 0.85);
      return;
    }
    this.stamp('scorch', x, y, rnd(1.1, 1.35) * scale, 0.7);
    if (hard) this.stamp('cracks', x, y, rnd(0.9, 1.1) * scale, 0.65);
    this.stamp('crater', x, y, rnd(0.85, 1.05) * scale * (hard ? 0.8 : 1), 0.9);
  }

  /** A blast `radius` tiles across: blackened ground blotched past the radius round a crater, rock and concrete cracked. */
  blast(x, y, radius, surface = 'sand') {
    this.stamp('scorch', x, y, radius * 2.3, 0.9);
    for (let k = radius >= 1 ? 3 : 1; k > 0; k--) {
      const a = rnd(0, TAU), r = rnd(0.3, 0.6) * radius;
      this.stamp('scorch', x + Math.cos(a) * r, y + Math.sin(a) * r, radius * rnd(0.9, 1.3), 0.55);
    }
    if (HARD.has(surface)) this.stamp('cracks', x, y, radius * 2, 0.75);
    this.stamp('crater', x, y, radius * 1.5, 1);
  }

  track(x, y, heading, width = 0.28, alpha = 0.05) {
    const c = this.ctx, px = this.px;
    c.save();
    c.translate(x * px, y * px);
    c.rotate(heading);
    c.fillStyle = `rgba(90,70,48,${alpha})`;
    c.fillRect(-0.18 * px, -width * px * 0.5 - 0.05 * px, 0.36 * px, 0.1 * px);
    c.fillRect(-0.18 * px, width * px * 0.5 - 0.05 * px, 0.36 * px, 0.1 * px);
    c.restore();
    this.dirty = true;
  }

  flush(now) {
    if (this.dirty && now - this.lastFlush > this.interval) {
      this.texture.needsUpdate = true;
      this.dirty = false;
      this.lastFlush = now;
    }
  }
}
