// Terrain showcase: a generated map with the RTS camera (edge scroll, arrows, wheel, middle drag).
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { CameraControl } from '../input/camera-control.js';
import { generateMap } from '../sim/mapgen.js';
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const size = params.num('size', 64);
  const { map, starts } = generateMap({ w: size, h: size, seed: params.num('seed', 7), players: 2 });
  const canvas = document.getElementById('gl');
  const r3d = new Renderer3D(canvas, settings.quality);
  const hf = new Heightfield(map, { sub: r3d.quality.terrainSub, seed: map.seed });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const rig = new CameraRig(r3d.camera, map.w, map.h);
  rig.goalDistance = rig.distance = params.num('dist', 30);
  rig.lookAt(params.num('x', starts[0].x + 6), params.num('z', starts[0].y + 6), true);
  const control = new CameraControl(rig, canvas, settings);
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    control.update(dt);
    rig.update(dt, (x, z) => hf.heightAt(x, z));
    r3d.follow(rig.target.x, rig.target.z, rig.distance * 1.1);
    terrain.update(now);
    r3d.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((now) => {
    last = now;
    rig.update(1, (x, z) => hf.heightAt(x, z));
    frame(now);
    window.__dune = { ready: true, scene: 'terrain', map, rig };
  });
}
