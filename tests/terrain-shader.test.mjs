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

test('the apron beyond the map edge follows the shroud of the nearest edge tile', () => {
  const material = new THREE.MeshStandardMaterial();
  injectTerrainShader(material, { uShroud: { value: null }, uMapSize: { value: new THREE.Vector2(64, 64) } }, { apron: true });
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader);
  const from = shader.fragmentShader.slice(shader.fragmentShader.indexOf('float terrainShroud('));
  const fn = from.slice(0, from.indexOf('\n}\n'));
  const sample = fn.indexOf('texture2D(uShroud');
  assert.ok(sample >= 0 && sample < fn.indexOf('#ifdef APRON'), 'the apron samples the shroud too');
  assert.match(fn, /clamp\(p \/ uMapSize, 0\.0, 1\.0\)/);
});

test('the apron takes its albedo and brightness from uApron, so the menu battle can match it to the map', () => {
  const material = new THREE.MeshStandardMaterial();
  injectTerrainShader(material, { uApron: { value: new THREE.Vector2(1, 1) } }, { apron: true });
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /uniform vec2 uApron;/);
  assert.match(shader.fragmentShader, /col \*= uApron\.x;/);
  assert.match(shader.fragmentShader, /return explored \* uApron\.y;/);
  assert.equal(shader.uniforms.uApron.value.x, 1);
});
