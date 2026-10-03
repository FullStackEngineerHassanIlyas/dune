// The campaign screens in the main menu (spec §5.8, §7; research.md §4-§6 for the Sega flow; screen names are
// contract C3). One controller per menu: it keeps the flow's state and the saved progress (src/campaign/), builds
// each screen for MainMenu.go, launches missions in the shell's frame (C2) and takes their results back through
// shell.on('missionEnd'). Words (C4), the mission list (C1), the territory map (C5) and the menu music's moods
// (C6) come from other modules that may not be there yet: each has a plain fallback. The menu's backdrop is held
// still behind the full-screen stages (no frames drawn: the laptop's GPU is shared with the map) and resumes on
// the panels and the title.
import { h } from '../dom.js';
import { HOUSES } from '../../data/houses.js';
import { SCREENS, SEGA_ORDER, step, resolveScreen, backOf } from '../../campaign/flow.js';
import { loadProgress, saveProgress, continues, finished, DONE } from '../../campaign/progress.js';
import { readResult, sampleResult, MISSIONS, missionNumber } from '../../campaign/result.js';
import { completionPassword, normalisePassword, PASSWORD_LENGTH } from '../../campaign/passwords.js';
import { loadWords } from './words.js';
import { CampaignMap } from './map.js';
import { mentatStage, reducedMotion } from './stage.js';
import { crestSvg } from './crests.js';
import { victoryCard, scoreScreen, passwordReveal } from './results.js';

export const isCampaignScreen = (screen) => SCREENS.includes(screen);
/** Screens that cover the whole menu: the backdrop holds still behind them. */
const FULL = new Set(['campaign-house', 'campaign-join', 'campaign-briefing', 'campaign-region', 'campaign-results', 'campaign-defeat', 'campaign-ending']);
/** Screens with the territory map; leaving them gives the map's graphics memory back. */
const MAPPED = new Set(['campaign-join', 'campaign-briefing', 'campaign-region', 'campaign-results', 'campaign-defeat', 'campaign-ending']);
const RESULT_STAGES = ['victory', 'mentat', 'score', 'password'];
const SPECIALS = { atreides: 'Sonic Tank · Fremen warriors', ordos: 'Deviator · Saboteur', harkonnen: 'Devastator · Death Hand' };
const VICTORY_CARD_MS = 6000;

const name = (house) => HOUSES[house]?.name ?? house;
/** "A", "A and B", "A, B and C". */
const andList = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] ?? '');
const hex = (house) => `#${(HOUSES[house]?.color ?? 0xd9a52e).toString(16).padStart(6, '0')}`;

export class CampaignScreens {
  /**
   * menu: the MainMenu (go, show, hide, visit, onStart); shell: { launch, quit, on } (C3); music: MenuMusic;
   * backdrop: MenuBackdrop. store and load (story, missions, atlas, ending) are for tests.
   */
  constructor(menu, { settings = {}, music = null, shell = null, backdrop = null, store, load = {} } = {}) {
    Object.assign(this, { menu, settings, music, shell, backdrop, store, load });
    this.progress = loadProgress(store);
    this.saved = null;          // false once a save failed (private window): the hub says so
    this.state = { screen: 'campaign' };
    this.result = null;         // the result the results or defeat screen shows
    this.stage = 0;             // which part of the results
    this.words = null;
    this.timers = new Set();
    this.moodNow = null;        // null: whatever the shell left playing (the title)
    this.hushed = false;
    this.devDone = false;
    this.typed = '';
    this.map = new CampaignMap({ quality: settings.quality, load: load.atlas, later: (fn, ms) => this.later(fn, ms) });
    shell?.on?.('missionEnd', (message) => this.missionEnd(message));
    globalThis.addEventListener?.('resize', () => this.map.resize());
  }

  /** Runs `fn` after `ms` unless the screen has changed by then. */
  later(fn, ms) {
    const visit = this.menu.visit;
    const t = setTimeout(() => { this.timers.delete(t); if (this.menu.visit === visit) fn(); }, ms);
    t?.unref?.();
    this.timers.add(t);
    return t;
  }

  clearTimers() { for (const t of this.timers) clearTimeout(t); this.timers.clear(); }

