// Scenes captured by `npm run smoke`. Each scene sets window.__dune.ready when its first frame is drawn.
export const SCENARIOS = {
  boot: { query: 'scene=boot' },
  'render-test': { query: 'scene=render-test' },
  'render-test-low': { query: 'scene=render-test&quality=low' },
  'render-test-high': { query: 'scene=render-test&quality=high' },
  terrain: { query: 'scene=terrain&seed=7' },
  'terrain-overview': { query: 'scene=terrain&seed=7&dist=70&x=32&z=36' },
  'terrain-seed-21': { query: 'scene=terrain&seed=21' },
  'gallery-atreides': { query: 'scene=gallery&house=atreides' },
  'gallery-harkonnen': { query: 'scene=gallery&house=harkonnen' },
  'gallery-ordos': { query: 'scene=gallery&house=ordos' },
  'gallery-closeup': { query: 'scene=gallery&house=atreides&dist=4.5&x=5&z=3.6&pitch=30' },
  'skirmish-atreides': { query: 'scene=skirmish&seed=11&house=atreides' },
  'skirmish-harkonnen': { query: 'scene=skirmish&seed=5&house=harkonnen' },
  'skirmish-ordos-close': { query: 'scene=skirmish&seed=8&house=ordos&dist=12' },
  'skirmish-wide': { query: 'scene=skirmish&seed=11&house=atreides&dist=55' },
  stress: { query: 'scene=stress&fps=1&quality=low', settleMs: 4000 },
};
