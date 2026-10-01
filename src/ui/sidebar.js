// C&C sidebar (spec §5.6, §5.7): rolling credits with a storage gauge, the radar slot, a vertical
// power bar, Repair and Sell toggles, the Palace weapon (a charging clock; click, then aim) and two build strips (structures | units) — factory upgrades close the structure strip — with model icons,
// clock-wipe progress, READY / ON HOLD and queue badges, scroll arrows and a tooltip. Left click
// builds, resumes or (when READY) starts placement; right click holds, then cancels with a refund;
// Shift + left click queues five. The tooltip follows what it describes while the pointer rests on it.
// Above it all, the Menu and full screen buttons.
import { rollCredits, tipText, clock } from './sidebar-model.js';

const SLOT = 92;   // icon height plus gap (px)

export class Sidebar {
  constructor(root, { iconFor, onCommand, onPlace, onTool, onSpecial = () => {}, onMenu = () => {}, onFullscreen = () => {} }) {
    Object.assign(this, { iconFor, onCommand, onPlace, onTool, onSpecial });
    const el = (this.el = document.createElement('div'));
    el.className = 'sidebar';
    el.innerHTML = `
      <div class="sb-top"><button class="sb-menu" title="Menu (Esc)">Menu</button><button class="sb-full" title="Full screen (Alt + Enter)" aria-label="Full screen">&#x26F6;</button></div>
      <div class="sb-credits"><span class="sb-label">Credits</span><span class="sb-digits">0</span><div class="sb-storage"><i></i></div></div>
      <div class="sb-radar"></div>
      <div class="sb-tools"><button class="sb-tool" data-tool="repair">Repair</button><button class="sb-tool" data-tool="sell">Sell</button></div>
      <button class="sb-item sb-weapon" hidden><img alt="" draggable="false"><span class="sb-state"></span></button>
      <div class="sb-body">
        <div class="sb-power"><div class="sb-power-fill"></div><div class="sb-power-use"></div></div>
        <div class="sb-strip" data-strip="structures"><button class="sb-arrow" data-dir="-1">&#9650;</button><div class="sb-slots"><div class="sb-list"></div></div><button class="sb-arrow" data-dir="1">&#9660;</button></div>
        <div class="sb-strip" data-strip="units"><button class="sb-arrow" data-dir="-1">&#9650;</button><div class="sb-slots"><div class="sb-list"></div></div><button class="sb-arrow" data-dir="1">&#9660;</button></div>
      </div>
      <div class="sb-tip"><b></b><span></span></div>`;
    root.appendChild(el);
    this.digits = el.querySelector('.sb-digits');
    this.storageBar = el.querySelector('.sb-storage i');
    this.radarEl = el.querySelector('.sb-radar');
    this.power = el.querySelector('.sb-power');
    this.powerFill = el.querySelector('.sb-power-fill');
    this.powerUse = el.querySelector('.sb-power-use');
    this.tip = el.querySelector('.sb-tip');
    this.weapon = el.querySelector('.sb-weapon');
    this.weaponImg = this.weapon.querySelector('img');
    this.weaponState = this.weapon.querySelector('.sb-state');
    this.weapon.addEventListener('click', () => {
      const item = this.weapon.item;
      if (item?.ready) this.onSpecial(item);
      else if (item) this.onCommand({ type: 'palace' });   // still charging: the Palace says it is not ready
    });
    this.weapon.addEventListener('pointerenter', () => this.showTip(this.weapon));
    this.weapon.addEventListener('pointerleave', () => this.hideTip());
    this.tipFor = null;
    this.strips = {};
    for (const node of el.querySelectorAll('.sb-strip')) {
      const strip = { el: node, list: node.querySelector('.sb-list'), slots: node.querySelector('.sb-slots'), offset: 0, key: null, buttons: new Map() };
      this.strips[node.dataset.strip] = strip;
      for (const a of node.querySelectorAll('.sb-arrow')) a.addEventListener('click', () => this.scroll(strip, Number(a.dataset.dir)));
      node.addEventListener('wheel', (e) => { e.preventDefault(); this.scroll(strip, Math.sign(e.deltaY)); }, { passive: false });
    }
    for (const b of el.querySelectorAll('.sb-tool')) b.addEventListener('click', () => this.onTool(b.dataset.tool));
    el.querySelector('.sb-menu').addEventListener('click', () => onMenu());
    el.querySelector('.sb-full').addEventListener('click', () => onFullscreen());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.shown = null;
  }

  setTool(kind) {
    for (const b of this.el.querySelectorAll('.sb-tool')) b.classList.toggle('active', b.dataset.tool === kind);
    this.weapon.classList.toggle('aiming', kind === 'palace');
  }

