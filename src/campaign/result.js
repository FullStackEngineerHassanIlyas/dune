// A mission's result as the battle posts it to the menu shell (contract C2: { dune: 'missionEnd', house, mission,
// won, draw, seconds, stats: endStats(world, house), score: { minutes, credits, survivingValue, killedValue,
// lostValue } }), read defensively since a message can carry anything, and turned into what the results screens
// show: the score and rank (C11) and the three You-versus-Enemy rows of the Sega score screen (research.md §5).
import { missionScore, rankFor, minutesOf } from './score.js';

export const CAMPAIGN_HOUSES = ['atreides', 'ordos', 'harkonnen'];
export const MISSIONS = 9;
/** The score screen's rows and the end-statistics rows (src/sim/victory.js endStats) they come from. */
export const SCORE_ROWS = [['spice', 'Spice harvested'], ['units', 'Units destroyed'], ['structures', 'Buildings destroyed']];

const count = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
export const missionNumber = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= MISSIONS ? n : null; };

/** The result in a missionEnd message, or null when it names no campaign house and mission. */
export function readResult(message) {
  if (!message || typeof message !== 'object') return null;
  const house = CAMPAIGN_HOUSES.includes(message.house) ? message.house : null;
  const mission = missionNumber(message.mission);
  if (!house || !mission) return null;
  const seconds = count(message.seconds ?? message.stats?.seconds);
  const s = message.score && typeof message.score === 'object' ? message.score : {};
  const fields = { minutes: s.minutes ?? minutesOf(seconds), credits: count(s.credits), survivingValue: count(s.survivingValue), killedValue: count(s.killedValue), lostValue: count(s.lostValue) };
  const listed = Array.isArray(message.stats?.rows) ? message.stats.rows : [];
  const rows = Object.fromEntries(SCORE_ROWS.map(([key, label]) => {
    const row = listed.find((r) => r?.label === label);
    return [key, [count(row?.you), count(row?.enemy)]];
  }));
  const score = missionScore(fields, mission);
  return { house, mission, won: message.won === true, draw: message.draw === true, seconds, ...fields, minutes: count(fields.minutes), score, rank: rankFor(score), rows };
}

/** A believable result for development shots of the results screens (?screen=campaign-results&house=…&mission=…). */
export function sampleResult(house, mission, { won = true } = {}) {
  const n = missionNumber(mission) ?? 1;
  const seconds = (8 + n * 5) * 60 + 25;
  return readResult({ dune: 'missionEnd', house, mission: n, won, seconds,
    stats: { rows: [{ label: 'Spice harvested', you: 900 + n * 3400, enemy: 400 + n * 1700 }, { label: 'Units destroyed', you: 6 + n * 14, enemy: 3 + n * 2 },
      { label: 'Buildings destroyed', you: won ? 2 + n * 3 : n, enemy: won ? Math.floor(n / 4) : 4 + n }] },
    score: { minutes: minutesOf(seconds), credits: 600 + n * 150, survivingValue: won ? 10 + n * 14 : 0, killedValue: won ? 4 + n * 9 : n, lostValue: won ? n : 20 } });
}
