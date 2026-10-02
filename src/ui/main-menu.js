// Main menu screens (spec §5.8): title with Skirmish, Campaign (to come), Options, Original Game Files,
// Controls and Credits, plus Pause background (WCAG 2.2.2) and Full screen at the top right. Esc steps
// back: to the title, or from the Original Game Files page to the Options page that opened it.
import { h } from './dom.js';
import { optionsPanel, originalFilesRow, originalFilesPage } from './options.js';
import { controlsTable } from './controls-help.js';
import { skirmishPanel } from './skirmish-setup.js';

/** The title screen's entries: [act, label, note, disabled]. */
export const MENU_ITEMS = [
  ['skirmish', 'Skirmish', 'One battle against up to three computer houses'],
  ['campaign', 'Campaign', 'Coming in a later phase', true],
  ['options', 'Options', 'Graphics, mouse, scrolling, sound, voices, music'],
  ['original-files', 'Original Game Files', 'Voices and music from your own Dune II'],
  ['controls', 'Controls', 'Mouse and keyboard'],
  ['credits', 'Credits'],
];

export class MainMenu {
  /** onSettings(key, value): an option changed (the music follows its volume live). */
  constructor(root, { settings, onStart, onFullscreen, isFullscreen = () => false, onBackdropPause = () => {}, isBackdropPaused = () => false, onSettings = () => {} }) {
    Object.assign(this, { settings, onStart, onFullscreen, isFullscreen, onBackdropPause, isBackdropPaused, onSettings });
    this.el = h('div', { class: 'main-menu' });
    // the corner toggles outlive the screens and are updated in place, so a toggle keeps keyboard focus
    this.bg = h('button', { type: 'button', class: 'mm-bg', title: 'Pause or play the moving background',
      onclick: () => { this.onBackdropPause(!this.isBackdropPaused()); this.refresh(); } });
    this.fs = h('button', { type: 'button', class: 'mm-fs', title: 'Full screen (Alt + Enter)',
      onclick: async () => { await this.onFullscreen(); this.refresh(); } });
    this.top = h('div', { class: 'mm-top' }, this.bg, this.fs);
    root.appendChild(this.el);
    this.screen = 'title';
    this.back = 'title';
    this.visit = 0;
    addEventListener('keydown', (e) => {
      if (this.el.hidden || e.key !== 'Escape' || this.screen === 'title') return;
      e.preventDefault();
      this.go(this.back);
    });
    this.go('title');
  }

  /** Shows a screen; `from` is where Back and Esc lead. */
  go(screen, from = 'title') {
    this.screen = screen;
    this.back = from;
    const visit = ++this.visit;
    const back = () => this.go(from);
    let body;
    if (screen === 'title') {
      body = h('div', { class: 'mm-title-screen' },
        h('header', { class: 'mm-brand' },
          h('div', { class: 'mm-kicker' }, 'A 3D fan remake'),
          h('h1', {}, 'Dune', h('span', {}, 'II')),
          h('div', { class: 'mm-sub' }, 'The Battle for Arrakis')),
        h('nav', { class: 'mm-nav', 'aria-label': 'Main menu' }, MENU_ITEMS.map(([act, label, note, disabled], i) =>
          h('button', { type: 'button', class: i === 0 ? 'mm-item primary' : 'mm-item', disabled: !!disabled, dataset: disabled ? undefined : { act }, onclick: disabled ? undefined : () => this.go(act) },
            label, note && h('small', {}, note)))),
        h('footer', { class: 'mm-foot' }, 'Non-commercial fan remake, not affiliated with Electronic Arts. After Westwood Studios’ Dune II (1992).'));
    } else if (screen === 'skirmish') {
      body = skirmishPanel(this.settings, { onBack: back, onStart: (query) => this.onStart(query) });
    } else if (screen === 'options') {
      body = h('div', { class: 'dm-panel wide page-options' }, h('h2', {}, 'Options'), optionsPanel(this.settings, { onChange: (key, value) => this.onSettings(key, value) }),
        originalFilesRow(() => this.go('original-files', 'options')),
        h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', onclick: back }, 'Back')));
    } else if (screen === 'original-files') {
      body = h('div', { class: 'dm-panel page-original-files' }, h('h2', {}, 'Original Game Files'), h('p', { class: 'dm-hint' }, 'Loading…'));
      originalFilesPage(this.settings, { onBack: back }).then((panel) => {
        if (this.visit !== visit) return;   // the player has moved on
        this.el.replaceChildren(this.top, panel);
        panel.querySelector?.('.dm-btn.primary, .dm-actions .dm-btn, button')?.focus({ preventScroll: true });
      });
    } else if (screen === 'controls') {
      body = h('div', { class: 'dm-panel wide page-controls' }, h('h2', {}, 'Controls'),
        h('p', { class: 'dm-hint' }, this.settings.scheme === 'modern' ? 'Modern mouse scheme (change it in Options).' : 'Classic mouse scheme, as in C&C 1995 (change it in Options).'),
        controlsTable(this.settings.scheme), h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', onclick: back }, 'Back')));
    } else {
      body = h('div', { class: 'dm-panel page-credits' }, h('h2', {}, 'Credits'),
        h('p', {}, 'Dune II 3D is a non-commercial fan remake. Every model, texture, sound and line of text in it is newly made.'),
        h('p', {}, 'Dune II: The Battle for Arrakis was made by Westwood Studios in 1992; its code, art and audio belong to Electronic Arts. The Dune name belongs to Herbert Properties.'),
        h('p', {}, 'Built with three.js. The announcer voices were rendered with the Kokoro-82M text-to-speech model (Apache-2.0).'),
        h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', onclick: back }, 'Back')));
    }
    this.refresh();
    this.el.replaceChildren(this.top, body);
    this.el.querySelector('.mm-item.primary, .dm-btn.primary, .dm-actions .dm-btn')?.focus({ preventScroll: true });
  }

  refresh() {
    const paused = this.isBackdropPaused(), full = this.isFullscreen();
    setToggle(this.bg, paused, paused ? '\u25B6\uFE0E' : '\u275A\u275A', paused ? 'Play background' : 'Pause background');
    setToggle(this.fs, full, '⛶', full ? 'Leave full screen' : 'Full screen');
  }

  show() { this.el.hidden = false; this.go('title'); }
  hide() { this.el.hidden = true; }
}

// A phone hides the words (menu.css) and keeps the glyph, so the name also lives in aria-label.
function setToggle(button, pressed, glyph, label) {
  button.setAttribute('aria-pressed', String(pressed));
  button.setAttribute('aria-label', label);
  button.replaceChildren(h('span', { class: 'mm-glyph', 'aria-hidden': 'true' }, glyph), h('span', { class: 'mm-word' }, label));
}
