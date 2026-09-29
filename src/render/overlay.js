// 2D overlay (spec §5.6): C&C white corner brackets, health bars, group numbers, drag box and
// order markers, drawn over the 3D view every frame.
export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dragBox = null;
    this.markers = [];
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth || innerWidth;
    this.h = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setDragBox(box) { this.dragBox = box; }
  marker(x, z) { this.markers.push({ x, z, t: 0 }); }

  draw({ world, selection, hoverId, hoverStructureId = null, project, positionOf, groups, dt, healthBars = 'selected', canSee = () => true, canSeeStructure = () => true }) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    for (const u of world.units.values()) {
      if (!canSee(u)) continue;
      const selected = selection.has(u.id), hovered = u.id === hoverId;
      const damaged = u.hp < u.maxHp;
      if (!selected && !hovered && healthBars !== 'always' && !(healthBars === 'damaged' && damaged)) continue;
      const p = positionOf(u);
      const s = project(p.x, p.z, u.move === 'foot' ? 0.12 : 0.18);
      if (!s.visible) continue;
      const half = Math.max(8, s.pxPerUnit * (u.move === 'foot' ? 0.2 : 0.34));
      if (selected || hovered) brackets(c, s.x, s.y, half, selected ? '#ffffff' : 'rgba(255,255,255,0.45)');
      healthBar(c, s.x, s.y - half - 7, half * 2, u.hp / u.maxHp);
      const g = selected ? groups.groupOf(u.id) : null;
      if (g !== null) {
        c.font = 'bold 12px "Trebuchet MS", sans-serif';
        c.fillStyle = '#000';
        c.fillText(String(g), s.x + half - 5, s.y + half + 1);
        c.fillStyle = '#fff';
        c.fillText(String(g), s.x + half - 6, s.y + half);
      }
    }
    for (const s of world.structures.values()) {
      if (!canSeeStructure(s)) continue;
      const selected = s.id === selection.structureId, hovered = s.id === hoverStructureId;
      if (!selected && !hovered && healthBars !== 'always' && !(healthBars === 'damaged' && s.hp < s.maxHp)) continue;
      const p = project(s.x + s.w / 2, s.y + s.h / 2, 0.3);
      if (!p.visible) continue;
      const half = Math.max(12, p.pxPerUnit * Math.max(s.w, s.h) * 0.52);
      if (selected || hovered) brackets(c, p.x, p.y, half, selected ? '#ffffff' : 'rgba(255,255,255,0.45)');
      healthBar(c, p.x, p.y - half - 7, Math.min(half * 2, 96), s.hp / s.maxHp);
      if (!selected) continue;
      if (s.rally) {
        const r = project(s.rally.x + 0.5, s.rally.y + 0.5, 0.05);
        c.save();
        c.setLineDash([6, 5]);
        c.strokeStyle = 'rgba(255,255,255,0.85)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(r.x, r.y);
        c.stroke();
        c.restore();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(r.x, r.y, 4, 0, Math.PI * 2);
        c.fill();
      }
      if (s.primary) {
        c.font = 'bold 11px "Trebuchet MS", sans-serif';
        c.textAlign = 'center';
        c.fillStyle = '#000';
        c.fillText('PRIMARY', p.x + 1, p.y + half + 14);
        c.fillStyle = '#ffd24a';
        c.fillText('PRIMARY', p.x, p.y + half + 13);
        c.textAlign = 'start';
      }
    }
    this.markers = this.markers.filter((m) => (m.t += dt) < 0.6);
    for (const m of this.markers) {
      const p = project(m.x, m.z, 0.02);
      if (!p.visible) continue;
      const k = m.t / 0.6, rx = (0.18 + 0.25 * k) * p.pxPerUnit;
      c.strokeStyle = `rgba(125,255,122,${1 - k})`;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(p.x, p.y, rx, rx * 0.5, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (this.dragBox) {
      const { x0, y0, x1, y1 } = this.dragBox;
      c.fillStyle = 'rgba(255,255,255,0.07)';
      c.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1;
      c.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }
}

function brackets(c, x, y, h, color) {
  const l = Math.max(4, h * 0.45);
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.lineWidth = 4;
  path(c, x, y, h, l);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = 2;
  path(c, x, y, h, l);
  c.stroke();
}

function path(c, x, y, h, l) {
  c.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = x + sx * h, cy = y + sy * h;
    c.moveTo(cx, cy - sy * l);
    c.lineTo(cx, cy);
    c.lineTo(cx - sx * l, cy);
  }
}

function healthBar(c, x, y, w, frac) {
  c.fillStyle = 'rgba(0,0,0,0.65)';
  c.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  c.fillStyle = frac > 0.5 ? '#35d04a' : frac > 0.25 ? '#e3c237' : '#e0412f';
  c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 3);
}
