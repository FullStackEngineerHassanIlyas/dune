// Structure gallery: every structure built so far in one house's colours on concrete, with animations
// running, for visual review against docs/research/refs/pc-structure-*.
import * as THREE from 'three';
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { InstancedModel } from '../render/models/instancer.js';
import { modelDef, STRUCTURE_MODEL } from '../render/models/index.js';
import { GameMap } from '../sim/map.js';
import { G } from '../data/terrain.js';
import { STRUCTURES } from '../data/structures.js';
import { HOUSES } from '../data/houses.js';
import { readParams } from '../core/params.js';

const LAYOUT = [
  ['constructionYard', 1, 1], ['windtrap', 4, 1], ['refinery', 7, 1], ['silo', 11, 1], ['outpost', 14, 1], ['repair', 17, 1],
  ['barracks', 1, 5], ['wor', 4, 5], ['lightFactory', 7, 5], ['heavyFactory', 10, 5], ['turret', 14, 5], ['rocketTurret', 16, 5], ['hiTech', 18, 5], ['starport', 8, 9], ['ix', 12, 9], ['palace', 16, 9],
];

export async function start({ search }) {
  const params = readParams(search);
  const house = HOUSES[params.str('house', 'atreides')] ?? HOUSES.atreides;
  const map = new GameMap(22, 13);
  map.ground.fill(G.ROCK);
  map.concrete.fill(1);
  map.concreteRevision++;
  const r3d = new Renderer3D(document.getElementById('gl'), params.str('quality', 'high'));
  const hf = new Heightfield(map, { sub: 2, seed: 1 });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const models = new Map();
  const handles = [];
  for (const [typeId, x, y] of LAYOUT) {
    const s = STRUCTURES[typeId];
    const id = STRUCTURE_MODEL[typeId];
    if (!models.has(id)) models.set(id, new InstancedModel(modelDef(id), r3d.scene));
    const h = models.get(id).add();
    h.matrix.makeTranslation(x + s.w / 2, hf.heightAt(x + s.w / 2, y + s.h / 2), y + s.h / 2);
    h.color.set(house.color);
    h.params.turret = Math.PI / 2 - 0.6;
    handles.push(h);
  }
  const rig = new CameraRig(r3d.camera, map.w, map.h);
  rig.goalDistance = rig.distance = params.num('dist', 19);
  rig.goalPitch = rig.pitch = THREE.MathUtils.degToRad(params.num('pitch', 42));
  rig.lookAt(params.num('x', 11), params.num('z', 6.5), true);
  rig.update(1, (x, z) => hf.heightAt(x, z));
  r3d.follow(rig.target.x, rig.target.z, 16);
  const frame = (now) => {
    for (const h of handles) { h.params.fan = now * 0.004; h.params.dish = now * 0.0012; h.params.padLights = 1 + 0.25 * Math.sin(now * 0.006); h.params.flag = Math.sin(now * 0.002) * 0.3; h.params.crane = now * 0.00025; h.params.door = 0.2; h.params.arm = Math.sin(now * 0.0015) * 0.3; }
    for (const m of models.values()) m.update();
    terrain.update(now);
    r3d.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((now) => { frame(now); window.__dune = { ready: true, scene: 'structures' }; });
}
