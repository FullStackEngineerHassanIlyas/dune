// Helpers for writing drum lanes and repeated lines in the song files (score.js has the format).
/** `s` n times over, separated so a reader can still see the bars. */
export const rep = (s, n) => Array.from({ length: n }, () => s).join(' ');
/** Bars joined into one line. */
export const bars = (...parts) => parts.join(' | ');
/** n bars of silence in a drum lane with `steps` steps a bar. */
export const rest = (n, steps = 16) => rep('.'.repeat(steps), n);
