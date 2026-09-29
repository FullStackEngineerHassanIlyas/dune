// In-game menu (spec §5.7, §5.8): Esc, F10 or the sidebar's Menu button pause the battle and open
// it — resume, options, controls, full screen, restart, and back to the main menu. While it is open
// it has the keyboard; Esc steps back a page, then closes it.
import { h } from './dom.js';
import { optionsPanel } from './options.js';
import { controlsTable } from './controls-help.js';

export class GameMenu {
  constructor(root, { settings, onClose, onRestart, onQuit, onFullscreen, isFullscreen = () => false, onSettings = () => {} }) {
    Object.assign(this, { settings, onClose, onRestart, onQuit, onFullscreen, isFullscreen, onSettings });
    this.el = h('div', { class: 'dm-overlay game-menu', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game menu', oncontextmenu: (e) => e.preventDefault() });
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    root.appendChild(this.el);
    this.page = null;
  }

  get isOpen() { return this.page !== null; }

  open() { this.show('main'); }

  close() {
    if (!this.isOpen) return;
    this.page = null;
    this.el.classList.remove('show');
    this.el.replaceChildren();
    this.onClose();
  }

  show(page) {
    this.page = page;
    this.el.classList.add('show');
    const back = h('button', { type: 'button', class: 'dm-btn', onclick: () => this.show('main') }, 'Back');
    let body;
    if (page === 'main') {
      const fullscreen = this.isFullscreen();
      body = [
        h('h2', {}, 'Game paused'),
        h('div', { class: 'dm-stack' },
          h('button', { type: 'button', class: 'dm-btn primary', dataset: { act: 'resume' }, onclick: () => this.close() }, 'Resume'),
          h('button', { type: 'button', class: 'dm-btn', dataset: { act: 'options' }, onclick: () => this.show('options') }, 'Options'),
          h('button', { type: 'button', class: 'dm-btn', dataset: { act: 'controls' }, onclick: () => this.show('controls') }, 'Controls'),
          h('button', { type: 'button', class: 'dm-btn', dataset: { act: 'fullscreen' }, onclick: async () => { await this.onFullscreen(); if (this.page === 'main') this.show('main'); } },
            fullscreen ? 'Leave full screen' : 'Full screen'),
          h('button', { type: 'button', class: 'dm-btn', dataset: { act: 'restart' }, onclick: () => this.show('restart') }, 'Restart battle'),
          h('button', { type: 'button', class: 'dm-btn danger', dataset: { act: 'quit' }, onclick: () => this.show('quit') }, 'Quit to main menu')),
        h('p', { class: 'dm-hint' }, 'Esc resumes'),
      ];
    } else if (page === 'options') {
      body = [h('h2', {}, 'Options'), optionsPanel(this.settings, { onChange: (key, value) => this.onSettings(key, value) }), h('div', { class: 'dm-actions' }, back)];
    } else if (page === 'controls') {
      body = [h('h2', {}, 'Controls'), controlsTable(this.settings.scheme), h('div', { class: 'dm-actions' }, back)];
    } else {
      const quit = page === 'quit';
      body = [
        h('h2', {}, quit ? 'Quit this battle?' : 'Restart this battle?'),
        h('p', {}, quit ? 'The battle ends and you return to the main menu.' : 'The battle starts again from the beginning on the same map.'),
        h('div', { class: 'dm-actions' }, back,
          h('button', { type: 'button', class: 'dm-btn danger', dataset: { act: `confirm-${page}` }, onclick: () => (quit ? this.onQuit() : this.onRestart()) }, quit ? 'Quit' : 'Restart')),
      ];
    }
    this.el.replaceChildren(h('div', { class: `dm-panel page-${page}` }, body));
    this.el.querySelector('.dm-btn.primary, .dm-actions .dm-btn:last-child')?.focus({ preventScroll: true });
  }

  /** Keys while the menu is open: Esc and F10 step back or close; the rest (Tab, Enter) work its buttons, never the battle. */
  onKey(key) {
    if (key !== 'Escape' && key !== 'F10') return false;
    if (this.page === 'main') this.close(); else this.show('main');
    return true;
  }
}
