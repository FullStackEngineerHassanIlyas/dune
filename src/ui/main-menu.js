// Main menu screens (spec §5.8): title with Skirmish, Campaign (to come), Options, Controls and
// Credits, plus full screen. Esc steps back to the title.
import { h } from './dom.js';
import { optionsPanel } from './options.js';
import { controlsTable } from './controls-help.js';
import { skirmishPanel } from './skirmish-setup.js';

export class MainMenu {
  constructor(root, { settings, onStart, onFullscreen, isFullscreen = () => false }) {
    Object.assign(this, { settings, onStart, onFullscreen, isFullscreen });
    this.el = h('div', { class: 'main-menu' });
    root.appendChild(this.el);
    this.screen = 'title';
    addEventListener('keydown', (e) => {
      if (this.el.hidden || e.key !== 'Escape' || this.screen === 'title') return;
      e.preventDefault();
      this.go('title');
    });
    this.go('title');
  }

  go(screen) {
    this.screen = screen;
    const back = () => this.go('title');
    const fullscreen = this.isFullscreen();
    const fs = h('button', { type: 'button', class: 'mm-fs', 'aria-pressed': String(fullscreen), title: 'Full screen (Alt + Enter)',
      onclick: async () => { await this.onFullscreen(); this.refresh(); } }, h('span', { 'aria-hidden': 'true' }, '⛶'), fullscreen ? ' Leave full screen' : ' Full screen');
    let body;
    if (screen === 'title') {
      body = h('div', { class: 'mm-title-screen' },
        h('header', { class: 'mm-brand' },
          h('div', { class: 'mm-kicker' }, 'A 3D fan remake'),
          h('h1', {}, 'Dune', h('span', {}, 'II')),
          h('div', { class: 'mm-sub' }, 'The Battle for Arrakis')),
        h('nav', { class: 'mm-nav', 'aria-label': 'Main menu' },
          h('button', { type: 'button', class: 'mm-item primary', dataset: { act: 'skirmish' }, onclick: () => this.go('skirmish') }, 'Skirmish', h('small', {}, 'One battle against the computer')),
          h('button', { type: 'button', class: 'mm-item', disabled: true }, 'Campaign', h('small', {}, 'Coming in a later phase')),
          h('button', { type: 'button', class: 'mm-item', dataset: { act: 'options' }, onclick: () => this.go('options') }, 'Options', h('small', {}, 'Graphics, mouse, scrolling, sound')),
          h('button', { type: 'button', class: 'mm-item', dataset: { act: 'controls' }, onclick: () => this.go('controls') }, 'Controls', h('small', {}, 'Mouse and keyboard')),
          h('button', { type: 'button', class: 'mm-item', dataset: { act: 'credits' }, onclick: () => this.go('credits') }, 'Credits')),
        h('footer', { class: 'mm-foot' }, 'Non-commercial fan remake, not affiliated with Electronic Arts. After Westwood Studios’ Dune II (1992).'));
    } else if (screen === 'skirmish') {
      body = skirmishPanel(this.settings, { onBack: back, onStart: (query) => this.onStart(query) });
    } else if (screen === 'options') {
      body = h('div', { class: 'dm-panel wide page-options' }, h('h2', {}, 'Options'), optionsPanel(this.settings), h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', onclick: back }, 'Back')));
    } else if (screen === 'controls') {
      body = h('div', { class: 'dm-panel wide page-controls' }, h('h2', {}, 'Controls'),
        h('p', { class: 'dm-hint' }, this.settings.scheme === 'modern' ? 'Modern mouse scheme (change it in Options).' : 'Classic mouse scheme, as in C&C 1995 (change it in Options).'),
        controlsTable(this.settings.scheme), h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', onclick: back }, 'Back')));
    } else {
      body = h('div', { class: 'dm-panel page-credits' }, h('h2', {}, 'Credits'),
        h('p', {}, 'Dune II 3D is a non-commercial fan remake. Every model, texture, sound and line of text in it is newly made.'),
        h('p', {}, 'Dune II: The Battle for Arrakis was made by Westwood Studios in 1992; its code, art and audio belong to Electronic Arts. The Dune name belongs to Herbert Properties.'),
        h('p', {}, 'Built with three.js.'),
        h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', onclick: back }, 'Back')));
    }
    this.el.replaceChildren(fs, body);
    this.el.querySelector('.mm-item.primary, .dm-btn.primary, .dm-actions .dm-btn')?.focus({ preventScroll: true });
  }

  refresh() { if (!this.el.hidden) this.go(this.screen); }
  show() { this.el.hidden = false; this.go('title'); }
  hide() { this.el.hidden = true; }
}