  update(model, dt) {
    this.shown = this.shown === null ? model.credits : rollCredits(this.shown, model.credits, dt);
    const text = String(Math.floor(this.shown));
    if (this.digits.textContent !== text) this.digits.textContent = text;
    this.storageBar.style.width = `${Math.min(100, (model.credits / Math.max(1, model.storage)) * 100).toFixed(1)}%`;
    const { produced, used, level } = model.power;
    const scale = Math.max(produced, used, 100) * 1.25;
    this.powerFill.style.height = `${((produced / scale) * 100).toFixed(1)}%`;
    this.powerUse.style.bottom = `${((used / scale) * 100).toFixed(1)}%`;
    if (this.powerFill.dataset.level !== level) this.powerFill.dataset.level = level;
    this.power.title = `Power ${produced} / ${used}`;
    this.fill(this.strips.structures, model.structures);
    this.fill(this.strips.units, model.units);
    this.showSpecial(model.special);
    if (this.tipFor?.isConnected && this.tipFor.item) this.showTip(this.tipFor);   // prices, stock and clocks change under the pointer
    else if (this.tipFor) this.hideTip();
  }

  fill(strip, items) {
    const key = items.map((i) => i.icon).join(',');   // an upgrade that levels up gets its new icon
    if (key !== strip.key) {   // rebuild only when the set of buildable items changes
      strip.key = key;
      strip.list.textContent = '';
      strip.buttons.clear();
      for (const item of items) strip.list.appendChild(this.makeButton(strip, item));
      this.scroll(strip, 0);
    }
    for (const item of items) {
      const b = strip.buttons.get(item.typeId);
      b.item = item;
      const cls = `sb-item state-${item.state}${item.starved ? ' starved' : ''}`;
      if (b.className !== cls) b.className = cls;
      const p = item.state === 'building' || item.state === 'hold' ? item.progress.toFixed(3) : '1';
      if (b.style.getPropertyValue('--p') !== p) b.style.setProperty('--p', p);
      const label = item.state === 'ready' ? 'READY' : item.state === 'hold' ? 'ON HOLD' : '';
      if (b.stateEl.textContent !== label) b.stateEl.textContent = label;
      const count = item.count > (item.order ? 0 : 1) ? String(item.count) : '';   // a single Starport order shows too
      if (b.countEl.textContent !== count) b.countEl.textContent = count;
    }
  }

  makeButton(strip, item) {
    const b = document.createElement('button');
    b.dataset.type = item.typeId;
    b.item = item;
    const img = new Image();
    img.src = this.iconFor(item.icon);
    img.alt = item.name;
    img.draggable = false;
    b.stateEl = document.createElement('span');
    b.stateEl.className = 'sb-state';
    b.countEl = document.createElement('span');
    b.countEl.className = 'sb-count';
    b.append(img, b.stateEl, b.countEl);
    b.addEventListener('click', (e) => this.leftClick(b.item, e.shiftKey));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onCommand(b.item.cancel ?? { type: 'hold', typeId: b.item.typeId }); });
    b.addEventListener('pointerenter', () => this.showTip(b));
    b.addEventListener('pointerleave', () => this.hideTip());
    strip.buttons.set(item.typeId, b);
    return b;
  }

  leftClick(item, shift) {
    if (item.line === 'structure' && item.state === 'ready') { this.onPlace(item.typeId); return; }
    if (item.order) { this.onCommand({ ...item.order, count: shift ? 5 : 1 }); return; }   // Starport wares
    this.onCommand({ type: 'build', typeId: item.typeId, count: shift ? 5 : 1 });
  }

  showSpecial(sp) {
    const b = this.weapon;
    b.hidden = !sp;
    b.item = sp;
    if (!sp) return;
    if (b.dataset.icon !== sp.icon) { b.dataset.icon = sp.icon; this.weaponImg.src = this.iconFor(sp.icon); this.weaponImg.alt = sp.name; }
    b.classList.toggle('state-ready', sp.ready);
    b.classList.toggle('state-building', !sp.ready);
    const p = sp.ready ? '1' : sp.progress.toFixed(3);
    if (b.style.getPropertyValue('--p') !== p) b.style.setProperty('--p', p);
    const label = sp.ready ? 'READY' : clock(sp.seconds);
    if (this.weaponState.textContent !== label) this.weaponState.textContent = label;
  }

  hideTip() {
    this.tipFor = null;
    this.tip.classList.remove('show');
  }

  showTip(b) {
    this.tipFor = b;
    const i = b.item;
    const name = this.tip.querySelector('b'), line = this.tip.querySelector('span'), text = tipText(i);
    if (name.textContent !== i.name) name.textContent = i.name;   // refreshed every frame: touch the page only when something changed
    if (line.textContent !== text) line.textContent = text;
    const top = `${b.getBoundingClientRect().top - this.el.getBoundingClientRect().top}px`;
    if (this.tip.style.top !== top) this.tip.style.top = top;
    this.tip.classList.add('show');
  }

  scroll(strip, dir) {
    const visible = Math.max(1, Math.floor((strip.slots.clientHeight + 4) / SLOT));
    const max = Math.max(0, strip.buttons.size - visible);
    strip.offset = Math.max(0, Math.min(max, strip.offset + dir));
    strip.list.style.transform = `translateY(${-strip.offset * SLOT}px)`;
  }
}
