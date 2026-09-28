// Lighting and post-processing check: sand floor, shadow casters, an emissive ball for bloom.
import * as THREE from 'three';
import { Renderer3D } from '../render/renderer.js';
import { readParams } from '../core/params.js';

export async function start({ search }) {
  const params = readParams(search);
  const r3d = new Renderer3D(document.getElementById('gl'), params.str('quality', 'medium'));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xd2ab74, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  r3d.scene.add(floor);
  const colors = [0x2f6fe0, 0xc8261e, 0x2e9e3e];
  colors.forEach((c, i) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1 + i * 0.5, 1), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2 }));
    box.position.set(i * 2 - 2, (1 + i * 0.5) / 2, 0);
    box.castShadow = box.receiveShadow = true;
    r3d.scene.add(box);
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.8), toneMapped: false }));
  glow.position.set(0, 0.6, 2);
  r3d.scene.add(glow);
  r3d.camera.position.set(0, 7, 11);
  r3d.camera.lookAt(0, 0.5, 0);
  r3d.follow(0, 0, 20);
  const frame = () => { r3d.render(); requestAnimationFrame(frame); };
  frame();
  window.__dune = { ready: true, scene: 'render-test' };
}