  /** Runs `fn` once the screen has been on show for `ms`, counted in drawn frames (a stall, such as the menu coming
   *  back from a battle, does not count), unless the screen has changed by then. Without frames (Node): a timer. */
  shown(fn, ms) {
    const raf = globalThis.requestAnimationFrame;
    if (!raf) { this.later(fn, ms); return; }
    const visit = this.menu.visit;
    let left = ms, last = null;
    const frame = (now) => {
      if (this.menu.visit !== visit) return;
      if (last !== null) left -= Math.min(100, now - last);
      last = now;
      if (left <= 0) fn(); else raf(frame);
    };
    raf(frame);
  }

  /** The words and the mission list, loaded once; the screen is drawn again when they arrive. */
  ensureWords() {
    if (this.words || this.wordsLoading) return;
    this.wordsLoading = loadWords(this.load).then((w) => {
      this.words = w;
      if (isCampaignScreen(this.menu.screen) && !this.menu.el.hidden) this.menu.go(this.menu.screen);
    });
  }

  /** One flow step; saves when the flow says so. */
  apply(action) {
    const out = step(this.progress, this.state, action);
    this.progress = out.progress;
    this.state = out.state;
    if (out.save) this.saved = saveProgress(this.progress, this.store);
    return out;
  }

  /** One flow step, then its screen (or the battle). */
  go(action) {
    const out = this.apply(action);
    if (out.state.screen !== 'campaign-password') this.typed = '';
    if (out.launch) this.launch(out.launch);
    else if (out.ending) this.playEnding();
    else this.menu.go(out.state.screen === 'title' ? 'title' : out.state.screen);
    return out;
  }

  launch(query) {
    this.clearTimers();
    this.map.dispose();
    this.hushed = false;   // the shell stops the backdrop and starts it again on the way back
    this.moodNow = null;   // and plays the title again
    (this.shell?.launch ?? this.menu.onStart)?.(query);
  }

  /** The battle's result (C2): saved, then the results (or the defeat) screen once the frame has closed. */
  missionEnd(message) {
    const result = readResult(message);
    if (!result) {
      console.warn('campaign: a missionEnd message without a campaign mission', message);
      this.shell?.quit?.('campaign');
      return;
    }
    this.apply({ type: 'result', result });
    this.result = result;
    this.stage = 0;
    this.shell?.quit?.('campaign-results');
  }

  /** The address's house, mission, stage and won for the screen it opens (?screen=…: development shots), once. */
  dev(screen) {
    if (this.devDone) return {};
    let q;
    try { q = new URLSearchParams(globalThis.location?.search ?? ''); } catch { return {}; }
    if (q.get('screen') !== screen) return {};
    this.devDone = true;
    const house = SEGA_ORDER.includes(q.get('house')) ? q.get('house') : undefined;
    const stage = RESULT_STAGES.indexOf(q.get('stage'));
    return { house, mission: missionNumber(q.get('mission')) ?? undefined, stage: stage >= 0 ? stage : undefined, won: q.get('won') === null ? undefined : q.get('won') !== '0' };
  }

  /** The state follows a screen asked for from outside (the shell after a battle, ?screen=, a menu entry). */
  sync(requested) {
    let screen = resolveScreen(requested, this.state, this.progress);
    if (requested === 'campaign' && screen === 'campaign-briefing') { this.apply({ type: 'quit' }); return; }
    const dev = this.dev(requested);
    if (screen === this.state.screen && !dev.house && !dev.mission && dev.won === undefined) {
      if (dev.stage !== undefined) this.stage = dev.stage;
      return;
    }
    const house = dev.house ?? this.state.house ?? this.progress.house ?? 'atreides';
    const mission = dev.mission ?? this.state.mission ?? Math.min(MISSIONS, this.progress.houses[house]?.mission ?? 1);
    if (requested === 'campaign-results' || requested === 'campaign-defeat') {
      const last = this.progress.last;
      const fits = last && last.house === house && last.mission === mission && (dev.won === undefined || dev.won === last.won);
      this.result = fits ? last : sampleResult(house, mission, { won: dev.won ?? requested === 'campaign-results' });
      screen = this.result.won ? 'campaign-results' : 'campaign-defeat';
      this.stage = dev.stage ?? 0;
    }
    this.state = { screen, house, mission };
  }

