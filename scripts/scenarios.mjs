// Scenes captured by `npm run smoke`. Each scene sets window.__dune.ready when its first frame is drawn.
export const SCENARIOS = {
  boot: { query: 'scene=boot' },
  'render-test': { query: 'scene=render-test' },
  'render-test-low': { query: 'scene=render-test&quality=low' },
  'render-test-high': { query: 'scene=render-test&quality=high' },
};
