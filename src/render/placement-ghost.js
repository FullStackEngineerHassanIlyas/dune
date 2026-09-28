// Placement preview (spec §4.5, §5.6): a translucent copy of the structure over a tile grid — green on
// the house's own concrete, yellow on bare rock (the structure starts damaged), red where it cannot
// go (every cell turns red when the footprint does not touch the base). Slabs show only their cells.
import * as THREE from 'three';
import { STRUCTURES } from '../data/structures.js';
import { modelDef, structureModelId } from './models/index.js';
import { nodeMatricesAtRest } from './models/instancer.js';

const COLORS = { concrete: 0x46e05a, bare: 0xf2c53d, blocked: 0xff3b30 };

export class PlacementGhost {
  constructor(scene, hf) {
    this.hf = hf;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.6, metalness: 0.1 });
    this.cellMaterials = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.42, depthWrite: false })]));
    this.cellGeometry = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
    this.cells = [];
    this.typeId = null;
  }

  setType(typeId) {
    if (typeId === this.typeId) return;
    this.typeId = typeId;
    this.body.clear();
    for (const c of this.cells) this.group.remove(c);
    this.cells = [];
    const t = STRUCTURES[typeId];
    if (!t.isConcrete) {
      const def = modelDef(structureModelId(typeId, t.w, t.h));
      const rest = nodeMatricesAtRest(def);   // part geometry sits in its node's space
      for (const part of def.parts) {
        const mesh = new THREE.Mesh(part.geometry, this.bodyMaterial);
        mesh.applyMatrix4(rest[part.node]);
        this.body.add(mesh);
      }
    }
    for (let k = 0; k < t.w * t.h; k++) {
      const cell = new THREE.Mesh(this.cellGeometry, this.cellMaterials.bare);
      cell.renderOrder = 5;
      this.group.add(cell);
      this.cells.push(cell);
    }
  }

  /** placement: {typeId, x, y, check} from Controller.placementAt, or null to hide. */
  show(placement) {
    if (!placement) { this.group.visible = false; return; }
    const { typeId, x, y, check } = placement;
    this.setType(typeId);
    const t = STRUCTURES[typeId];
    let sum = 0;
    check.tiles.forEach((tile, k) => {
      const cell = this.cells[k];
      const h = this.hf.heightAt(tile.x + 0.5, tile.y + 0.5);
      sum += h;
      cell.position.set(tile.x + 0.5, h + 0.04, tile.y + 0.5);
      const state = t.isConcrete && tile.state === 'bare' ? 'concrete' : tile.state;
      cell.material = this.cellMaterials[check.ok ? state : 'blocked'];
    });
    this.body.position.set(x + t.w / 2, sum / check.tiles.length + 0.02, y + t.h / 2);
    this.group.visible = true;
  }
}