  /** MainMenu.go asks for a campaign screen: { screen (the one drawn), body, back }. */
  render(requested) {
    this.clearTimers();
    this.sync(requested);
    const screen = this.state.screen;
    this.hush(FULL.has(screen));
    if (!MAPPED.has(screen)) this.map.dispose();
    this.ensureWords();
    this.typer = null;
    const body = this.words ? this.build(screen) : h('section', { class: 'cp-stage cp-loading' }, h('p', {}, 'Loading…'));
    return { screen, body, back: backOf(screen) };
  }

  build(screen) {
    switch (screen) {
      case 'campaign-house': return this.houses();
      case 'campaign-join': return this.join();
      case 'campaign-briefing': return this.briefing();
      case 'campaign-region': return this.region();
      case 'campaign-results': return this.results();
      case 'campaign-defeat': return this.defeat();
      case 'campaign-ending': return this.ending();
      case 'campaign-password': return this.password();
      default: return this.hub();
    }
  }

  /** Leaving the campaign for the title: the map goes, the backdrop moves again, the title theme returns. */
  leave() {
    this.clearTimers();
    this.map.dispose();
    this.hush(false);
    this.mood('menu');
  }

  /** The backdrop held still (true), or as the player's Pause background setting has it and running. */
  hush(on) {
    if (on === this.hushed) return;
    this.hushed = on;
    try {
      this.backdrop?.setPaused?.(on ? true : this.settings.menuMotion === false);
      if (!on) this.backdrop?.start?.();   // started again if it was stopped (a no-op while it runs)
    } catch (err) { console.warn('campaign: backdrop:', err); }
  }

  /** A menu music mood (C6), each asked for once; without mood() a briefing falls back to briefing(house). */
  mood(name) {
    if ((this.moodNow ?? 'menu') === name) return;
    this.moodNow = name;
    const m = this.music;
    try {
      if (typeof m?.mood === 'function') m.mood(name);
      else if (name.startsWith('briefing:')) m?.briefing?.(name.slice(9));
      else if (name === 'menu') m?.briefing?.(null);
    } catch (err) { console.warn('campaign: music:', err); }
  }

