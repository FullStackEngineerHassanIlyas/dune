// Helpers for writing drum lanes and repeated lines in the song files (score.js has the format).
/** `s` n times over, separated so a reader can still see the bars. */
export const rep = (s, n) => Array.from({ length: n }, () => s).join(' ');
/** Bars joined into one line. */
export const bars = (...parts) => parts.join(' | ');
/** n bars of silence in a drum lane with `steps` steps a bar. */
export const rest = (n, steps = 16) => rep('.'.repeat(steps), n);
/** A melodic line with every note (or chord) set to velocity n tenths: `at('d2 . a1*2', 5)` → 'd2:5 . a1:5*2'. */
export const at = (line, n) => line.replace(/(^|\s)(~?[a-g][#b]?\d(?:\+[a-g][#b]?\d)*)([!?]|:\d+)?(?=\*|\s|$)/g, `$1$2:${n}`);
/** A melodic line moved by `semis` semitones, accents and lengths kept: `shift('d4 f#4*2', 12)` → 'd5 f#5*2'. */
export function shift(line, semis) {
  const NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b'], LETTER = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  return line.replace(/([a-g])([#b]?)(\d)/g, (_, l, acc, o) => {
    const m = 12 * (Number(o) + 1) + LETTER[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + semis;
    return NAMES[m % 12] + (Math.floor(m / 12) - 1);
  });
}
