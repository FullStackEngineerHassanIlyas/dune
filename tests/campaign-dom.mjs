// A small stand-in for the DOM, enough for src/ui/dom.js h(), the main menu and the campaign screens to run in
// Node: elements with children, attributes, dataset, style, classes, events, focus, value and a selector engine
// for the simple selectors the menus use (tag, .class, [attr], [attr="v"], descendant, lists). Installs itself on
// globalThis; keydown listeners added to the window are collected so a test can press keys.

export class FakeEl {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.nodeType = 1; this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = {};
    this.className = ''; this.hidden = false; this.style = {}; this.parent = null; this.innerHTML = ''; this.value = '';
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'value') this.value = String(v); if (k === 'id') this.id = String(v); if (k === 'hidden') this.hidden = true; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  adopt(c) { if (c instanceof FakeEl) { c.parent?.detach(c); c.parent = this; } return c; }
  detach(c) { this.children = this.children.filter((x) => x !== c); }
  append(...cs) { for (const c of cs) this.children.push(this.adopt(c)); }
  appendChild(c) { this.children.push(this.adopt(c)); return c; }
  replaceChildren(...cs) { for (const c of this.children) if (c instanceof FakeEl) c.parent = null; this.children = []; this.append(...cs); }
  remove() { this.parent?.detach(this); this.parent = null; }
  focus() { globalThis.document.activeElement = this; }
  get classList() {
    const list = () => this.className.split(' ').filter(Boolean);
    return { add: (c) => { if (!list().includes(c)) this.className = [...list(), c].join(' '); }, remove: (c) => { this.className = list().filter((x) => x !== c).join(' '); }, contains: (c) => list().includes(c) };
  }
  get textContent() { return this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join(''); }
  set textContent(v) { this.children = [String(v)]; }
  get isConnected() { let el = this; while (el.parent) el = el.parent; return el === globalThis.document.body; }
  all() { return [this, ...this.children.filter((c) => typeof c !== 'string').flatMap((c) => c.all())]; }
  find(pred) { return this.all().find(pred) ?? null; }
  findAll(pred) { return this.all().filter(pred); }
  matches(sel) { return sel.split(',').some((part) => matchChain(this, part.trim().split(/\s+/))); }
  querySelectorAll(sel) { return this.all().slice(1).filter((el) => el.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  dispatch(type, extra = {}) { const e = { type, target: this, preventDefault() {}, ...extra }; for (const fn of this.listeners[type] ?? []) fn(e); return e; }
  click() { if (!this.attrs.disabled) this.dispatch('click'); }
}

function matchOne(el, simple) {
  const tag = /^[a-z][a-z0-9]*/i.exec(simple)?.[0];
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  const re = /\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g;
  let m;
  while ((m = re.exec(simple))) {
    if (m[1] && !el.className.split(' ').includes(m[1])) return false;
    if (m[2]) {
      const key = m[2].startsWith('data-') ? m[2].slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()) : null;
      const value = key ? el.dataset[key] : el.attrs[m[2]];
      if (value === undefined || (m[3] !== undefined && String(value) !== m[3])) return false;
    }
  }
  return true;
}

function matchChain(el, parts) {
  if (!matchOne(el, parts.at(-1))) return false;
  if (parts.length === 1) return true;
  for (let p = el.parent; p; p = p.parent) if (matchChain(p, parts.slice(0, -1))) return true;
  return false;
}

export const keyListeners = [];

/** Installs the fake document and window on globalThis. */
export function installDom() {
  globalThis.Node = FakeEl;
  const body = new FakeEl('body');
  globalThis.document = { createElement: (tag) => new FakeEl(tag), querySelectorAll: () => [], getElementById: () => null, body, activeElement: null, hidden: false };
  globalThis.addEventListener = (type, fn) => { if (type === 'keydown') keyListeners.push(fn); };
  globalThis.localStorage = undefined;
  return body;
}

export const tick = () => new Promise((r) => setTimeout(r, 0));
export async function settle(n = 20) { for (let i = 0; i < n; i++) await tick(); }
export function press(key, target = globalThis.document.activeElement ?? null) {
  const e = { key, target, preventDefault() {} };
  for (const fn of keyListeners) fn(e);
  return e;
}

/** An in-memory localStorage. */
export function memoryStore(init = {}) {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

export const byAct = (root, act, extra = {}) => root.find((el) => el.dataset?.act === act && Object.entries(extra).every(([k, v]) => el.dataset[k] === v));
