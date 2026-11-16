// Reproducible AI closeout: node scripts/measure-ai.mjs --suite=matrix --jobs=8 --minutes=60 > results.jsonl
import { fork, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setupSkirmish } from '../src/game/setup.js';
import { setupMission } from '../src/game/mission-setup.js';
import { missionDef } from '../src/data/campaign.js';
import { checkInvariants } from '../src/sim/invariants.js';

const houses = ['atreides', 'harkonnen', 'ordos', 'sardaukar'];
const file = fileURLToPath(import.meta.url);

/** Fixed before tuning: twelve default seeds plus coverage across size, house count and difficulty. */
export function matrix() {
  const games = Array.from({ length: 12 }, (_, i) => ({ id: `default-${i + 1}`, group: 'default', seed: i + 1, size: 64, houses: 4, difficulty: 'normal' }));
  for (const size of [64, 96, 128]) for (const count of [2, 3, 4]) for (const difficulty of ['easy', 'normal', 'hard']) {
    games.push({ id: `matrix-${size}-${count}-${difficulty}`, group: 'matrix', size, houses: count, difficulty, seed: games.length + 1 });
  }
  games.push({ id: 'small-2-easy', group: 'matrix', size: 32, houses: 2, difficulty: 'easy', seed: 40 });
  return games;
}

/** Null end times are censored observations, never invented wins at the time limit. */
export function summarize(results) {
  const counts = { under20: 0, inside20to40: 0, over40: 0, censored: 0 };
  for (const r of results) counts[r.endSeconds === null ? 'censored' : r.endSeconds < 1200 ? 'under20' : r.endSeconds <= 2400 ? 'inside20to40' : 'over40']++;
  return counts;
}

/** Hash the exact snapshot shape used by tests/mission-setup.test.mjs, not a new simulation contract. */
function stateHash(world) {
  return createHash('sha256').update(JSON.stringify({
    units: [...world.units.values()].map(u => [u.id, u.typeId, u.house, Math.round(u.x * 100), Math.round(u.y * 100), u.order.type, u.hp]),
    structures: [...world.structures.values()].map(s => [s.id, s.typeId, s.house, s.x, s.y, s.hp]),
    credits: [...world.houses.values()].map(h => [h.id, Math.round(h.credits)]), tick: world.tick,
  })).digest('hex');
}

/** Run unmodified world.step at 20 Hz; collect events without changing commands, AI or victory rules. */
export function runGame(settings, minutes = 60) {
  const options = { seed: settings.seed, size: settings.size, difficulty: settings.difficulty, house: 'atreides',
    opponents: houses.slice(1, settings.houses).map(house => ({ house, difficulty: settings.difficulty })), aiPlayer: true, allied: settings.allied ?? false };
  const { world } = settings.mission ? setupMission(missionDef(settings.mission.house, settings.mission.number)) : setupSkirmish(options);
  const waves = [], kills = {}, checkpoints = [], invariantFailures = [];
  let moveFailed = 0;
  const started = performance.now();
  for (let n = 0, limit = Math.round(minutes * 60 * 20); n < limit && !world.outcome; n++) {
    world.step();
    for (const e of world.events.drain()) {
      if (e.type === 'aiAttack') waves.push({ seconds: world.time, house: e.house, target: e.target, size: e.size });
      if (e.type === 'moveFailed') moveFailed++;
      if ((e.type === 'unitDestroyed' || e.type === 'structureDestroyed') && e.by && e.by !== e.house) {
        const key = `${e.by}>${e.house}:${e.type}`; kills[key] = (kills[key] ?? 0) + 1;
      }
    }
    if (world.tick % 1200 === 0) checkpoints.push({ seconds: world.time, hash: stateHash(world) });
    if (world.tick % 6000 === 0) invariantFailures.push(...checkInvariants(world).map(message => ({ tick: world.tick, message })));
  }
  return { settings, observedSeconds: world.time, endSeconds: world.outcome?.seconds ?? null,
    winner: world.outcome?.winner ?? null, draw: world.outcome?.draw ?? false,
    eliminations: Object.fromEntries([...world.houses.values()].map(h => [h.id, h.defeatedAt ?? null])),
    stateHash: stateHash(world), checkpoints, waves, kills, moveFailed, invariantFailures,
    stats: Object.fromEntries([...world.houses.values()].map(h => [h.id, h.stats])), wallSeconds: (performance.now() - started) / 1000 };
}

/** Isolate games in child processes; bounded parallelism and signal cleanup avoid orphaned simulations. */
async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
  if (args.case) { const result = runGame(JSON.parse(args.case), Number(args.minutes ?? 60)); process.send(result); return; }
  const jobs = Number(args.jobs ?? 8), minutes = Number(args.minutes ?? 60);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 8 || !Number.isFinite(minutes) || minutes <= 0) throw Error('jobs must be 1..8 and minutes positive');
  let games = matrix();
  if (args.suite === 'defaults') games = games.filter(g => g.group === 'default');
  if (args.suite === 'pilot') games = games.slice(0, 1);
  if (args.suite === 'guards') games = [
    ...[1, 7, 13].map(seed => ({ id: `two-${seed}`, seed, size: 64, houses: 2, difficulty: 'normal' })),
    ...[['atreides', 3], ['harkonnen', 6], ['ordos', 9]].map(([house, number]) => ({ id: `${house}-${number}`, mission: { house, number } })),
    { id: 'allied', seed: 7, size: 64, houses: 4, difficulty: 'normal', allied: true },
  ];
  if (args.only) games = games.filter(g => args.only.split(',').includes(g.id));
  const revision = execFileSync('/usr/bin/git', ['-C', fileURLToPath(new URL('..', import.meta.url)), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const aiSha256 = createHash('sha256').update(readFileSync(new URL('../src/sim/ai.js', import.meta.url))).digest('hex');
  const active = new Set(), results = [];
  const stop = () => { for (const child of active) child.kill('SIGTERM'); };
  const interrupt = () => { stop(); process.exitCode = 130; };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(jobs, games.length) }, async () => {
      while (next < games.length && !process.exitCode) {
        const settings = games[next++];
        const result = await new Promise((resolve, reject) => {
          const child = fork(file, [`--case=${JSON.stringify(settings)}`, `--minutes=${minutes}`], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
          active.add(child); let value;
          child.on('message', data => { value = data; });
          child.on('error', reject);
          child.on('exit', code => { active.delete(child); code === 0 && value ? resolve(value) : reject(Error(`${settings.id} child exited ${code}`)); });
        });
        results.push(result); console.log(JSON.stringify({ revision, aiSha256, ...result }));
        console.error(`${settings.id}: end=${result.endSeconds === null ? 'censored' : (result.endSeconds / 60).toFixed(2)} min; first=${Math.min(...Object.values(result.eliminations).filter(t => t !== null)) / 60}; ${result.wallSeconds.toFixed(1)}s wall`);
      }
    }));
    console.error(JSON.stringify({ summary: summarize(results), games: results.length }));
  } finally { stop(); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch(error => { console.error(error); process.exitCode = 1; });
