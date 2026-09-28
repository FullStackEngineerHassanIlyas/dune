// Minimal scene proving that the vendored Three.js and the screenshot harness work.
import * as THREE from 'three';

export async function start() {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd8b98c);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(3, 3, 4);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0xb98a55, 1.2));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
  sun.position.set(-3, 5, 2);
  scene.add(sun);
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2f6fe0 })));
  renderer.render(scene, camera);
  window.__dune = { ready: true, scene: 'boot' };
}
