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
};

export function makeCursorSetter(el) {
  let current = null;
  return (name) => {
    if (name === current) return;
    current = name;
    el.style.cursor = CURSORS[name] ?? 'default';
  };
}
