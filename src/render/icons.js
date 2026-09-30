// Sidebar and selection-panel icons rendered from the real 3D models (spec §5.6). Each model is
// framed from the front-left and above in its house colour on a dark panel background, rendered once
// into an HDR target, tone-mapped by an OutputPass exactly like the battlefield, read back and kept
// as a PNG data URL. Plain one-instance meshes are used so shared geometry attributes stay untouched.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { modelDef, unitModelId, structureModelId } from './models/index.js';
import { getMaterial, HOUSE_TINTED } from './models/materials.js';
import { nodeMatricesAtRest } from './models/instancer.js';
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { HOUSES } from '../data/houses.js';

export const ICON_W = 128, ICON_H = 96;
export const UNIT_ICON_YAW = -1.9;   // units rest facing east; this turns them towards the viewer's left
const FOV = 30;
const ELEVATION = THREE.MathUtils.degToRad(34), AZIMUTH = THREE.MathUtils.degToRad(32);

/** Union of the part bounding boxes with every node at rest, under an optional root transform. */
export function modelBounds(def, matrix = null) {
  const rest = nodeMatricesAtRest(def, matrix ?? undefined);
  const box = new THREE.Box3(), part = new THREE.Box3();
  for (const p of def.parts) {
    p.geometry.computeBoundingBox();
    box.union(part.copy(p.geometry.boundingBox).applyMatrix4(rest[p.node]));
  }
  return box;
}

/** Camera placement that fills about `fill` of the view with the box's projection. */
export function iconFraming(box, { fov = FOV, aspect = ICON_W / ICON_H, fill = 0.88 } = {}) {
  const target = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const dir = new THREE.Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.01, 1000);
  const pts = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
  const v = new THREE.Vector3();
  let distance = Math.max(0.1, radius / Math.sin(THREE.MathUtils.degToRad(fov) / 2));
  for (let k = 0; k < 6; k++) {
    cam.position.copy(target).addScaledVector(dir, distance);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    let extent = 0;
    for (const p of pts) { v.copy(p).project(cam); extent = Math.max(extent, Math.abs(v.x), Math.abs(v.y)); }
    distance = Math.max(radius * 1.05, distance * (extent / fill));
  }
  return { target, radius, distance, position: target.clone().addScaledVector(dir, distance) };
}

/** WebGL rows run bottom-up; ImageData rows run top-down. */
export function flipRows(src, w, h) {
  const out = new Uint8ClampedArray(src.length), row = w * 4;
  for (let y = 0; y < h; y++) out.set(src.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  return out;
}

/** 'upgrade:<structure>:<level>' → the upgrade icon it names, or null. */
export function upgradeIconKey(key) {
  const m = /^upgrade:(\w+):(\d+)$/.exec(key);
  return m && STRUCTURES[m[1]]?.upgrades ? { structureType: m[1], level: Number(m[2]) } : null;
}

/** 'starport:<unit>' → the Starport ware it names, or null. */
export function starportIconKey(key) {
  const m = /^starport:(\w+)$/.exec(key);
  return m && UNITS[m[1]] ? { unitType: m[1] } : null;
}

/** Starport wares: the unit with a gold coin in the bottom left corner. */
function drawPortBadge(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(20, 14, 6, 0.85)';
  ctx.strokeStyle = '#e8b84a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(20, ICON_H - 20, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 20, ICON_H - 19);
  ctx.restore();
}

/** Upgrade icons: the building with a gold arrow and the level it reaches in the top right corner. */
function drawUpgradeBadge(ctx, level) {
  const x = ICON_W - 46, y = 4;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 14, 6, 0.85)';
  ctx.strokeStyle = '#e8b84a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, 42, 30, 6); else ctx.rect(x, y, 42, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 24);
  ctx.lineTo(x + 14, y + 6);
  ctx.lineTo(x + 22, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(level), x + 32, y + 16);
  ctx.restore();
}

const PALACE_ICON = { deathHand: 'deathHandMissile', fremen: 'fremen', saboteur: 'saboteur' };

/** 'palace:<weapon>' → the Palace weapon it names, or null. */
export function palaceIconKey(key) {
  const m = /^palace:(\w+)$/.exec(key);
  return m && PALACE_ICON[m[1]] ? { weapon: m[1] } : null;
}