  /** Esc and the keyboard on the campaign screens; true when handled. */
  onKey(e) {
    const screen = this.menu.screen;
    if (!isCampaignScreen(screen) || this.menu.el.hidden) return false;
    if (e.key === 'Escape') {
      e.preventDefault?.();
      if (screen === 'campaign-results') this.advance?.();
      else if (screen === 'campaign-defeat') this.go({ type: 'retry' });
      else if (screen === 'campaign-ending') this.playEnding();
      else this.go({ type: 'back' });
      return true;
    }
    if (screen === 'campaign-house' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const cards = [...(this.menu.el.querySelectorAll?.('.cp-house') ?? [])];
      const at = cards.indexOf(globalThis.document?.activeElement), left = e.key === 'ArrowLeft', n = cards.length;
      cards[at < 0 ? (left ? n - 1 : 0) : (at + (left ? n - 1 : 1)) % n]?.focus();
      e.preventDefault?.();
      return true;
    }
    // reading on: → or Page Down anywhere, Space where it does not press a button
    const target = e.target?.tagName ?? '';
    if (this.typer && (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && target !== 'BUTTON' && target !== 'INPUT'))) {
      this.typer.skip();
      e.preventDefault?.();
      return true;
    }
    return false;
  }

  // ----- the screens -----

  item(label, note, act, onclick, data = {}) {
    return h('button', { type: 'button', class: 'mm-item cp-item', dataset: { act, ...data }, onclick }, label, note && h('small', {}, note));
  }

  hub() {
    this.mood('menu');
    const w = this.words;
    const items = [
      ...continues(this.progress).map(({ house, mission }) => this.item(`Continue · House ${name(house)}`, [`Mission ${mission}`, w.title(house, mission)].filter(Boolean).join(': '), 'continue',
        () => this.go({ type: 'continue', house }), { house })),
      this.item('New campaign', 'Choose your house and begin at mission 1', 'new', () => this.go({ type: 'new' })),
      this.item('Enter password', 'Go straight to a mission with a password from the Sega game', 'password', () => this.go({ type: 'open', screen: 'campaign-password' })),
      ...finished(this.progress).map((house) => this.item(`Ending · House ${name(house)}`, 'Arrakis is yours: watch the ending again', 'ending',
        () => this.go({ type: 'open', screen: 'campaign-ending', house, mission: MISSIONS }), { house })),
    ];
    items[0].className += ' primary';
    return h('div', { class: 'dm-panel cp-hub' }, h('h2', {}, 'Campaign'),
      h('p', { class: 'dm-hint cp-hub-hint' }, 'Three houses, nine missions each, as in Dune: The Battle for Arrakis on the Sega Mega Drive.'),
      h('nav', { class: 'cp-hub-list', 'aria-label': 'Campaign' }, items),
      this.saved === false && h('p', { class: 'cp-warn', role: 'status' }, 'This browser will not keep your progress (a private window?). Note the passwords you are given.'),
      h('div', { class: 'dm-actions' }, h('button', { type: 'button', class: 'dm-btn', dataset: { act: 'back' }, onclick: () => this.go({ type: 'back' }) }, 'Back')));
  }

  houses() {
    this.mood('houseSelect');
    const cards = SEGA_ORDER.map((id, i) => {
      const art = h('span', { class: 'cp-crest' });
      art.innerHTML = crestSvg(id);
      const saved = this.progress.houses[id];
      return h('button', { type: 'button', class: 'cp-house', style: `--house:${hex(id)}`, dataset: { act: 'house', house: id, ...(i === 0 ? { autofocus: '1' } : {}) },
        'aria-label': `House ${name(id)}`, onclick: () => this.go({ type: 'pick', house: id }) },
        art, h('span', { class: 'cp-plaque' }, name(id)),
        h('small', {}, `Mentat ${this.words.mentat(id)}`), h('small', {}, SPECIALS[id]),
        saved && h('small', { class: 'cp-saved' }, saved.mission >= DONE ? 'Arrakis won' : `Saved at mission ${saved.mission}`));
    });
    return h('section', { class: 'cp-stage cp-houses-screen' },
      h('h2', { class: 'cp-select-title' }, 'Select your House'),
      h('div', { class: 'cp-houses', role: 'group', 'aria-label': 'Houses' }, cards),
      h('div', { class: 'cp-bar cp-bar-left' }, h('button', { type: 'button', class: 'dm-btn cp-btn', dataset: { act: 'back' }, onclick: () => this.go({ type: 'back' }) }, 'Back')));
  }

  /** The Mentat's stage for the current house, the map mounted beside him and showing `step`. */
  mentat(className, step) {
    const { house } = this.state;
    const stage = mentatStage(house, { mentatName: this.words.mentat(house), label: name(house), later: (fn, ms) => this.later(fn, ms), className,
      warn: this.saved === false ? 'This browser is not keeping your progress: note the passwords you are given.' : null });
    this.map.mount(stage.mapBox);
    if (step !== null) this.map.show({ house, step });
    const say = stage.say;
    stage.say = (lines, opts) => (this.typer = say(lines, opts));
    return stage;
  }

  join() {
    const { house } = this.state;
    this.mood(`briefing:${house}`);
    const stage = this.mentat('cp-join', 0);
    const pages = this.words.pages(house);
    let page = 0;
    const show = () => {
      if (page < pages.length) {
        stage.say(pages[page], { kicker: `House ${name(house)} · ${page + 1} of ${pages.length}` });
        stage.note(null);
        stage.actions([['Back', 'back', () => this.go({ type: 'back' })], ['Next', 'next', () => { page += 1; show(); }, { primary: true }]]);
        return;
      }
      stage.say([this.words.question(house)], { kicker: `House ${name(house)}` });
      const saved = this.progress.houses[house]?.mission ?? 1;
      stage.note(saved >= DONE ? `Yes starts House ${name(house)} again at mission 1; Arrakis stays won in your record.`
        : saved > 1 ? `Yes starts House ${name(house)} again at mission 1 (your saved game is at mission ${saved}; Continue keeps it).` : null);
      stage.actions([['No', 'decline', () => this.go({ type: 'decline' })], ['Yes', 'join', () => this.go({ type: 'join' }), { primary: true }]]);
    };
    show();
    return stage.el;
  }

  briefing() {
    const { house, mission } = this.state;
    this.mood(`briefing:${house}`);
    const stage = this.mentat('cp-briefing', mission - 1);
    const w = this.words, objective = w.objective(house, mission), enemies = w.enemies(house, mission);
    const saved = this.progress.houses[house]?.mission ?? 0;
    const replay = saved > mission && (saved >= DONE ? `A replay: House ${name(house)} has won Arrakis, and that stays in your record.` : `A replay: your saved game stays at mission ${saved}.`);
    let advice = false;
    const show = (focus) => {
      stage.say(advice ? w.advice(house, mission) : w.briefing(house, mission),
        { kicker: advice ? `Mission ${mission} · the Mentat's advice` : `Mission ${mission} of ${MISSIONS}`, title: w.title(house, mission) ?? `House ${name(house)}` });
      stage.note([objective && `Objective: ${objective}.`, enemies.length && `Against ${andList(enemies)}.`, replay].filter(Boolean).join(' ') || null);
      stage.actions([['Back', 'back', () => this.go({ type: 'back' })], [advice ? 'Briefing' : 'Advice', 'advice', () => { advice = !advice; show('advice'); }],
        ['Proceed', 'proceed', () => this.go({ type: 'proceed' }), { primary: true }]], { focus });
    };
    show();
    return stage.el;
  }

  region() {
    const { house, mission } = this.state;
    this.mood('region');
    this.typer = null;
    const box = h('div', { class: 'cp-region-map', dataset: { act: 'skip-zoom' } });
    const start = () => { if (this.state.screen === 'campaign-region') this.go({ type: 'launch' }); };
    box.addEventListener('click', start);
    const caption = this.words.caption(house, mission - 1);
    const el = h('section', { class: 'cp-stage cp-region', dataset: { house } }, box,
      h('div', { class: 'cp-region-words' },
        h('div', { class: 'cp-kicker' }, `House ${name(house)} · mission ${mission}`),
        h('h2', { class: 'cp-title' }, this.words.title(house, mission) ?? `Mission ${mission}`),
        caption && h('p', {}, caption)),
      h('div', { class: 'cp-bar' },
        h('button', { type: 'button', class: 'dm-btn cp-btn', dataset: { act: 'back' }, onclick: () => this.go({ type: 'back' }) }, 'Back'),
        h('button', { type: 'button', class: 'dm-btn cp-btn primary', dataset: { act: 'start' }, onclick: start }, 'Start now')));
    this.map.mount(box);
    const visit = this.menu.visit;
    this.map.zoomTo({ house, mission, seconds: 7 }).then(() => { if (this.menu.visit === visit) start(); });
    return el;
  }

  results() {
    const r = (this.result ??= this.progress.last ?? sampleResult(this.state.house, this.state.mission));
    const { house, mission } = r;
    const last = mission >= MISSIONS;   // after the last mission: no password; the score leads to the ending
    const stages = last ? RESULT_STAGES.slice(0, 3) : RESULT_STAGES;
    this.stage = Math.min(this.stage, stages.length - 1);
    const next = () => {
      if (this.state.screen !== 'campaign-results') return;
      if (this.stage < stages.length - 1) { this.stage += 1; this.menu.go('campaign-results'); } else this.go({ type: 'next' });
    };
    this.advance = next;
    this.typer = null;
    const part = stages[this.stage];
    if (part !== 'mentat') this.map.dispose();   // only the Mentat's part has the map
    if (part === 'password') {
      this.mood(`briefing:${house}`);   // the Sega starts the Mentat's theme here
      return passwordReveal(house, mission, completionPassword(house, mission), { onContinue: next, kept: this.saved !== false });
    }
    this.mood(`victory:${house}`);
    if (part === 'victory') {
      this.shown(next, VICTORY_CARD_MS);
      return victoryCard(house, mission, { onContinue: next });
    }
    if (part === 'score') return scoreScreen(r, { later: (fn, ms) => this.later(fn, ms), instant: reducedMotion(), onContinue: next });
    const stage = this.mentat('cp-win', null);
    this.map.show({ house, step: mission - 1 }).then(() => this.later(() => this.map.conquer({ house, step: mission }), 800));
    if (last) stage.say([...this.words.win(house, mission), ...this.words.ending(house)], { kicker: 'The Battle for Arrakis is over', title: `Dune belongs to House ${name(house)}` });
    else stage.say(this.words.win(house, mission), { kicker: `Mission ${mission} accomplished`, title: this.words.title(house, mission) ?? `House ${name(house)}` });
    stage.actions([['Continue', 'continue', next, { primary: true }]]);
    return stage.el;
  }

  defeat() {
    const { house, mission } = this.state;
    this.mood(`defeat:${house}`);
    const stage = this.mentat('cp-defeat', mission - 1);
    stage.say(this.words.lose(house, mission), { kicker: `Mission ${mission} failed`, title: this.words.title(house, mission) ?? `House ${name(house)}` });
    stage.actions([['Campaign menu', 'menu', () => this.go({ type: 'open', screen: 'campaign' })], ['Try again', 'retry', () => this.go({ type: 'retry' }), { primary: true }]]);
    return stage.el;
  }

  /** The hub's "watch the ending again": the Mentat's final words, then the ending. */
  ending() {
    const { house } = this.state;
    this.mood(`victory:${house}`);
    const stage = this.mentat('cp-ending', MISSIONS);
    const lines = this.words.ending(house);
    stage.say(lines.length ? lines : this.words.win(house, MISSIONS), { kicker: 'The Battle for Arrakis is over', title: `Dune belongs to House ${name(house)}` });
    stage.actions([['Continue', 'ending', () => this.playEnding(), { primary: true }]]);
    return stage.el;
  }

  /** The ending (C12: scenes/menu-intro.js playEnding), then the title. */
  async playEnding() {
    if (this.endingBusy) return;
    this.endingBusy = true;
    const house = this.state.house;
    this.clearTimers();
    this.map.dispose();
    this.menu.hide();
    this.moodNow = 'finale';   // the ending plays music of its own; the title theme comes back with the title
    try {
      const mod = await (this.load.ending ?? (() => import('../../scenes/menu-intro.js')))();
      await mod?.playEnding?.({ house, app: globalThis.document?.getElementById?.('app') ?? null, backdrop: this.backdrop, menu: this.menu, music: this.music });
    } catch (err) { console.warn('campaign: the ending failed:', err); }
    this.endingBusy = false;
    this.apply({ type: 'done' });
    this.hush(false);
    try { this.backdrop?.start?.(); } catch (err) { console.warn('campaign: backdrop:', err); }
    this.menu.show();
  }

  password() {
    this.mood('menu');
    const error = this.state.error === 'unknown';
    const input = h('input', { type: 'text', class: 'cp-pass-input', maxlength: PASSWORD_LENGTH, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters',
      'aria-label': 'Password', 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': 'cp-pass-msg', value: this.typed, dataset: { act: 'password-input', autofocus: '1' } });
    const set = (v) => { this.typed = normalisePassword(v).slice(0, PASSWORD_LENGTH); input.value = this.typed; };
    const submit = () => this.go({ type: 'password', text: this.typed });
    input.addEventListener('input', () => set(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    const key = (label, act, onclick, data, name) => h('button', { type: 'button', class: 'cp-key', 'aria-label': name, dataset: { act, ...data }, onclick: () => { onclick(); input.focus?.({ preventScroll: true }); } }, label);
    const grid = h('div', { class: 'cp-keys', role: 'group', 'aria-label': 'Letters' },
      [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => key(c, 'letter', () => set(this.typed + c), { letter: c })),
      key('←', 'delete', () => set(this.typed.slice(0, -1)), {}, 'Delete the last letter'), key('End', 'end', submit, {}, 'Start with this password'));
    return h('div', { class: 'dm-panel cp-password' }, h('h2', {}, 'Enter password'),
      h('p', {}, 'Each mission of the Sega game has a ten-letter password. Type it, or pick the letters below.'),
      input,
      h('p', { id: 'cp-pass-msg', class: `cp-pass-msg${error ? ' bad' : ''}`, role: 'alert' }, error ? 'That password opens no mission. Check the letters and try again.' : ''),
      grid,
      h('div', { class: 'dm-actions' },
        h('button', { type: 'button', class: 'dm-btn', dataset: { act: 'back' }, onclick: () => this.go({ type: 'back' }) }, 'Back'),
        h('button', { type: 'button', class: 'dm-btn primary', dataset: { act: 'submit' }, onclick: submit }, 'Start')));
  }
}
