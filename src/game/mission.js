// A campaign mission's rules (spec §7; research §2, §5, §6): world.mission.update(world) runs every five ticks
// inside World.step, so it is as deterministic as the rest of the simulation. It lives in src/game because the
// voice test scans src/sim for announcer keys. What it does:
//  - objectives (C1): 'quota' — the player's credits in storage at that moment reach the quota (spending does
//    not count); 'quotaOrDestroy' — that, or the enemy base gone; 'destroy' — every structure of every enemy
//    house gone (captured counts; walls, slabs and turrets do not). Nothing ends before def.minSeconds (the
//    original's two minutes).
//  - the loss: the player has no structure left (walls, turrets and slabs do not count; an MCV does not save
//    you, as on the Sega), checked first, so a mutual wipe-out is the computer's win.
//  - the reinforcement schedule: at its time each group comes in by Carryall (one each, from the chosen side
//    or the nearest edge) or drives in from an edge; the player's own are announced when they are down
//    ('reinforcements', C9, with x and y for Space); the enemy's arrive quietly at their base, or come down on
//    the player's base and hunt.
//  - the computer units' standing orders: hunters go after the nearest enemy, an ambush springs when the enemy
//    comes in sight or shoots at it, guards drawn away by a fight go back to their posts.
//  - the mission's Starport wares (C1 starport.stock): the player's market offers those, so many of each.
//  - the score inputs (C2), frozen with the stats at the outcome (the fly-over and the wait before the hand-off
//    do not count), and a read-only debug state (C2's message, __dune.mission).
import { UNITS } from '../data/units.js';
import { unitSight, GUARD_RADIUS } from '../data/tuning.js';
import { finishGame, endStats } from '../sim/victory.js';
import { deliverByAir } from '../sim/carryall.js';
import { edgePoint } from '../sim/air.js';
import { nearestEnemyTarget } from '../sim/ai.js';
import { market } from '../sim/starport.js';
import { hostile } from '../sim/alliance.js';
export const MIN_SECONDS = 120;
export const AREA_GUARD = { radius: 6, leash: 12 };   // tiles beyond weapon range: twice a plain guard's (sim/combat.js)
export const AMBUSH = { radius: 0, leash: 0 };        // fires only at what its gun reaches, chases nothing
const ORDERS_EVERY = 4;   // updates (five ticks each) between looks at the standing orders: once a second
const OBJECTIVES = ['quota', 'quotaOrDestroy', 'destroy'];

/** The guard order's reach for a standing order (C1). */
export const guardOf = (kind) => (kind === 'areaGuard' ? AREA_GUARD : kind === 'ambush' ? AMBUSH : {});

/** What counts as a base for winning and losing: no walls, slabs or turrets. */
export const counts = (t) => !t.isWall && !t.isConcrete && !t.weapon;
/** A structure's worth on the score (research §5): a hundredth of its price. */
export const worth = (t) => Math.floor(t.cost / 100);

