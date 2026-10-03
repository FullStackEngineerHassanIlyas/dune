// What the player's announcer says in a battle (spec §6 Announcer; research audio-ui-controls.md §A.1):
// simulation events become voiced lines (src/audio/voice.js), the player's unit orders and selections draw
// an answer from one of the units, in the voice of its kind (src/data/unit-voices.js: the first unit that
// takes the order, one of those just selected; never the same words twice running; the old shared replies
// when its own line cannot be had), and two warnings the original spoke are raised here from what the player can
// see: an enemy unit near the base ("Warning, Harkonnen unit approaching") and a sandworm ("Wormsign").
// Those two also show in the message bar; every other line's text is already there from its 'eva' event.
// Approach warnings come one per wave, WARN_EVERY apart; a worm is announced the first time the player sees
// it (its ridge, sim/worm.js), whatever was said just before — the original's alert on first sight.
import { lineForEvent, ackForCommand, namedLine, SELECT_ACKS } from '../audio/voice.js';
import { VARIANTS, voiceGroup, replyKind, voicedKind, pickVariant, unitLine, parseUnitLine } from '../data/unit-voices.js';
import { unitVisibleTo } from '../sim/fog.js';
import { HOUSES } from '../data/houses.js';

export const APPROACH_TILES = 12;      // an enemy this close to one of the player's buildings is approaching
export const WARN_EVERY = 20;          // seconds between two sighting warnings in the message bar
const HARMLESS = new Set(['carryall', 'frigate']);   // flying freight is not an attack
const ENDINGS = new Set(['missionAccomplished', 'missionFailed', 'draw']);
const PRIMED = ['move', 'attack'];     // a group's commonest answers, decoded as soon as one of its units is selected

/** The message-bar words of an approach warning, as the announcer says them (scripts/voices/lines.json). */
export function sightingText(houseId) {
  const named = namedLine('approaching', houseId) !== 'approaching.enemy';
  if (!named) return 'Warning: enemy unit approaching.';
  return houseId === 'fremen' || houseId === 'sardaukar' ? `Warning: ${HOUSES[houseId].name} approaching.` : `Warning: ${HOUSES[houseId].name} unit approaching.`;
}

export class Announcer {
  /** player: a VoicePlayer. onMessage(text): the message bar. */
  constructor({ world, house, player, onMessage = () => {}, rng = Math.random }) {
    Object.assign(this, { world, house, player, onMessage, rng });
    this.nearBase = (x, y) => this.nearestBuilding(x, y) <= APPROACH_TILES;
    this.pending = null;          // the world's command list last looked at, and how far
    this.pendingSeen = 0;
    this.selectionVersion = -1;
    this.selected = new Set();
    this.warned = new Set();      // enemy ids already announced
    this.nextLook = 0;
    this.lastWarning = -1e9;
    this.radar = undefined;
    this.lastVariant = new Map();  // '<group>.<kind>' → the variant said last
    this.primed = new Set();       // groups whose answers were made ready
  }

  say(id, now) {
    const ok = this.player.say(id, now);
    const u = ok && parseUnitLine(id);
    if (u) this.lastVariant.set(`${u.group}.${u.kind}`, u.n);
    return ok;
  }

  /** For the debug hooks: what the voice is doing. */
  status() {
    const p = this.player, out = p.output;
    return { live: !!out?.live, volume: p.volume, lines: out?.lines ? Object.keys(out.lines).length : 0, decoded: out?.buffers?.size ?? 0,
      speaking: p.current, waiting: p.queue.items.map((q) => q.id), said: [...p.said] };
  }

  onEvent(e, now) {
    const id = lineForEvent(e, this.house, { nearBase: this.nearBase });
    if (!id) return;
    if (ENDINGS.has(id)) this.player.interrupt(id, now);
    else this.say(id, now);
  }

  /** Once a frame, before the simulation steps: orders just given, the selection, sightings, radar and the next line. */
  frame(now, selection = null, radar = undefined) {
    this.orders(now);
    if (selection) this.selection(selection, now);
    if (radar !== undefined) {
      if (this.radar !== undefined && radar !== this.radar) this.say(radar ? 'radarOn' : 'radarOff', now);
      this.radar = radar;
    }
    if (now >= this.nextLook) { this.nextLook = now + 1; this.sightings(now); }
    this.player.update(now);
  }

