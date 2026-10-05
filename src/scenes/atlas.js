// Dev scene: the territory map of Arrakis on its own (spec §5.8, contract C5), for inspection and screenshots.
// ?house= (atreides | harkonnen | ordos) ?step= missions won (0–9); ?zoom=<mission> dives onto that mission's region
// (?seconds=, default 7; ?hold=0..1 stops it that far along); ?conquer=1 floods in the land won at `step`;
// ?target= overrides the pulsing region (0: none); ?inset=left,right,top,bottom keeps those shares of the picture
// clear; ?still=1 forces reduced motion; ?gpu=1 times the GPU for debug(); ?quality= picks the preset.
// window.__dune: ready, atlas, debug(), show(), zoomTo(), conquer(), done (true once the zoom or conquest finished).
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { createAtlas } from '../render/atlas/index.js';

function readInset(params) {
  const v = params.str('inset')?.split(',').map(Number);
  return v?.length === 4 && v.every((x) => x >= 0 && x < 1) ? { left: v[0], right: v[1], top: v[2], bottom: v[3] } : null;
}

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides'), step = params.num('step', 0);
  document.getElementById('gl').style.display = 'none';
  const stage = document.createElement('div');
  stage.className = 'atlas-stage';
  document.getElementById('app').appendChild(stage);
  const atlas = createAtlas(stage, {
    quality: settings.quality,
    reducedMotion: params.raw.has('still') ? params.bool('still') : undefined,
    inset: readInset(params),
    measure: params.bool('gpu'),
  });
  const dune = (window.__dune = { ready: false, scene: 'atlas', atlas, debug: () => atlas.debug(), show: atlas.show, zoomTo: atlas.zoomTo, conquer: atlas.conquer, done: false });
  const finished = () => { dune.done = true; };
  if (params.bool('conquer')) atlas.conquer({ house, step }).then(finished);
  else atlas.show({ house, step, target: params.num('target') ?? undefined });
  const mission = params.num('zoom');
  if (mission) atlas.zoomTo({ house, mission, seconds: params.num('seconds', 7), hold: params.num('hold') ?? undefined }).then(finished);
  addEventListener('resize', () => atlas.resize());
  await atlas.ready;
  dune.ready = true;
}
