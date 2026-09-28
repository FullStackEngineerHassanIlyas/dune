import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { injectTerrainShader } from '../src/render/terrain-shader.js';

test('terrain shader patches every chunk it relies on', () => {
  for (const apron of [false, true]) {
    const material = new THREE.MeshStandardMaterial();
    const uniforms = { uSpice: { value: null }, uConcrete: { value: null }, uShroud: { value: null }, uDecals: { value: null }, uMapSize: { value: new THREE.Vector2(64, 64) }, uTime: { value: 0 } };
    injectTerrainShader(material, uniforms, { apron });
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    assert.match(shader.vertexShader, /attribute vec3 aTerrain;/);
    assert.match(shader.vertexShader, /vWorldPos = \(modelMatrix/);
    assert.match(shader.fragmentShader, /terrainAlbedo\(vWorldPos\.xz/);
    assert.match(shader.fragmentShader, /roughnessFactor = tRough;/);
    assert.match(shader.fragmentShader, /perturbTerrainNormal\(/);
    assert.match(shader.fragmentShader, /terrainShroud\(vWorldPos\.xz\)/);
    assert.doesNotMatch(shader.fragmentShader, /#include <map_fragment>/);
    assert.equal(shader.uniforms.uMapSize, uniforms.uMapSize);
    assert.equal(material.defines?.APRON !== undefined, apron);
  }
});
