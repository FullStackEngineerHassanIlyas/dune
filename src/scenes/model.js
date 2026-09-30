// Model inspection: one unit or structure model from several sides (or in each house's colours) on
// flat rock, with its triangle count, for close visual review against docs/research/refs.
// ?scene=model&id=windtrap [&views=1-4 | &houses=1] [&dist= &pitch= &yaw= (degrees)] [&lift=0.9] [&set=warn:1.2,door:0.4]
// Structures stand as built (south face toward the camera) in the first view and turned round in the second.
import * as THREE from 'three';
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { InstancedModel } from '../render/models/instancer.js';
import { modelDef, STRUCTURE_MODEL } from '../render/models/index.js';
import { poseMatrix } from '../render/views/pose.js';
import { GameMap } from '../sim/map.js';
import { G } from '../data/terrain.js';
import { HOUSES } from '../data/houses.js';
import { readParams } from '../core/params.js';

// Units: toward the camera (three-quarter), east, away (three-quarter), west. Structures: as built
// (south face to the camera), then turned round, then from each side.
const UNIT_HEADINGS = [Math.PI / 2 + 0.6, 0, -Math.PI / 2 - 0.6, Math.PI];
const STRUCTURE_HEADINGS = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
const STRUCTURES = new Set([...Object.values(STRUCTURE_MODEL), 'wallArm']);

export async function start({ search }) {
  const params = readParams(search);
  const id = params.str('id', 'combatTank');
  const def = modelDef(id);
  const houses = params.bool('houses') ? ['atreides', 'harkonnen', 'ordos'] : [params.str('house', 'atreides')];
  const views = houses.length > 1 ? houses.length : Math.max(1, Math.min(4, params.num('views', 4)));
  const gap = Math.max(1.3, def.radius * 2.3);
  const map = new GameMap(Math.ceil(gap * views + 8), Math.ceil(gap + 8));
  map.ground.fill(G.ROCK);
  const r3d = new Renderer3D(document.getElementById('gl'), params.str('quality', 'high'));
  const hf = new Heightfield(map, { sub: 2, seed: 1 });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const model = new InstancedModel(def, r3d.scene);
  const cx = map.w / 2, cz = map.h / 2, lift = params.num('lift', 0);
  const HEADINGS = STRUCTURES.has(id) ? STRUCTURE_HEADINGS : UNIT_HEADINGS;
  for (let k = 0; k < views; k++) {
    const h = model.add();
    const x = cx + (k - (views - 1) / 2) * gap;
    poseMatrix(h.matrix, x, hf.heightAt(x, cz) + lift, cz, houses.length > 1 ? HEADINGS[0] : HEADINGS[k]);
    h.color.set(HOUSES[houses[houses.length > 1 ? k : 0]]?.color ?? 0xffffff);
    Object.assign(h.params, { turret: -0.5, crane: 0.8, flap: 0.35, flapR: -0.35, claws: 0.5, clawsB: -0.5, door: 0.2, padLights: 1, flag: 0.2 });
    for (const pair of params.str('set', '').split(',').filter(Boolean)) { const [k, v] = pair.split(':'); h.params[k] = Number(v); }
  }
  model.update();
  let tris = 0;
  for (const p of def.parts) tris += p.geometry.attributes.position.count / 3;
  const label = document.createElement('div');
  label.style.cssText = 'position:fixed;left:12px;top:10px;color:#fff;font:14px monospace;text-shadow:0 1px 2px #000';
  label.textContent = `${id} — ${def.parts.length} parts, ${Math.round(tris)} triangles, radius ${def.radius}`;
  document.getElementById('ui').appendChild(label);
  const rig = new CameraRig(r3d.camera, map.w, map.h);
  rig.goalDistance = rig.distance = params.num('dist', gap * views * 0.55 + 1);
  rig.goalPitch = rig.pitch = THREE.MathUtils.degToRad(params.num('pitch', 42));
  rig.goalYaw = rig.yaw = THREE.MathUtils.degToRad(params.num('yaw', 0));
  rig.lookAt(params.num('x', cx), params.num('z', cz), true);
  rig.update(1, (x, z) => hf.heightAt(x, z));
  r3d.follow(rig.target.x, rig.target.z, 16);
  const frame = (now) => {
    for (const h of model.handles.slice(0, model.count)) { h.params.fan = now * 0.004; h.params.dish = now * 0.0012; }
    model.update();
    terrain.update(now);
    r3d.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((now) => { frame(now); window.__dune = { ready: true, scene: 'model' }; });
}