export class IconFactory {
  constructor(renderer, { environment = null } = {}) {
    this.renderer = renderer;
    this.cache = new Map();
    this.scene = new THREE.Scene();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight(0xfff0d6, 2.9);
    key.position.set(-3, 6, 4);
    const rim = new THREE.DirectionalLight(0xbfd4ff, 1.2);
    rim.position.set(4, 3, -5);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xcfe0ff, 0x8a6a44, 0.9));
    this.camera = new THREE.PerspectiveCamera(FOV, ICON_W / ICON_H, 0.01, 100);
    this.hdr = new THREE.WebGLRenderTarget(ICON_W, ICON_H, { type: THREE.HalfFloatType, samples: 4 });
    this.ldr = new THREE.WebGLRenderTarget(ICON_W, ICON_H);
    this.output = new OutputPass();
    this.pixels = new Uint8Array(ICON_W * ICON_H * 4);
    this.canvas = document.createElement('canvas');
    this.canvas.width = ICON_W;
    this.canvas.height = ICON_H;
    this.ctx = this.canvas.getContext('2d');
  }

  forItem(typeId, houseId) {
    const color = HOUSES[UNITS[typeId]?.colour ?? houseId]?.color ?? 0xffffff;   // Fremen keep their sand colour
    const pw = palaceIconKey(typeId);
    if (pw) return this.get(PALACE_ICON[pw.weapon], pw.weapon === 'fremen' ? HOUSES.fremen.color : color, UNIT_ICON_YAW);
    const up = upgradeIconKey(typeId);
    if (up) { const t = STRUCTURES[up.structureType]; return this.get(structureModelId(up.structureType, t.w, t.h), color, 0, up.level); }
    const ware = starportIconKey(typeId);
    if (ware) return this.get(unitModelId(ware.unitType), color, UNIT_ICON_YAW, 'port');
    const s = STRUCTURES[typeId];
    return s ? this.get(structureModelId(typeId, s.w, s.h), color) : this.get(unitModelId(typeId), color, UNIT_ICON_YAW);
  }

  get(modelId, color, yaw = 0, badge = 0) {
    const key = `${modelId}|${color}|${yaw}|${badge}`;
    let url = this.cache.get(key);
    if (!url) {
      url = this.render(modelId, color, yaw, badge);
      if (!this.renderer.getContext().isContextLost()) this.cache.set(key, url);   // a blank drawn mid-refresh is not kept
    }
    return url;
  }

  render(modelId, color, yaw, badge = 0) {
    const def = modelDef(modelId);
    const matrix = new THREE.Matrix4().makeRotationY(yaw);
    const rest = nodeMatricesAtRest(def, matrix);
    const tint = new THREE.Color(color);
    const meshes = def.parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, getMaterial(part.material), 1);
      mesh.setMatrixAt(0, rest[part.node]);
      if (HOUSE_TINTED.has(part.material)) mesh.setColorAt(0, tint);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return mesh;
    });
    const f = iconFraming(modelBounds(def, matrix));
    this.camera.position.copy(f.position);
    this.camera.lookAt(f.target);
    this.camera.near = Math.max(0.01, f.distance - f.radius * 2);
    this.camera.far = f.distance + f.radius * 2;
    this.camera.updateProjectionMatrix();
    const r = this.renderer;
    const prevTarget = r.getRenderTarget(), prevColor = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.hdr);
    r.setClearColor(0x2b2117, 1);
    r.clear();
    r.render(this.scene, this.camera);
    this.output.render(r, this.ldr, this.hdr);
    r.readRenderTargetPixels(this.ldr, 0, 0, ICON_W, ICON_H, this.pixels);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevColor, prevAlpha);
    for (const mesh of meshes) { this.scene.remove(mesh); mesh.dispose(); }
    this.ctx.putImageData(new ImageData(flipRows(this.pixels, ICON_W, ICON_H), ICON_W, ICON_H), 0, 0);
    if (badge === 'port') drawPortBadge(this.ctx); else if (badge) drawUpgradeBadge(this.ctx, badge);
    return this.canvas.toDataURL();
  }
}
