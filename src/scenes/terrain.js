// Terrain showcase: a generated map viewed from above the first start position.
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { generateMap } from '../sim/mapgen.js';
import { readParams } from '../core/params.js';

export async function start({ search }) {
  const params = readParams(search);
  const size = params.num('size', 64);
  const { map, starts } = generateMap({ w: size, h: size, seed: params.num('seed', 7), players: 2 });
  const r3d = new Renderer3D(document.getElementById('gl'), params.str('quality', 'medium'));
  const hf = new Heightfield(map, { sub: r3d.quality.terrainSub, seed: map.seed });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const s = starts[0];
  const cx = params.num('x', s.x + 6), cz = params.num('z', s.y + 6), dist = params.num('dist', 30);
  r3d.camera.position.set(cx, hf.heightAt(cx, cz) + dist * 0.82, cz + dist * 0.57);
  r3d.camera.lookAt(cx, hf.heightAt(cx, cz), cz);
  r3d.follow(cx, cz, dist * 1.1);
  const frame = (now) => { terrain.update(now); r3d.render(); requestAnimationFrame(frame); };
  requestAnimationFrame((now) => { frame(now); window.__dune = { ready: true, scene: 'terrain', map }; });
}
