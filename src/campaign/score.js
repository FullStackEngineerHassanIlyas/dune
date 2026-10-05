// A mission's score and rank (spec §7, contract C11; research.md §5). The score follows the original's code: the
// enemy structures destroyed, less the player's own lost, plus what still stands, a point per hundred credits in
// store and a bonus for finishing inside 45 minutes a mission; never below zero. Units destroyed and spice
// harvested are shown on the score screen but do not score. The Sega release has nine ranks; the thresholds up to
// Squad Leader are the PC ones, the last three estimated from scores seen on a Sega run.

export const RANKS = [
  ['Sand Snake', 0], ['Desert Mongoose', 50], ['Sand Warrior', 100], ['Dune Trooper', 150], ['Squad Leader', 200],
  ['Outpost Commander', 250], ['Base Commander', 300], ['Scourge of Dune', 375], ['Ruler of Arrakis', 420],
];

const whole = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

/** Minutes played as the original counts them: every minute begun. */
export function minutesOf(seconds) { return whole(seconds / 60) + 1; }

/** The score of mission `mission` from C2's score fields { minutes, credits, survivingValue, killedValue, lostValue }. */
export function missionScore({ minutes, credits, survivingValue, killedValue, lostValue } = {}, mission = 1) {
  const m = Number(minutes);
  const bonus = Number.isFinite(m) && m >= 0 ? Math.max(0, 45 * mission - Math.floor(m)) : 0;
  return Math.max(0, whole(killedValue) - whole(lostValue) + whole(survivingValue) + Math.floor(whole(credits) / 100) + bonus);
}

/** The rank a score earns. */
export function rankFor(score) {
  let rank = RANKS[0][0];
  for (const [name, min] of RANKS) if (score >= min) rank = name;
  return rank;
}

/** The score screen's TIME: hours and minutes of play, h:mm. */
export function formatTime(seconds) {
  const m = whole(seconds / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
