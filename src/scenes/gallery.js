// Model gallery: every Plan 1a model in one house's colours on flat rock, for visual review
// against docs/research/refs (Mentat info cards).
import * as THREE from 'three';
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { InstancedModel } from '../render/models/instancer.js';
import { modelDef } from '../render/models/index.js';
import { poseMatrix } from '../render/views/pose.js';
import { GameMap } from '../sim/map.js';
import { G } from '../data/terrain.js';
import { HOUSES } from '../data/houses.js';
import { readParams } from '../core/params.js';

const ROWS = [
  ['combatTank', 'siegeTank', 'missileTank', 'deviator', 'sonicTank', 'devastator'],
  ['harvester', 'mcv', 'trike', 'quad', 'soldier', 'trooper'],
];

export async function start({ search }) {
  const params = readParams(search);
  const house = HOUSES[params.str('house', 'atreides')] ?? HOUSES.atreides;
  const map = new GameMap(18, 10);
  map.ground.fill(G.ROCK);
  const r3d = new Renderer3D(document.getElementById('gl'), params.str('quality', 'high'));
  const hf = new Heightfield(map, { sub: 2, seed: 1 });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const color = new THREE.Color(house.color);
  const models = new Map();
  const place = (id, x, z, heading, count = 1) => {
    if (!models.has(id)) models.set(id, new InstancedModel(modelDef(id), r3d.scene));
    const model = models.get(id);
    for (let k = 0; k < count; k++) {
      const h = model.add();
      const ox = count > 1 ? [0.1, -0.08, -0.08][k] : 0, oz = count > 1 ? [0, 0.11, -0.11][k] : 0;
      poseMatrix(h.matrix, x + ox, hf.heightAt(x, z), z + oz, heading);
      h.color.copy(color);
      h.params.turret = -0.5;
      h.params.crane = 0.8;
    }
  };
  const heading = Math.PI / 2 + 0.55;   // three-quarter view toward the camera
  ROWS.forEach((row, r) => row.forEach((id, c) => place(id, 2.2 + c * 1.45, 3.3 + r * 1.6, heading, id === 'soldier' || id === 'trooper' ? 3 : 1)));
  place('constructionYard', 12.6, 4.4, 0);
  for (const m of models.values()) m.update();
  const rig = new CameraRig(r3d.camera, map.w, map.h);
  rig.goalDistance = rig.distance = params.num('dist', 9.5);
  rig.goalPitch = rig.pitch = THREE.MathUtils.degToRad(params.num('pitch', 40));
  rig.lookAt(params.num('x', 7.6), params.num('z', 4.6), true);
  rig.update(1, (x, z) => hf.heightAt(x, z));
  r3d.follow(rig.target.x, rig.target.z, 14);
  const frame = (now) => { terrain.update(now); r3d.render(); requestAnimationFrame(frame); };
  requestAnimationFrame((now) => { frame(now); window.__dune = { ready: true, scene: 'gallery' }; });
}
