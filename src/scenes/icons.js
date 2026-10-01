// Icon sheet: every unit and structure icon of one house, as the sidebar will show them.
import { Renderer3D } from '../render/renderer.js';
import { IconFactory } from '../render/icons.js';
import { UNIT_MODEL, STRUCTURE_MODEL } from '../render/models/index.js';
import { readParams } from '../core/params.js';

export async function start({ search }) {
  const params = readParams(search);
  const house = params.str('house', 'atreides');
  const canvas = document.getElementById('gl');
  const r3d = new Renderer3D(canvas, 'low');
  canvas.style.display = 'none';
  const icons = new IconFactory(r3d.renderer, { environment: r3d.scene.environment });
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:absolute;inset:0;padding:16px;display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;overflow:auto;background:#140e08;pointer-events:auto';
  for (const typeId of [...Object.keys(STRUCTURE_MODEL), ...Object.keys(UNIT_MODEL), 'upgrade:constructionYard:2', 'upgrade:heavyFactory:1', 'upgrade:heavyFactory:4', 'starport:quad', 'starport:carryall', 'palace:deathHand', 'palace:fremen', 'palace:saboteur']) {
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;text-align:center;font:11px sans-serif;color:#f2d7a0';
    const img = new Image();
    img.src = icons.forItem(typeId, house);
    img.style.cssText = 'display:block;width:128px;height:96px;border:2px solid #b8893a';
    fig.append(img, typeId);
    sheet.appendChild(fig);
  }
  document.getElementById('ui').appendChild(sheet);
  window.__dune = { ready: true, scene: 'icons' };
}
