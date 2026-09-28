// Shared materials, one per MAT key (spec §5.3). HOUSE parts are white and take the per-instance
// house colour; LIGHT parts are unlit and bright enough to bloom.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { detailTexture, treadTexture } from './textures.js';

const cache = new Map();
export const HOUSE_TINTED = new Set([MAT.HOUSE, MAT.HOUSE_LIGHT]);

function treadMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.15, map: treadTexture() });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTread;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv.x += aTread;\n#endif');
  };
  m.customProgramCacheKey = () => 'tread';
  return m;
}

export function getMaterial(key) {
  if (cache.has(key)) return cache.get(key);
  const detail = detailTexture();
  let m;
  switch (key) {
    case MAT.PAINT: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.12, map: detail }); break;
    case MAT.HOUSE: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25, map: detail }); break;
    case MAT.METAL: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.85 }); break;
    case MAT.DARK: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 }); break;
    case MAT.TREAD: m = treadMaterial(); break;
    case MAT.GLASS: m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.5, emissive: 0x08131c }); break;
    case MAT.LIGHT:
    case MAT.HOUSE_LIGHT: m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); break;
    default: throw new Error(`unknown material ${key}`);
  }
  m.name = key;
  cache.set(key, m);
  return m;
}
