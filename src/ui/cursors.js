// SVG cursors (spec §5.6), applied to the game canvas.
const svg = (body, hx, hy) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`)}") ${hx} ${hy}, auto`;

const BRACKETS = 'M4 11V4h7M21 4h7v7M28 21v7h-7M11 28H4v-7';
export const CURSORS = {
  default: 'default',
  select: svg(`<path d='${BRACKETS}' fill='none' stroke='#000' stroke-width='4' opacity='.5'/><path d='${BRACKETS}' fill='none' stroke='#fff' stroke-width='2'/>`, 16, 16),
  move: svg(`<path d='M16 2l5 6h-3v6h6v-3l6 5-6 5v-3h-6v6h3l-5 6-5-6h3v-6H8v3l-6-5 6-5v3h6V8h-3z' fill='#7dff7a' stroke='#000' stroke-width='1.2'/>`, 16, 16),
  noMove: svg(`<circle cx='16' cy='16' r='11' fill='none' stroke='#000' stroke-width='5' opacity='.5'/><circle cx='16' cy='16' r='11' fill='none' stroke='#ff4a3a' stroke-width='3'/><path d='M8 24L24 8' stroke='#ff4a3a' stroke-width='3'/>`, 16, 16),
  attack: svg(`<g fill='none' stroke='#ff3b30' stroke-width='2.2'><circle cx='16' cy='16' r='9'/><path d='M16 2v8M16 22v8M2 16h8M22 16h8'/></g>`, 16, 16),
  deploy: svg(`<path d='M6 26h20v-4H6zM9 22l7-12 7 12z' fill='#ffd24a' stroke='#000' stroke-width='1'/>`, 16, 16),
  noDeploy: svg(`<path d='M6 26h20v-4H6zM9 22l7-12 7 12z' fill='#888' stroke='#000' stroke-width='1'/><path d='M6 6L26 26' stroke='#ff4a3a' stroke-width='3'/>`, 16, 16),
  sell: svg(`<circle cx='16' cy='16' r='12' fill='#1d1408' stroke='#ffd24a' stroke-width='2.5'/><path d='M20 11.5c-.9-1.4-2.5-2-4.2-2-2.3 0-4 1.2-4 3 0 4.4 8.6 2.3 8.6 6.8 0 2-1.8 3.3-4.5 3.3-2 0-3.8-.8-4.7-2.2M16 7v18' fill='none' stroke='#ffd24a' stroke-width='2.2' stroke-linecap='round'/>`, 16, 16),
  noSell: svg(`<circle cx='16' cy='16' r='12' fill='#1d1408' stroke='#8a8a8a' stroke-width='2.5'/><path d='M20 11.5c-.9-1.4-2.5-2-4.2-2-2.3 0-4 1.2-4 3 0 4.4 8.6 2.3 8.6 6.8 0 2-1.8 3.3-4.5 3.3-2 0-3.8-.8-4.7-2.2M16 7v18' fill='none' stroke='#8a8a8a' stroke-width='2.2' stroke-linecap='round'/><path d='M7 25L25 7' stroke='#ff4a3a' stroke-width='3'/>`, 16, 16),
  repair: svg(`<path d='M21 4a6 6 0 0 0-5.6 8.1L5 22.5 9.5 27l10.4-10.4A6 6 0 0 0 28 11l-3.6 3.6-3.4-.6-.6-3.4L24 7a6 6 0 0 0-3-3z' fill='#7dff7a' stroke='#000' stroke-width='1.2'/>`, 8, 24),
  noRepair: svg(`<path d='M21 4a6 6 0 0 0-5.6 8.1L5 22.5 9.5 27l10.4-10.4A6 6 0 0 0 28 11l-3.6 3.6-3.4-.6-.6-3.4L24 7a6 6 0 0 0-3-3z' fill='#8a8a8a' stroke='#000' stroke-width='1.2'/><path d='M6 6L26 26' stroke='#ff4a3a' stroke-width='3'/>`, 8, 24),
};

export function makeCursorSetter(el) {
  let current = null;
  return (name) => {
    if (name === current) return;
    current = name;
    el.style.cursor = CURSORS[name] ?? 'default';
  };
}
