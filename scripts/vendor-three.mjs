// Copies three.js (MIT) and the addons we use, plus their relative imports, into vendor/three.
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'three');
const dst = path.join(root, 'vendor', 'three');
const ADDONS = [
  'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js',
  'postprocessing/OutputPass.js', 'postprocessing/FXAAPass.js', 'postprocessing/ShaderPass.js',
  'geometries/RoundedBoxGeometry.js', 'utils/BufferGeometryUtils.js',
];

if (!existsSync(src)) {
  console.error('three is not installed — run `npm install` first');
  process.exit(1);
}
await mkdir(dst, { recursive: true });
for (const f of ['three.module.js', 'three.core.js']) await copyFile(path.join(src, 'build', f), path.join(dst, f));
const done = new Set();
async function copyAddon(rel) {
  if (done.has(rel)) return;
  done.add(rel);
  const from = path.join(src, 'examples', 'jsm', rel);
  const to = path.join(dst, 'addons', rel);
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
  const text = await readFile(from, 'utf8');
  for (const m of text.matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)) {
    await copyAddon(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
  }
}
for (const a of ADDONS) await copyAddon(a);
const pkg = JSON.parse(await readFile(path.join(src, 'package.json'), 'utf8'));
await copyFile(path.join(src, 'LICENSE'), path.join(dst, 'LICENSE'));
await writeFile(path.join(dst, 'VERSION'), `three ${pkg.version} (MIT), copied by scripts/vendor-three.mjs\n`);
console.log(`vendored three ${pkg.version} with ${done.size} addon files`);
