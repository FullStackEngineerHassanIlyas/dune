// What the player's announcer says in a battle (spec §6 Announcer; research audio-ui-controls.md §A.1):
// simulation events become voiced lines (src/audio/voice.js), the player's unit orders and selections draw
// a unit's acknowledgement, and two warnings the original spoke are raised here from what the player can
// see: an enemy unit near the base ("Warning, Harkonnen unit approaching") and a sandworm ("Wormsign").
// Those two also show in the message bar; every other line's text is already there from its 'eva' event.
import { lineForEvent, ackForCommand, namedLine, SELECT_ACKS } from '../audio/voice.js';
import { unitVisibleTo } from '../sim/fog.js';
import { HOUSES } from '../data/houses.js';

export const APPROACH_TILES = 12;      // an enemy this close to one of the player's buildings is approaching
export const WARN_EVERY = 20;          // seconds between two sighting warnings in the message bar
const HARMLESS = new Set(['carryall', 'frigate']);   // flying freight is not an attack
const ENDINGS = new Set(['missionAccomplished', 'missionFailed', 'draw']);

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
  }

  say(id, now) { return this.player.say(id, now); }

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
    for (let i = this.pendingSeen; i < list.length; i++) if (list[i].houseId === this.house) ack = ackForCommand(list[i].command, this.rng) ?? ack;
    this.pendingSeen = list.length;
    if (ack) this.say(ack, now);
  }

  /** "Reporting" when the player picks up one of their own units that was not selected before. */
  selection(sel, now) {
    if (sel.version === this.selectionVersion) return;
    this.selectionVersion = sel.version;
    let fresh = false;
    for (const id of sel.ids) {
      if (this.selected.has(id)) continue;
      if (this.world.units.get(id)?.house === this.house) { fresh = true; break; }
    }
    this.selected = new Set(sel.ids);
    if (fresh) this.say(SELECT_ACKS[Math.floor(this.rng() * SELECT_ACKS.length) % SELECT_ACKS.length], now);
  }

  /** Enemies the player can see close to their base, and sandworms anywhere in sight: one warning per wave. */
  sightings(now) {
    const w = this.world;
    for (const id of this.warned) if (!w.units.has(id)) this.warned.delete(id);
    if (now - this.lastWarning < WARN_EVERY) return;
    let line = null, text = null;
    const seen = [];
    for (const u of w.units.values()) {
      if (u.house === this.house || u.inside || this.warned.has(u.id) || HARMLESS.has(u.typeId)) continue;
      const worm = u.typeId === 'sandworm';
      if (!worm && this.nearestBuilding(u.x, u.y) > APPROACH_TILES) continue;
      if (!unitVisibleTo(w, this.house, u)) continue;
      seen.push(u.id);
      if (worm) { line = 'wormsign'; text = 'Warning: wormsign.'; }
      else if (!line) { line = namedLine('approaching', u.house); text = sightingText(u.house); }
    }
    if (!line) return;
    for (const id of seen) this.warned.add(id);
    this.lastWarning = now;
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