export function createMission(world, def, { orders = new Map(), starts = [] } = {}) {
  const player = def.house, enemies = (def.houses ?? []).map((h) => h.id).filter((id) => world.houses.has(id));
  const kind = OBJECTIVES.includes(def.objective?.kind) ? def.objective.kind : 'destroy';
  const quota = kind === 'destroy' ? 0 : Math.max(0, def.objective?.quota ?? 0);
  const minSeconds = Number.isFinite(def.minSeconds) ? def.minSeconds : MIN_SECONDS;
  const schedule = (def.reinforcements ?? []).map((r, k) => ({ ...r, k, at: Number.isFinite(r.at) ? r.at : 0 })).sort((p, q) => p.at - q.at || p.k - q.k);
  const sites = def.map?.sites ?? [];
  const hunters = new Set(), ambushers = new Set(), posts = new Map();
  for (const [id, o] of orders) {
    if (!o) continue;
    if (o.kind === 'hunt') { hunters.add(id); continue; }
    if (o.kind === 'ambush') ambushers.add(id);
    posts.set(id, { ...o, house: world.units.get(id)?.house });
  }
  const arrivals = [];   // groups on their way: { house, ids, then, announce, edge, at }
  const landed = [];     // the player's groups that came in (debug)
  const tally = { killedValue: 0, lostValue: 0 };
  let next = 0, calls = 0, stocked = !def.starport?.stock, final = null;   // final: the score as the mission ended

  const prev = world.onStructureKilled;   // the score counts every building that falls until the end (research §5)
  world.onStructureKilled = (s, attacker) => {
    prev?.(s, attacker);
    if (world.outcome || s.type.isWall || s.type.isConcrete) return;
    if (s.house === player) tally.lostValue += Math.max(1, worth(s.type));
    else if (hostile(world, s.house, player)) tally.killedValue += Math.max(1, worth(s.type));
  };

  const baseOf = (houseId) => {
    let n = 0;
    for (const s of world.structures.values()) if (s.house === houseId && counts(s.type)) n++;
    return n;
  };
  const enemyBase = () => enemies.reduce((n, id) => n + baseOf(id), 0);
  let hadBase = baseOf(player) > 0;   // a player who starts with an MCV alone loses only once a base has stood
  const credits = () => Math.floor(world.houses.get(player)?.credits ?? 0);

  /** Where a house's base is: its Construction Yard, else any building of it, else its site, else its start. */
  function homeOf(houseId) {
    let any = null;
    for (const s of world.structures.values()) {
      if (s.house !== houseId || s.type.isWall) continue;
      if (s.typeId === 'constructionYard') return { x: s.x + Math.floor(s.w / 2), y: s.y + s.h };
      any ??= { x: s.x + Math.floor(s.w / 2), y: s.y + s.h };
    }
    if (any) return any;
    const site = sites.find((s) => s.id === houseId);
    if (site) return { x: site.x, y: site.y };
    if (houseId !== player && !enemies.includes(houseId) && enemies.length) return homeOf(enemies[0]);   // a house with no base of its own (a drop only): its allies'
    const k = houseId === player ? 0 : 1 + enemies.indexOf(houseId);
    return starts[k] ?? { x: world.map.w >> 1, y: world.map.h >> 1 };
  }

  /** The tile a group is bound for: 'home', 'enemy' (the player's base for the computer, the nearest enemy base for the player) or { x, y }. */
  function destination(r) {
    if (r.to && typeof r.to === 'object' && Number.isFinite(r.to.x) && Number.isFinite(r.to.y)) return { x: r.to.x, y: r.to.y };
    if (r.to !== 'enemy') return homeOf(r.house);
    if (r.house !== player) return homeOf(player);
    const here = homeOf(player);
    let best = null, bestD = Infinity;
    for (const id of enemies) { const h = homeOf(id), d = Math.hypot(h.x - here.x, h.y - here.y); if (d < bestD) { bestD = d; best = h; } }
    return best ?? here;
  }

  /** Free tiles around (x, y), one for each move class, nearest first and none twice: in the open beside the base
   *  (no building next to them) where there is room, else anywhere free. */
  function freeTiles(x, y, moves) {
    const map = world.map, taken = new Set();
    const open = (tx, ty) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.inBounds(tx + dx, ty + dy) && map.structure[map.idx(tx + dx, ty + dy)]) return false;
      return true;
    };
    const find = (move, clear) => {
      for (let r = 1; r <= 10; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = x + dx, ty = y + dy;
        if (!map.inBounds(tx, ty)) continue;
        const i = map.idx(tx, ty);
        if (taken.has(i) || map.unit[i] || map.structure[i] || map.moveFactor(i, move) <= 0 || (clear && !open(tx, ty))) continue;
        taken.add(i);
        return { x: tx, y: ty };
      }
      return null;
    };
    return moves.map((move) => find(move, true) ?? find(move, false));
  }

  /** One scheduled group comes in. */
  function launch(r) {
    if (!world.houses.has(r.house)) return;
    const types = (r.units ?? []).filter((t) => UNITS[t] && UNITS[t].move !== 'air');
    if (!types.length) return;
    const map = world.map, to = destination(r), spots = freeTiles(to.x, to.y, types.map((t) => UNITS[t].move));
    const entry = edgePoint(map, r.from, to.x, to.y), alongX = entry.y === 0 || entry.y === map.h - 1;
    const then = r.house === player ? 'idle' : r.to === 'enemy' ? 'hunt' : r.to && typeof r.to === 'object' ? 'guard' : 'idle';
    const ids = [];
    types.forEach((type, k) => {
      const spot = spots[k] ?? to;
      const shift = Math.round((k - (types.length - 1) / 2) * 2);   // side by side along the edge
      const at = { x: Math.max(0, Math.min(map.w - 1, entry.x + (alongX ? shift : 0))), y: Math.max(0, Math.min(map.h - 1, entry.y + (alongX ? 0 : shift))) };
      if (r.via === 'edge') {
        const start = freeTiles(at.x, at.y, [UNITS[type].move])[0];
        if (!start) return;
        const u = world.spawnUnit(type, r.house, start.x, start.y, { heading: Math.atan2(spot.y - start.y, spot.x - start.x) });
        world.issue(r.house, { type: then === 'hunt' ? 'attackMove' : 'move', ids: [u.id], x: spot.x, y: spot.y });
        ids.push(u.id);
      } else ids.push(deliverByAir(world, r.house, type, spot, null, at).id);
    });
    if (ids.length) arrivals.push({ house: r.house, ids, then, announce: r.house === player, edge: r.via === 'edge', at: world.time });
  }

  /** Groups whose units are all down (or lost) are done: the player hears of it, hunters set off. */
  function land() {
    for (let k = arrivals.length - 1; k >= 0; k--) {
      const a = arrivals[k], down = [];
      let waiting = false;
      for (const id of a.ids) {
        const u = world.units.get(id);
        if (!u) continue;
        if (u.inside) waiting = true; else down.push(u);
      }
      if (waiting) continue;
      arrivals.splice(k, 1);
      for (const u of down) {
        if (a.then === 'hunt') hunters.add(u.id);
        else if (a.then === 'guard') { u.order = { type: 'guard', x: u.tx, y: u.ty }; posts.set(u.id, { kind: 'guard', post: { x: u.tx, y: u.ty }, house: u.house }); }
      }
      if (a.announce && down.length) {
        world.events.push('eva', { house: player, key: 'reinforcements', text: 'Reinforcements have arrived.', x: down[0].x, y: down[0].y });
        landed.push({ at: world.time, ids: down.map((u) => u.id), x: down[0].tx, y: down[0].ty });
      }
    }
  }

  /** Once the player's Starport market opens (sim/starport.js), it sells what the mission stocks and nothing else. */
  function stockStarport() {
    const h = world.houses.get(player), m = h && (h.starport ?? market(world, h));
    if (!m) return;
    stocked = true;
    const want = def.starport.stock;
    for (const t of Object.keys(m.stock)) {
      if (Object.hasOwn(want, t)) m.stock[t] = Math.max(0, Math.floor(want[t]));
      else { delete m.stock[t]; delete m.price[t]; }
    }
  }

  /** Hunters, ambushes and posts, once a second. */
  function standingOrders() {
    for (const id of ambushers) {
      const u = world.units.get(id);
      if (!u) { ambushers.delete(id); continue; }
      if (u.hp < u.maxHp || enemyInSight(u)) { ambushers.delete(id); posts.delete(id); u.garrison = false; hunters.add(id); }   // sprung
    }
    for (const id of hunters) {
      const u = world.units.get(id);
      if (!u) { hunters.delete(id); continue; }
      if (u.inside || u.target || (u.order.type !== 'idle' && u.order.type !== 'guard')) continue;
      const t = nearestEnemyTarget(world, u.house, u.x, u.y);
      if (t) world.issue(u.house, { type: 'attackMove', ids: [u.id], x: t.x, y: t.y });
    }
    for (const [id, o] of posts) {
      const u = world.units.get(id);
      if (!u || u.house !== o.house) { posts.delete(id); continue; }   // lost, or turned by gas
      if (u.order.type !== 'idle' || u.target || u.inside) continue;
      u.order = { type: 'guard', x: o.post.x, y: o.post.y, ...guardOf(o.kind) };   // back to the post (sim/combat.js resume)
    }
  }

  /** An enemy on the ground within the ambush's sight, or near enough that its gun would reach on a guard's look-out. */
  function enemyInSight(u) {
    const r = Math.max(unitSight(u.type.sight), (u.type.range ?? 0) + GUARD_RADIUS) + 0.5;
    for (const o of world.units.values()) {
      if (!o.isGround || o.inside || !world.houses.has(o.house) || !hostile(world, o.house, u.house)) continue;
      if (Math.abs(o.x - u.x) <= r && Math.abs(o.y - u.y) <= r && Math.hypot(o.x - u.x, o.y - u.y) <= r) return true;
    }
    return false;
  }

  function progress() {
    const left = kind === 'quota' ? null : enemyBase();
    const quotaMet = kind !== 'destroy' && credits() >= quota;
    const destroyed = kind !== 'quota' && left === 0;
    return { credits: credits(), quota, left, met: quotaMet || destroyed };
  }

  function end(won) {
    if (world.outcome) return;
    const standing = enemies.filter((id) => baseOf(id) > 0);
    if (won) finishGame(world, { winner: player, standing: [player], lost: enemies });
    else finishGame(world, { winner: standing[0] ?? enemies[0] ?? null, standing, lost: [player] });
    final = scoreNow();
  }

  /** C2 score inputs as they stand now. */
  function scoreNow() {
    const seconds = Math.round(world.outcome?.seconds ?? world.time);
    let survivingValue = 0;
    for (const s of world.structures.values()) if (s.house === player && !s.type.isWall && !s.type.isConcrete) survivingValue += worth(s.type);
    return { minutes: Math.floor(seconds / 60) + 1, credits: credits(), survivingValue, killedValue: tally.killedValue, lostValue: tally.lostValue };
  }

  const title = def.title || (kind === 'quota' ? `Harvest ${quota} credits` : kind === 'quotaOrDestroy' ? `Harvest ${quota} credits or destroy the enemy base` : 'Destroy the enemy base');

  const mission = {
    def, kind, quota, minSeconds, title,
    update(w = world) {
      if (w !== world) return;
      if (world.outcome && !final) final = scoreNow();   // ended some other way (a debug win): frozen from here
      if (baseOf(player) > 0) hadBase = true;
      while (next < schedule.length && world.time >= schedule[next].at) launch(schedule[next++]);
      if (arrivals.length) land();
      if (!stocked) stockStarport();
      if (calls++ % ORDERS_EVERY === 0) standingOrders();
      if (world.outcome || world.time < minSeconds) return;
      if (hadBase && baseOf(player) === 0) { end(false); return; }
      if (progress().met) end(true);
    },
    /** The HUD's objective line: what to do and how far along it is. */
    hudLine() {
      if (world.outcome) return `${title} · ${world.outcome.winner === player ? 'Mission accomplished' : 'Mission failed'}`;
      const p = progress();
      const parts = [title];
      if (kind !== 'destroy') parts.push(`${Math.min(p.credits, 999999)} / ${quota} credits`);
      if (kind !== 'quota') parts.push(`${p.left} enemy ${p.left === 1 ? 'building' : 'buildings'} left`);
      return parts.join(' · ');
    },
    /** C2 score inputs: the original's per-mission score is worked out from these (campaign stream, C11); once the
     *  mission is over, as they stood at its end. */
    score() { return { ...(final ?? scoreNow()) }; },
    /** The message the battle hands the menu shell when it is over (C2). */
    result() {
      const o = world.outcome;
      return { dune: 'missionEnd', house: player, mission: def.mission ?? null, won: !!o && o.winner === player, draw: !!o?.draw,
        seconds: Math.round(o?.seconds ?? world.time), stats: endStats(world, player), score: mission.score() };
    },
    nextReinforcement() {
      for (let k = next; k < schedule.length; k++) if (schedule[k].house === player) return { at: schedule[k].at, units: [...schedule[k].units], via: schedule[k].via ?? 'carryall' };
      return null;
    },
    debug() {
      const p = progress(), o = world.outcome;
      return { id: def.id ?? null, house: player, mission: def.mission ?? null, title, objective: { kind, quota, text: mission.hudLine() }, time: world.time, minSeconds,
        progress: p, hadBase, nextReinforcement: mission.nextReinforcement(), pending: schedule.length - next, landing: arrivals.length, arrived: landed.map((a) => ({ ...a })),
        hunters: hunters.size, ambushes: ambushers.size, posts: posts.size,
        outcome: o ? { won: o.winner === player, winner: o.winner, seconds: o.seconds } : null, score: mission.score() };
    },
  };
  return mission;
}
