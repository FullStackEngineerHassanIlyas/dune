// Selection panel (spec §5.6): bottom-left of the battlefield — portrait (model icon), name, hit
// points and what the selection is doing, with order buttons: Stop / Guard / Scatter / Deploy /
// Return for units, Repair / Sell / Set primary for own structures. The model part is pure.
import { UNITS } from '../data/units.js';
import { LINE_FACTORIES } from '../sim/tech.js';
import { HARVEST_CAPACITY } from '../sim/harvest.js';

const UNIT_FACTORIES = new Set(Object.entries(LINE_FACTORIES).filter(([line]) => line !== 'structure').flatMap(([, types]) => types));
const HARVEST_TEXT = { seek: 'Looking for spice', toField: 'Heading to spice', harvesting: 'Harvesting', toRefinery: 'Returning to refinery', queued: 'Waiting to unload', unloading: 'Unloading' };
const ORDER_TEXT = { idle: 'Idle', move: 'Moving', guard: 'Guarding', stop: 'Idle' };

function structureModel(world, s, houseId) {
  const own = s.house === houseId, t = s.type, details = [];
  if (t.power < 0) details.push(`Power output ${Math.round(-t.power * Math.max(0.5, Math.min(1, s.hp / s.maxHp)))}`);
  else if (t.power > 0) details.push(`Power use ${t.power}`);
  if (t.storage) details.push(`Storage ${t.storage}`);
  if (UNIT_FACTORIES.has(s.typeId)) {
    if (s.primary) details.push('Primary factory');
    if (s.rally) details.push('Rally point set');
  }
  if (s.typeId === 'refinery') details.push(s.dockedBy ? 'Harvester unloading' : 'Landing pad free');
  if (s.repairing) details.push(s.repairStalled ? 'Repair paused: no credits' : 'Repairing');
  const buttons = own ? [
    { id: 'repair', label: s.repairing ? 'Stop repair' : 'Repair', active: !!s.repairing, disabled: !s.repairing && s.hp >= s.maxHp },
    { id: 'sell', label: 'Sell' },
    ...(UNIT_FACTORIES.has(s.typeId) && !s.primary ? [{ id: 'primary', label: 'Set primary' }] : []),
  ] : [];
  return { kind: 'structure', typeId: s.typeId, house: s.house, own, name: t.name, hp: s.hp, maxHp: s.maxHp, count: 1, details, buttons };
}

function unitButtons(own) {
  if (!own.length) return [];
  const b = [{ id: 'stop', label: 'Stop', key: 'S' }, { id: 'guard', label: 'Guard', key: 'G' }, { id: 'scatter', label: 'Scatter', key: 'X' }];
  if (own.some((u) => u.type.deploysTo)) b.push({ id: 'deploy', label: 'Deploy', key: 'D' });
  if (own.some((u) => u.harvest)) b.push({ id: 'return', label: 'Return' });
  return b;
}

export function selectionPanelModel(world, selection, houseId) {
  const s = world.structures.get(selection.structureId);
  if (s) return structureModel(world, s, houseId);
  const units = selection.list().map((id) => world.units.get(id)).filter(Boolean);
  if (!units.length) return null;
  const own = units.filter((u) => u.house === houseId);
  const buttons = unitButtons(own);
  if (units.length === 1) {
    const u = units[0], details = [];
    if (u.harvest) details.push(`Spice ${Math.round((u.harvest.load / HARVEST_CAPACITY) * 100)} %`);
    details.push(u.order.type === 'harvest' ? HARVEST_TEXT[u.harvest.state] ?? 'Harvesting' : ORDER_TEXT[u.order.type] ?? 'Busy');
    return { kind: 'unit', typeId: u.typeId, house: u.house, own: u.house === houseId, name: u.type.name, hp: u.hp, maxHp: u.maxHp, count: 1, details, buttons };
  }
  const counts = new Map();
  for (const u of units) counts.set(u.typeId, (counts.get(u.typeId) ?? 0) + 1);
  const types = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    kind: 'group', typeId: types[0][0], house: units[0].house, own: own.length > 0, name: `${units.length} units`,
    hp: units.reduce((n, u) => n + u.hp, 0), maxHp: units.reduce((n, u) => n + u.maxHp, 0), count: units.length,
    details: types.slice(0, 4).map(([typeId, n]) => `${n} × ${UNITS[typeId].name}`), buttons,
  };
}

export class SelectionPanel {
  constructor(root, { iconFor, onButton }) {
    this.iconFor = iconFor;
    this.el = document.createElement('div');
    this.el.className = 'sel-panel';
    this.el.innerHTML = '<img class="sel-portrait" alt=""><div class="sel-info"><div class="sel-name"></div><div class="sel-hp"><i></i><span></span></div><div class="sel-details"></div></div><div class="sel-buttons"></div>';
    root.appendChild(this.el);
    this.portrait = this.el.querySelector('.sel-portrait');
    this.name = this.el.querySelector('.sel-name');
    this.hpBar = this.el.querySelector('.sel-hp i');
    this.hpText = this.el.querySelector('.sel-hp span');
    this.details = this.el.querySelector('.sel-details');
    this.buttons = this.el.querySelector('.sel-buttons');
    this.buttons.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) onButton(b.dataset.id); });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.key = null;
  }

  update(model) {
    this.el.classList.toggle('show', !!model);
    if (!model) { this.key = null; return; }
    const key = JSON.stringify([model.kind, model.typeId, model.house, model.name, model.details, model.buttons]);
    if (key !== this.key) {
      this.key = key;
      this.portrait.src = this.iconFor(model.typeId, model.house);
      this.name.textContent = model.name;
      this.details.textContent = '';
      for (const line of model.details) { const d = document.createElement('div'); d.textContent = line; this.details.appendChild(d); }
      this.buttons.textContent = '';
      for (const b of model.buttons) {
        const el = document.createElement('button');
        el.dataset.id = b.id;
        el.textContent = b.label;
        if (b.key) { const k = document.createElement('kbd'); k.textContent = b.key; el.appendChild(k); }
        el.disabled = !!b.disabled;
        el.classList.toggle('active', !!b.active);
        this.buttons.appendChild(el);
      }
    }
    const frac = Math.max(0, Math.min(1, model.hp / model.maxHp));
    this.hpBar.style.width = `${(frac * 100).toFixed(1)}%`;
    this.hpBar.style.background = frac > 0.5 ? '#35d04a' : frac > 0.25 ? '#e3c237' : '#e0412f';
    const text = `${Math.ceil(model.hp)} / ${model.maxHp}`;
    if (this.hpText.textContent !== text) this.hpText.textContent = text;
  }
}
