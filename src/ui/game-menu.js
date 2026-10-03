// In-game menu (spec §5.7, §5.8): Esc, F10 or the sidebar's Menu button pause the battle and open
// it — resume, options (with the Original Game Files page), controls, full screen, restart, and back to
// the main menu. While it is open it has the keyboard; Esc steps back a page, then closes it. In a campaign
// mission it says Restart mission (the same mission again) and Quit mission (back to the campaign, C2).
import { h } from './dom.js';
import { optionsPanel, originalFilesRow, originalFilesPage } from './options.js';
import { controlsTable } from './controls-help.js';

/** What the restart and quit buttons and their questions say: a skirmish's battle or a campaign mission. */
export function menuWords({ mission = false, inShell = false } = {}) {
  if (!mission) return { restart: 'Restart battle', quit: 'Quit to main menu', restartAsk: 'Restart this battle?', restartNote: 'The battle starts again from the beginning on the same map.',
    quitAsk: 'Quit this battle?', quitNote: 'The battle ends and you return to the main menu.' };
  return { restart: 'Restart mission', quit: 'Quit mission', restartAsk: 'Restart this mission?', restartNote: 'The mission starts again from the beginning.',
    quitAsk: 'Quit this mission?', quitNote: `The mission ends and you return to the ${inShell ? 'campaign' : 'main menu'}.` };
}

export class GameMenu {
  constructor(root, { settings, onClose, onRestart, onQuit, onFullscreen, isFullscreen = () => false, onSettings = () => {}, words = menuWords() }) {
    Object.assign(this, { settings, onClose, onRestart, onQuit, onFullscreen, isFullscreen, onSettings, words });
    this.el = h('div', { class: 'dm-overlay game-menu', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game menu', oncontextmenu: (e) => e.preventDefault() });
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    root.appendChild(this.el);
    this.page = null;
    this.visit = 0;
  }

  get isOpen() { return this.page !== null; }

  open() { this.show('main'); }

  close() {
    if (!this.isOpen) return;
    this.page = null;
    this.visit++;
    this.el.classList.remove('show');
    this.el.replaceChildren();
    this.onClose();
  }

  show(page) {
    this.page = page;
    const visit = ++this.visit;
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
          h('button', { type: 'button', class: 'dm-btn', dataset: { act: 'restart' }, onclick: () => this.show('restart') }, this.words.restart),
          h('button', { type: 'button', class: 'dm-btn danger', dataset: { act: 'quit' }, onclick: () => this.show('quit') }, this.words.quit)),
        h('p', { class: 'dm-hint' }, 'Esc resumes'),
      ];
    } else if (page === 'options') {
      body = [h('h2', {}, 'Options'), optionsPanel(this.settings, { onChange: (key, value) => this.onSettings(key, value) }),
        originalFilesRow(() => this.show('original-files')), h('div', { class: 'dm-actions' }, back)];
    } else if (page === 'original-files') {
      body = [h('h2', {}, 'Original Game Files'), h('p', { class: 'dm-hint' }, 'Loading…')];
      originalFilesPage(this.settings, { onBack: () => this.show('options') }).then((panel) => {
        if (this.visit !== visit) return;   // closed or moved on meanwhile
        this.el.replaceChildren(panel);
        panel.querySelector?.('.dm-btn.primary, .dm-actions .dm-btn, button')?.focus({ preventScroll: true });
      });
    } else if (page === 'controls') {
      body = [h('h2', {}, 'Controls'), controlsTable(this.settings.scheme), h('div', { class: 'dm-actions' }, back)];
    } else {
      const quit = page === 'quit';
      body = [
        h('h2', {}, quit ? this.words.quitAsk : this.words.restartAsk),
        h('p', {}, quit ? this.words.quitNote : this.words.restartNote),
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
    if (this.page === 'main') this.close(); else this.show(this.page === 'original-files' ? 'options' : 'main');
    return true;
  }
}