  /** A unit answers the player's newest unit order still waiting in the world's command list. */
  orders(now) {
    const list = this.world.pending;
    if (!list) return;
    if (list !== this.pending) { this.pending = list; this.pendingSeen = 0; }
    let ack = null;
    for (let i = this.pendingSeen; i < list.length; i++) if (list[i].houseId === this.house) ack = this.reply(list[i].command) ?? ack;
    this.pendingSeen = list.length;
    if (ack) this.say(ack, now);
  }

  /** The answer to a command: the first of the player's units that takes it speaks; null if none does. */
  reply(cmd) {
    if (!cmd?.ids?.length) return null;
    const units = [];
    for (const id of cmd.ids) {
      const u = this.world.units.get(id);
      if (u?.house === this.house && !u.inside && !u.visitor && u.destructAt === undefined) units.push(u);
    }
    const deployers = cmd.type === 'deploy' ? units.filter((u) => u.type.deploysTo) : [];   // D with an MCV along deploys it and blows nothing up
    for (const u of deployers.length ? deployers : units) {
      const kind = replyKind(cmd.type, u);
      if (kind) return this.unitLine(voiceGroup(u.typeId), kind) ?? ackForCommand(cmd, this.rng);
    }
    return null;
  }

  /** A line of the group's for `kind` (or the nearest kind it has words for), not the one it said last; null if the voice lacks it. */
  unitLine(group, kind) {
    const voiced = voicedKind(group, kind);
    if (!voiced) return null;
    const id = unitLine(group, voiced, pickVariant(VARIANTS[group][voiced], this.lastVariant.get(`${group}.${voiced}`), this.rng));
    return this.player.output?.has?.(id) ? id : null;
  }

  /** One of the player's units just picked up answers ("Reporting"), in its voice; its group's commonest answers are made ready. */
  selection(sel, now) {
    if (sel.version === this.selectionVersion) return;
    this.selectionVersion = sel.version;
    const fresh = [];
    for (const id of sel.ids) {
      if (this.selected.has(id)) continue;
      const u = this.world.units.get(id);
      if (u?.house === this.house && voiceGroup(u.typeId)) fresh.push(u);
    }
    this.selected = new Set(sel.ids);
    if (!fresh.length) return;
    const group = voiceGroup(fresh[Math.floor(this.rng() * fresh.length) % fresh.length].typeId);
    this.say(this.unitLine(group, 'select') ?? SELECT_ACKS[Math.floor(this.rng() * SELECT_ACKS.length) % SELECT_ACKS.length], now);
    this.prime(group);
  }

  prime(group) {
    if (this.primed.has(group) || !this.player.output?.prefetch || this.player.output.live === false) return;   // nothing decodes before the audio opens
    this.primed.add(group);
    const ids = [];
    for (const kind of PRIMED) for (let n = 1; n <= (VARIANTS[group][kind] ?? 0); n++) ids.push(unitLine(group, kind, n));
    this.player.output.prefetch(ids.filter((id) => this.player.output.has(id)));
  }

  /** Sandworms anywhere in sight, each the first time it is seen; enemies the player can see close to their base, one warning per wave. */
  sightings(now) {
    const w = this.world;
    for (const id of this.warned) if (!w.units.has(id)) this.warned.delete(id);
    const quiet = now - this.lastWarning < WARN_EVERY;
    let line = null, text = null, worm = false;
    const seen = [];
    for (const u of w.units.values()) {
      if (u.house === this.house || u.inside || this.warned.has(u.id) || HARMLESS.has(u.typeId)) continue;
      const isWorm = u.typeId === 'sandworm';
      if (!isWorm && (quiet || this.nearestBuilding(u.x, u.y) > APPROACH_TILES)) continue;
      if (!unitVisibleTo(w, this.house, u)) continue;
      if (isWorm) { if (!worm) seen.length = 0; worm = true; line = 'wormsign'; text = 'Warning: wormsign.'; }
      else if (worm) continue;   // a worm's warning first; the enemy waits for the next look
      else if (!line) { line = namedLine('approaching', u.house); text = sightingText(u.house); }
      seen.push(u.id);
    }
    if (!line) return;
    for (const id of seen) this.warned.add(id);
    if (!worm) this.lastWarning = now;
    this.onMessage(text);
    this.say(line, now);
  }

  /** Distance in tiles from (x, y) to the nearest building of the player's, Infinity without one. */
  nearestBuilding(x, y) {
    let best = Infinity;
    for (const s of this.world.structures.values()) {
      if (s.house !== this.house) continue;
      const dx = Math.max(s.x - x, 0, x - (s.x + s.w)), dy = Math.max(s.y - y, 0, y - (s.y + s.h));
      const d = Math.hypot(dx, dy);
      if (d < best) best = d;
    }
    return best;
  }
}

