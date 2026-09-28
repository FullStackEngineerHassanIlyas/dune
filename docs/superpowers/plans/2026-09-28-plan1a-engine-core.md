# Plan 1a — Engine core: units on a 3D Arrakis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser page that generates an Arrakis map, renders it as lit, shadowed 3D terrain with house-coloured 3D units, and lets the player select and move units with C&C-style mouse controls; the MCV deploys into a Construction Yard.

**Architecture:** A deterministic 20 Hz simulation (`src/sim`, `src/data`, pure JS, runs under Node) and a Three.js presentation layer (`src/render`, `src/input`, `src/ui`, `src/scenes`) joined only by commands (input → `world.issue`) and events (`world.events` → presentation). No build step: ES modules, an import map, and Three.js 0.186.1 vendored into `vendor/three/`.

**Tech Stack:** JavaScript ES2022 modules · Three.js 0.186.1 (WebGL2, `MeshStandardMaterial` + `onBeforeCompile`, `InstancedMesh`, EffectComposer/UnrealBloom/Output/FXAA passes) · Node 24 (`node:test`, global `fetch`/`WebSocket`) · headless Google Chrome driven over the DevTools protocol for screenshots and end-to-end tests.

**Spec:** `docs/superpowers/specs/2026-09-28-dune2-3d-design.md`. This plan is the first half of delivery phase 1 (spec §11): sections §3 (architecture), §4.1 (conversions), §4.2 (map), the MCV part of §4.5, §4.6 movement, §5.1–§5.3 (rendering, terrain, unit models and the Construction Yard), §5.5 (camera), the selection/move subset of §5.6–§5.7, §9 (error handling) and §10 (testing). Plan 1b finishes phase 1: production and sidebar, placement and concrete, power, harvesting, combat, fog and radar, the remaining structure models, basic AI and sound.

## Global Constraints

- No build step: `npm start` serves the repo root; the browser loads ES modules through an import map. `npm install` only fetches the dev dependency `three@0.186.1` (used by Node tests and copied into `vendor/three/` by `npm run vendor`).
- `src/sim/**` and `src/data/**` never import `three`, the DOM, or browser APIs — they must run under `node --test`.
- Simulation: 20 ticks per second (`SIM_HZ`), all randomness from `world.rng` (seeded); the same seed and the same commands produce the same state.
- One tile = one world unit. Tile `(x, y)` has its centre at world `(x + 0.5, z = y + 0.5)`; Y is up. Map north (tile y = 0) is at the top of the screen at camera yaw 0.
- Headings are radians in the map plane: 0 = east (+x), π/2 = south (+y / +z).
- Every conversion from original Dune II numbers to seconds and tiles lives in `src/data/tuning.js` (spec §4.1).
- House colours: Atreides `0x2f6fe0`, Harkonnen `0xc8261e`, Ordos `0x2e9e3e`, Fremen `0xa8834a`, Sardaukar `0x7a3fb0`.
- All in-game text is English. No original Dune II or C&C asset (image, sound, text) enters the repo.
- Units and structures render through one `InstancedMesh` per model part; target under ~250 draw calls.
- Commits are small and conventional (`feat(sim): …`, `test: …`, `chore: …`) and end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Clicks that hit no ground** (sky above the horizon, beyond the map edge, the future sidebar area) must not throw or issue an order; nothing should happen. → Task 10 (`screenToGround` returns `null` for the sky) and Task 14 (controller test: a click with no ground issues no command).
2. **Twenty units ordered onto one tile, or into an enclosed area,** must not freeze or stack; they spread over nearby free tiles, or stop at the nearest reachable tile. → Task 6 tests "group order spreads units" and "unreachable target".
3. **Two units meeting head-on in a one-tile corridor** must never overlap and must not wait forever; within five seconds of meeting they settle. → Task 6 test "head-on in a corridor".
4. **A hidden tab, a slow frame, or a resize** must not make the simulation spiral (hundreds of catch-up ticks) or distort the view. → Task 2 `FixedLoop` tests (catch-up capped at 5 ticks, backlog dropped) and the resize handling in Task 15.
5. **Deploying the MCV at the map edge, on sand, or with units in every candidate footprint** must refuse cleanly with "Unable to deploy here." and leave the MCV intact. → Task 7 tests.

## File map

```
package.json  package-lock.json  serve.mjs  index.html  README.md  .gitignore
vendor/three/                    three.module.js, three.core.js, addons/…, LICENSE, VERSION (generated)
scripts/vendor-three.mjs         copy three + the addons we use (and their relative imports)
scripts/cdp.mjs                  headless Chrome driver over the DevTools protocol
scripts/scenarios.mjs            smoke-test scenes
scripts/smoke.mjs                screenshots of every scenario → screenshots/
scripts/e2e.mjs                  mouse-driven skirmish opening, asserts through window.__dune
src/main.js                      WebGL2 check + scene router
src/core/{rng,events,params,settings,loop}.js
src/data/{houses,terrain,units,structures,tuning}.js
src/sim/{map,mapgen,pathfind,geometry,house,unit,structure,world,movement,destinations,orders}.js
src/game/{setup,debug}.js
src/render/{quality,renderer,sky,heightfield,terrain,terrain-shader,decals,camera-rig,picking,overlay}.js
src/render/models/{kit,textures,materials,instancer,palette,index}.js
src/render/models/units/{tank-chassis,combat-tank,siege-tank,missile-tank,deviator,sonic-tank,devastator,harvester,mcv,trike,quad,infantry}.js
src/render/models/structures/{construction-yard,placeholder}.js
src/render/views/{unit-views,structure-views}.js
src/input/{pointer,keyboard,camera-control,selection,groups,controller}.js
src/ui/{styles.css,cursors.js,hud.js}
src/scenes/{boot,render-test,terrain,gallery,skirmish}.js
tests/*.test.mjs  tests/helpers.mjs
```

---

### Task 1: Scaffold — server, page, vendored Three.js, Chrome harness

**Files:**
- Create: `package.json`, `serve.mjs`, `index.html`, `src/main.js`, `src/ui/styles.css`, `src/scenes/boot.js`, `scripts/vendor-three.mjs`, `scripts/cdp.mjs`, `scripts/scenarios.mjs`, `scripts/smoke.mjs`
- Generated: `vendor/three/**`, `package-lock.json`
- Test: `tests/serve.test.mjs`

**Interfaces:**
- Produces: `createServer()` (from `serve.mjs`); `launchChrome({width,height})` → `{port,width,height,close()}` and `openPage(chrome, url)` → `page` with `eval(expr)`, `waitFor(expr, ms)`, `screenshot(file)`, `click(x,y,opts)`, `drag(x0,y0,x1,y1)`, `mouse(type,x,y,opts)`, `key(key,{code,modifiers})`, `logs[]`, `close()` (from `scripts/cdp.mjs`); `SCENARIOS` map `name → {query, settleMs?, timeoutMs?}` (from `scripts/scenarios.mjs`). Every scene sets `window.__dune.ready = true` once its first frame is on screen.

- [ ] **Step 1: Write the failing server test**

**File: `tests/serve.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../serve.mjs';

test('server serves the page, vendored three as JavaScript, 404s and blocks path escapes', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const page = await fetch(`http://localhost:${port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<canvas id="gl">/);
    const three = await fetch(`http://localhost:${port}/vendor/three/three.module.js`);
    assert.equal(three.status, 200);
    assert.match(three.headers.get('content-type'), /javascript/);
    await three.arrayBuffer();
    const missing = await fetch(`http://localhost:${port}/nope.js`);
    assert.equal(missing.status, 404);
    await missing.arrayBuffer();
    const escape = await fetch(`http://localhost:${port}/..%2f..%2fetc%2fpasswd`);
    assert.notEqual(escape.status, 200);
    await escape.arrayBuffer();
  } finally {
    server.close();
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/serve.test.mjs`
Expected: FAIL — `Cannot find module '…/serve.mjs'`.

- [ ] **Step 3: Create the package, server and page**

**File: `package.json`**
```json
{
  "name": "dune2-3d",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Fan remake of Dune II: The Battle for Arrakis in Three.js",
  "scripts": {
    "start": "node serve.mjs",
    "test": "node --test \"tests/**/*.test.mjs\"",
    "vendor": "node scripts/vendor-three.mjs",
    "smoke": "node scripts/smoke.mjs",
    "e2e": "node scripts/e2e.mjs"
  },
  "devDependencies": {
    "three": "0.186.1"
  }
}
```

**File: `serve.mjs`**
```js
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch (err) {
      res.writeHead(err.code === 'ENOENT' || err.code === 'ENOTDIR' ? 404 : 500);
      res.end(String(err.code || err));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(port, () => console.log(`Dune II 3D → http://localhost:${port}`));
}
```

**File: `index.html`**
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Dune II 3D — fan remake</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="src/ui/styles.css">
<script type="importmap">
{ "imports": { "three": "./vendor/three/three.module.js", "three/addons/": "./vendor/three/addons/" } }
</script>
</head>
<body>
<div id="app">
  <canvas id="gl"></canvas>
  <canvas id="overlay"></canvas>
  <div id="ui"></div>
</div>
<script type="module" src="src/main.js"></script>
</body>
</html>
```

**File: `src/ui/styles.css`**
```css
html, body { margin: 0; height: 100%; background: #000; overflow: hidden; font-family: "Trebuchet MS", "Segoe UI", sans-serif; color: #f2d7a0; user-select: none; }
#app { position: fixed; inset: 0; }
#gl, #overlay { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#overlay { pointer-events: none; }
#ui { position: absolute; inset: 0; pointer-events: none; }
.fatal { position: absolute; inset: 0; display: grid; place-items: center; background: #1a1008; color: #f2d7a0; font-size: 20px; text-align: center; padding: 2em; pointer-events: auto; }
```

**File: `src/main.js`**
```js
// Entry point: checks WebGL2, then loads the scene named by ?scene= (default: skirmish).
const SCENES = {
  boot: () => import('./scenes/boot.js'),
};

function fatal(message) {
  const div = document.createElement('div');
  div.className = 'fatal';
  div.textContent = message;
  document.getElementById('ui').appendChild(div);
}

const params = new URLSearchParams(location.search);
const name = params.get('scene') || 'skirmish';
if (!document.createElement('canvas').getContext('webgl2')) {
  fatal('Dune II 3D needs WebGL 2. Please use a current Chrome, Edge or Firefox with hardware acceleration enabled.');
} else if (!SCENES[name]) {
  fatal(`Unknown scene "${name}".`);
} else {
  SCENES[name]()
    .then((scene) => scene.start({ search: location.search }))
    .catch((err) => { console.error(err); fatal(`Something went wrong while starting the game:\n${err.message}`); });
}
```

**File: `src/scenes/boot.js`**
```js
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
```

- [ ] **Step 4: Create the vendoring script and vendor Three.js**

**File: `scripts/vendor-three.mjs`**
```js
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
```

Run: `npm install && npm run vendor`
Expected: `vendored three 0.186.1 with 12 addon files` (the exact addon count may differ by one or two; every file named in `ADDONS` must exist under `vendor/three/addons/`).

- [ ] **Step 5: Run the server test**

Run: `node --test tests/serve.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 6: Create the Chrome driver, scenario list and smoke runner**

**File: `scripts/cdp.mjs`**
```js
// Minimal Chrome DevTools Protocol driver (no dependencies): launch headless Chrome with SwiftShader
// WebGL2, open pages, evaluate JS, send real mouse/keyboard input and capture screenshots.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BUTTONS = { none: 0, left: 1, right: 2, middle: 4 };

export async function launchChrome({ width = 1600, height = 900 } = {}) {
  const port = 9222 + Math.floor(Math.random() * 700);
  const userDir = await mkdtemp(path.join(tmpdir(), 'dune-chrome-'));
  const proc = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });
  let version = null;
  for (let i = 0; i < 100 && !version; i++) {
    await sleep(100);
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { /* still starting */ }
  }
  if (!version) { proc.kill(); throw new Error('Chrome did not open its DevTools endpoint'); }
  return {
    port, width, height,
    async close() { proc.kill(); await sleep(300); await rm(userDir, { recursive: true, force: true }); },
  };
}

export async function openPage(chrome, url) {
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push(`[exception] ${d.exception?.description || d.text}`);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: chrome.width, height: chrome.height, deviceScaleFactor: 1, mobile: false });
  const page = {
    logs,
    send,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async waitFor(expression, timeoutMs = 30000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        try { if (await page.eval(expression)) return; } catch { /* page still loading */ }
        await sleep(100);
      }
      throw new Error(`timed out waiting for ${expression}\n${logs.join('\n')}`);
    },
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(file, Buffer.from(r.data, 'base64'));
    },
    async mouse(type, x, y, { button = 'left', clickCount = 1, modifiers = 0, held = button } = {}) {
      const buttons = type === 'mouseReleased' ? 0 : BUTTONS[held] ?? 0;
      await send('Input.dispatchMouseEvent', { type, x, y, button, clickCount, modifiers, buttons });
    },
    async click(x, y, { button = 'left', modifiers = 0 } = {}) {
      await page.mouse('mouseMoved', x, y, { button: 'none', held: 'none', modifiers });
      await page.mouse('mousePressed', x, y, { button, modifiers });
      await page.mouse('mouseReleased', x, y, { button, modifiers });
    },
    async drag(x0, y0, x1, y1, steps = 10) {
      await page.mouse('mouseMoved', x0, y0, { button: 'none', held: 'none' });
      await page.mouse('mousePressed', x0, y0);
      for (let i = 1; i <= steps; i++) await page.mouse('mouseMoved', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, { button: 'left', held: 'left' });
      await page.mouse('mouseReleased', x1, y1);
    },
    async key(key, { code = key, modifiers = 0 } = {}) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
    },
    close() { ws.close(); },
  };
  return page;
}

export const MODIFIERS = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
```

**File: `scripts/scenarios.mjs`**
```js
// Scenes captured by `npm run smoke`. Each scene sets window.__dune.ready when its first frame is drawn.
export const SCENARIOS = {
  boot: { query: 'scene=boot' },
};
```

**File: `scripts/smoke.mjs`**
```js
// Starts the dev server and headless Chrome, captures screenshots/<name>.png for every scenario and
// fails if a scene does not become ready or logs an error/exception.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage } from './cdp.mjs';
import { SCENARIOS } from './scenarios.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT || 8471);
const only = process.argv.slice(2);
const list = Object.entries(SCENARIOS).filter(([name]) => !only.length || only.includes(name));

export async function startServer(port = PORT) {
  const server = spawn(process.execPath, ['serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { if ((await fetch(`http://localhost:${port}/index.html`)).ok) return server; } catch { /* not up yet */ }
  }
  server.kill();
  throw new Error(`port ${port} is not serving the game (in use?) — set SMOKE_PORT`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  await mkdir(path.join(root, 'screenshots'), { recursive: true });
  const chrome = await launchChrome();
  let failed = 0;
  try {
    for (const [name, sc] of list) {
      const page = await openPage(chrome, `http://localhost:${PORT}/?${sc.query}`);
      try {
        await page.waitFor('window.__dune && window.__dune.ready === true', sc.timeoutMs ?? 90000);
        await new Promise((r) => setTimeout(r, sc.settleMs ?? 400));
        await page.screenshot(path.join(root, 'screenshots', `${name}.png`));
        const errors = page.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
        if (errors.length) { failed++; console.log(`FAIL ${name}\n  ${errors.join('\n  ')}`); }
        else console.log(`wrote screenshots/${name}.png`);
      } catch (err) {
        failed++;
        console.log(`FAIL ${name}: ${err.message}`);
      } finally {
        page.close();
      }
    }
  } finally {
    await chrome.close();
    server.kill();
  }
  process.exit(failed ? 1 : 0);
}
```

- [ ] **Step 7: Capture the boot scene and look at it**

Run: `npm run smoke`
Expected: `wrote screenshots/boot.png`, exit code 0. Open `screenshots/boot.png` (Read tool): a lit blue cube on a sand-coloured background. If the screenshot is black or the run times out, check `page.logs` output for a WebGL error before continuing.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json serve.mjs index.html src scripts tests vendor
git commit -m "chore: scaffold server, page, vendored three 0.186.1 and headless Chrome harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Core utilities — RNG, events, params, settings, fixed-step loop

**Files:**
- Create: `src/core/rng.js`, `src/core/events.js`, `src/core/params.js`, `src/core/settings.js`, `src/core/loop.js`
- Test: `tests/core.test.mjs`

**Interfaces:**
- Produces: `class Rng(seed)` with `next()`→[0,1), `int(n)`, `range(a,b)`, `chance(p)`, `pick(list)`, `shuffle(list)`; `hashString(text)`→uint32; `class EventQueue` with `push(type, data)`→data (sets `data.type`), `drain()`→array; `class Emitter` with `on(name,fn)`→unsubscribe, `off`, `emit`; `readParams(search)`→`{raw, str(k,d), num(k,d), bool(k,d)}`; `DEFAULTS`, `sanitize(obj)`, `loadSettings(params, storage)`, `saveSettings(settings, storage)`; `class FixedLoop(step, {maxSteps=5})` with `advance(dtSeconds, speed=1)`→`{steps, alpha}`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/core.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng, hashString } from '../src/core/rng.js';
import { EventQueue, Emitter } from '../src/core/events.js';
import { readParams } from '../src/core/params.js';
import { DEFAULTS, sanitize, loadSettings, saveSettings } from '../src/core/settings.js';
import { FixedLoop } from '../src/core/loop.js';

test('same seed gives the same sequence, different seeds diverge', () => {
  const a = new Rng(42), b = new Rng(42), c = new Rng(43);
  const sa = [], sb = [], sc = [];
  for (let i = 0; i < 50; i++) { sa.push(a.next()); sb.push(b.next()); sc.push(c.next()); }
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('int stays in range and covers it; seed 0 works', () => {
  const r = new Rng(0);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = r.int(6);
    assert.ok(v >= 0 && v < 6);
    seen.add(v);
  }
  assert.equal(seen.size, 6);
});

test('shuffle keeps every element', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = new Rng(5).shuffle([...list]);
  assert.deepEqual([...out].sort((x, y) => x - y), list);
});

test('hashString is stable and spreads', () => {
  assert.equal(hashString('dune'), hashString('dune'));
  assert.notEqual(hashString('dune'), hashString('dunf'));
});

test('event queue drains in order and empties', () => {
  const q = new EventQueue();
  q.push('a', { n: 1 });
  q.push('b');
  const out = q.drain();
  assert.deepEqual(out.map((e) => e.type), ['a', 'b']);
  assert.equal(out[0].n, 1);
  assert.equal(q.drain().length, 0);
});

test('emitter subscribes and unsubscribes', () => {
  const e = new Emitter();
  let n = 0;
  const off = e.on('x', (v) => { n += v; });
  e.emit('x', 2);
  off();
  e.emit('x', 5);
  assert.equal(n, 2);
});

test('params parse strings, numbers and booleans', () => {
  const p = readParams('?a=1&b=x&c=0&d=');
  assert.equal(p.num('a'), 1);
  assert.equal(p.str('b'), 'x');
  assert.equal(p.bool('c'), false);
  assert.equal(p.bool('missing', true), true);
  assert.equal(p.num('d', 7), 7);
  assert.equal(p.num('b', 3), 3);
});

test('settings sanitize rejects unknown keys and bad values', () => {
  const s = sanitize({ quality: 'ultra', scheme: 'modern', scrollSpeed: 99, edgeScroll: 'false', hacker: 1 });
  assert.equal(s.quality, DEFAULTS.quality);
  assert.equal(s.scheme, 'modern');
  assert.equal(s.scrollSpeed, DEFAULTS.scrollSpeed);
  assert.equal(s.edgeScroll, false);
  assert.equal('hacker' in s, false);
});

test('settings load merges URL over storage and tolerates broken JSON', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveSettings({ ...DEFAULTS, quality: 'high' }, storage);
  assert.equal(loadSettings(readParams(''), storage).quality, 'high');
  assert.equal(loadSettings(readParams('?quality=low'), storage).quality, 'low');
  store.set('dune2-3d.settings', '{broken');
  assert.equal(loadSettings(readParams(''), storage).quality, DEFAULTS.quality);
  assert.equal(loadSettings(readParams(''), null).quality, DEFAULTS.quality);
});

test('fixed loop runs whole steps and reports interpolation alpha', () => {
  const loop = new FixedLoop(0.05);
  assert.deepEqual(loop.advance(0.02), { steps: 0, alpha: 0.02 / 0.05 });
  const r = loop.advance(0.04);
  assert.equal(r.steps, 1);
  assert.ok(Math.abs(r.alpha - 0.2) < 1e-9);
});

test('fixed loop caps catch-up and drops the backlog after a stall', () => {
  const loop = new FixedLoop(0.05, { maxSteps: 5 });
  const r = loop.advance(3.0);          // a hidden tab or a long hitch
  assert.equal(r.steps, 5);
  assert.ok(r.alpha < 1);
  assert.equal(loop.advance(0.01).steps, 0);
});

test('fixed loop honours game speed', () => {
  const loop = new FixedLoop(0.05);
  assert.equal(loop.advance(0.1, 1.5).steps, 3);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/core.test.mjs`
Expected: FAIL — cannot find `../src/core/rng.js`.

- [ ] **Step 3: Implement the modules**

**File: `src/core/rng.js`**
```js
// Seeded PRNG (mulberry32). Every random decision in the simulation goes through an Rng so that the
// same seed and the same commands always produce the same game.
export class Rng {
  constructor(seed = 1) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + (b - a) * this.next(); }
  chance(p) { return this.next() < p; }
  pick(list) { return list[this.int(list.length)]; }

  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
```

**File: `src/core/events.js`**
```js
// Simulation → presentation event queue, drained once per rendered frame.
export class EventQueue {
  constructor() { this.items = []; }
  push(type, data = {}) { data.type = type; this.items.push(data); return data; }
  drain() { const out = this.items; this.items = []; return out; }
}

// Tiny synchronous emitter for UI and input wiring.
export class Emitter {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) { this.map.get(name)?.delete(fn); }
  emit(name, ...args) { for (const fn of [...(this.map.get(name) ?? [])]) fn(...args); }
}
```

**File: `src/core/params.js`**
```js
// URL query → typed getters.
export function readParams(search = globalThis.location?.search ?? '') {
  const p = new URLSearchParams(search);
  const has = (k) => p.has(k) && p.get(k) !== '';
  return {
    raw: p,
    str: (k, d = null) => (has(k) ? p.get(k) : d),
    num: (k, d = null) => (has(k) && !Number.isNaN(Number(p.get(k))) ? Number(p.get(k)) : d),
    bool: (k, d = false) => (has(k) ? !['0', 'false', 'no', 'off'].includes(p.get(k)) : d),
  };
}
```

**File: `src/core/settings.js`**
```js
// Player settings: defaults ← localStorage ← URL overrides. Only whitelisted keys and values survive.
const KEY = 'dune2-3d.settings';
export const DEFAULTS = { quality: 'medium', scheme: 'classic', edgeScroll: true, scrollSpeed: 1, healthBars: 'selected', gameSpeed: 'normal' };
const CHOICES = {
  quality: ['low', 'medium', 'high'],
  scheme: ['classic', 'modern'],
  healthBars: ['selected', 'damaged', 'always'],
  gameSpeed: ['slowest', 'slow', 'normal', 'fast', 'fastest'],
};

export function sanitize(obj) {
  const out = { ...DEFAULTS };
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (!(k in DEFAULTS)) continue;
    if (CHOICES[k]) { if (CHOICES[k].includes(v)) out[k] = v; }
    else if (typeof DEFAULTS[k] === 'boolean') out[k] = v === true || v === 'true' || v === '1';
    else if (typeof DEFAULTS[k] === 'number') { const n = Number(v); if (Number.isFinite(n) && n > 0 && n <= 4) out[k] = n; }
  }
  return out;
}

export function loadSettings(params, storage = globalThis.localStorage) {
  let stored = {};
  try { stored = JSON.parse(storage?.getItem(KEY) ?? '{}') ?? {}; } catch { stored = {}; }
  const merged = { ...stored };
  if (params) for (const k of Object.keys(DEFAULTS)) { const v = params.str(k); if (v !== null) merged[k] = v; }
  return sanitize(merged);
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(sanitize(settings))); } catch { /* private mode: keep for this session only */ }
}
```

**File: `src/core/loop.js`**
```js
// Fixed-step accumulator: the simulation advances in whole ticks, rendering interpolates with alpha.
// A long stall (hidden tab, debugger) runs at most maxSteps ticks and drops the rest of the backlog.
export class FixedLoop {
  constructor(step, { maxSteps = 5 } = {}) {
    this.step = step;
    this.maxSteps = maxSteps;
    this.acc = 0;
  }

  advance(dtSeconds, speed = 1) {
    this.acc += Math.min(Math.max(dtSeconds, 0), 0.25) * speed;
    let steps = 0;
    while (this.acc >= this.step - 1e-9 && steps < this.maxSteps) { this.acc -= this.step; steps++; }
    if (steps === this.maxSteps && this.acc >= this.step) this.acc %= this.step;
    if (this.acc < 0) this.acc = 0;
    return { steps, alpha: this.acc / this.step };
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/core.test.mjs`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core tests/core.test.mjs
git commit -m "feat(core): seeded rng, event queue, params, settings and fixed-step loop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Data tables — houses, terrain, units, structures, tuning

**Files:**
- Create: `src/data/houses.js`, `src/data/terrain.js`, `src/data/units.js`, `src/data/structures.js`, `src/data/tuning.js`
- Test: `tests/data.test.mjs`

**Interfaces:**
- Produces:
  - `HOUSES[id]` → `{id, name, color, mentat?, palace, toughness, playable}`; `PLAYABLE_HOUSES`; `LIGHT_VEHICLE[house]`, `INFANTRY[house]` (starting-force helpers).
  - `G = {SAND, DUNE, ROCK, MOUNTAIN}` (ground), `SURFACE = {SAND, DUNE, ROCK, MOUNTAIN, SPICE, CONCRETE, RUBBLE, BLOCKED}`, `moveFactor(surface, moveClass)` → 0..255.
  - `MOVE = {FOOT:'foot', TRACKED:'tracked', HARVESTER:'harvester', WHEELED:'wheeled', AIR:'air', WORM:'worm'}`; `UNITS[id]` with fields `name, houses, builtAt, upgrade, requires?, cost, buildTime, hp, move, speed, turn, turret, weapon, damage, range, fireDelay, firesTwice?, targetAir?, sight, figures?, explodes?, carriable?, deploysTo?`.
  - `STRUCTURES[id]` with `name, w, h, cost, buildTime, hp, power, storage?, sight, requires (array | null = never buildable), requiresUpgrade?, houses, tech, techByHouse?, produces?, upgrades?, conquerable?, isConcrete?, isWall?`.
  - `SIM_HZ=20`, `DT`, `TERRAIN_REF=192`, `groundSpeed(factor, terrain)`, `airSpeed(factor)`, `fireDelaySeconds(d)`, `buildSeconds(t)`, `unitSight(r)`, `TURN_RATE[class]`, `DRIVE_ANGLE[moveClass]`, `GAME_SPEED`, `STUCK_REPATH_SECONDS=1.5`, `STUCK_GIVEUP_SECONDS=5`, `SPICE_PER_TILE=250`, `THICK_SPICE_PER_TILE=750`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/data.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSES, PLAYABLE_HOUSES, LIGHT_VEHICLE, INFANTRY } from '../src/data/houses.js';
import { SURFACE, moveFactor } from '../src/data/terrain.js';
import { UNITS, MOVE } from '../src/data/units.js';
import { STRUCTURES } from '../src/data/structures.js';
import { groundSpeed, fireDelaySeconds, buildSeconds, TURN_RATE, DRIVE_ANGLE } from '../src/data/tuning.js';

const canBuild = (house, unit) => UNITS[unit].houses.includes(house);

test('every reference in the tables points at something that exists', () => {
  for (const [id, u] of Object.entries(UNITS)) {
    if (u.builtAt) assert.ok(STRUCTURES[u.builtAt], `${id}.builtAt`);
    for (const r of u.requires ?? []) assert.ok(STRUCTURES[r], `${id}.requires ${r}`);
    for (const h of u.houses) assert.ok(HOUSES[h], `${id}.houses ${h}`);
    assert.ok(Object.values(MOVE).includes(u.move), `${id}.move`);
    assert.ok(u.turn >= 1 && u.turn <= 3, `${id}.turn`);
    if (u.deploysTo) assert.ok(STRUCTURES[u.deploysTo]);
  }
  for (const [id, s] of Object.entries(STRUCTURES)) {
    for (const r of s.requires ?? []) assert.ok(STRUCTURES[r], `${id}.requires ${r}`);
    for (const k of Object.keys(s.requiresUpgrade ?? {})) assert.ok(STRUCTURES[k], `${id}.requiresUpgrade ${k}`);
    assert.ok(s.w >= 1 && s.w <= 3 && s.h >= 1 && s.h <= 3, `${id} footprint`);
  }
});

test('structure prerequisites contain no cycles', () => {
  const state = {};
  const visit = (id) => {
    if (state[id] === 'done') return;
    assert.notEqual(state[id], 'visiting', `cycle through ${id}`);
    state[id] = 'visiting';
    for (const r of STRUCTURES[id].requires ?? []) visit(r);
    state[id] = 'done';
  };
  Object.keys(STRUCTURES).forEach(visit);
});

test('house rosters follow the original game', () => {
  assert.ok(!canBuild('harkonnen', 'trike') && !canBuild('harkonnen', 'soldier') && !canBuild('harkonnen', 'ornithopter'));
  assert.ok(!canBuild('atreides', 'trooper') && !canBuild('atreides', 'devastator') && !canBuild('atreides', 'deviator'));
  assert.ok(!canBuild('ordos', 'missileTank') && canBuild('ordos', 'raider') && canBuild('ordos', 'trooper') && canBuild('ordos', 'soldier'));
  const specials = { atreides: 'sonicTank', harkonnen: 'devastator', ordos: 'deviator' };
  for (const h of PLAYABLE_HOUSES) {
    const own = ['sonicTank', 'devastator', 'deviator'].filter((u) => canBuild(h, u));
    assert.deepEqual(own, [specials[h]]);
    assert.ok(canBuild(h, LIGHT_VEHICLE[h]) && canBuild(h, INFANTRY[h]));
  }
});

test('key numbers match the original tables', () => {
  assert.deepEqual([UNITS.combatTank.cost, UNITS.combatTank.hp, UNITS.combatTank.range, UNITS.combatTank.fireDelay], [300, 200, 4, 80]);
  assert.deepEqual([UNITS.devastator.hp, UNITS.devastator.speed], [400, 10]);
  assert.equal(STRUCTURES.windtrap.power, -100);
  assert.equal(STRUCTURES.refinery.storage, 1005);
  assert.deepEqual([STRUCTURES.palace.w, STRUCTURES.palace.h, STRUCTURES.palace.cost], [3, 3, 999]);
  assert.equal(STRUCTURES.constructionYard.requires, null);
  assert.equal(HOUSES.harkonnen.color, 0xc8261e);
});

test('terrain movement table: mountains, concrete and worms', () => {
  assert.equal(moveFactor(SURFACE.MOUNTAIN, 'tracked'), 0);
  assert.equal(moveFactor(SURFACE.MOUNTAIN, 'foot'), 64);
  assert.equal(moveFactor(SURFACE.CONCRETE, 'wheeled'), 255);
  assert.equal(moveFactor(SURFACE.CONCRETE, 'worm'), 0);
  assert.equal(moveFactor(SURFACE.SAND, 'worm'), 192);
  assert.equal(moveFactor(SURFACE.BLOCKED, 'air'), 255);
  assert.equal(moveFactor(SURFACE.BLOCKED, 'foot'), 0);
});

test('conversions follow spec §4.1', () => {
  assert.ok(Math.abs(groundSpeed(25, 160) - 1.0764) < 1e-3);   // Combat Tank on rock
  assert.ok(groundSpeed(45, 160) > groundSpeed(25, 160));        // Trike outruns the tank
  assert.equal(groundSpeed(25, 0), 0);
  assert.equal(fireDelaySeconds(80), 2);
  assert.ok(Math.abs(buildSeconds(48) - 21.6) < 1e-9);
  assert.ok(TURN_RATE[1] < TURN_RATE[2] && TURN_RATE[2] < TURN_RATE[3]);
  assert.ok(DRIVE_ANGLE.tracked < DRIVE_ANGLE.wheeled);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/data.test.mjs`
Expected: FAIL — cannot find `../src/data/houses.js`.

- [ ] **Step 3: Write the tables**

**File: `src/data/houses.js`**
```js
// The Great Houses and the campaign sub-houses (docs/research/raw/mechanics-campaign.md §10.2).
export const HOUSES = {
  atreides:  { id: 'atreides',  name: 'Atreides',  color: 0x2f6fe0, mentat: 'Cyril',  palace: 'fremen',    toughness: 77,  playable: true },
  harkonnen: { id: 'harkonnen', name: 'Harkonnen', color: 0xc8261e, mentat: 'Radnor', palace: 'deathHand', toughness: 200, playable: true },
  ordos:     { id: 'ordos',     name: 'Ordos',     color: 0x2e9e3e, mentat: 'Ammon',  palace: 'saboteur',  toughness: 128, playable: true },
  fremen:    { id: 'fremen',    name: 'Fremen',    color: 0xa8834a, palace: 'fremen',    toughness: 10, playable: false },
  sardaukar: { id: 'sardaukar', name: 'Sardaukar', color: 0x7a3fb0, palace: 'deathHand', toughness: 10, playable: false },
};
export const PLAYABLE_HOUSES = ['atreides', 'harkonnen', 'ordos'];
// Starting-force helpers: the light vehicle and infantry each house fields from the start.
export const LIGHT_VEHICLE = { atreides: 'trike', harkonnen: 'quad', ordos: 'raider' };
export const INFANTRY = { atreides: 'infantry', harkonnen: 'troopers', ordos: 'infantry' };
```

**File: `src/data/terrain.js`**
```js
// Ground types and the original movement table (OpenDUNE landscapeinfo.c,
// docs/research/raw/mechanics-campaign.md §1.2). Values are out of 255 of a unit's full speed; 0 = impassable.
export const G = { SAND: 0, DUNE: 1, ROCK: 2, MOUNTAIN: 3 };
export const SURFACE = { SAND: 0, DUNE: 1, ROCK: 2, MOUNTAIN: 3, SPICE: 4, CONCRETE: 5, RUBBLE: 6, BLOCKED: 7 };
//            foot tracked harvester wheeled air worm
const TABLE = [
  [112, 112, 112, 160, 255, 192], // sand
  [112, 160, 160, 160, 255, 192], // dune
  [112, 160, 160, 112, 255, 0],   // rock
  [64, 0, 0, 0, 255, 0],          // mountain
  [112, 160, 160, 160, 255, 192], // spice (on sand)
  [255, 255, 255, 255, 255, 0],   // concrete slab
  [160, 160, 160, 160, 255, 0],   // rubble (destroyed wall/structure)
  [0, 0, 0, 0, 255, 0],           // structure or wall
];
const COLUMN = { foot: 0, tracked: 1, harvester: 2, wheeled: 3, air: 4, worm: 5 };

export function moveFactor(surface, moveClass) {
  return TABLE[surface][COLUMN[moveClass]];
}
```

**File: `src/data/units.js`**
```js
// Unit table with the original Dune II values (OpenDUNE unitinfo.c, docs/research/raw/units.md).
// speed/turn/fireDelay/buildTime are original units; src/data/tuning.js converts them.
export const MOVE = { FOOT: 'foot', TRACKED: 'tracked', HARVESTER: 'harvester', WHEELED: 'wheeled', AIR: 'air', WORM: 'worm' };
const ALL = ['atreides', 'harkonnen', 'ordos'];

export const UNITS = {
  soldier:     { name: 'Light Infantry', houses: ['atreides', 'ordos'], builtAt: 'barracks', upgrade: 0, cost: 60, buildTime: 32, hp: 20, move: MOVE.FOOT, speed: 8, turn: 3, turret: false, weapon: 'rifle', damage: 3, range: 2, fireDelay: 45, sight: 1, figures: 1 },
  infantry:    { name: 'Infantry Squad', houses: ['atreides', 'ordos'], builtAt: 'barracks', upgrade: 1, cost: 100, buildTime: 32, hp: 50, move: MOVE.FOOT, speed: 5, turn: 3, turret: false, weapon: 'rifle', damage: 3, range: 2, fireDelay: 45, firesTwice: true, sight: 1, figures: 3 },
  trooper:     { name: 'Heavy Trooper', houses: ['harkonnen', 'ordos'], builtAt: 'wor', upgrade: 0, cost: 100, buildTime: 56, hp: 45, move: MOVE.FOOT, speed: 15, turn: 3, turret: false, weapon: 'trooperRocket', damage: 5, range: 5, fireDelay: 50, targetAir: true, sight: 1, figures: 1 },
  troopers:    { name: 'Trooper Squad', houses: ['harkonnen', 'ordos'], builtAt: 'wor', upgrade: 1, cost: 200, buildTime: 56, hp: 110, move: MOVE.FOOT, speed: 10, turn: 3, turret: false, weapon: 'trooperRocket', damage: 5, range: 5, fireDelay: 50, firesTwice: true, targetAir: true, sight: 1, figures: 3 },
  saboteur:    { name: 'Saboteur', houses: ['ordos'], builtAt: 'palace', upgrade: 0, cost: 0, buildTime: 48, hp: 10, move: MOVE.FOOT, speed: 40, turn: 3, turret: false, weapon: 'pistol', damage: 2, range: 2, fireDelay: 45, sight: 1, figures: 1 },
  trike:       { name: 'Trike', houses: ['atreides'], builtAt: 'lightFactory', upgrade: 0, cost: 150, buildTime: 40, hp: 100, move: MOVE.WHEELED, speed: 45, turn: 2, turret: false, weapon: 'mg', damage: 5, range: 3, fireDelay: 50, firesTwice: true, sight: 2, explodes: true },
  raider:      { name: 'Raider Trike', houses: ['ordos'], builtAt: 'lightFactory', upgrade: 0, cost: 150, buildTime: 40, hp: 80, move: MOVE.WHEELED, speed: 60, turn: 2, turret: false, weapon: 'mg', damage: 5, range: 3, fireDelay: 50, firesTwice: true, sight: 2, explodes: true },
  quad:        { name: 'Quad', houses: ALL, builtAt: 'lightFactory', upgrade: 1, cost: 200, buildTime: 48, hp: 130, move: MOVE.WHEELED, speed: 40, turn: 2, turret: false, weapon: 'mg', damage: 7, range: 3, fireDelay: 50, firesTwice: true, sight: 2 },
  combatTank:  { name: 'Combat Tank', houses: ALL, builtAt: 'heavyFactory', upgrade: 0, cost: 300, buildTime: 64, hp: 200, move: MOVE.TRACKED, speed: 25, turn: 1, turret: true, weapon: 'cannon', damage: 25, range: 4, fireDelay: 80, sight: 3 },
  siegeTank:   { name: 'Siege Tank', houses: ALL, builtAt: 'heavyFactory', upgrade: 3, cost: 600, buildTime: 96, hp: 300, move: MOVE.TRACKED, speed: 20, turn: 1, turret: true, weapon: 'heavyCannon', damage: 30, range: 5, fireDelay: 90, firesTwice: true, sight: 4 },
  missileTank: { name: 'Missile Tank', houses: ['atreides', 'harkonnen'], builtAt: 'heavyFactory', upgrade: 2, cost: 450, buildTime: 72, hp: 100, move: MOVE.TRACKED, speed: 30, turn: 1, turret: true, weapon: 'rocket', damage: 75, range: 9, fireDelay: 120, firesTwice: true, targetAir: true, sight: 5, explodes: true },
  deviator:    { name: 'Deviator', houses: ['ordos'], builtAt: 'heavyFactory', upgrade: 0, requires: ['ix'], cost: 750, buildTime: 80, hp: 120, move: MOVE.TRACKED, speed: 30, turn: 1, turret: true, weapon: 'gasRocket', damage: 0, range: 7, fireDelay: 180, sight: 5 },
  sonicTank:   { name: 'Sonic Tank', houses: ['atreides'], builtAt: 'heavyFactory', upgrade: 0, requires: ['ix'], cost: 600, buildTime: 104, hp: 110, move: MOVE.TRACKED, speed: 30, turn: 1, turret: false, weapon: 'sonic', damage: 60, range: 8, fireDelay: 80, sight: 4 },
  devastator:  { name: 'Devastator', houses: ['harkonnen'], builtAt: 'heavyFactory', upgrade: 0, requires: ['ix'], cost: 800, buildTime: 104, hp: 400, move: MOVE.TRACKED, speed: 10, turn: 1, turret: false, weapon: 'plasma', damage: 40, range: 5, fireDelay: 100, firesTwice: true, sight: 4 },
  harvester:   { name: 'Harvester', houses: ALL, builtAt: 'heavyFactory', upgrade: 0, cost: 300, buildTime: 64, hp: 150, move: MOVE.HARVESTER, speed: 20, turn: 1, turret: false, weapon: null, sight: 2, explodes: true, carriable: true },
  mcv:         { name: 'MCV', houses: ALL, builtAt: 'heavyFactory', upgrade: 1, cost: 900, buildTime: 80, hp: 150, move: MOVE.TRACKED, speed: 20, turn: 1, turret: false, weapon: null, sight: 2, explodes: true, carriable: true, deploysTo: 'constructionYard' },
  carryall:    { name: 'Carryall', houses: ALL, builtAt: 'hiTech', upgrade: 0, cost: 800, buildTime: 64, hp: 100, move: MOVE.AIR, speed: 200, turn: 3, turret: false, weapon: null, sight: 0 },
  ornithopter: { name: 'Ornithopter', houses: ['atreides', 'ordos'], builtAt: 'hiTech', upgrade: 1, requires: ['ix'], cost: 600, buildTime: 96, hp: 25, move: MOVE.AIR, speed: 150, turn: 2, turret: false, weapon: 'miniRocket', damage: 50, range: 4, fireDelay: 50, firesTwice: true, sight: 5 },
  frigate:     { name: 'Frigate', houses: [], builtAt: null, upgrade: 0, cost: 0, buildTime: 0, hp: 100, move: MOVE.AIR, speed: 130, turn: 2, turret: false, weapon: null, sight: 0 },
  sandworm:    { name: 'Sandworm', houses: [], builtAt: null, upgrade: 0, cost: 0, buildTime: 0, hp: 1000, move: MOVE.WORM, speed: 35, turn: 3, turret: false, weapon: 'swallow', damage: 0, range: 1, fireDelay: 20, sight: 0 },
};
```

**File: `src/data/structures.js`**
```js
// Structure table with the original Dune II values (OpenDUNE structureinfo.c,
// docs/research/raw/structures.md). power > 0 consumes, power < 0 produces.
// requires: null means "never built from the menu" (the Construction Yard comes from an MCV).
const ALL = ['atreides', 'harkonnen', 'ordos'];

export const STRUCTURES = {
  concrete:         { name: 'Concrete Slab', w: 1, h: 1, cost: 5, buildTime: 16, hp: 20, power: 0, sight: 1, requires: [], houses: ALL, tech: 1, isConcrete: true },
  concrete4:        { name: 'Large Concrete Slab', w: 2, h: 2, cost: 20, buildTime: 16, hp: 20, power: 0, sight: 1, requires: [], requiresUpgrade: { constructionYard: 1 }, houses: ALL, tech: 4, isConcrete: true },
  wall:             { name: 'Wall', w: 1, h: 1, cost: 50, buildTime: 40, hp: 50, power: 0, sight: 1, requires: ['outpost'], houses: ALL, tech: 4, isWall: true },
  windtrap:         { name: 'Wind Trap', w: 2, h: 2, cost: 300, buildTime: 48, hp: 200, power: -100, sight: 2, requires: [], houses: ALL, tech: 1, conquerable: true },
  refinery:         { name: 'Spice Refinery', w: 3, h: 2, cost: 400, buildTime: 80, hp: 450, power: 30, storage: 1005, sight: 4, requires: ['windtrap'], houses: ALL, tech: 1, conquerable: true },
  silo:             { name: 'Spice Silo', w: 2, h: 2, cost: 150, buildTime: 48, hp: 150, power: 5, storage: 1000, sight: 2, requires: ['refinery'], houses: ALL, tech: 2, conquerable: true },
  outpost:          { name: 'Radar Outpost', w: 2, h: 2, cost: 400, buildTime: 80, hp: 500, power: 30, sight: 10, requires: ['windtrap'], houses: ALL, tech: 2 },
  barracks:         { name: 'Barracks', w: 2, h: 2, cost: 300, buildTime: 72, hp: 300, power: 10, sight: 2, requires: ['outpost'], houses: ['atreides', 'ordos'], tech: 2, produces: 'infantry', upgrades: [150] },
  wor:              { name: 'WOR Trooper Facility', w: 2, h: 2, cost: 400, buildTime: 104, hp: 400, power: 20, sight: 3, requires: ['outpost'], houses: ['harkonnen', 'ordos'], tech: 5, techByHouse: { harkonnen: 2 }, produces: 'infantry', upgrades: [200] },
  lightFactory:     { name: 'Light Factory', w: 2, h: 2, cost: 400, buildTime: 96, hp: 350, power: 20, sight: 3, requires: ['refinery'], houses: ALL, tech: 3, techByHouse: { atreides: 2, ordos: 2 }, produces: 'light', upgrades: [200], conquerable: true },
  heavyFactory:     { name: 'Heavy Factory', w: 3, h: 2, cost: 600, buildTime: 144, hp: 200, power: 35, sight: 3, requires: ['lightFactory', 'outpost'], houses: ALL, tech: 4, produces: 'heavy', upgrades: [300, 300, 300], conquerable: true },
  hiTech:           { name: 'Hi-Tech Factory', w: 3, h: 2, cost: 500, buildTime: 120, hp: 400, power: 35, sight: 3, requires: ['lightFactory', 'outpost'], houses: ALL, tech: 5, produces: 'air', upgrades: [250], conquerable: true },
  repair:           { name: 'Repair Facility', w: 3, h: 2, cost: 700, buildTime: 80, hp: 200, power: 20, sight: 3, requires: ['lightFactory', 'outpost'], houses: ALL, tech: 5, conquerable: true },
  ix:               { name: 'House of IX', w: 2, h: 2, cost: 500, buildTime: 120, hp: 400, power: 40, sight: 3, requires: ['starport'], houses: ALL, tech: 7 },
  starport:         { name: 'Starport', w: 3, h: 3, cost: 500, buildTime: 120, hp: 500, power: 50, sight: 6, requires: ['refinery'], houses: ALL, tech: 6, conquerable: true },
  palace:           { name: 'Palace', w: 3, h: 3, cost: 999, buildTime: 130, hp: 1000, power: 80, sight: 5, requires: ['starport'], houses: ALL, tech: 8 },
  turret:           { name: 'Gun Turret', w: 1, h: 1, cost: 125, buildTime: 64, hp: 200, power: 10, sight: 2, requires: ['outpost'], houses: ALL, tech: 5, conquerable: true },
  rocketTurret:     { name: 'Rocket Turret', w: 1, h: 1, cost: 250, buildTime: 96, hp: 200, power: 25, sight: 5, requires: ['outpost'], requiresUpgrade: { constructionYard: 2 }, houses: ALL, tech: 6, conquerable: true },
  constructionYard: { name: 'Construction Yard', w: 2, h: 2, cost: 400, buildTime: 80, hp: 400, power: 0, sight: 3, requires: null, houses: ALL, tech: 1, produces: 'structure', upgrades: [200, 200], conquerable: true },
};
```

**File: `src/data/tuning.js`**
```js
// Every conversion from original Dune II numbers to real time and tiles (spec §4.1). Tune here only.
export const SIM_HZ = 20;
export const DT = 1 / SIM_HZ;
export const TERRAIN_REF = 192;

/** Tiles per second for a ground unit with original speed factor on terrain value 0..255. */
export function groundSpeed(factor, terrain) { return ((0.25 + factor / 24) * terrain) / TERRAIN_REF; }
/** Tiles per second for aircraft. */
export function airSpeed(factor) { return factor / 40; }
export function fireDelaySeconds(fireDelay) { return fireDelay / 40; }
export function buildSeconds(buildTime) { return buildTime * 0.45; }
export function unitSight(radius) { return radius + 1; }

/** Radians per second by original turning class (1 = heavy tracked … 3 = infantry). */
export const TURN_RATE = [0, 2.6, 4.8, 10];
/** How far off its heading (radians) a unit may start driving; beyond it, it turns on the spot first. */
export const DRIVE_ANGLE = { foot: Math.PI, tracked: 0.5, harvester: 0.5, wheeled: 1.1, air: Math.PI, worm: Math.PI };
export const GAME_SPEED = { slowest: 0.5, slow: 0.75, normal: 1, fast: 1.25, fastest: 1.5 };

export const STUCK_REPATH_SECONDS = 1.5;
export const STUCK_GIVEUP_SECONDS = 5;

export const SPICE_PER_TILE = 250;
export const THICK_SPICE_PER_TILE = 750;
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/data.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data tests/data.test.mjs
git commit -m "feat(data): houses, terrain movement table, unit and structure tables, tuning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Map model and generator

**Files:**
- Create: `src/sim/map.js`, `src/sim/mapgen.js`
- Test: `tests/mapgen.test.mjs`

**Interfaces:**
- Consumes: `G`, `SURFACE`, `moveFactor` (Task 3); `Rng` (Task 2); `SPICE_PER_TILE`, `THICK_SPICE_PER_TILE`.
- Produces: `class GameMap(w, h)` with typed arrays `ground`, `spice` (credits per tile), `concrete` (0 or house slot+1), `bloom`, `rubble`, `structure` (id), `unit` (id); counters `revision`, `spiceRevision`, `concreteRevision`; property `seed`; methods `idx(x,y)`, `xOf(i)`, `yOf(i)`, `inBounds(x,y)`, `surface(i)`, `moveFactor(i, moveClass)`, `isSand(i)`, `isBuildableGround(i)`, `setSpice(i, amount)`. `generateMap({w, h, seed, players, spiceFields?, blooms?})` → `{map, starts: [{x,y}]}`; `PLATEAU_RADIUS`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/mapgen.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../src/sim/mapgen.js';
import { GameMap } from '../src/sim/map.js';
import { G, SURFACE } from '../src/data/terrain.js';

function reachableTracked(map, from, to) {
  const seen = new Uint8Array(map.w * map.h);
  const q = [from]; seen[from] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    if (i === to) return true;
    const x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (!seen[ni] && map.moveFactor(ni, 'tracked') > 0) { seen[ni] = 1; q.push(ni); }
    }
  }
  return false;
}

test('generation is deterministic per seed', () => {
  const a = generateMap({ w: 64, h: 64, seed: 5 }), b = generateMap({ w: 64, h: 64, seed: 5 }), c = generateMap({ w: 64, h: 64, seed: 6 });
  assert.deepEqual(a.map.ground, b.map.ground);
  assert.deepEqual(a.map.spice, b.map.spice);
  assert.deepEqual(a.starts, b.starts);
  assert.notDeepEqual(a.map.ground, c.map.ground);
});

test('every start sits on a 13x13 rock plateau', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { map, starts } = generateMap({ w: 64, h: 64, seed, players: 2 });
    for (const s of starts) {
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        assert.equal(map.ground[map.idx(s.x + dx, s.y + dy)], G.ROCK, `seed ${seed} start ${s.x},${s.y} offset ${dx},${dy}`);
      }
    }
  }
});

test('starts are connected for tracked vehicles and have spice within 15 tiles', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { map, starts } = generateMap({ w: 64, h: 64, seed, players: 2 });
    assert.ok(reachableTracked(map, map.idx(starts[0].x, starts[0].y), map.idx(starts[1].x, starts[1].y)), `seed ${seed} connected`);
    for (const s of starts) {
      let near = false;
      for (let i = 0; i < map.spice.length && !near; i++) if (map.spice[i] && Math.hypot(map.xOf(i) - s.x, map.yOf(i) - s.y) <= 15) near = true;
      assert.ok(near, `seed ${seed} spice near ${s.x},${s.y}`);
    }
  }
});

test('spice and blooms only lie on sand', () => {
  const { map } = generateMap({ w: 64, h: 64, seed: 3 });
  let spice = 0, blooms = 0;
  for (let i = 0; i < map.spice.length; i++) {
    if (map.spice[i]) { spice++; assert.ok(map.ground[i] === G.SAND || map.ground[i] === G.DUNE); assert.equal(map.surface(i), SURFACE.SPICE); }
    if (map.bloom[i]) { blooms++; assert.ok(map.ground[i] === G.SAND || map.ground[i] === G.DUNE); assert.equal(map.spice[i], 0); }
  }
  assert.ok(spice > 60, `spice tiles ${spice}`);
  assert.ok(blooms >= 1);
});

test('small and large maps work', () => {
  const small = generateMap({ w: 32, h: 32, seed: 2, players: 1 });
  assert.equal(small.starts.length, 1);
  const t0 = Date.now();
  const big = generateMap({ w: 128, h: 128, seed: 2, players: 4 });
  assert.equal(big.starts.length, 4);
  assert.ok(Date.now() - t0 < 3000);
});

test('surface reflects structures, concrete, rubble and mountains', () => {
  const m = new GameMap(4, 4);
  m.ground.fill(G.ROCK);
  assert.equal(m.surface(0), SURFACE.ROCK);
  m.concrete[0] = 1; assert.equal(m.surface(0), SURFACE.CONCRETE);
  m.structure[0] = 7; assert.equal(m.surface(0), SURFACE.BLOCKED);
  m.rubble[1] = 1; assert.equal(m.surface(1), SURFACE.RUBBLE);
  m.ground[2] = G.MOUNTAIN; assert.equal(m.moveFactor(2, 'tracked'), 0);
  assert.ok(m.isBuildableGround(3));
  m.ground[3] = G.SAND; assert.ok(!m.isBuildableGround(3)); assert.ok(m.isSand(3));
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/mapgen.test.mjs`
Expected: FAIL — cannot find `../src/sim/mapgen.js`.

- [ ] **Step 3: Implement the map and the generator**

**File: `src/sim/map.js`**
```js
// Tile grid shared by every system. Ground types never change during a game; spice, concrete,
// rubble, structures and unit occupancy do.
import { G, SURFACE, moveFactor } from '../data/terrain.js';

export class GameMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.ground = new Uint8Array(n);      // G.*
    this.spice = new Uint16Array(n);      // spice credits lying on the tile
    this.concrete = new Uint8Array(n);    // 0 = none, else owning house slot + 1
    this.bloom = new Uint8Array(n);       // 1 = spice bloom mound
    this.rubble = new Uint8Array(n);      // 1 = rubble of a destroyed wall/structure
    this.structure = new Int32Array(n);   // structure id or 0
    this.unit = new Int32Array(n);        // ground unit id holding or reserving the tile, or 0
    this.revision = 0;                    // bumps whenever passability changes
    this.spiceRevision = 0;
    this.concreteRevision = 0;
    this.seed = 1;
  }

  idx(x, y) { return y * this.w + x; }
  xOf(i) { return i % this.w; }
  yOf(i) { return (i / this.w) | 0; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  surface(i) {
    if (this.structure[i]) return SURFACE.BLOCKED;
    if (this.concrete[i]) return SURFACE.CONCRETE;
    const g = this.ground[i];
    if (g === G.MOUNTAIN) return SURFACE.MOUNTAIN;
    if (g === G.ROCK) return this.rubble[i] ? SURFACE.RUBBLE : SURFACE.ROCK;
    if (this.spice[i] > 0) return SURFACE.SPICE;
    return g === G.DUNE ? SURFACE.DUNE : SURFACE.SAND;
  }

  moveFactor(i, moveClass) { return moveFactor(this.surface(i), moveClass); }

  isSand(i) {
    const g = this.ground[i];
    return (g === G.SAND || g === G.DUNE) && !this.concrete[i] && !this.structure[i];
  }

  isBuildableGround(i) { return this.ground[i] === G.ROCK && !this.structure[i]; }

  setSpice(i, amount) {
    this.spice[i] = Math.max(0, Math.min(65535, Math.round(amount)));
    this.spiceRevision++;
  }
}
```

**File: `src/sim/mapgen.js`**
```js
// Map generator after the original Dune II algorithm (seeded noise → blur → thresholds →
// spice blobs, docs/research/raw/mechanics-campaign.md §1.4) plus the spec §4.2 guarantees:
// a 13x13 rock plateau under every start, tracked connectivity between starts, spice near each start.
import { Rng } from '../core/rng.js';
import { G } from '../data/terrain.js';
import { SPICE_PER_TILE, THICK_SPICE_PER_TILE } from '../data/tuning.js';
import { GameMap } from './map.js';

export const PLATEAU_RADIUS = 8;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function valueNoise(rng, size = 64) {
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();
  const at = (x, y) => lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise, x, y, octaves) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += amp * noise(x * freq, y * freq); norm += amp; amp *= 0.5; freq *= 2; }
  return sum / norm;
}

function blur(src, w, h) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      sum += src[ny * w + nx]; count++;
    }
    out[y * w + x] = sum / count;
  }
  return out;
}

function quantile(values, q) {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export function startPositions(w, h, count, rng) {
  const m = Math.max(6, Math.min(10, Math.floor(Math.min(w, h) / 5)));
  const corners = [[m, m], [w - 1 - m, h - 1 - m], [w - 1 - m, m], [m, h - 1 - m]];
  const order = rng.chance(0.5) ? [0, 1, 2, 3] : [2, 3, 0, 1];
  return order.slice(0, count).map((k) => ({ x: corners[k][0], y: corners[k][1] }));
}

function stampPlateau(map, cx, cy, r) {
  for (let dy = -r - 3; dy <= r + 3; dy++) for (let dx = -r - 3; dx <= r + 3; dx++) {
    const x = cx + dx, y = cy + dy;
    if (!map.inBounds(x, y)) continue;
    const d = (Math.abs(dx) / r) ** 4 + (Math.abs(dy) / r) ** 4;
    const i = map.idx(x, y);
    if (d <= 1) map.ground[i] = G.ROCK;
    else if (d <= 1.8 && map.ground[i] === G.MOUNTAIN) map.ground[i] = G.ROCK;
  }
}

function reachable(map, from, passable) {
  const seen = new Uint8Array(map.w * map.h);
  const queue = [from];
  seen[from] = 1;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k], x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (seen[ni] || !passable(ni)) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}

function carveLine(map, a, b) {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(a.x + ((b.x - a.x) * s) / steps), y = Math.round(a.y + ((b.y - a.y) * s) / steps);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (map.inBounds(nx, ny) && map.ground[map.idx(nx, ny)] === G.MOUNTAIN) map.ground[map.idx(nx, ny)] = G.ROCK;
    }
  }
}

function connectStarts(map, starts) {
  const passable = (i) => map.ground[i] !== G.MOUNTAIN;
  for (let k = 1; k < starts.length; k++) {
    const seen = reachable(map, map.idx(starts[0].x, starts[0].y), passable);
    if (!seen[map.idx(starts[k].x, starts[k].y)]) carveLine(map, starts[0], starts[k]);
  }
}

const isSandGround = (map, i) => map.ground[i] === G.SAND || map.ground[i] === G.DUNE;

function growField(map, rng, cx, cy, size) {
  const start = map.idx(cx, cy);
  if (!isSandGround(map, start)) return 0;
  const seen = new Set([start]);
  const frontier = [start];
  let placed = 0;
  while (frontier.length && placed < size) {
    const i = frontier.splice(rng.int(frontier.length), 1)[0];
    if (!isSandGround(map, i)) continue;
    map.spice[i] = placed < size * 0.3 ? THICK_SPICE_PER_TILE : SPICE_PER_TILE;
    placed++;
    const x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (!seen.has(ni) && rng.chance(0.75)) { seen.add(ni); frontier.push(ni); }
    }
  }
  return placed;
}

function spiceNear(map, rng, s, starts) {
  const candidates = [];
  for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
    const d = Math.hypot(dx, dy);
    if (d < 9 || d > 13) continue;
    const x = s.x + dx, y = s.y + dy;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (isSandGround(map, i) && starts.every((o) => Math.hypot(o.x - x, o.y - y) >= 9)) candidates.push(i);
  }
  if (!candidates.length) {
    // no sand nearby: open a patch of desert toward the map centre, never inside a start plateau core
    const ang = Math.atan2(map.h / 2 - s.y, map.w / 2 - s.x);
    const x = Math.max(3, Math.min(map.w - 4, Math.round(s.x + Math.cos(ang) * 13)));
    const y = Math.max(3, Math.min(map.h - 4, Math.round(s.y + Math.sin(ang) * 13)));
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const tx = x + dx, ty = y + dy;
      if (starts.some((o) => Math.max(Math.abs(o.x - tx), Math.abs(o.y - ty)) <= 7)) continue;
      map.ground[map.idx(tx, ty)] = G.SAND;
    }
    candidates.push(map.idx(x, y));
  }
  const i = rng.pick(candidates);
  growField(map, rng, map.xOf(i), map.yOf(i), 24 + rng.int(14));
}

function placeSpice(map, rng, starts, count) {
  for (const s of starts) spiceNear(map, rng, s, starts);
  let made = 0, attempts = 0;
  while (made < count && attempts++ < count * 40) {
    const x = rng.int(map.w), y = rng.int(map.h), i = map.idx(x, y);
    if (!isSandGround(map, i) || map.spice[i]) continue;
    if (starts.some((s) => Math.hypot(s.x - x, s.y - y) < 10)) continue;
    if (growField(map, rng, x, y, 18 + rng.int(30)) > 0) made++;
  }
}

function placeBlooms(map, rng, starts, count) {
  let made = 0, attempts = 0;
  while (made < count && attempts++ < count * 60) {
    const x = rng.int(map.w), y = rng.int(map.h), i = map.idx(x, y);
    if (!isSandGround(map, i) || map.spice[i] || map.bloom[i]) continue;
    if (starts.some((s) => Math.hypot(s.x - x, s.y - y) < 12)) continue;
    map.bloom[i] = 1;
    made++;
  }
}

export function generateMap({ w = 64, h = 64, seed = 1, players = 2, spiceFields = null, blooms = null } = {}) {
  const rng = new Rng(seed);
  const map = new GameMap(w, h);
  map.seed = seed;
  const n = w * h;
  const heightNoise = valueNoise(rng), duneNoise = valueNoise(rng);
  let height = new Float32Array(n);
  const dune = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    height[y * w + x] = fbm(heightNoise, x / 11, y / 11, 4);
    dune[y * w + x] = fbm(duneNoise, x / 5, y / 9, 2);
  }
  height = blur(height, w, h);
  const rockCut = quantile(height, 0.63), mountainCut = quantile(height, 0.93), duneCut = quantile(dune, 0.62);
  for (let i = 0; i < n; i++) {
    map.ground[i] = height[i] >= mountainCut ? G.MOUNTAIN : height[i] >= rockCut ? G.ROCK : dune[i] >= duneCut ? G.DUNE : G.SAND;
  }
  const starts = startPositions(w, h, players, rng);
  for (const s of starts) stampPlateau(map, s.x, s.y, PLATEAU_RADIUS);
  connectStarts(map, starts);
  placeSpice(map, rng, starts, spiceFields ?? Math.max(3, Math.round(n / 420)));
  placeBlooms(map, rng, starts, blooms ?? Math.max(1, Math.round(n / 1400)));
  map.spiceRevision++;
  return { map, starts };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/mapgen.test.mjs`
Expected: PASS (6 tests). If "spice near start" fails for a seed, check that `spiceNear` runs before the random fields and that the forced sand patch lands about 13 tiles out.

- [ ] **Step 5: Commit**

```bash
git add src/sim/map.js src/sim/mapgen.js tests/mapgen.test.mjs
git commit -m "feat(sim): tile map and seeded map generator with plateau, connectivity and spice guarantees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pathfinding

**Files:**
- Create: `src/sim/pathfind.js`
- Test: `tests/pathfind.test.mjs`

**Interfaces:**
- Consumes: `GameMap.moveFactor(i, moveClass)` (Task 4); `TERRAIN_REF` (Task 3).
- Produces: `class PathFinder(map)` with `find(start, goal, moveClass, {maxNodes=30000, blocked=null, extraCost=null})` → `{path: number[] (tile indices, excludes start), reached: boolean}` and property `expanded` (nodes expanded by the last search). When the goal is unreachable or the budget runs out, the path ends at the explored tile closest to the goal.

- [ ] **Step 1: Write the failing tests**

**File: `tests/pathfind.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../src/sim/map.js';
import { PathFinder } from '../src/sim/pathfind.js';
import { G } from '../src/data/terrain.js';

function mapFrom(rows) {
  // '.' sand, 'r' rock, 'M' mountain
  const h = rows.length, w = rows[0].length, m = new GameMap(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m.ground[m.idx(x, y)] = { '.': G.SAND, r: G.ROCK, M: G.MOUNTAIN }[rows[y][x]];
  return m;
}

test('straight path on open ground', () => {
  const m = mapFrom(Array(5).fill('r'.repeat(20)));
  const { path, reached } = new PathFinder(m).find(m.idx(2, 2), m.idx(12, 2), 'tracked');
  assert.ok(reached);
  assert.equal(path.length, 10);
  assert.ok(path.every((i) => m.yOf(i) === 2));
  assert.equal(path.at(-1), m.idx(12, 2));
});

test('goes through the gap in a mountain wall', () => {
  const m = mapFrom([
    'rrrrrMrrrr',
    'rrrrrMrrrr',
    'rrrrrrrrrr',
    'rrrrrMrrrr',
    'rrrrrMrrrr',
  ]);
  const { path, reached } = new PathFinder(m).find(m.idx(1, 0), m.idx(8, 0), 'tracked');
  assert.ok(reached);
  assert.ok(path.includes(m.idx(5, 2)));
});

test('no diagonal squeeze between two mountains', () => {
  const m = mapFrom([
    'rrr',
    'rMr',
    'rrM',
  ]);
  // from (1,2)... a diagonal step (1,0)->(2,1) would cut the corner between (1,1)M and (2,0) — allowed only if both orthogonals are passable
  const pf = new PathFinder(m);
  const { path } = pf.find(m.idx(0, 2), m.idx(2, 0), 'tracked');
  for (let k = 0, prev = m.idx(0, 2); k < path.length; prev = path[k], k++) {
    const dx = m.xOf(path[k]) - m.xOf(prev), dy = m.yOf(path[k]) - m.yOf(prev);
    if (dx && dy) {
      assert.ok(m.moveFactor(m.idx(m.xOf(prev) + dx, m.yOf(prev)), 'tracked') > 0);
      assert.ok(m.moveFactor(m.idx(m.xOf(prev), m.yOf(prev) + dy), 'tracked') > 0);
    }
  }
});

test('tracked units cannot cross a mountain band but infantry can', () => {
  const m = mapFrom([
    'rrrMMrrr',
    'rrrMMrrr',
    'rrrMMrrr',
  ]);
  const pf = new PathFinder(m);
  const tank = pf.find(m.idx(0, 1), m.idx(7, 1), 'tracked');
  assert.equal(tank.reached, false);
  assert.equal(tank.path.at(-1), m.idx(2, 1));   // stops at the foot of the mountains, nearest the goal
  const foot = pf.find(m.idx(0, 1), m.idx(7, 1), 'foot');
  assert.ok(foot.reached);
});

test('wheeled units prefer sand over rock', () => {
  const m = mapFrom([
    '...........',
    '...........',
    'rrrrrrrrrrr',
    '...........',
    '...........',
  ]);
  const { path } = new PathFinder(m).find(m.idx(0, 2), m.idx(10, 2), 'wheeled');
  const onRock = path.filter((i) => m.ground[i] === G.ROCK).length;
  assert.ok(onRock <= 2, `rock tiles on path: ${onRock}`);
});

test('budget exhaustion returns a partial path toward the goal', () => {
  const m = mapFrom(Array(40).fill('r'.repeat(40)));
  const pf = new PathFinder(m);
  const { path, reached } = pf.find(m.idx(0, 0), m.idx(39, 39), 'tracked', { maxNodes: 50 });
  assert.equal(reached, false);
  assert.ok(path.length > 0);
  const end = path.at(-1);
  assert.ok(Math.hypot(m.xOf(end) - 39, m.yOf(end) - 39) < Math.hypot(39, 39));
});

test('blocked callback is respected except at the goal', () => {
  const m = mapFrom(Array(3).fill('rrrrr'));
  const pf = new PathFinder(m);
  const wall = new Set([m.idx(2, 0), m.idx(2, 1)]);
  const { path, reached } = pf.find(m.idx(0, 0), m.idx(4, 0), 'tracked', { blocked: (i) => wall.has(i) });
  assert.ok(reached);
  assert.ok(path.includes(m.idx(2, 2)));
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/pathfind.test.mjs`
Expected: FAIL — cannot find `../src/sim/pathfind.js`.

- [ ] **Step 3: Implement A***

**File: `src/sim/pathfind.js`**
```js
// A* on the tile grid: 8-connected, no corner cutting, step cost = distance × TERRAIN_REF / terrain
// factor, so slow ground is avoided the way the original units avoid it. Unreachable goals and
// exhausted budgets return the path to the explored tile closest to the goal.
import { TERRAIN_REF } from '../data/tuning.js';

const SQRT2 = Math.SQRT2;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]];
const MIN_STEP = TERRAIN_REF / 255;

class MinHeap {
  constructor(capacity) { this.ids = new Int32Array(capacity); this.pri = new Float32Array(capacity); this.size = 0; }
  clear() { this.size = 0; }
  push(id, p) {
    if (this.size === this.ids.length) this.grow();
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.pri[parent] <= p) break;
      this.ids[i] = this.ids[parent]; this.pri[i] = this.pri[parent]; i = parent;
    }
    this.ids[i] = id; this.pri[i] = p;
  }
  pop() {
    const top = this.ids[0];
    const lastId = this.ids[--this.size], lastP = this.pri[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.pri[c + 1] < this.pri[c]) c++;
      if (this.pri[c] >= lastP) break;
      this.ids[i] = this.ids[c]; this.pri[i] = this.pri[c]; i = c;
    }
    this.ids[i] = lastId; this.pri[i] = lastP;
    return top;
  }
  grow() {
    const ids = new Int32Array(this.ids.length * 2); ids.set(this.ids); this.ids = ids;
    const pri = new Float32Array(this.pri.length * 2); pri.set(this.pri); this.pri = pri;
  }
}

export class PathFinder {
  constructor(map) {
    this.map = map;
    const n = map.w * map.h;
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.opened = new Uint32Array(n);   // search generation that last touched the node
    this.closed = new Uint32Array(n);
    this.gen = 0;
    this.heap = new MinHeap(n);
    this.expanded = 0;
  }

  find(start, goal, moveClass, { maxNodes = 30000, blocked = null, extraCost = null } = {}) {
    const { map } = this;
    const w = map.w, h = map.h;
    const gen = ++this.gen;
    const gx = goal % w, gy = (goal / w) | 0;
    const hOf = (i) => {
      const dx = Math.abs((i % w) - gx), dy = Math.abs(((i / w) | 0) - gy);
      return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * MIN_STEP;
    };
    const passable = (i) => map.moveFactor(i, moveClass) > 0 && !(blocked && i !== goal && blocked(i));
    const heap = this.heap;
    heap.clear();
    this.g[start] = 0; this.from[start] = -1; this.opened[start] = gen;
    heap.push(start, hOf(start));
    let best = start, bestH = hOf(start), expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      if (cur === goal) { best = cur; bestH = 0; break; }
      const hc = hOf(cur);
      if (hc < bestH) { bestH = hc; best = cur; }
      if (++expanded > maxNodes) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy, dist] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (this.closed[ni] === gen || !passable(ni)) continue;
        if (dx && dy && (!passable(cy * w + nx) || !passable(ny * w + cx))) continue;
        const ng = this.g[cur] + (dist * TERRAIN_REF) / map.moveFactor(ni, moveClass) + (extraCost ? extraCost(ni) : 0);
        if (this.opened[ni] !== gen || ng < this.g[ni]) {
          this.opened[ni] = gen; this.g[ni] = ng; this.from[ni] = cur;
          heap.push(ni, ng + hOf(ni));
        }
      }
    }
    this.expanded = expanded;
    const path = [];
    for (let i = best; i !== start && i !== -1; i = this.from[i]) path.push(i);
    path.reverse();
    return { path, reached: best === goal };
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/pathfind.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/pathfind.js tests/pathfind.test.mjs
git commit -m "feat(sim): A* pathfinder with terrain costs, corner rules, budgets and nearest-reachable fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: World, units, movement and group orders

**Files:**
- Create: `src/sim/geometry.js`, `src/sim/house.js`, `src/sim/unit.js`, `src/sim/structure.js`, `src/sim/world.js`, `src/sim/movement.js`, `src/sim/destinations.js`, `src/sim/orders.js`, `tests/helpers.mjs`
- Test: `tests/movement.test.mjs`, `tests/orders.test.mjs`

**Interfaces:**
- Consumes: `GameMap` (Task 4), `PathFinder` (Task 5), `Rng`, `EventQueue` (Task 2), `UNITS`, `STRUCTURES`, `HOUSES`, tuning constants (Task 3).
- Produces:
  - `wrapAngle(a)`, `angleDiff(from,to)`, `turnToward(cur,target,maxStep)`, `lerpAngle(a,b,t)`, `TAU`.
  - `class House(id, slot, {credits, ai, techLevel})` → `{id, slot, info, credits, isAI, techLevel, stats}`.
  - `createUnit(id, typeId, house, x, y, {heading})` → unit record (fields listed in `unit.js`); `createStructure(id, typeId, house, x, y, {hpFraction})`; `footprint(x,y,w,h)` → `[[x,y],…]`.
  - `class World({map, seed})`: `map`, `rng`, `tick`, `time`, `houses` (Map), `units` (Map), `structures` (Map), `events` (EventQueue), `addHouse(id, opts)`, `spawnUnit(typeId, houseId, x, y, {heading})`, `spawnStructure(typeId, houseId, x, y, {hpFraction})`, `removeUnit(u, reason)`, `removeStructure(s, reason)`, `issue(houseId, command)`, `step()`, `requestPath(u, goal, {avoidUnits})`, hooks `onDeploy(u)` and `onTileEntered(u)` (null until later tasks set them).
  - Commands (objects passed to `world.issue`): `{type:'move', ids, x, y}`, `{type:'stop', ids}`, `{type:'guard', ids}`, `{type:'scatter', ids}`.
  - Events: `unitSpawned {id, house, unitType}`, `unitRemoved {id, reason}`, `structurePlaced {id, house, structureType, x, y}`, `structureRemoved {id, reason}`, `moveOrdered {ids, x, y}`, `arrived {id}`, `moveFailed {id}`, `commandRejected {house, command}`.
  - Test helpers `flatWorld(w, h, ground, seed)`, `run(world, seconds)`, `runUntil(world, pred, maxSeconds)` → seconds or -1.

- [ ] **Step 1: Write the test helpers and the failing tests**

**File: `tests/helpers.mjs`**
```js
import { GameMap } from '../src/sim/map.js';
import { World } from '../src/sim/world.js';
import { G } from '../src/data/terrain.js';

export function flatWorld(w = 24, h = 24, ground = G.ROCK, seed = 1) {
  const map = new GameMap(w, h);
  map.ground.fill(ground);
  const world = new World({ map, seed });
  world.addHouse('atreides');
  world.addHouse('harkonnen');
  world.addHouse('ordos');
  return world;
}

export function run(world, seconds) {
  for (let i = 0, n = Math.round(seconds * 20); i < n; i++) world.step();
}

/** Steps until pred() holds; returns the elapsed seconds, or -1 if it never did. */
export function runUntil(world, pred, maxSeconds) {
  for (let i = 0; i <= maxSeconds * 20; i++) {
    if (pred()) return i / 20;
    world.step();
  }
  return -1;
}
```

**File: `tests/movement.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

test('a tank drives to its destination and holds only that tile', () => {
  const world = flatWorld();
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 5, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 12, y: 5 });
  const t = runUntil(world, () => tank.order.type === 'idle' && tank.tx === 12, 20);
  assert.ok(t > 8 && t < 11, `took ${t}s (10 tiles at ~1.08 tiles/s)`);
  assert.equal(world.map.unit[world.map.idx(12, 5)], tank.id);
  assert.equal(world.map.unit[world.map.idx(2, 5)], 0);
  assert.equal(tank.x, 12.5);
  assert.equal(tank.y, 5.5);
});

test('tracked vehicles turn on the spot before driving', () => {
  const world = flatWorld();
  const tank = world.spawnUnit('combatTank', 'atreides', 10, 5, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 2, y: 5 });
  world.step();
  world.step();
  assert.equal(tank.x, 10.5, 'still on its tile while turning');
  assert.notEqual(tank.heading, 0);
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 20) > 0);
  assert.equal(tank.tx, 2);
});

test('a group order spreads units over distinct nearby tiles', () => {
  const world = flatWorld(30, 30, G.SAND);
  const ids = [];
  for (let k = 0; k < 20; k++) ids.push(world.spawnUnit('quad', 'harkonnen', 2 + (k % 5), 2 + Math.floor(k / 5)).id);
  world.issue('harkonnen', { type: 'move', ids, x: 20, y: 20 });
  world.step();   // the command applies on the next tick
  const t = runUntil(world, () => ids.every((id) => world.units.get(id).order.type === 'idle'), 60);
  assert.ok(t > 0, 'every unit settled');
  const units = ids.map((id) => world.units.get(id));
  assert.equal(new Set(units.map((u) => `${u.tx},${u.ty}`)).size, 20);
  for (const u of units) assert.ok(Math.max(Math.abs(u.tx - 20), Math.abs(u.ty - 20)) <= 5, `unit at ${u.tx},${u.ty}`);
});

test('an unreachable target sends the unit to the nearest reachable tile', () => {
  const world = flatWorld(20, 20, G.ROCK);
  const m = world.map;
  for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) if (x === 8 || x === 12 || y === 8 || y === 12) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 10, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 10, y: 10 });
  world.step();
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 30) > 0);
  assert.deepEqual([tank.tx, tank.ty], [7, 10]);
});

test('two tanks meeting head-on in a one-tile corridor never overlap and settle', () => {
  const world = flatWorld(20, 7, G.MOUNTAIN);
  const m = world.map;
  for (let x = 0; x < 20; x++) m.ground[m.idx(x, 3)] = G.ROCK;
  const a = world.spawnUnit('combatTank', 'atreides', 2, 3, { heading: 0 });
  const b = world.spawnUnit('combatTank', 'atreides', 17, 3, { heading: Math.PI });
  world.issue('atreides', { type: 'move', ids: [a.id], x: 17, y: 3 });
  world.issue('atreides', { type: 'move', ids: [b.id], x: 2, y: 3 });
  let minGap = Infinity;
  for (let i = 0; i < 20 * 20; i++) {
    world.step();
    minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y));
  }
  assert.ok(minGap >= 0.5, `closest approach ${minGap}`);
  assert.equal(a.order.type, 'idle');
  assert.equal(b.order.type, 'idle');
});

test('occupancy stays consistent under crossing traffic', () => {
  const world = flatWorld(24, 24, G.SAND, 3);
  const west = [], east = [];
  for (let k = 0; k < 6; k++) {
    west.push(world.spawnUnit('quad', 'atreides', 1, 4 + k * 2).id);
    east.push(world.spawnUnit('combatTank', 'atreides', 22, 4 + k * 2, { heading: Math.PI }).id);
  }
  world.issue('atreides', { type: 'move', ids: west, x: 21, y: 12 });
  world.issue('atreides', { type: 'move', ids: east, x: 2, y: 12 });
  for (let i = 0; i < 20 * 60; i++) {
    world.step();
    const held = new Map();
    for (const id of world.map.unit) if (id) held.set(id, (held.get(id) ?? 0) + 1);
    for (const u of world.units.values()) {
      const n = held.get(u.id) ?? 0;
      assert.ok(n >= 1 && n <= 2, `unit ${u.id} holds ${n} tiles at tick ${world.tick}`);
      assert.ok(world.map.unit[world.map.idx(u.tx, u.ty)] === u.id || (u.step && u.step.released), `unit ${u.id} lost its tile`);
      assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y));
    }
  }
  for (const u of world.units.values()) assert.equal(u.order.type, 'idle', `unit ${u.id} still ${u.order.type}`);
});

test('same seed and commands give identical results', () => {
  const once = () => {
    const world = flatWorld(24, 24, G.SAND, 9);
    const ids = [];
    for (let k = 0; k < 8; k++) ids.push(world.spawnUnit('quad', 'atreides', 1 + k, 1).id);
    world.issue('atreides', { type: 'move', ids, x: 18, y: 18 });
    world.issue('atreides', { type: 'scatter', ids: ids.slice(0, 3) });
    run(world, 15);
    return ids.map((id) => { const u = world.units.get(id); return [u.x, u.y, u.heading]; });
  };
  assert.deepEqual(once(), once());
});

test('a unit re-plans when a structure appears on its path', () => {
  const world = flatWorld(24, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 1, 5, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 20, y: 5 });
  run(world, 1);
  world.spawnStructure('windtrap', 'harkonnen', 10, 4);
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 40) > 0);
  assert.deepEqual([tank.tx, tank.ty], [20, 5]);
});
```

**File: `tests/orders.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run } from './helpers.mjs';

test('commands for another house\'s units are ignored', () => {
  const world = flatWorld();
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 2);
  world.issue('harkonnen', { type: 'move', ids: [tank.id], x: 10, y: 10 });
  run(world, 2);
  assert.deepEqual([tank.tx, tank.ty, tank.order.type], [2, 2, 'idle']);
});

test('stop halts a moving unit on the next tile centre', () => {
  const world = flatWorld(24, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 1, 5, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 20, y: 5 });
  run(world, 1);
  world.issue('atreides', { type: 'stop', ids: [tank.id] });
  run(world, 2);
  assert.equal(tank.order.type, 'idle');
  assert.equal(tank.x, tank.tx + 0.5);
  assert.ok(tank.tx <= 4);
});

test('guard gives a guard order in place', () => {
  const world = flatWorld();
  const tank = world.spawnUnit('combatTank', 'atreides', 4, 4);
  world.issue('atreides', { type: 'guard', ids: [tank.id] });
  world.step();
  assert.deepEqual(tank.order, { type: 'guard', x: 4, y: 4 });
});

test('scatter moves every unit off its tile', () => {
  const world = flatWorld(16, 16, G.SAND);
  const units = [[6, 6], [7, 6], [6, 7], [7, 7]].map(([x, y]) => world.spawnUnit('quad', 'ordos', x, y));
  const before = units.map((u) => `${u.tx},${u.ty}`);
  world.issue('ordos', { type: 'scatter', ids: units.map((u) => u.id) });
  run(world, 6);
  const moved = units.filter((u, k) => `${u.tx},${u.ty}` !== before[k]).length;
  assert.ok(moved >= 3, `moved ${moved}`);
  assert.ok(units.every((u) => u.order.type === 'idle'));
});

test('invalid move coordinates are ignored, out-of-map ones are clamped', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 2, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: NaN, y: 3 });
  run(world, 1);
  assert.deepEqual([tank.tx, tank.ty, tank.order.type], [2, 2, 'idle']);
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 500, y: 2 });
  run(world, 15);
  assert.deepEqual([tank.tx, tank.ty], [11, 2]);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/movement.test.mjs tests/orders.test.mjs`
Expected: FAIL — cannot find `../src/sim/world.js`.

- [ ] **Step 3: Implement geometry, house, unit and structure records**

**File: `src/sim/geometry.js`**
```js
// Angle helpers for headings in the map plane (0 = east, π/2 = south).
export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function angleDiff(from, to) { return wrapAngle(to - from); }

export function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(d) * maxStep);
}

export function lerpAngle(a, b, t) { return wrapAngle(a + angleDiff(a, b) * t); }
```

**File: `src/sim/house.js`**
```js
// A player or computer faction taking part in a game.
import { HOUSES } from '../data/houses.js';

export class House {
  constructor(id, slot, { credits = 0, ai = false, techLevel = 9 } = {}) {
    if (!HOUSES[id]) throw new Error(`unknown house ${id}`);
    this.id = id;
    this.slot = slot;
    this.info = HOUSES[id];
    this.credits = credits;
    this.isAI = ai;
    this.techLevel = techLevel;
    this.stats = { spiceHarvested: 0, unitsKilled: 0, unitsLost: 0, structuresKilled: 0, structuresLost: 0 };
  }
}
```

**File: `src/sim/unit.js`**
```js
// Unit records: plain objects so systems read them cheaply and tests can inspect them.
import { UNITS, MOVE } from '../data/units.js';

export function createUnit(id, typeId, house, x, y, { heading = 0 } = {}) {
  const type = UNITS[typeId];
  if (!type) throw new Error(`unknown unit type ${typeId}`);
  return {
    id, typeId, type, house, kind: 'unit',
    move: type.move,
    isGround: type.move !== MOVE.AIR,
    tx: x, ty: y,               // tile the unit stands on (or is leaving)
    x: x + 0.5, y: y + 0.5,     // continuous position in tile units
    px: x + 0.5, py: y + 0.5,   // position at the previous tick, for render interpolation
    heading, pheading: heading,
    turret: heading, pturret: heading,
    hp: type.hp, maxHp: type.hp,
    order: { type: 'idle' },
    goal: -1, path: [], pathIndex: 0, pathState: 'none', pathReached: false, queued: false, avoidUnits: false,
    step: null, carry: 0,
    waitTicks: 0, stuckTicks: 0, repaths: 0, nudgedAt: -1000,
    distance: 0, pdistance: 0,  // tiles travelled in total (wheel, tread and walk animation)
  };
}
```

**File: `src/sim/structure.js`**
```js
// Structure records and footprint helpers.
import { STRUCTURES } from '../data/structures.js';

export function createStructure(id, typeId, house, x, y, { hpFraction = 1 } = {}) {
  const type = STRUCTURES[typeId];
  if (!type) throw new Error(`unknown structure type ${typeId}`);
  return {
    id, typeId, type, house, kind: 'structure',
    x, y, w: type.w, h: type.h,
    hp: Math.max(1, Math.round(type.hp * hpFraction)), maxHp: type.hp,
    level: 0, placedAt: 0,
  };
}

export function footprint(x, y, w, h) {
  const out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([x + dx, y + dy]);
  return out;
}
```

- [ ] **Step 4: Implement the world**

**File: `src/sim/world.js`**
```js
// The simulation world: map, houses, entities and the fixed-step update (spec §3).
import { Rng } from '../core/rng.js';
import { EventQueue } from '../core/events.js';
import { STRUCTURES } from '../data/structures.js';
import { DT } from '../data/tuning.js';
import { PathFinder } from './pathfind.js';
import { House } from './house.js';
import { createUnit } from './unit.js';
import { createStructure, footprint } from './structure.js';
import { updateMovement } from './movement.js';
import { applyCommand } from './orders.js';

export class World {
  constructor({ map, seed = 1 }) {
    this.map = map;
    this.rng = new Rng(seed);
    this.tick = 0;
    this.time = 0;
    this.houses = new Map();
    this.units = new Map();
    this.structures = new Map();
    this.nextId = 1;
    this.events = new EventQueue();
    this.pending = [];
    this.pathfinder = new PathFinder(map);
    this.pathQueue = [];
    this.pathNodeBudget = 40000;   // A* expansions per tick across all units
    this.onDeploy = null;          // set by the deploy module (Task 7)
    this.onTileEntered = null;     // crush, bloom and worm hooks (plan 1b and later)
  }

  addHouse(id, opts = {}) {
    const house = new House(id, this.houses.size, opts);
    this.houses.set(id, house);
    return house;
  }

  spawnUnit(typeId, houseId, x, y, opts = {}) {
    if (!this.map.inBounds(x, y)) throw new Error(`spawn outside the map at ${x},${y}`);
    const unit = createUnit(this.nextId++, typeId, houseId, x, y, opts);
    if (unit.isGround) {
      const i = this.map.idx(x, y);
      if (this.map.unit[i] || this.map.structure[i]) throw new Error(`tile ${x},${y} is taken`);
      this.map.unit[i] = unit.id;
    }
    this.units.set(unit.id, unit);
    this.events.push('unitSpawned', { id: unit.id, house: houseId, unitType: typeId });
    return unit;
  }

  spawnStructure(typeId, houseId, x, y, opts = {}) {
    const t = STRUCTURES[typeId];
    if (!t) throw new Error(`unknown structure type ${typeId}`);
    for (const [fx, fy] of footprint(x, y, t.w, t.h)) {
      if (!this.map.inBounds(fx, fy) || this.map.structure[this.map.idx(fx, fy)]) throw new Error(`cannot place ${typeId} at ${x},${y}`);
    }
    const s = createStructure(this.nextId++, typeId, houseId, x, y, opts);
    s.placedAt = this.tick;
    for (const [fx, fy] of footprint(x, y, t.w, t.h)) this.map.structure[this.map.idx(fx, fy)] = s.id;
    this.map.revision++;
    this.structures.set(s.id, s);
    this.events.push('structurePlaced', { id: s.id, house: houseId, structureType: typeId, x, y });
    return s;
  }

  removeUnit(u, reason = 'removed') {
    if (!this.units.has(u.id)) return;
    const m = this.map;
    for (const i of [m.idx(u.tx, u.ty), u.step?.from, u.step?.to]) if (i !== undefined && m.unit[i] === u.id) m.unit[i] = 0;
    this.units.delete(u.id);
    this.events.push('unitRemoved', { id: u.id, reason });
  }

  removeStructure(s, reason = 'removed') {
    if (!this.structures.has(s.id)) return;
    for (const [fx, fy] of footprint(s.x, s.y, s.w, s.h)) {
      const i = this.map.idx(fx, fy);
      if (this.map.structure[i] === s.id) this.map.structure[i] = 0;
    }
    this.map.revision++;
    this.structures.delete(s.id);
    this.events.push('structureRemoved', { id: s.id, reason });
  }

  issue(houseId, command) { this.pending.push({ houseId, command }); }

  step() {
    const commands = this.pending;
    this.pending = [];
    for (const { houseId, command } of commands) applyCommand(this, houseId, command);
    this.processPathQueue();
    for (const u of this.units.values()) { u.px = u.x; u.py = u.y; u.pheading = u.heading; u.pturret = u.turret; u.pdistance = u.distance; }
    for (const u of [...this.units.values()]) if (this.units.has(u.id)) updateMovement(this, u);
    this.tick++;
    this.time = this.tick * DT;
  }

  requestPath(u, goal, { avoidUnits = false } = {}) {
    u.goal = goal;
    u.pathState = 'waiting';
    u.avoidUnits = avoidUnits;
    if (!u.queued) { u.queued = true; this.pathQueue.push(u.id); }
  }

  processPathQueue() {
    const map = this.map;
    let budget = this.pathNodeBudget;
    while (this.pathQueue.length && budget > 0) {
      const u = this.units.get(this.pathQueue.shift());
      if (!u) continue;
      u.queued = false;
      if (u.pathState !== 'waiting') continue;
      const near = (i) => Math.max(Math.abs(map.xOf(i) - u.tx), Math.abs(map.yOf(i) - u.ty)) <= 3;
      const blocked = u.avoidUnits ? (i) => map.unit[i] !== 0 && map.unit[i] !== u.id && near(i) : null;
      const extraCost = (i) => {
        const o = map.unit[i];
        if (!o || o === u.id) return 0;
        const other = this.units.get(o);
        return other && !other.step && other.pathState !== 'ready' ? 6 : 0.5;
      };
      const res = this.pathfinder.find(map.idx(u.tx, u.ty), u.goal, u.move, { maxNodes: Math.min(budget, 30000), blocked, extraCost });
      budget -= this.pathfinder.expanded + 1;
      u.path = res.path;
      u.pathIndex = 0;
      u.pathReached = res.reached;
      u.pathState = res.path.length ? 'ready' : 'none';
    }
  }
}
```

- [ ] **Step 5: Implement movement, destination slots and orders**

**File: `src/sim/movement.js`**
```js
// Tile-to-tile ground movement: a unit holds its tile and reserves the next, turns toward it
// (tracked vehicles on the spot), then drives at the original speed for the terrain it enters.
// The tile it leaves is released halfway. Blocked units wait, ask idle friends to make way,
// re-plan around units, and give up after STUCK_GIVEUP_SECONDS so nothing deadlocks.
import { DT, SIM_HZ, TURN_RATE, DRIVE_ANGLE, groundSpeed, STUCK_REPATH_SECONDS, STUCK_GIVEUP_SECONDS } from '../data/tuning.js';
import { angleDiff, turnToward } from './geometry.js';

const REPATH_TICKS = Math.round(STUCK_REPATH_SECONDS * SIM_HZ);
const GIVEUP_TICKS = Math.round(STUCK_GIVEUP_SECONDS * SIM_HZ);
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function updateMovement(world, u) {
  if (!u.isGround) return;
  if (!u.type.turret) u.turret = u.heading;
  if (u.step) { advance(world, u); return; }
  if (u.pathState === 'waiting') return;
  if (u.pathState !== 'ready' || u.pathIndex >= u.path.length) { arrive(world, u); return; }
  const map = world.map;
  const next = u.path[u.pathIndex];
  const nx = map.xOf(next), ny = map.yOf(next);
  if (map.moveFactor(next, u.move) === 0 || Math.max(Math.abs(nx - u.tx), Math.abs(ny - u.ty)) !== 1) { replan(world, u); return; }
  const want = Math.atan2(ny - u.ty, nx - u.tx);
  const off = Math.abs(angleDiff(u.heading, want));
  u.heading = turnToward(u.heading, want, TURN_RATE[u.type.turn] * DT);
  if (off > DRIVE_ANGLE[u.move]) return;
  const occupant = map.unit[next];
  if (occupant && occupant !== u.id) { blocked(world, u, occupant); return; }
  map.unit[next] = u.id;
  const dist = nx !== u.tx && ny !== u.ty ? Math.SQRT2 : 1;
  u.step = { from: map.idx(u.tx, u.ty), to: next, dist, progress: u.carry / dist, released: false };
  u.carry = 0;
  u.waitTicks = 0;
  advance(world, u);
}

function advance(world, u) {
  const map = world.map, s = u.step;
  const speed = groundSpeed(u.type.speed, map.moveFactor(s.to, u.move) || 64) * (u.speedMul ?? 1);
  const fx = map.xOf(s.from) + 0.5, fy = map.yOf(s.from) + 0.5, tx = map.xOf(s.to) + 0.5, ty = map.yOf(s.to) + 0.5;
  u.heading = turnToward(u.heading, Math.atan2(ty - fy, tx - fx), TURN_RATE[u.type.turn] * DT);
  s.progress += (speed * DT) / s.dist;
  u.distance += speed * DT;
  if (!s.released && s.progress >= 0.5) {
    if (map.unit[s.from] === u.id) map.unit[s.from] = 0;
    s.released = true;
  }
  if (s.progress >= 1) {
    u.carry = Math.min(0.5, (s.progress - 1) * s.dist);
    u.x = tx; u.y = ty;
    u.tx = map.xOf(s.to); u.ty = map.yOf(s.to);
    u.step = null;
    u.pathIndex++;
    world.onTileEntered?.(u);
  } else {
    u.x = fx + (tx - fx) * s.progress;
    u.y = fy + (ty - fy) * s.progress;
  }
}

const isIdle = (u) => u.pathState !== 'ready' && u.pathState !== 'waiting';

function blocked(world, u, occupantId) {
  const other = world.units.get(occupantId);
  const lastStep = u.pathIndex === u.path.length - 1;
  if (other && !other.step && isIdle(other)) {
    if (lastStep) { u.path.length = u.pathIndex; arrive(world, u); return; }   // our spot is taken: stop beside it
    if (other.house === u.house) nudge(world, other, u);
  }
  if (++u.waitTicks < REPATH_TICKS) return;
  u.waitTicks = 0;
  u.stuckTicks += REPATH_TICKS;
  if (u.stuckTicks >= GIVEUP_TICKS) { giveUp(world, u); return; }
  replan(world, u, true);
}

// Ask an idle friendly unit to step onto a free neighbouring tile that is not on our way.
function nudge(world, other, requester) {
  if (world.tick - other.nudgedAt < 30) return;
  const map = world.map;
  const onPath = new Set(requester.path.slice(requester.pathIndex, requester.pathIndex + 4));
  const options = [];
  for (const [dx, dy] of N8) {
    const x = other.tx + dx, y = other.ty + dy;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (!map.unit[i] && map.moveFactor(i, other.move) > 0 && !onPath.has(i)) options.push(i);
  }
  if (!options.length) return;
  const target = options[world.rng.int(options.length)];
  other.nudgedAt = world.tick;
  other.order = { type: 'move', x: map.xOf(target), y: map.yOf(target), nudge: true };
  other.goal = target;
  other.path = [target];
  other.pathIndex = 0;
  other.pathState = 'ready';
  other.pathReached = true;
  other.stuckTicks = 0;
  other.waitTicks = 0;
}

function replan(world, u, avoidUnits = false) {
  if (u.goal < 0) { arrive(world, u); return; }
  u.repaths++;
  world.requestPath(u, u.goal, { avoidUnits });
}

function giveUp(world, u) {
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1; u.stuckTicks = 0; u.waitTicks = 0;
  if (u.order.type === 'move') u.order = { type: 'idle' };
  world.events.push('moveFailed', { id: u.id });
}

function arrive(world, u) {
  u.carry = 0;
  const here = world.map.idx(u.tx, u.ty);
  // a partial path (search budget ran out) continues toward the goal
  if (u.pathState === 'ready' && !u.pathReached && u.goal >= 0 && here !== u.goal && u.repaths < 6) { replan(world, u); return; }
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.stuckTicks = 0; u.waitTicks = 0;
  if (u.order.type === 'move') {
    u.order = { type: 'idle' };
    u.goal = -1;
    world.events.push('arrived', { id: u.id });
  } else if (u.order.type === 'deploy') {
    world.onDeploy?.(u);
  }
}
```

**File: `src/sim/destinations.js`**
```js
// Spread a group order over nearby free tiles so twenty units do not fight over one tile.
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const isStationary = (u) => u && !u.step && u.pathState !== 'ready' && u.pathState !== 'waiting';

/** @returns {Map<number, number>} unit id → destination tile index */
export function findDestinations(world, goal, units) {
  const map = world.map;
  const result = new Map();
  if (units.length === 1) { result.set(units[0].id, goal); return result; }
  const group = new Set(units.map((u) => u.id));
  const classes = [...new Set(units.map((u) => u.move))];
  const seen = new Uint8Array(map.w * map.h);
  const queue = [goal];
  seen[goal] = 1;
  const slots = [];
  const want = units.length * 3;
  const maxVisit = Math.min(map.w * map.h, 64 + units.length * 24);
  for (let k = 0; k < queue.length && slots.length < want && k < maxVisit; k++) {
    const i = queue[k];
    const occupant = map.unit[i];
    const standing = occupant && !group.has(occupant) && isStationary(world.units.get(occupant));
    if (!map.structure[i] && !standing && classes.some((c) => map.moveFactor(i, c) > 0)) slots.push(i);
    const x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (!seen[ni]) { seen[ni] = 1; queue.push(ni); }
    }
  }
  const gx = map.xOf(goal), gy = map.yOf(goal);
  const ordered = [...units].sort((a, b) => Math.hypot(a.tx - gx, a.ty - gy) - Math.hypot(b.tx - gx, b.ty - gy) || a.id - b.id);
  const taken = new Set();
  for (const u of ordered) {
    const slot = slots.find((i) => !taken.has(i) && map.moveFactor(i, u.move) > 0) ?? goal;
    taken.add(slot);
    result.set(u.id, slot);
  }
  return result;
}
```

**File: `src/sim/orders.js`**
```js
// Player and AI commands (spec §3). Everything is validated here; the simulation never trusts input.
import { findDestinations } from './destinations.js';

export function applyCommand(world, houseId, cmd) {
  const units = (Array.isArray(cmd?.ids) ? cmd.ids : []).map((id) => world.units.get(id)).filter((u) => u && u.house === houseId);
  switch (cmd?.type) {
    case 'move': orderMove(world, units, cmd.x, cmd.y); return;
    case 'stop': units.forEach(stopUnit); return;
    case 'guard': units.forEach((u) => { stopUnit(u); u.order = { type: 'guard', x: u.tx, y: u.ty }; }); return;
    case 'scatter': scatter(world, units); return;
    default: world.events.push('commandRejected', { house: houseId, command: cmd?.type });
  }
}

export function stopUnit(u) {
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  u.stuckTicks = 0; u.waitTicks = 0; u.repaths = 0;
  u.order = { type: 'idle' };
}

export function orderMove(world, units, x, y) {
  const map = world.map;
  const ground = units.filter((u) => u.isGround);
  if (!ground.length || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const tx = Math.max(0, Math.min(map.w - 1, Math.floor(x)));
  const ty = Math.max(0, Math.min(map.h - 1, Math.floor(y)));
  const slots = findDestinations(world, map.idx(tx, ty), ground);
  for (const u of ground) {
    u.order = { type: 'move', x: tx, y: ty };
    u.stuckTicks = 0; u.waitTicks = 0; u.repaths = 0;
    world.requestPath(u, slots.get(u.id));
  }
  world.events.push('moveOrdered', { ids: ground.map((u) => u.id), x: tx, y: ty });
}

function scatter(world, units) {
  const map = world.map;
  for (const u of units) {
    if (!u.isGround) continue;
    const options = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = u.tx + dx, y = u.ty + dy;
      if ((dx || dy) && map.inBounds(x, y)) {
        const i = map.idx(x, y);
        if (!map.unit[i] && map.moveFactor(i, u.move) > 0) options.push(i);
      }
    }
    if (!options.length) continue;
    const goal = options[world.rng.int(options.length)];
    u.order = { type: 'move', x: map.xOf(goal), y: map.yOf(goal) };
    u.stuckTicks = 0; u.waitTicks = 0; u.repaths = 0;
    world.requestPath(u, goal);
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/movement.test.mjs tests/orders.test.mjs`
Expected: PASS (13 tests). Failures to expect and how to read them: a "holds 0 tiles" assertion means a path tile was claimed without releasing (check `advance` release logic); a group-order timeout means units wait on each other forever (check `blocked` → `replan(…, true)` and `giveUp`).

- [ ] **Step 7: Run the whole suite, then commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add src/sim tests/helpers.mjs tests/movement.test.mjs tests/orders.test.mjs
git commit -m "feat(sim): world, tile movement with turning, reservations, nudging and group destinations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: MCV deployment

**Files:**
- Create: `src/sim/deploy.js`
- Modify: `src/sim/orders.js` (add the `deploy` command), `src/sim/world.js` (set `onDeploy`)
- Test: `tests/deploy.test.mjs`

**Interfaces:**
- Consumes: `World.removeUnit`, `World.spawnStructure`, `world.onDeploy` hook, `arrive()` calling it (Task 6).
- Produces: `DEPLOY_OFFSETS`; `footprintClear(world, x, y, w, h, ignoreUnit)` → boolean (in bounds, rock or concrete, no structure, no other unit); `deploySpot(world, u)` → `{x,y}` or `null`; `tryDeploy(world, u)` → structure or `null`; `orderDeploy(world, u)`. Command `{type:'deploy', ids}`. Events `deployed {id, house, x, y}` and `eva {house, key:'cannotDeploy', text:'Unable to deploy here.'}`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/deploy.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run } from './helpers.mjs';
import { deploySpot } from '../src/sim/deploy.js';

const deploy = (world, house, mcv) => { world.issue(house, { type: 'deploy', ids: [mcv.id] }); world.step(); };
const yard = (world) => [...world.structures.values()].find((s) => s.typeId === 'constructionYard');

test('MCV deploys into a Construction Yard covering its own tile', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'atreides', 5, 5);
  deploy(world, 'atreides', mcv);
  assert.equal(world.units.has(mcv.id), false);
  const cy = yard(world);
  assert.deepEqual([cy.x, cy.y, cy.house, cy.hp], [5, 5, 'atreides', 400]);
  for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]]) assert.equal(world.map.structure[world.map.idx(x, y)], cy.id);
  assert.equal(world.map.unit[world.map.idx(5, 5)], 0);
  assert.ok(world.events.drain().some((e) => e.type === 'deployed' && e.id === cy.id));
});

test('MCV on sand refuses with a message and stays', () => {
  const world = flatWorld(12, 12, G.SAND);
  const mcv = world.spawnUnit('mcv', 'atreides', 5, 5);
  deploy(world, 'atreides', mcv);
  assert.ok(world.units.has(mcv.id));
  assert.equal(world.structures.size, 0);
  assert.equal(mcv.order.type, 'idle');
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'cannotDeploy' && e.text === 'Unable to deploy here.'));
});

test('MCV in the bottom-right corner deploys to the north-west', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'ordos', 11, 11);
  deploy(world, 'ordos', mcv);
  assert.deepEqual([yard(world).x, yard(world).y], [10, 10]);
});

test('MCV in the top-left corner uses its own tile as the corner', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'ordos', 0, 0);
  deploy(world, 'ordos', mcv);
  assert.deepEqual([yard(world).x, yard(world).y], [0, 0]);
});

test('units in every candidate footprint block deployment', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'ordos', 5, 5);
  world.spawnUnit('soldier', 'ordos', 5, 6);
  world.spawnUnit('soldier', 'ordos', 5, 4);
  assert.equal(deploySpot(world, mcv), null);
  deploy(world, 'ordos', mcv);
  assert.ok(world.units.has(mcv.id));
  assert.equal(world.structures.size, 0);
});

test('a moving MCV deploys after finishing its current tile', () => {
  const world = flatWorld(16, 8, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'harkonnen', 2, 3, { heading: 0 });
  world.issue('harkonnen', { type: 'move', ids: [mcv.id], x: 12, y: 3 });
  run(world, 1.5);
  assert.ok(mcv.step, 'the MCV is between tiles');
  world.issue('harkonnen', { type: 'deploy', ids: [mcv.id] });
  run(world, 3);
  assert.equal(world.units.has(mcv.id), false);
  assert.equal(yard(world).house, 'harkonnen');
});

test('deploy on a unit that cannot deploy does nothing', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  deploy(world, 'atreides', tank);
  assert.ok(world.units.has(tank.id));
  assert.equal(world.structures.size, 0);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/deploy.test.mjs`
Expected: FAIL — cannot find `../src/sim/deploy.js`.

- [ ] **Step 3: Implement deployment and wire it in**

**File: `src/sim/deploy.js`**
```js
// MCV deployment: the Construction Yard's 2x2 footprint must cover the MCV's tile. Candidate corners
// follow the original order (own tile, west, north, north-west; OpenDUNE Script_Unit_MCVDeploy).
import { STRUCTURES } from '../data/structures.js';
import { G } from '../data/terrain.js';

export const DEPLOY_OFFSETS = [[0, 0], [-1, 0], [0, -1], [-1, -1]];

export function footprintClear(world, x, y, w, h, ignoreUnit = 0) {
  const map = world.map;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const fx = x + dx, fy = y + dy;
    if (!map.inBounds(fx, fy)) return false;
    const i = map.idx(fx, fy);
    if (map.structure[i] || !(map.ground[i] === G.ROCK || map.concrete[i])) return false;
    if (map.unit[i] && map.unit[i] !== ignoreUnit) return false;
  }
  return true;
}

export function deploySpot(world, u) {
  const t = STRUCTURES[u.type.deploysTo];
  if (!t) return null;
  for (const [ox, oy] of DEPLOY_OFFSETS) {
    if (footprintClear(world, u.tx + ox, u.ty + oy, t.w, t.h, u.id)) return { x: u.tx + ox, y: u.ty + oy };
  }
  return null;
}

export function tryDeploy(world, u) {
  if (!u.type.deploysTo || !world.units.has(u.id)) return null;
  const spot = u.step ? null : deploySpot(world, u);
  if (!spot) {
    u.order = { type: 'idle' };
    world.events.push('eva', { house: u.house, key: 'cannotDeploy', text: 'Unable to deploy here.' });
    return null;
  }
  world.removeUnit(u, 'deployed');
  const s = world.spawnStructure(u.type.deploysTo, u.house, spot.x, spot.y);
  world.events.push('deployed', { id: s.id, house: u.house, x: spot.x, y: spot.y });
  return s;
}

export function orderDeploy(world, u) {
  if (!u.type.deploysTo) return;
  u.path = []; u.pathIndex = 0; u.goal = -1; u.pathState = 'none';
  u.order = { type: 'deploy' };
  if (!u.step) tryDeploy(world, u);   // otherwise movement finishes the current tile and calls world.onDeploy
}
```

Modify `src/sim/orders.js` — add the import under the existing one:
```js
import { findDestinations } from './destinations.js';
import { orderDeploy } from './deploy.js';
```
and add a case before `default:` in `applyCommand`:
```js
    case 'deploy': units.forEach((u) => orderDeploy(world, u)); return;
```

Modify `src/sim/world.js` — add the import after `import { applyCommand } from './orders.js';`:
```js
import { tryDeploy } from './deploy.js';
```
and replace the constructor line `this.onDeploy = null;          // set by the deploy module (Task 7)` with:
```js
    this.onDeploy = (u) => tryDeploy(this, u);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/deploy.test.mjs && npm test`
Expected: PASS (7 new tests; whole suite green).

- [ ] **Step 5: Commit**

```bash
git add src/sim/deploy.js src/sim/orders.js src/sim/world.js tests/deploy.test.mjs
git commit -m "feat(sim): MCV deployment with the original footprint order and clean refusal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Renderer — lights, sky, post-processing, quality presets

**Files:**
- Create: `src/render/quality.js`, `src/render/sky.js`, `src/render/renderer.js`, `src/scenes/render-test.js`
- Modify: `src/main.js` (register the scene), `scripts/scenarios.mjs` (add `render-test`)
- Test: `tests/quality.test.mjs`

**Interfaces:**
- Produces: `QUALITY` presets and `qualityPreset(name)` → `{shadows, msaa, fxaa, bloom, particles, pixelRatio, terrainSub}` (unknown names fall back to `medium`); `SUN_DIRECTION` (unit `THREE.Vector3` toward the sun); `createSky(sunDir)` → `THREE.Mesh`; `createEnvironment(renderer)` → PMREM texture used as `scene.environment`; `class Renderer3D(canvas, qualityName)` with `renderer`, `scene`, `camera`, `sun`, `hemi`, `sky`, `composer`, `quality`, `width`, `height`, `resize()`, `follow(x, z, extent=26)`, `render()`, optional callback `onContextLost`.

- [ ] **Step 1: Write the failing test**

**File: `tests/quality.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY, qualityPreset } from '../src/render/quality.js';

test('every preset defines the same settings and medium is the fallback', () => {
  const keys = Object.keys(QUALITY.medium).sort();
  for (const [name, q] of Object.entries(QUALITY)) assert.deepEqual(Object.keys(q).sort(), keys, name);
  assert.equal(qualityPreset('nonsense'), QUALITY.medium);
  assert.equal(qualityPreset('low').shadows, 0);
  assert.ok(QUALITY.high.shadows > QUALITY.medium.shadows);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/quality.test.mjs`
Expected: FAIL — cannot find `../src/render/quality.js`.

- [ ] **Step 3: Implement presets, sky and renderer**

**File: `src/render/quality.js`**
```js
// Graphics presets (spec §8). pixelRatio is a cap on devicePixelRatio; terrainSub = terrain vertices per tile side.
export const QUALITY = {
  low:    { shadows: 0,    msaa: 0, fxaa: true,  bloom: false, particles: 1500, pixelRatio: 0.75, terrainSub: 3 },
  medium: { shadows: 1024, msaa: 0, fxaa: true,  bloom: true,  particles: 4000, pixelRatio: 1,    terrainSub: 4 },
  high:   { shadows: 2048, msaa: 4, fxaa: false, bloom: true,  particles: 8000, pixelRatio: 2,    terrainSub: 4 },
};

export function qualityPreset(name) { return QUALITY[name] ?? QUALITY.medium; }
```

**File: `src/render/sky.js`**
```js
// Hazy desert sky dome drawn at the far plane; it follows the camera target so it never clips.
import * as THREE from 'three';

export function createSky(sunDir) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uSunDir: { value: sunDir.clone() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.25, 1.0);
        vec3 horizon = vec3(0.93, 0.78, 0.58), zenith = vec3(0.45, 0.60, 0.80), ground = vec3(0.78, 0.60, 0.40);
        vec3 col = h > 0.0 ? mix(horizon, zenith, pow(h, 0.55)) : mix(horizon, ground, min(-h * 5.0, 1.0));
        float sun = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.86, 0.62) * (pow(sun, 90.0) * 2.0 + pow(sun, 6.0) * 0.15);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** Image-based light from a sky-over-sand gradient, so metal and paint pick up the desert ambience. */
export function createEnvironment(renderer) {
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), sky = new THREE.Color(0.45, 0.6, 0.8), haze = new THREE.Color(0.93, 0.78, 0.58), sand = new THREE.Color(0.7, 0.53, 0.34);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y > 0) c.copy(haze).lerp(sky, Math.pow(y, 0.6)); else c.copy(sand).multiplyScalar(0.85 + 0.15 * (1 + y));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  return env;
}
```

**File: `src/render/renderer.js`**
```js
// Renderer, lights, sky and post-processing (spec §5.1): ACES tone mapping, soft sun shadows that
// follow the camera, hemisphere sky/sand bounce, exponential haze, bloom and FXAA or MSAA.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { createSky, createEnvironment } from './sky.js';
import { qualityPreset } from './quality.js';

export const SUN_DIRECTION = new THREE.Vector3(-0.55, 0.9, 0.42).normalize();

export class Renderer3D {
  constructor(canvas, qualityName = 'medium') {
    this.canvas = canvas;
    this.quality = qualityPreset(qualityName);
    const q = this.quality;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = q.shadows > 0;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xd9bb8e, 0.0085);
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 700);

    this.sun = new THREE.DirectionalLight(0xfff0d6, 3.1);
    this.sun.castShadow = q.shadows > 0;
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows);
      const c = this.sun.shadow.camera;
      c.near = 1; c.far = 160;
      this.sun.shadow.bias = -0.0005;
      this.sun.shadow.normalBias = 0.03;
    }
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0xb0824c, 0.75);
    this.scene.add(this.hemi);
    this.scene.environment = createEnvironment(r);
    this.scene.environmentIntensity = 0.55;
    this.sky = createSky(SUN_DIRECTION);
    this.scene.add(this.sky);
    this.shadowExtent = 0;

    const target = q.msaa ? new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: q.msaa }) : undefined;
    this.composer = new EffectComposer(r, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.9);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    if (q.fxaa) this.composer.addPass(new FXAAPass());

    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.onContextLost?.(); });
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth || innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || innerHeight);
    const pr = Math.min(devicePixelRatio || 1, this.quality.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = w;
    this.height = h;
  }

  /** Keep the sun, its shadow frustum and the sky centred on the point the camera looks at. */
  follow(x, z, extent = 26) {
    const sx = Math.round(x), sz = Math.round(z);
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + SUN_DIRECTION.x * 70, SUN_DIRECTION.y * 70, sz + SUN_DIRECTION.z * 70);
    const e = Math.round(Math.max(18, Math.min(64, extent)));
    if (this.sun.castShadow && e !== this.shadowExtent) {
      const c = this.sun.shadow.camera;
      c.left = -e; c.right = e; c.top = e; c.bottom = -e;
      c.updateProjectionMatrix();
      this.shadowExtent = e;
    }
    this.sky.position.set(x, 0, z);
  }

  render() { if (!this.lost) this.composer.render(); }
}
```

**File: `src/scenes/render-test.js`**
```js
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
```

Modify `src/main.js` — add the scene to `SCENES`:
```js
const SCENES = {
  boot: () => import('./scenes/boot.js'),
  'render-test': () => import('./scenes/render-test.js'),
};
```

Modify `scripts/scenarios.mjs` — add after `boot`:
```js
  'render-test': { query: 'scene=render-test' },
  'render-test-low': { query: 'scene=render-test&quality=low' },
  'render-test-high': { query: 'scene=render-test&quality=high' },
```

- [ ] **Step 4: Run the tests and the smoke screenshots**

Run: `node --test tests/quality.test.mjs && npm run smoke render-test render-test-low render-test-high`
Expected: PASS, then three screenshots written without errors. Look at `screenshots/render-test.png`: warm sand floor with soft shadows falling up-screen and to the right, hazy blue-to-sand sky, a glowing orange ball with visible bloom. `render-test-low.png` has no shadows or bloom; `render-test-high.png` has sharper shadows.

- [ ] **Step 5: Commit**

```bash
git add src/render src/scenes/render-test.js src/main.js scripts/scenarios.mjs tests/quality.test.mjs
git commit -m "feat(render): renderer with sun shadows, sky dome, haze, bloom, FXAA/MSAA and quality presets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Heightfield and terrain rendering

**Files:**
- Create: `src/render/heightfield.js`, `src/render/terrain-shader.js`, `src/render/terrain.js`, `src/render/decals.js`, `src/scenes/terrain.js`
- Modify: `src/main.js` (register `terrain`), `scripts/scenarios.mjs` (add `terrain`, `terrain-large`)
- Test: `tests/heightfield.test.mjs`, `tests/terrain-shader.test.mjs`

**Interfaces:**
- Consumes: `GameMap`, `G` (Tasks 3–4), `generateMap` (Task 4), `Renderer3D` (Task 8).
- Produces:
  - `ROCK_HEIGHT`, `noise2(x, y, seed)`, `class Heightfield(map, {sub, seed})` with `vw`, `vh`, `data` (heights per vertex), `rock`, `mountain`, `dune` (0..1 weights per vertex), `heightAt(x, z)`, `normalAt(x, z, out)`, `flatten(x0, y0, w, h)`.
  - `injectTerrainShader(material, uniforms, {apron})` — patches a `MeshStandardMaterial` (vertex attribute `aTerrain` = rock, mountain, dune).
  - `buildTerrainGeometry(hf)` → `THREE.BufferGeometry`; `class TerrainView(map, hf)` with `group` (add to scene), `update(timeMs)`, `setShroud(explored: Uint8Array, visible: Uint8Array)`, `decals`.
  - `class DecalMap(w, h)` with `texture`, `crater(x, y, radius, strength)`, `scorch(x, y, radius)`, `track(x, y, heading, width, alpha)`, `flush(nowMs)`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/heightfield.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../src/sim/map.js';
import { G } from '../src/data/terrain.js';
import { Heightfield, ROCK_HEIGHT } from '../src/render/heightfield.js';
import { buildTerrainGeometry } from '../src/render/terrain.js';

function testMap() {
  const m = new GameMap(40, 40);
  m.ground.fill(G.SAND);
  for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) m.ground[m.idx(x, y)] = G.ROCK;
  for (let y = 18; y < 22; y++) for (let x = 18; x < 22; x++) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  return m;
}

test('rock plateaus stand at ROCK_HEIGHT, sand stays low, mountains rise, edges fade', () => {
  const hf = new Heightfield(testMap(), { sub: 4, seed: 3 });
  assert.ok(Math.abs(hf.heightAt(13.5, 13.5) - ROCK_HEIGHT) < 0.05, `rock ${hf.heightAt(13.5, 13.5)}`);
  assert.ok(Math.abs(hf.heightAt(4.5, 4.5)) < 0.08, `sand ${hf.heightAt(4.5, 4.5)}`);
  assert.ok(hf.heightAt(20, 20) > 0.7, `mountain ${hf.heightAt(20, 20)}`);
  assert.ok(Math.abs(hf.heightAt(0, 0)) < 1e-9);
  assert.ok(Math.abs(hf.heightAt(40, 17)) < 1e-9);
});

test('heights are continuous and deterministic', () => {
  const a = new Heightfield(testMap(), { sub: 4, seed: 3 }), b = new Heightfield(testMap(), { sub: 4, seed: 3 });
  assert.deepEqual(a.data, b.data);
  let prev = a.heightAt(0, 20);
  for (let x = 0.05; x < 40; x += 0.05) {
    const h = a.heightAt(x, 20);
    assert.ok(Math.abs(h - prev) < 0.35, `jump at x=${x.toFixed(2)}`);
    prev = h;
  }
});

test('normals point up on flat ground and lean on slopes', () => {
  const m = new GameMap(20, 20);
  m.ground.fill(G.ROCK);
  const hf = new Heightfield(m, { sub: 2, seed: 1 });
  const n = hf.normalAt(10, 10);
  assert.ok(n.y > 0.99);
  const hf2 = new Heightfield(testMap(), { sub: 4, seed: 3 });
  let steepest = 1;
  for (let x = 9; x <= 11; x += 0.05) steepest = Math.min(steepest, hf2.normalAt(x, 14).y);
  assert.ok(steepest < 0.9, `plateau edge slopes (steepest normal.y ${steepest})`);
});

test('flatten levels a footprint to its average height', () => {
  const hf = new Heightfield(testMap(), { sub: 4, seed: 3 });
  hf.flatten(12, 12, 2, 2);
  const h = hf.heightAt(12.2, 12.2);
  assert.ok(Math.abs(hf.heightAt(13.8, 13.8) - h) < 1e-6);
});

test('terrain geometry has one vertex per heightfield sample and upward normals', () => {
  const hf = new Heightfield(testMap(), { sub: 2, seed: 3 });
  const g = buildTerrainGeometry(hf);
  assert.equal(g.attributes.position.count, hf.vw * hf.vh);
  assert.equal(g.index.count, (hf.vw - 1) * (hf.vh - 1) * 6);
  assert.ok(g.attributes.aTerrain);
  const ny = g.attributes.normal.array;
  for (let i = 1; i < ny.length; i += 3) assert.ok(ny[i] > 0);
});
```

**File: `tests/terrain-shader.test.mjs`**
```js
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
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/heightfield.test.mjs tests/terrain-shader.test.mjs`
Expected: FAIL — cannot find `../src/render/heightfield.js`.

- [ ] **Step 3: Implement the heightfield**

**File: `src/render/heightfield.js`**
```js
// Terrain heights for rendering, derived deterministically from the sim map (spec §5.2): sand with
// low swells, dunes as asymmetric waves, rock plateaus raised with soft edges, ridged mountains.
// Pure JS (no three) so it is testable under Node; the simulation never needs heights.
import { G } from '../data/terrain.js';

export const ROCK_HEIGHT = 0.34;

function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise2(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function ridged(x, y, s) {
  let sum = 0, amp = 0.6, f = 1;
  for (let o = 0; o < 3; o++) { sum += amp * (1 - Math.abs(noise2(x * f, y * f, s + o * 17) * 2 - 1)); amp *= 0.5; f *= 2.1; }
  return sum;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const isRock = (g) => g === G.ROCK || g === G.MOUNTAIN;
const isMountain = (g) => g === G.MOUNTAIN;
const isDune = (g) => g === G.DUNE;

export class Heightfield {
  constructor(map, { sub = 4, seed = map.seed ?? 1 } = {}) {
    this.map = map;
    this.sub = sub;
    this.seed = seed;
    this.vw = map.w * sub + 1;
    this.vh = map.h * sub + 1;
    const n = this.vw * this.vh;
    this.data = new Float32Array(n);
    this.rock = new Float32Array(n);
    this.mountain = new Float32Array(n);
    this.dune = new Float32Array(n);
    this.build();
  }

  classAt(x, y, pred) {
    const m = this.map;
    x = Math.max(0, Math.min(m.w - 1, x));
    y = Math.max(0, Math.min(m.h - 1, y));
    return pred(m.ground[y * m.w + x]) ? 1 : 0;
  }

  // bilinear blend of a tile class over tile centres
  smoothClass(x, y, pred) {
    const fx = x - 0.5, fy = y - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const a = this.classAt(x0, y0, pred), b = this.classAt(x0 + 1, y0, pred);
    const c = this.classAt(x0, y0 + 1, pred), d = this.classAt(x0 + 1, y0 + 1, pred);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  build() {
    const { sub, seed, vw, vh, map } = this;
    for (let vy = 0; vy < vh; vy++) for (let vx = 0; vx < vw; vx++) {
      const x = vx / sub, y = vy / sub, k = vy * vw + vx;
      const wx = x + (noise2(x * 0.6, y * 0.6, seed) - 0.5) * 0.8;
      const wy = y + (noise2(x * 0.6 + 40, y * 0.6 + 40, seed) - 0.5) * 0.8;
      const r = smooth(0.32, 0.68, this.smoothClass(wx, wy, isRock));
      const m = smooth(0.3, 0.75, this.smoothClass(wx, wy, isMountain));
      const d = this.smoothClass(x, y, isDune);
      const wave = Math.pow(Math.sin(x * 0.55 + y * 0.18 + noise2(x * 0.25, y * 0.25, seed + 3) * 5) * 0.5 + 0.5, 1.8);
      const sand = (noise2(x * 0.35, y * 0.35, seed + 5) - 0.5) * 0.08 + d * (0.08 + 0.3 * wave);
      const rockTop = ROCK_HEIGHT + (noise2(x * 1.4, y * 1.4, seed + 9) - 0.5) * 0.05;
      const mountain = 0.35 + 1.9 * ridged(x * 0.32, y * 0.32, seed + 13);
      let h = sand * (1 - r) + rockTop * r + mountain * m;
      h *= smooth(0, 0.8, Math.min(x, y, map.w - x, map.h - y));   // meet the flat apron at the map edge
      this.data[k] = h;
      this.rock[k] = r;
      this.mountain[k] = m;
      this.dune[k] = d * (1 - r);
    }
  }

  heightAt(x, z) {
    const s = this.sub;
    const fx = Math.max(0, Math.min(this.vw - 1.0001, x * s)), fz = Math.max(0, Math.min(this.vh - 1.0001, z * s));
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0, w = this.vw, d = this.data;
    const a = d[z0 * w + x0], b = d[z0 * w + x0 + 1], c = d[(z0 + 1) * w + x0], e = d[(z0 + 1) * w + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
  }

  normalAt(x, z, out = { x: 0, y: 1, z: 0 }) {
    const e = 0.5 / this.sub;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const nx = -hx / (2 * e), nz = -hz / (2 * e), len = Math.hypot(nx, 1, nz);
    out.x = nx / len; out.y = 1 / len; out.z = nz / len;
    return out;
  }

  /** Level the vertices under a structure footprint (tile rect) to their average height. */
  flatten(x0, y0, w, h) {
    const s = this.sub;
    let sum = 0, count = 0;
    for (let vy = y0 * s; vy <= (y0 + h) * s; vy++) for (let vx = x0 * s; vx <= (x0 + w) * s; vx++) { sum += this.data[vy * this.vw + vx]; count++; }
    const avg = sum / count;
    for (let vy = y0 * s; vy <= (y0 + h) * s; vy++) for (let vx = x0 * s; vx <= (x0 + w) * s; vx++) this.data[vy * this.vw + vx] = avg;
    return avg;
  }
}
```

- [ ] **Step 4: Implement the terrain shader patch**

**File: `src/render/terrain-shader.js`**
```js
// Terrain shading injected into MeshStandardMaterial so PBR lighting and shadows still apply
// (spec §5.2): sand with wind ripples, lit dune crests, cracked rock, banded mountains, speckled
// spice that follows the live spice texture, concrete slabs with seams, decals and soft shroud.
const HEAD = /* glsl */ `
uniform sampler2D uSpice;
uniform sampler2D uConcrete;
uniform sampler2D uShroud;
uniform sampler2D uDecals;
uniform vec2 uMapSize;
uniform float uTime;
varying vec3 vTerrain;
varying vec3 vWorldPos;

float tHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float tFbm(vec2 p) { return 0.5 * tNoise(p) + 0.25 * tNoise(p * 2.03 + 7.1) + 0.125 * tNoise(p * 4.07 + 3.3); }
float ripple(vec2 p) { return sin(dot(p, vec2(0.86, 0.5)) * 11.0 + tNoise(p * 1.3) * 5.0); }

vec3 terrainAlbedo(vec2 p, inout float rough, inout float spiceAmt) {
  vec3 sand = mix(vec3(0.80, 0.60, 0.36), vec3(0.92, 0.74, 0.47), tFbm(p * 0.45));
  sand *= 0.94 + 0.1 * tNoise(p * 7.0);
  sand *= 1.0 + 0.14 * vTerrain.z * clamp(vWorldPos.y * 3.0, 0.0, 1.0);
  vec3 rock = mix(vec3(0.36, 0.28, 0.21), vec3(0.55, 0.44, 0.32), tFbm(p * 0.9));
  rock *= 0.82 + 0.3 * tNoise(p * 2.2);
  rock *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.025, abs(tNoise(p * 4.5) - 0.5)));
  vec3 mtn = mix(vec3(0.27, 0.21, 0.17), vec3(0.45, 0.35, 0.27), tFbm(p * vec2(0.6, 2.4)));
  mtn *= 0.85 + 0.18 * sin(vWorldPos.y * 16.0 + tFbm(p * 0.7) * 4.0);
  vec3 col = mix(sand, rock, vTerrain.x);
  col = mix(col, mtn, vTerrain.y);
  rough = mix(0.97, 0.88, vTerrain.x);
#ifndef APRON
  vec2 uv = p / uMapSize;
  float s = texture2D(uSpice, uv).r;
  float edge = s + (tFbm(p * 1.7) - 0.5) * 0.3;
  spiceAmt = smoothstep(0.18, 0.34, edge) * (1.0 - vTerrain.x);
  vec3 spice = mix(vec3(0.80, 0.38, 0.17), vec3(0.60, 0.19, 0.08), smoothstep(0.55, 0.95, s));
  spice *= 0.9 + 0.2 * tNoise(p * 9.0);
  spice = mix(spice, vec3(1.0, 0.62, 0.30), step(0.86, tNoise(p * 16.0)) * 0.7);
  col = mix(col, spice, spiceAmt);
  float concrete = texture2D(uConcrete, (floor(p) + 0.5) / uMapSize).r;
  if (concrete > 0.5) {
    vec2 f = fract(p);
    float seam = 1.0 - smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    col = vec3(0.56, 0.55, 0.51) * (0.88 + 0.16 * tNoise(p * 6.0)) * (1.0 - 0.45 * seam);
    rough = 0.82;
  }
  col *= texture2D(uDecals, uv).rgb;
#else
  col *= 0.85;
#endif
  return col;
}

vec3 perturbTerrainNormal(vec3 n, vec2 p, float spiceAmt) {
  float e = 0.02;
  float amt = 0.012 * (1.0 - vTerrain.x) * (1.0 - vTerrain.y) * (1.0 - 0.6 * spiceAmt);
  float hx = ripple(p + vec2(e, 0.0)) - ripple(p - vec2(e, 0.0));
  float hz = ripple(p + vec2(0.0, e)) - ripple(p - vec2(0.0, e));
  vec3 d = vec3(-hx, 0.0, -hz) / (2.0 * e) * amt;
  float r = vTerrain.x * 0.05;
  float bx = tNoise((p + vec2(e, 0.0)) * 3.0) - tNoise((p - vec2(e, 0.0)) * 3.0);
  float bz = tNoise((p + vec2(0.0, e)) * 3.0) - tNoise((p - vec2(0.0, e)) * 3.0);
  d += vec3(-bx, 0.0, -bz) / (2.0 * e) * r;
  return normalize(n + mat3(viewMatrix) * d);
}

float terrainShroud(vec2 p) {
#ifdef APRON
  return 0.62;
#else
  vec2 sh = texture2D(uShroud, p / uMapSize).rg;
  float n = (tNoise(p * 2.5) - 0.5) * 0.25;
  float explored = smoothstep(0.2, 0.8, sh.r + n);
  float visible = smoothstep(0.2, 0.8, sh.g + n);
  return explored * mix(0.62, 1.0, visible);
#endif
}
`;

export function injectTerrainShader(material, uniforms, { apron = false } = {}) {
  if (apron) material.defines = { ...(material.defines ?? {}), APRON: 1 };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aTerrain;\nvarying vec3 vTerrain;\nvarying vec3 vWorldPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrain = aTerrain;\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <map_fragment>', 'float tRough = 0.95;\nfloat tSpice = 0.0;\ndiffuseColor.rgb = terrainAlbedo(vWorldPos.xz, tRough, tSpice);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = perturbTerrainNormal(normal, vWorldPos.xz, tSpice);')
      .replace('#include <dithering_fragment>', 'gl_FragColor.rgb *= terrainShroud(vWorldPos.xz);\n#include <dithering_fragment>');
  };
  material.customProgramCacheKey = () => (apron ? 'terrain-apron' : 'terrain');
  return material;
}
```

- [ ] **Step 5: Implement the decal map and the terrain view**

**File: `src/render/decals.js`**
```js
// Paintable multiply map over the terrain: craters, scorch and track marks (spec §5.2).
// White means untouched; the texture uploads at most five times a second.
import * as THREE from 'three';

export class DecalMap {
  constructor(w, h) {
    this.px = Math.min(2048, Math.max(512, w * 16)) / w;   // pixels per tile
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * this.px);
    this.canvas.height = Math.round(h * this.px);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.dirty = false;
    this.lastFlush = 0;
  }

  blob(x, y, radius, inner, outer) {
    const c = this.ctx, px = this.px, cx = x * px, cy = y * px, r = radius * px;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, inner);
    g.addColorStop(0.65, outer);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    this.dirty = true;
  }

  crater(x, y, radius, strength = 0.55) { this.blob(x, y, radius, `rgba(45,32,22,${strength})`, `rgba(80,60,40,${strength * 0.5})`); }
  scorch(x, y, radius) { this.blob(x, y, radius, 'rgba(30,26,24,0.55)', 'rgba(60,50,42,0.25)'); }

  track(x, y, heading, width = 0.28, alpha = 0.05) {
    const c = this.ctx, px = this.px;
    c.save();
    c.translate(x * px, y * px);
    c.rotate(heading);
    c.fillStyle = `rgba(90,70,48,${alpha})`;
    c.fillRect(-0.18 * px, -width * px * 0.5 - 0.05 * px, 0.36 * px, 0.1 * px);
    c.fillRect(-0.18 * px, width * px * 0.5 - 0.05 * px, 0.36 * px, 0.1 * px);
    c.restore();
    this.dirty = true;
  }

  flush(now) {
    if (this.dirty && now - this.lastFlush > 200) {
      this.texture.needsUpdate = true;
      this.dirty = false;
      this.lastFlush = now;
    }
  }
}
```

**File: `src/render/terrain.js`**
```js
// Terrain mesh + apron + live data textures (spice, concrete, shroud) + decal map.
import * as THREE from 'three';
import { injectTerrainShader } from './terrain-shader.js';

export function buildTerrainGeometry(hf) {
  const { vw, vh, sub } = hf;
  const n = vw * vh;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), ter = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const tmp = { x: 0, y: 1, z: 0 };
  for (let vy = 0; vy < vh; vy++) for (let vx = 0; vx < vw; vx++) {
    const k = vy * vw + vx, x = vx / sub, z = vy / sub;
    pos[k * 3] = x; pos[k * 3 + 1] = hf.data[k]; pos[k * 3 + 2] = z;
    hf.normalAt(x, z, tmp);
    nor[k * 3] = tmp.x; nor[k * 3 + 1] = tmp.y; nor[k * 3 + 2] = tmp.z;
    ter[k * 3] = hf.rock[k]; ter[k * 3 + 1] = hf.mountain[k]; ter[k * 3 + 2] = hf.dune[k];
    uv[k * 2] = x / hf.map.w; uv[k * 2 + 1] = z / hf.map.h;
  }
  const index = new Uint32Array((vw - 1) * (vh - 1) * 6);
  let p = 0;
  for (let vy = 0; vy < vh - 1; vy++) for (let vx = 0; vx < vw - 1; vx++) {
    const a = vy * vw + vx, b = a + 1, c = a + vw, d = c + 1;
    index[p++] = a; index[p++] = c; index[p++] = b;
    index[p++] = b; index[p++] = c; index[p++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aTerrain', new THREE.BufferAttribute(ter, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

function dataTexture(w, h, channels, fill = 0) {
  const data = new Uint8Array(w * h * channels).fill(fill);
  const t = new THREE.DataTexture(data, w, h, channels === 1 ? THREE.RedFormat : THREE.RGFormat, THREE.UnsignedByteType);
  t.unpackAlignment = 1;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export class TerrainView {
  constructor(map, hf) {
    this.map = map;
    this.hf = hf;
    this.spiceTex = dataTexture(map.w, map.h, 1);
    this.concreteTex = dataTexture(map.w, map.h, 1);
    this.concreteTex.magFilter = this.concreteTex.minFilter = THREE.NearestFilter;
    this.shroudTex = dataTexture(map.w, map.h, 2, 255);
    const { DecalMap } = DECALS;
    this.decals = new DecalMap(map.w, map.h);
    this.uniforms = {
      uSpice: { value: this.spiceTex }, uConcrete: { value: this.concreteTex }, uShroud: { value: this.shroudTex },
      uDecals: { value: this.decals.texture }, uMapSize: { value: new THREE.Vector2(map.w, map.h) }, uTime: { value: 0 },
    };
    const material = injectTerrainShader(new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }), this.uniforms);
    this.mesh = new THREE.Mesh(buildTerrainGeometry(hf), material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    const apronGeo = new THREE.PlaneGeometry(map.w + 500, map.h + 500, 1, 1);
    apronGeo.rotateX(-Math.PI / 2);
    apronGeo.translate(map.w / 2, -0.015, map.h / 2);
    apronGeo.setAttribute('aTerrain', new THREE.BufferAttribute(new Float32Array(apronGeo.attributes.position.count * 3), 3));
    const apronMat = injectTerrainShader(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), this.uniforms, { apron: true });
    this.apron = new THREE.Mesh(apronGeo, apronMat);
    this.apron.receiveShadow = true;
    this.group = new THREE.Group();
    this.group.add(this.mesh, this.apron);
    this.spiceRev = -1;
    this.concreteRev = -1;
    this.update(0);
  }

  update(now) {
    const m = this.map;
    if (m.spiceRevision !== this.spiceRev) {
      this.spiceRev = m.spiceRevision;
      const a = this.spiceTex.image.data;
      for (let i = 0; i < m.spice.length; i++) a[i] = m.spice[i] ? Math.min(255, 90 + Math.round((m.spice[i] / 750) * 165)) : 0;
      this.spiceTex.needsUpdate = true;
    }
    if (m.concreteRevision !== this.concreteRev) {
      this.concreteRev = m.concreteRevision;
      const a = this.concreteTex.image.data;
      for (let i = 0; i < m.concrete.length; i++) a[i] = m.concrete[i] ? 255 : 0;
      this.concreteTex.needsUpdate = true;
    }
    this.uniforms.uTime.value = now / 1000;
    this.decals.flush(now);
  }

  /** explored/visible: one byte per tile (0 or 255). */
  setShroud(explored, visible) {
    const a = this.shroudTex.image.data;
    for (let i = 0; i < explored.length; i++) { a[i * 2] = explored[i]; a[i * 2 + 1] = visible[i]; }
    this.shroudTex.needsUpdate = true;
  }
}

// DecalMap needs a DOM canvas; it is loaded lazily so buildTerrainGeometry stays testable under Node.
const DECALS = typeof document !== 'undefined' ? await import('./decals.js') : { DecalMap: class { constructor() { this.texture = null; } flush() {} } };
```

- [ ] **Step 6: Add the terrain scene**

**File: `src/scenes/terrain.js`**
```js
// Terrain showcase: a generated map viewed from above the first start position.
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { generateMap } from '../sim/mapgen.js';
import { readParams } from '../core/params.js';

export async function start({ search }) {
  const params = readParams(search);
  const size = params.num('size', 64);
  const { map, starts } = generateMap({ w: size, h: size, seed: params.num('seed', 7), players: 2 });
  const r3d = new Renderer3D(document.getElementById('gl'), params.str('quality', 'medium'));
  const hf = new Heightfield(map, { sub: r3d.quality.terrainSub, seed: map.seed });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const s = starts[0];
  const cx = params.num('x', s.x + 6), cz = params.num('z', s.y + 6), dist = params.num('dist', 30);
  r3d.camera.position.set(cx, hf.heightAt(cx, cz) + dist * 0.82, cz + dist * 0.57);
  r3d.camera.lookAt(cx, hf.heightAt(cx, cz), cz);
  r3d.follow(cx, cz, dist * 1.1);
  const frame = (now) => { terrain.update(now); r3d.render(); requestAnimationFrame(frame); };
  requestAnimationFrame((now) => { frame(now); window.__dune = { ready: true, scene: 'terrain', map }; });
}
```

Modify `src/main.js` — add to `SCENES`:
```js
  terrain: () => import('./scenes/terrain.js'),
```

Modify `scripts/scenarios.mjs` — add:
```js
  terrain: { query: 'scene=terrain&seed=7' },
  'terrain-overview': { query: 'scene=terrain&seed=7&dist=70&x=32&z=36' },
  'terrain-seed-21': { query: 'scene=terrain&seed=21' },
```

- [ ] **Step 7: Run tests and smoke, then look**

Run: `node --test tests/heightfield.test.mjs tests/terrain-shader.test.mjs && npm run smoke terrain terrain-overview terrain-seed-21`
Expected: PASS and three screenshots. Review `screenshots/terrain.png` and `terrain-overview.png` with the Read tool against `docs/research/refs/genesis-screenshot-gameplay-base-combat-01.jpg`: pale sand with visible wind ripples and dune waves, darker brown rock plateaus that stand above the sand with soft slopes, dark ridged mountains casting shadows, orange-red speckled spice fields with ragged edges, a dimmed desert beyond the map edge, no black gaps, no visible tile grid. Adjust colours in `terrain-shader.js` (not the structure of the code) if a surface reads wrong, then re-run the smoke command.

- [ ] **Step 8: Commit**

```bash
git add src/render src/scenes/terrain.js src/main.js scripts/scenarios.mjs tests/heightfield.test.mjs tests/terrain-shader.test.mjs
git commit -m "feat(render): heightfield terrain with PBR desert shading, spice, concrete, decals and shroud inputs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Camera rig, picking and camera controls

**Files:**
- Create: `src/render/camera-rig.js`, `src/render/picking.js`, `src/input/camera-control.js`
- Modify: `src/scenes/terrain.js` (drive the camera with the rig and controls)
- Test: `tests/picking.test.mjs`

**Interfaces:**
- Consumes: `Heightfield.heightAt` (Task 9), `Renderer3D.camera/follow` (Task 8), settings `{edgeScroll, scrollSpeed}` (Task 2).
- Produces:
  - `class CameraRig(camera, mapW, mapH)` with `target`, `goal`, `distance`, `yaw`, `pitch`, `shake`, getters `forward`/`right`, `lookAt(x, z, immediate)`, `pan(dRight, dForward)`, `zoom(factor)`, `rotate(dYaw, dPitch)`, `reset()`, `update(dt, heightAt)`.
  - `screenToGround(camera, ndcX, ndcY, heightAt, maxHeight=3.5)` → `{x, y, z}` or `null` (sky / no hit); `worldToScreen(camera, x, y, z, width, height, out)` → `{x, y, visible}`; `pixelsPerUnit(camera, x, y, z, height)`.
  - `class CameraControl(rig, element, settings, {viewportRight})` with `update(dt)`; handles edge scroll, arrow keys, wheel zoom, middle-drag pan, Alt + middle-drag rotate.

- [ ] **Step 1: Write the failing tests**

**File: `tests/picking.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { screenToGround, worldToScreen } from '../src/render/picking.js';
import { CameraRig } from '../src/render/camera-rig.js';

function camera() {
  const c = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 600);
  c.position.set(10, 20, 30);
  c.lookAt(10, 0, 10);
  c.updateMatrixWorld();
  return c;
}

test('the screen centre hits the look-at point on flat ground', () => {
  const p = screenToGround(camera(), 0, 0, () => 0);
  assert.ok(Math.abs(p.x - 10) < 0.02 && Math.abs(p.z - 10) < 0.02, JSON.stringify(p));
});

test('rays into the sky return null', () => {
  const c = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 600);
  c.position.set(0, 2, 0);
  c.lookAt(0, 2.5, -10);
  c.updateMatrixWorld();
  assert.equal(screenToGround(c, 0, 0.9, () => 0), null);
});

test('a hill in front of the look-at point is hit first', () => {
  const hill = (x, z) => (Math.abs(x - 10) < 2 && z > 13 && z < 17 ? 5 : 0);
  const p = screenToGround(camera(), 0, 0, hill, 6);
  assert.ok(p.z > 14 && p.z < 17, JSON.stringify(p));
});

test('worldToScreen and screenToGround agree', () => {
  const c = camera();
  const s = worldToScreen(c, 12, 0, 8, 1600, 900);
  assert.ok(s.visible);
  const p = screenToGround(c, (s.x / 1600) * 2 - 1, 1 - (s.y / 900) * 2, () => 0);
  assert.ok(Math.abs(p.x - 12) < 0.05 && Math.abs(p.z - 8) < 0.05);
});

test('camera rig clamps to the map and zoom limits, and looks north at yaw 0', () => {
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 600);
  const rig = new CameraRig(cam, 64, 64);
  rig.lookAt(-50, 500, true);
  assert.deepEqual([rig.target.x, rig.target.z], [0, 64]);
  rig.zoom(100);
  rig.update(10, () => 0);
  assert.equal(rig.distance, rig.maxDistance);
  assert.ok(cam.position.z > rig.target.z, 'camera sits south of its target');
  rig.lookAt(30, 30, true);
  rig.pan(0, 5);
  assert.ok(rig.goal.z < 30, 'panning forward moves north');
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/picking.test.mjs`
Expected: FAIL — cannot find `../src/render/picking.js`.

- [ ] **Step 3: Implement rig, picking and controls**

**File: `src/render/camera-rig.js`**
```js
// RTS camera (spec §5.5): orbits a ground target at ~55° pitch; yaw 0 looks north (map up = screen up).
import * as THREE from 'three';

const deg = THREE.MathUtils.degToRad;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class CameraRig {
  constructor(camera, mapW, mapH) {
    this.camera = camera;
    this.mapW = mapW;
    this.mapH = mapH;
    this.target = new THREE.Vector3(mapW / 2, 0, mapH / 2);
    this.goal = this.target.clone();
    this.minDistance = 8; this.maxDistance = 64;
    this.minPitch = deg(32); this.maxPitch = deg(80);
    this.distance = this.goalDistance = 24;
    this.pitch = this.goalPitch = deg(55);
    this.yaw = this.goalYaw = 0;
    this.shake = 0;
    this.offset = new THREE.Vector3();
  }

  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  get right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  lookAt(x, z, immediate = false) {
    this.goal.set(clamp(x, 0, this.mapW), 0, clamp(z, 0, this.mapH));
    if (immediate) { this.target.x = this.goal.x; this.target.z = this.goal.z; }
  }

  pan(dRight, dForward) {
    const f = this.forward, r = this.right;
    this.lookAt(this.goal.x + r.x * dRight + f.x * dForward, this.goal.z + r.z * dRight + f.z * dForward);
  }

  zoom(factor) { this.goalDistance = clamp(this.goalDistance * factor, this.minDistance, this.maxDistance); }
  rotate(dYaw, dPitch) { this.goalYaw += dYaw; this.goalPitch = clamp(this.goalPitch + dPitch, this.minPitch, this.maxPitch); }
  reset() { this.goalYaw = 0; this.goalPitch = deg(55); this.goalDistance = 24; }

  update(dt, heightAt) {
    const k = 1 - Math.exp(-dt * 12);
    this.target.x += (this.goal.x - this.target.x) * k;
    this.target.z += (this.goal.z - this.target.z) * k;
    const ground = heightAt ? heightAt(this.target.x, this.target.z) : 0;
    this.target.y += (ground - this.target.y) * k;
    this.distance += (this.goalDistance - this.distance) * k;
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.pitch += (this.goalPitch - this.pitch) * k;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.offset.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).multiplyScalar(this.distance);
    this.camera.position.copy(this.target).add(this.offset);
    if (this.shake > 0) {
      const s = this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
```

**File: `src/render/picking.js`**
```js
// Screen ↔ ground conversions. screenToGround ray-marches the heightfield and returns null when the
// ray never meets the ground (sky, horizon), so callers can simply ignore such clicks.
import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const v = new THREE.Vector3();

export function screenToGround(camera, ndcX, ndcY, heightAt, maxHeight = 3.5) {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if (d.y > -1e-4) return null;
  const tStart = Math.max(0, (o.y - maxHeight) / -d.y);
  const tEnd = (o.y + 1) / -d.y;
  const step = 0.25;
  const above = (t) => o.y + d.y * t - heightAt(o.x + d.x * t, o.z + d.z * t) > 0;
  if (!above(tStart)) return null;
  for (let t = tStart + step; t <= tEnd + step; t += step) {
    if (!above(t)) {
      let a = t - step, b = t;
      for (let k = 0; k < 14; k++) { const m = (a + b) / 2; if (above(m)) a = m; else b = m; }
      const x = o.x + d.x * b, z = o.z + d.z * b;
      return { x, y: heightAt(x, z), z };
    }
  }
  return null;
}

export function worldToScreen(camera, x, y, z, width, height, out = {}) {
  v.set(x, y, z).project(camera);
  out.x = ((v.x + 1) / 2) * width;
  out.y = ((1 - v.y) / 2) * height;
  out.visible = v.z > -1 && v.z < 1;
  return out;
}

export function pixelsPerUnit(camera, x, y, z, height) {
  const dist = camera.position.distanceTo(v.set(x, y, z));
  return height / (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(dist, 0.001));
}
```

**File: `src/input/camera-control.js`**
```js
// Camera input (spec §5.5): screen-edge scrolling, arrow keys, wheel zoom, middle-drag pan and
// Alt + middle-drag rotate/tilt. Edge scrolling stops when the pointer leaves the window.
export class CameraControl {
  constructor(rig, element, settings, { viewportRight = () => element.clientWidth } = {}) {
    this.rig = rig;
    this.el = element;
    this.settings = settings;
    this.viewportRight = viewportRight;
    this.mouse = { x: -1, y: -1, inside: false };
    this.keys = new Set();
    this.drag = null;
    element.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (this.drag) this.onDrag(e);
    });
    element.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    window.addEventListener('blur', () => { this.mouse.inside = false; this.keys.clear(); this.drag = null; });
    element.addEventListener('wheel', (e) => { e.preventDefault(); this.rig.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    element.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      this.drag = { x: e.clientX, y: e.clientY, rotate: e.altKey };
      element.setPointerCapture?.(e.pointerId);
    });
    element.addEventListener('pointerup', (e) => { if (e.button === 1) this.drag = null; });
    window.addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow')) { this.keys.add(e.key); e.preventDefault(); } });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
  }

  onDrag(e) {
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    if (this.drag.rotate) { this.rig.rotate(-dx * 0.006, dy * 0.004); return; }
    const scale = this.rig.distance * 0.0019;
    this.rig.pan(-dx * scale, dy * scale);
  }

  update(dt) {
    const speed = this.rig.distance * 0.95 * (this.settings.scrollSpeed ?? 1) * dt;
    let dr = 0, df = 0;
    if (this.keys.has('ArrowLeft')) dr -= 1;
    if (this.keys.has('ArrowRight')) dr += 1;
    if (this.keys.has('ArrowUp')) df += 1;
    if (this.keys.has('ArrowDown')) df -= 1;
    if (this.settings.edgeScroll && this.mouse.inside && !this.drag) {
      const m = 6, w = this.viewportRight(), h = this.el.clientHeight;
      if (this.mouse.x <= m) dr -= 1; else if (this.mouse.x >= w - m && this.mouse.x <= w) dr += 1;
      if (this.mouse.y <= m) df += 1; else if (this.mouse.y >= h - m) df -= 1;
    }
    if (dr || df) this.rig.pan(dr * speed, df * speed);
  }
}
```

Modify `src/scenes/terrain.js` — replace the whole file with a rig-driven version:
```js
// Terrain showcase: a generated map with the RTS camera (edge scroll, arrows, wheel, middle drag).
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { CameraControl } from '../input/camera-control.js';
import { generateMap } from '../sim/mapgen.js';
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const size = params.num('size', 64);
  const { map, starts } = generateMap({ w: size, h: size, seed: params.num('seed', 7), players: 2 });
  const canvas = document.getElementById('gl');
  const r3d = new Renderer3D(canvas, settings.quality);
  const hf = new Heightfield(map, { sub: r3d.quality.terrainSub, seed: map.seed });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const rig = new CameraRig(r3d.camera, map.w, map.h);
  rig.goalDistance = rig.distance = params.num('dist', 30);
  rig.lookAt(params.num('x', starts[0].x + 6), params.num('z', starts[0].y + 6), true);
  const control = new CameraControl(rig, canvas, settings);
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    control.update(dt);
    rig.update(dt, (x, z) => hf.heightAt(x, z));
    r3d.follow(rig.target.x, rig.target.z, rig.distance * 1.1);
    terrain.update(now);
    r3d.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((now) => {
    last = now;
    rig.update(1, (x, z) => hf.heightAt(x, z));
    frame(now);
    window.__dune = { ready: true, scene: 'terrain', map, rig };
  });
}
```

- [ ] **Step 4: Run tests and smoke**

Run: `node --test tests/picking.test.mjs && npm run smoke terrain terrain-overview`
Expected: PASS (5 tests); screenshots look the same as in Task 9 (the camera rig reproduces the same framing).

- [ ] **Step 5: Commit**

```bash
git add src/render/camera-rig.js src/render/picking.js src/input/camera-control.js src/scenes/terrain.js tests/picking.test.mjs
git commit -m "feat(render): RTS camera rig, heightfield picking and camera controls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Model kit, materials and the instancer

**Files:**
- Create: `src/render/models/kit.js`, `src/render/models/textures.js`, `src/render/models/materials.js`, `src/render/models/instancer.js`
- Test: `tests/models-kit.test.mjs`

**Interfaces:**
- Consumes: `three`, `RoundedBoxGeometry`, `mergeGeometries` (vendored addons; Node resolves them from `node_modules/three`).
- Produces:
  - `MAT = {PAINT, HOUSE, METAL, DARK, TREAD, GLASS, LIGHT, HOUSE_LIGHT}`; primitives that return merge-ready geometry (non-indexed, `position/normal/uv/color`): `shape(geo, opts)`, `box(w,h,d,opts)`, `rbox(w,h,d,radius,opts)`, `cyl(rTop,rBottom,h,seg,opts)`, `sphere(r,seg,opts)`, `dome(r,seg,opts)`, `cone(r,h,seg,opts)`, `torus(r,tube,radial,tubular,opts,arc)`, `lathe(points,seg,opts)`, `prism(profile,depth,opts,bevel)`, `tube(points,radius,radial,opts)`; `opts = {p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz], color, glow}`.
  - `class ModelBuilder(name)` with `node(name, {parent='root', pivot, axis='y', kind='rot'|'trans'|'scale', param=name, value})`, `add(material, geometry, node='root')`, `build(extra)` → `ModelDef {name, nodes, parts:[{node, material, geometry}], ...extra}`.
  - `getMaterial(key)` (cached), `HOUSE_TINTED` (materials that take the house colour); `detailTexture()`, `treadTexture()` (null outside the browser).
  - `class InstancedModel(def, scene, {capacity=8, castShadow=true})` with `add()` → `handle {slot, matrix, params, color, visible}`, `remove(handle)`, `update()`, `dispose()`, `meshes`, `count`. `params[node.param]` drives each node; `params.tread` scrolls tread textures.

- [ ] **Step 1: Write the failing tests**

**File: `tests/models-kit.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ModelBuilder, MAT, box, cyl, rbox, prism, lathe } from '../src/render/models/kit.js';
import { InstancedModel } from '../src/render/models/instancer.js';
import { getMaterial } from '../src/render/models/materials.js';

test('builder merges geometry per node and material, with vertex colours', () => {
  const b = new ModelBuilder('t');
  b.node('turret', { pivot: [0, 0.2, 0] });
  b.add(MAT.PAINT, box(1, 0.2, 0.5, { color: 0xff0000 }));
  b.add(MAT.PAINT, box(0.2, 0.2, 0.2, { p: [0.3, 0.2, 0] }));
  b.add(MAT.HOUSE, box(0.3, 0.1, 0.3), 'turret');
  const def = b.build({ radius: 0.5 });
  assert.equal(def.parts.length, 2);
  assert.equal(def.radius, 0.5);
  const paint = def.parts.find((p) => p.material === MAT.PAINT);
  assert.equal(paint.geometry.attributes.position.count, 72);
  assert.ok(paint.geometry.attributes.color && paint.geometry.attributes.uv && paint.geometry.attributes.normal);
});

test('mixed primitive types merge together', () => {
  const b = new ModelBuilder('mix');
  b.add(MAT.PAINT, rbox(0.3, 0.1, 0.2, 0.03));
  b.add(MAT.PAINT, cyl(0.05, 0.05, 0.2, 8, { r: [0, 0, Math.PI / 2] }));
  b.add(MAT.PAINT, prism([[0, 0], [0.2, 0], [0.1, 0.1]], 0.1));
  b.add(MAT.PAINT, lathe([[0.05, 0], [0.1, 0.1]], 10));
  assert.equal(b.build().parts.length, 1);
});

test('unknown nodes and undeclared parents are rejected', () => {
  const b = new ModelBuilder('bad');
  assert.throws(() => b.add(MAT.PAINT, box(1, 1, 1), 'nope'));
  assert.throws(() => b.node('child', { parent: 'missing' }));
});

test('instanced model grows, removes by swapping and poses nodes', () => {
  const scene = new THREE.Scene();
  const b = new ModelBuilder('t');
  b.node('turret', { pivot: [0, 1, 0], axis: 'y' });
  b.add(MAT.PAINT, box(1, 1, 1));
  b.add(MAT.HOUSE, box(0.5, 0.5, 0.5), 'turret');
  const model = new InstancedModel(b.build(), scene, { capacity: 2 });
  const handles = [];
  for (let i = 0; i < 5; i++) { const h = model.add(); h.matrix.makeTranslation(i, 0, 0); handles.push(h); }
  model.remove(handles[1]);
  handles[4].params.turret = Math.PI / 2;
  handles[4].color.set(0x00ff00);
  model.update();
  const [body, turret] = model.meshes;
  assert.equal(model.count, 4);
  assert.equal(turret.count, 4);
  assert.equal(handles[4].slot, 1);
  const m = new THREE.Matrix4();
  turret.getMatrixAt(1, m);
  const p = new THREE.Vector3().setFromMatrixPosition(m);
  assert.deepEqual([p.x, p.y, p.z].map((v) => +v.toFixed(3)), [4, 1, 0]);
  const c = new THREE.Color();
  turret.getColorAt(1, c);
  assert.equal(c.getHex(), 0x00ff00);
  assert.equal(body.instanceColor, null);
  assert.equal(scene.children.length, 2);
});

test('hidden handles collapse to zero scale', () => {
  const scene = new THREE.Scene();
  const b = new ModelBuilder('h');
  b.add(MAT.PAINT, box(1, 1, 1));
  const model = new InstancedModel(b.build(), scene);
  const h = model.add();
  h.visible = false;
  model.update();
  const m = new THREE.Matrix4();
  model.meshes[0].getMatrixAt(0, m);
  assert.equal(m.determinant(), 0);
});

test('every material key resolves outside the browser', () => {
  for (const key of Object.values(MAT)) assert.ok(getMaterial(key));
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/models-kit.test.mjs`
Expected: FAIL — cannot find `../src/render/models/kit.js`.

- [ ] **Step 3: Implement the kit, textures and materials**

**File: `src/render/models/kit.js`**
```js
// Procedural modelling kit (spec §5.3): primitives with a transform and a flat vertex colour,
// merged per node and material by ModelBuilder into ModelDefs that InstancedModel draws.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MAT = { PAINT: 'paint', HOUSE: 'house', METAL: 'metal', DARK: 'dark', TREAD: 'tread', GLASS: 'glass', LIGHT: 'light', HOUSE_LIGHT: 'houseLight' };

const KEEP = new Set(['position', 'normal', 'uv', 'color']);
const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler();
const sv = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();

/** Normalise any geometry for merging: non-indexed, position/normal/uv/color only, transformed. */
export function shape(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], color = 0xffffff, glow = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  euler.set(r[0], r[1], r[2]);
  g.applyMatrix4(m4.compose(pv.set(p[0], p[1], p[2]), quat.setFromEuler(euler), sv.set(s[0], s[1], s[2])));
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  col.set(color);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = col.r * glow; colors[i * 3 + 1] = col.g * glow; colors[i * 3 + 2] = col.b * glow; }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export const box = (w, h, d, o) => shape(new THREE.BoxGeometry(w, h, d), o);
export const rbox = (w, h, d, radius, o) => shape(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2) * 0.99), o);
export const cyl = (rTop, rBottom, h, seg, o) => shape(new THREE.CylinderGeometry(rTop, rBottom, h, seg), o);
export const sphere = (r, seg, o) => shape(new THREE.SphereGeometry(r, seg, Math.max(3, Math.ceil(seg / 2))), o);
export const dome = (r, seg, o) => shape(new THREE.SphereGeometry(r, seg, Math.max(2, Math.ceil(seg / 4)), 0, Math.PI * 2, 0, Math.PI / 2), o);
export const cone = (r, h, seg, o) => shape(new THREE.ConeGeometry(r, h, seg), o);
export const torus = (r, tube, radial, tubular, o, arc = Math.PI * 2) => shape(new THREE.TorusGeometry(r, tube, radial, tubular, arc), o);
export const lathe = (points, seg, o) => shape(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), o);

/** Extrude a 2D side profile (x forward, y up) across z by `depth`, centred on z = 0. */
export function prism(profile, depth, o = {}, bevel = 0) {
  const sh = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return shape(g, o);
}

export function tube(points, radius, radial = 6, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return shape(new THREE.TubeGeometry(curve, Math.max(4, points.length * 6), radius, radial, false), o);
}

export class ModelBuilder {
  constructor(name) {
    this.name = name;
    this.nodes = { root: { parent: null } };
    this.buckets = new Map();
  }

  /** kind 'rot' turns about `axis` by params[param]; 'trans' slides along it; 'scale' scales uniformly. */
  node(name, { parent = 'root', pivot = [0, 0, 0], axis = 'y', kind = 'rot', param = name, value = kind === 'scale' ? 1 : 0 } = {}) {
    if (!this.nodes[parent]) throw new Error(`${this.name}: declare parent ${parent} before ${name}`);
    this.nodes[name] = { parent, pivot, axis, kind, param, value };
    return this;
  }

  add(material, geometry, node = 'root') {
    if (!this.nodes[node]) throw new Error(`${this.name}: unknown node ${node}`);
    const key = `${node}|${material}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { node, material, geos: [] });
    this.buckets.get(key).geos.push(geometry);
    return this;
  }

  build(extra = {}) {
    const parts = [];
    for (const { node, material, geos } of this.buckets.values()) {
      const geometry = mergeGeometries(geos, false);
      if (!geometry) throw new Error(`${this.name}: could not merge ${node}/${material}`);
      geometry.computeBoundingSphere();
      parts.push({ node, material, geometry });
    }
    return { name: this.name, nodes: this.nodes, parts, ...extra };
  }
}
```

**File: `src/render/models/textures.js`**
```js
// Procedural canvas textures. Outside the browser (Node tests) they are null.
import * as THREE from 'three';

const cache = {};
const hasDom = () => typeof document !== 'undefined';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** Light grime and panel seams (linear values 0.84–1.0) that modulate vertex colours. */
export function detailTexture() {
  if (!hasDom()) return null;
  if (cache.detail) return cache.detail;
  const c = canvas(256), g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  let s = 1234567;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 256 * 256; i++) {
    const v = 215 + rnd() * 40;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.3;
  g.strokeStyle = '#707070';
  g.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const p = 20 + k * 42;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
    g.beginPath(); g.moveTo(0, p + 11); g.lineTo(256, p + 11); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return (cache.detail = t);
}

/** Track cleats; scrolled per instance by the tread material. */
export function treadTexture() {
  if (!hasDom()) return null;
  if (cache.tread) return cache.tread;
  const c = canvas(64), g = c.getContext('2d');
  g.fillStyle = '#3a3531'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#1c1a18'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 4, 64);
  g.fillStyle = '#5a534c'; for (let x = 0; x < 64; x += 8) g.fillRect(x + 4, 0, 1, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return (cache.tread = t);
}
```

**File: `src/render/models/materials.js`**
```js
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
```

- [ ] **Step 4: Implement the instancer**

**File: `src/render/models/instancer.js`**
```js
// One InstancedMesh per model part (spec §5.1). Each instance has a root matrix, per-node parameters
// (turret yaw, recoil, wheel spin …), a house colour and a tread scroll value.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { getMaterial, HOUSE_TINTED } from './materials.js';

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const local = new THREE.Matrix4(), tmp = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);

export class InstancedModel {
  constructor(def, scene, { capacity = 8, castShadow = true } = {}) {
    this.def = def;
    this.scene = scene;
    this.castShadow = castShadow;
    this.capacity = capacity;
    this.count = 0;
    this.handles = [];
    this.nodeNames = Object.keys(def.nodes);
    this.nodeIndex = Object.fromEntries(this.nodeNames.map((n, i) => [n, i]));
    this.nodeMatrices = this.nodeNames.map(() => new THREE.Matrix4());
    this.partNode = def.parts.map((p) => this.nodeIndex[p.node]);
    this.meshes = def.parts.map((part) => this.createMesh(part, capacity));
  }

  createMesh(part, capacity) {
    const mesh = new THREE.InstancedMesh(part.geometry, getMaterial(part.material), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = this.castShadow && part.material !== MAT.LIGHT && part.material !== MAT.HOUSE_LIGHT;
    mesh.receiveShadow = true;
    if (HOUSE_TINTED.has(part.material)) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    if (part.material === MAT.TREAD) {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      attr.setUsage(THREE.DynamicDrawUsage);
      part.geometry.setAttribute('aTread', attr);
    }
    this.scene.add(mesh);
    return mesh;
  }

  add() {
    if (this.count === this.capacity) this.grow();
    const handle = { slot: this.count, matrix: new THREE.Matrix4(), params: {}, color: new THREE.Color(1, 1, 1), visible: true };
    this.handles[this.count++] = handle;
    return handle;
  }

  remove(handle) {
    if (handle.slot < 0) return;
    const last = this.handles[this.count - 1];
    if (last !== handle) { last.slot = handle.slot; this.handles[handle.slot] = last; }
    this.handles[--this.count] = undefined;
    handle.slot = -1;
  }

  grow() {
    const capacity = this.capacity * 2;
    this.meshes = this.meshes.map((old, i) => {
      const part = this.def.parts[i];
      const oldTread = part.geometry.getAttribute('aTread')?.array ?? null;
      this.scene.remove(old);
      old.dispose();
      const mesh = this.createMesh(part, capacity);
      mesh.instanceMatrix.array.set(old.instanceMatrix.array);
      if (old.instanceColor) mesh.instanceColor.array.set(old.instanceColor.array);
      if (oldTread) part.geometry.getAttribute('aTread').array.set(oldTread);
      return mesh;
    });
    this.capacity = capacity;
  }

  update() {
    const nodes = this.def.nodes;
    for (let s = 0; s < this.count; s++) {
      const h = this.handles[s];
      if (!h.visible) { for (const mesh of this.meshes) mesh.setMatrixAt(s, hidden); continue; }
      for (let n = 0; n < this.nodeNames.length; n++) {
        const node = nodes[this.nodeNames[n]];
        const out = this.nodeMatrices[n];
        if (!node.parent) { out.copy(h.matrix); continue; }
        local.makeTranslation(node.pivot[0], node.pivot[1], node.pivot[2]);
        const v = h.params[node.param] ?? node.value;
        if (node.kind === 'rot') local.multiply(tmp.makeRotationAxis(AXES[node.axis], v));
        else if (node.kind === 'trans') { const a = AXES[node.axis]; local.multiply(tmp.makeTranslation(a.x * v, a.y * v, a.z * v)); }
        else if (node.kind === 'scale') local.multiply(tmp.makeScale(v, v, v));
        out.multiplyMatrices(this.nodeMatrices[this.nodeIndex[node.parent]], local);
      }
      for (let p = 0; p < this.meshes.length; p++) {
        const mesh = this.meshes[p];
        mesh.setMatrixAt(s, this.nodeMatrices[this.partNode[p]]);
        if (mesh.instanceColor) mesh.setColorAt(s, h.color);
      }
    }
    for (let p = 0; p < this.meshes.length; p++) {
      const mesh = this.meshes[p];
      mesh.count = this.count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const tread = this.def.parts[p].geometry.getAttribute('aTread');
      if (tread) {
        for (let s = 0; s < this.count; s++) tread.array[s] = this.handles[s].params.tread ?? 0;
        tread.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const mesh of this.meshes) { this.scene.remove(mesh); mesh.dispose(); }
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/models-kit.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/render/models tests/models-kit.test.mjs
git commit -m "feat(render): modelling kit, shared materials with tread scrolling and house tint, instancer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Unit and Construction Yard models, gallery scene

**Files:**
- Create: `src/render/models/palette.js`, `src/render/models/units/tank-chassis.js`, `combat-tank.js`, `siege-tank.js`, `missile-tank.js`, `deviator.js`, `sonic-tank.js`, `devastator.js`, `harvester.js`, `mcv.js`, `trike.js`, `quad.js`, `infantry.js` (all under `src/render/models/units/`), `src/render/models/structures/construction-yard.js`, `src/render/models/structures/placeholder.js`, `src/render/models/index.js`, `src/render/views/pose.js`, `src/scenes/gallery.js`
- Modify: `src/main.js` (register `gallery`), `scripts/scenarios.mjs` (gallery per house)
- Test: `tests/models-catalog.test.mjs`

**Interfaces:**
- Consumes: kit and instancer (Task 11), `Heightfield`, `TerrainView` (Task 9), `CameraRig` (Task 10), `Renderer3D` (Task 8), `UNITS`, `HOUSES`.
- Produces: `PAL` colours; model builders returning `ModelDef` with `radius` (selection size) and, for armed units, `muzzle` ([x,y,z] in the model's root or weapon node space); `modelDef(id)` (cached), `unitModelId(typeId)`, `structureModelId(typeId, w, h)`, `UNIT_MODEL`, `STRUCTURE_MODEL`; `poseMatrix(out, x, y, z, heading, normal=null)` (root matrix: model +X points along `heading`, +Y along `normal`). Node params used by later tasks: `turret` (yaw relative to hull, radians, sign = −(sim angle)), `barrel` (recoil slide, ≤ 0), `wheel` (spin), `drum` (harvester intake spin), `legL`/`legR` (walk swing), `crane` (yard crane yaw), `tread` (texture scroll).
- Models all face +X, stand on y = 0, and are sized in tiles (1 tile = 1 unit): tanks ≈ 0.65 long, Devastator ≈ 0.9, infantry ≈ 0.2 tall, the Construction Yard fills its 2×2 footprint.

- [ ] **Step 1: Write the failing test**

**File: `tests/models-catalog.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { STRUCTURES } from '../src/data/structures.js';
import { MAT } from '../src/render/models/kit.js';
import { modelDef, unitModelId, structureModelId } from '../src/render/models/index.js';

const MATS = new Set(Object.values(MAT));

test('every unit type resolves to a model that builds', () => {
  for (const typeId of Object.keys(UNITS)) {
    const def = modelDef(unitModelId(typeId));
    assert.ok(def.parts.length >= 1, typeId);
    assert.ok(def.radius > 0, `${typeId} radius`);
    for (const p of def.parts) assert.ok(MATS.has(p.material), `${typeId} material ${p.material}`);
  }
});

test('ground combat models expose the nodes the views drive', () => {
  for (const id of ['combatTank', 'siegeTank', 'missileTank', 'deviator']) assert.ok(modelDef(id).nodes.turret, `${id} turret`);
  for (const id of ['combatTank', 'siegeTank']) assert.ok(modelDef(id).nodes.barrel, `${id} barrel`);
  assert.ok(modelDef('harvester').nodes.drum);
  assert.ok(modelDef('soldier').nodes.legL && modelDef('trooper').nodes.legR);
  assert.ok(Object.values(modelDef('quad').nodes).some((n) => n.param === 'wheel'));
  assert.ok(modelDef('constructionYard').nodes.crane);
});

test('every structure resolves to a model (placeholders until plan 1b)', () => {
  for (const [id, s] of Object.entries(STRUCTURES)) {
    const def = modelDef(structureModelId(id, s.w, s.h));
    assert.ok(def.parts.length >= 1, id);
  }
});

test('model sizes stay inside their footprint', () => {
  for (const id of ['combatTank', 'siegeTank', 'missileTank', 'harvester', 'mcv', 'trike', 'quad', 'devastator']) {
    for (const p of modelDef(id).parts) {
      if (p.node !== 'root') continue;
      p.geometry.computeBoundingBox();
      const b = p.geometry.boundingBox;
      assert.ok(b.max.x - b.min.x <= 1.1 && b.max.z - b.min.z <= 0.8, `${id} fits about one tile`);
      assert.ok(b.min.y >= -0.01, `${id} does not sink below the ground`);
    }
  }
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/models-catalog.test.mjs`
Expected: FAIL — cannot find `../src/render/models/index.js`.

- [ ] **Step 3: Palette and shared tank chassis**

**File: `src/render/models/palette.js`**
```js
// Shared colours (sRGB hex). HOUSE parts are white in the geometry and get the house colour per instance.
export const PAL = {
  sand: 0xc9a46c, sandDark: 0x9b7b4f, sandLight: 0xdcc08c,
  steel: 0x9aa1a8, steelDark: 0x4f555c, gunmetal: 0x383c42,
  rubber: 0x2a2623, glass: 0x1d3446, white: 0xe8e4dc, offWhite: 0xcac3b6,
  brass: 0xc8963c, gold: 0xe3b24c, rocketRed: 0xd6392a, yellow: 0xd9a52e,
  concrete: 0x9d998f, concreteDark: 0x76726a,
  cloth: 0x8c6d4b, clothDark: 0x5b4632, mask: 0x3a3936,
  orangeGlow: 0xff8c2e, greenGlow: 0x7dff8e, redGlow: 0xff4a36, blueGlow: 0x88d8ff,
};
```

**File: `src/render/models/units/tank-chassis.js`**
```js
// Tracked hull shared by the tank family: scrolling treads, road wheels, fenders, a sloped hull
// extruded from a side profile, house stripes and an engine deck. Returns the deck height.
import { MAT, box, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';

export function tankChassis(b, { length = 0.64, width = 0.46, hull = 0.13, trackW = 0.12, trackH = 0.12, color = PAL.sand, stripe = true } = {}) {
  const hl = length / 2, hw = width / 2, base = 0.06;
  for (const side of [-1, 1]) {
    const z = side * (hw - trackW / 2);
    b.add(MAT.TREAD, box(length, trackH, trackW, { p: [0, trackH / 2 + 0.005, z] }));
    for (const x of [-hl + 0.055, hl - 0.055]) b.add(MAT.DARK, cyl(0.058, 0.058, trackW + 0.012, 12, { p: [x, 0.062, z], r: [Math.PI / 2, 0, 0], color: PAL.gunmetal }));
    b.add(MAT.PAINT, box(length + 0.03, 0.022, trackW + 0.02, { p: [0, trackH + 0.016, z], color }));
  }
  const top = base + hull;
  const profile = [[-hl + 0.01, base], [hl - 0.12, base], [hl + 0.02, base + hull * 0.45], [hl - 0.08, top], [-hl + 0.06, top], [-hl - 0.01, top - 0.035]];
  b.add(MAT.PAINT, prism(profile, width - 2 * trackW + 0.03, { color }));
  b.add(MAT.PAINT, box(length * 0.78, 0.03, width - 0.02, { p: [-0.03, top - 0.012, 0], color }));
  if (stripe) for (const side of [-1, 1]) b.add(MAT.HOUSE, box(length * 0.62, 0.03, 0.03, { p: [-0.04, top - 0.005, side * (hw - 0.03)] }));
  b.add(MAT.DARK, box(0.11, 0.012, width * 0.36, { p: [-hl + 0.12, top + 0.004, 0], color: PAL.gunmetal }));
  b.add(MAT.METAL, cyl(0.014, 0.014, 0.07, 6, { p: [-hl + 0.07, top + 0.03, hw - trackW - 0.02], color: PAL.steelDark }));
  return { top };
}
```

- [ ] **Step 4: Tank family models**

**File: `src/render/models/units/combat-tank.js`**
```js
// Combat Tank (Mentat art: low tracked hull, rounded turret, single long barrel).
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function combatTank() {
  const b = new ModelBuilder('combatTank');
  const { top } = tankChassis(b);
  b.node('turret', { pivot: [-0.04, top, 0] });
  b.node('barrel', { parent: 'turret', pivot: [0.11, 0.055, 0], axis: 'x', kind: 'trans' });
  b.add(MAT.PAINT, rbox(0.26, 0.09, 0.24, 0.035, { p: [0, 0.045, 0], color: PAL.sand }), 'turret');
  b.add(MAT.PAINT, prism([[0.06, 0], [0.15, 0.015], [0.15, 0.07], [0.06, 0.085]], 0.14, { p: [0, 0.005, 0], color: PAL.sandDark }), 'turret');
  b.add(MAT.HOUSE, box(0.21, 0.018, 0.245, { p: [-0.015, 0.06, 0] }), 'turret');
  b.add(MAT.DARK, cyl(0.04, 0.045, 0.022, 10, { p: [-0.06, 0.1, 0.05], color: PAL.gunmetal }), 'turret');
  b.add(MAT.METAL, cyl(0.02, 0.024, 0.3, 10, { p: [0.15, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.steelDark }), 'barrel');
  b.add(MAT.METAL, cyl(0.03, 0.03, 0.05, 10, { p: [0.3, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }), 'barrel');
  return b.build({ radius: 0.36, muzzle: [0.33, 0, 0] });
}
```

**File: `src/render/models/units/siege-tank.js`**
```js
// Siege Tank: longer, heavier hull, big turret with bustle, long heavy barrel with muzzle brake.
import { ModelBuilder, MAT, box, rbox, cyl } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function siegeTank() {
  const b = new ModelBuilder('siegeTank');
  const { top } = tankChassis(b, { length: 0.76, width: 0.52, hull: 0.15, trackW: 0.13, trackH: 0.13 });
  b.node('turret', { pivot: [-0.07, top, 0] });
  b.node('barrel', { parent: 'turret', pivot: [0.14, 0.07, 0], axis: 'x', kind: 'trans' });
  b.add(MAT.PAINT, rbox(0.34, 0.11, 0.3, 0.04, { p: [0, 0.055, 0], color: PAL.sand }), 'turret');
  b.add(MAT.PAINT, rbox(0.14, 0.05, 0.22, 0.02, { p: [-0.18, 0.05, 0], color: PAL.sandDark }), 'turret');
  b.add(MAT.HOUSE, box(0.28, 0.02, 0.305, { p: [-0.02, 0.075, 0] }), 'turret');
  for (const z of [-0.1, 0.1]) b.add(MAT.DARK, cyl(0.015, 0.015, 0.06, 6, { p: [0.06, 0.13, z], color: PAL.gunmetal }), 'turret');
  b.add(MAT.METAL, cyl(0.028, 0.034, 0.44, 12, { p: [0.22, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.steelDark }), 'barrel');
  b.add(MAT.METAL, cyl(0.04, 0.04, 0.03, 12, { p: [0.16, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }), 'barrel');
  b.add(MAT.METAL, box(0.07, 0.05, 0.08, { p: [0.45, 0, 0], color: PAL.gunmetal }), 'barrel');
  return b.build({ radius: 0.44, muzzle: [0.49, 0, 0] });
}
```

**File: `src/render/models/units/missile-tank.js`**
```js
// Missile Tank / Rocket Launcher: tracked hull, turret with an elevated 2x3 rocket box, red warheads.
import { ModelBuilder, MAT, box, rbox, cyl, cone } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function missileTank() {
  const b = new ModelBuilder('missileTank');
  const { top } = tankChassis(b);
  b.node('turret', { pivot: [-0.06, top, 0] });
  b.node('launcher', { parent: 'turret', pivot: [0, 0.06, 0], axis: 'z', value: 0.38 });
  b.add(MAT.PAINT, cyl(0.1, 0.11, 0.05, 12, { p: [0, 0.025, 0], color: PAL.sandDark }), 'turret');
  b.add(MAT.METAL, box(0.06, 0.07, 0.05, { p: [0, 0.06, 0], color: PAL.steelDark }), 'turret');
  b.add(MAT.PAINT, rbox(0.3, 0.1, 0.22, 0.02, { p: [0.03, 0.04, 0], color: PAL.sand }), 'launcher');
  for (const z of [-0.112, 0.112]) b.add(MAT.HOUSE, box(0.2, 0.08, 0.005, { p: [0, 0.04, z] }), 'launcher');
  for (const y of [0.015, 0.065]) for (const z of [-0.065, 0, 0.065]) {
    b.add(MAT.DARK, cyl(0.026, 0.026, 0.02, 8, { p: [0.18, y, z], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }), 'launcher');
    b.add(MAT.PAINT, cone(0.018, 0.04, 8, { p: [0.2, y, z], r: [0, 0, -Math.PI / 2], color: PAL.rocketRed }), 'launcher');
  }
  return b.build({ radius: 0.38, muzzle: [0.22, 0.04, 0] });
}
```

**File: `src/render/models/units/deviator.js`**
```js
// Deviator: the launcher chassis carrying one large nerve-gas missile on a rail (green warhead).
import { ModelBuilder, MAT, box, cyl, cone } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function deviator() {
  const b = new ModelBuilder('deviator');
  const { top } = tankChassis(b);
  b.node('turret', { pivot: [-0.05, top, 0] });
  b.node('launcher', { parent: 'turret', pivot: [0, 0.07, 0], axis: 'z', value: 0.42 });
  b.add(MAT.PAINT, cyl(0.1, 0.11, 0.05, 12, { p: [0, 0.025, 0], color: PAL.sandDark }), 'turret');
  b.add(MAT.METAL, box(0.05, 0.08, 0.05, { p: [0, 0.07, 0], color: PAL.steelDark }), 'turret');
  b.add(MAT.METAL, box(0.36, 0.025, 0.08, { p: [0.04, 0, 0], color: PAL.steelDark }), 'launcher');
  b.add(MAT.PAINT, cyl(0.035, 0.035, 0.3, 10, { p: [0.05, 0.045, 0], r: [0, 0, Math.PI / 2], color: PAL.white }), 'launcher');
  b.add(MAT.LIGHT, cone(0.035, 0.08, 10, { p: [0.24, 0.045, 0], r: [0, 0, -Math.PI / 2], color: PAL.greenGlow, glow: 1.4 }), 'launcher');
  b.add(MAT.HOUSE, cyl(0.037, 0.037, 0.03, 10, { p: [-0.02, 0.045, 0], r: [0, 0, Math.PI / 2] }), 'launcher');
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    b.add(MAT.PAINT, box(0.05, 0.004, 0.035, { p: [-0.1, 0.045 + Math.sin(a) * 0.04, Math.cos(a) * 0.04], r: [a, 0, 0], color: PAL.steel }), 'launcher');
  }
  return b.build({ radius: 0.38, muzzle: [0.26, 0.045, 0] });
}
```

**File: `src/render/models/units/sonic-tank.js`**
```js
// Sonic Tank: hull-fixed golden horn emitter (Mentat art) with a glowing core; no turret.
import { ModelBuilder, MAT, box, rbox, cyl, lathe } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function sonicTank() {
  const b = new ModelBuilder('sonicTank');
  const { top } = tankChassis(b, { length: 0.66 });
  const y = top + 0.1;
  b.add(MAT.PAINT, rbox(0.2, 0.08, 0.2, 0.02, { p: [-0.08, top + 0.04, 0], color: PAL.sandDark }));
  b.add(MAT.HOUSE, box(0.18, 0.02, 0.205, { p: [-0.08, top + 0.075, 0] }));
  b.add(MAT.METAL, cyl(0.035, 0.05, 0.1, 10, { p: [0, y, 0], r: [0, 0, -Math.PI / 2], color: PAL.steelDark }));
  const flare = [[0.03, 0], [0.035, 0.06], [0.05, 0.12], [0.085, 0.18], [0.13, 0.22], [0.16, 0.235]];
  b.add(MAT.METAL, lathe(flare, 20, { p: [0.04, y, 0], r: [0, 0, -Math.PI / 2], color: PAL.brass }));
  b.add(MAT.DARK, lathe([...flare].reverse().map(([r, h]) => [r * 0.9, h]), 20, { p: [0.04, y, 0], r: [0, 0, -Math.PI / 2], color: 0x3b2c18 }));
  b.add(MAT.LIGHT, cyl(0.028, 0.028, 0.01, 12, { p: [0.05, y, 0], r: [0, 0, Math.PI / 2], color: PAL.blueGlow, glow: 1.5 }));
  return b.build({ radius: 0.38, muzzle: [0.3, y, 0] });
}
```

**File: `src/render/models/units/devastator.js`**
```js
// Devastator: huge armoured tank with hull-fixed twin plasma cannons and glowing reactor vents.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function devastator() {
  const b = new ModelBuilder('devastator');
  const { top } = tankChassis(b, { length: 0.9, width: 0.64, hull: 0.18, trackW: 0.16, trackH: 0.15, color: PAL.sandDark });
  b.add(MAT.PAINT, rbox(0.5, 0.15, 0.46, 0.035, { p: [-0.08, top + 0.075, 0], color: PAL.sand }));
  b.add(MAT.PAINT, prism([[0.17, 0], [0.3, 0], [0.26, 0.1], [0.17, 0.13]], 0.4, { p: [0, top, 0], color: PAL.sand }));
  for (const z of [-0.235, 0.235]) b.add(MAT.HOUSE, box(0.42, 0.1, 0.012, { p: [-0.08, top + 0.075, z] }));
  b.add(MAT.HOUSE, box(0.3, 0.012, 0.3, { p: [-0.12, top + 0.152, 0] }));
  for (const z of [-0.09, 0.09]) {
    b.add(MAT.METAL, cyl(0.032, 0.038, 0.42, 12, { p: [0.36, top + 0.09, z], r: [0, 0, Math.PI / 2], color: PAL.steelDark }));
    b.add(MAT.METAL, cyl(0.045, 0.045, 0.06, 12, { p: [0.56, top + 0.09, z], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  }
  for (const z of [-0.12, 0.12]) b.add(MAT.LIGHT, box(0.05, 0.04, 0.08, { p: [-0.34, top + 0.1, z], color: PAL.orangeGlow, glow: 1.6 }));
  b.add(MAT.DARK, box(0.1, 0.02, 0.36, { p: [-0.28, top + 0.155, 0], color: PAL.gunmetal }));
  return b.build({ radius: 0.52, muzzle: [0.6, top + 0.09, 0] });
}
```

- [ ] **Step 5: Support vehicles, light vehicles and infantry**

**File: `src/render/models/units/harvester.js`**
```js
// Spice Harvester: wedge-shaped armoured hopper on wide tracks, cab, exhaust and a spinning intake drum.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function harvester() {
  const b = new ModelBuilder('harvester');
  const { top } = tankChassis(b, { length: 0.8, width: 0.58, hull: 0.08, trackW: 0.14, trackH: 0.13, stripe: false });
  b.add(MAT.PAINT, prism([[-0.4, top - 0.02], [0.24, top - 0.02], [0.4, top + 0.1], [0.3, top + 0.3], [-0.36, top + 0.3], [-0.42, top + 0.22]], 0.52, { color: PAL.sand }));
  b.add(MAT.DARK, box(0.5, 0.012, 0.36, { p: [-0.06, top + 0.305, 0], color: PAL.gunmetal }));
  for (const z of [-0.262, 0.262]) b.add(MAT.HOUSE, prism([[-0.3, top + 0.06], [0.2, top + 0.06], [0.27, top + 0.16], [0.2, top + 0.24], [-0.3, top + 0.24]], 0.012, { p: [0, 0, z] }));
  b.add(MAT.PAINT, rbox(0.14, 0.1, 0.16, 0.02, { p: [0.2, top + 0.34, 0.14], color: PAL.sandLight }));
  b.add(MAT.GLASS, box(0.02, 0.05, 0.12, { p: [0.275, top + 0.35, 0.14], color: PAL.glass }));
  b.add(MAT.METAL, cyl(0.018, 0.018, 0.14, 6, { p: [-0.3, top + 0.37, -0.18], color: PAL.steelDark }));
  b.node('drum', { pivot: [0.42, 0.11, 0], axis: 'z' });
  b.add(MAT.METAL, cyl(0.07, 0.07, 0.46, 12, { r: [Math.PI / 2, 0, 0], color: PAL.steel }), 'drum');
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.add(MAT.DARK, box(0.03, 0.02, 0.46, { p: [Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0], r: [0, 0, a], color: PAL.gunmetal }), 'drum');
  }
  return b.build({ radius: 0.48 });
}
```

**File: `src/render/models/units/mcv.js`**
```js
// MCV: long eight-wheeled carrier with the folded Construction Yard module and crane on top.
import { ModelBuilder, MAT, box, rbox, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';

export function mcv() {
  const b = new ModelBuilder('mcv');
  for (const x of [-0.33, -0.11, 0.11, 0.33]) for (const z of [-0.2, 0.2]) {
    b.add(MAT.DARK, cyl(0.075, 0.075, 0.07, 14, { p: [x, 0.075, z], r: [Math.PI / 2, 0, 0], color: PAL.rubber }));
    b.add(MAT.METAL, cyl(0.035, 0.035, 0.074, 8, { p: [x, 0.075, z], r: [Math.PI / 2, 0, 0], color: PAL.steelDark }));
  }
  b.add(MAT.PAINT, rbox(0.9, 0.12, 0.36, 0.03, { p: [0, 0.16, 0], color: PAL.sand }));
  b.add(MAT.PAINT, rbox(0.62, 0.14, 0.34, 0.03, { p: [-0.12, 0.29, 0], color: PAL.sandLight }));
  b.add(MAT.PAINT, rbox(0.2, 0.16, 0.34, 0.04, { p: [0.34, 0.3, 0], color: PAL.sand }));
  b.add(MAT.GLASS, box(0.02, 0.07, 0.28, { p: [0.44, 0.33, 0], color: PAL.glass }));
  for (const z of [-0.176, 0.176]) b.add(MAT.HOUSE, box(0.5, 0.05, 0.01, { p: [-0.12, 0.3, z] }));
  b.add(MAT.PAINT, box(0.52, 0.04, 0.05, { p: [-0.1, 0.39, 0.07], color: PAL.yellow }));
  b.add(MAT.PAINT, box(0.06, 0.08, 0.06, { p: [0.14, 0.4, 0.07], color: PAL.yellow }));
  b.add(MAT.METAL, cyl(0.006, 0.006, 0.1, 4, { p: [-0.34, 0.35, 0.07], color: PAL.gunmetal }));
  b.add(MAT.HOUSE_LIGHT, sphere(0.018, 8, { p: [0.36, 0.4, -0.12], glow: 2.5 }));
  return b.build({ radius: 0.48 });
}
```

**File: `src/render/models/units/trike.js`**
```js
// Trike / Raider Trike: two big rear wheels, front fork, house fairing, twin forward guns.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';

export function trike() {
  const b = new ModelBuilder('trike');
  b.node('wheelL', { pivot: [-0.12, 0.09, 0.12], axis: 'z', param: 'wheel' });
  b.node('wheelR', { pivot: [-0.12, 0.09, -0.12], axis: 'z', param: 'wheel' });
  b.node('wheelF', { pivot: [0.2, 0.07, 0], axis: 'z', param: 'wheel' });
  for (const n of ['wheelL', 'wheelR']) {
    b.add(MAT.DARK, cyl(0.09, 0.09, 0.07, 14, { r: [Math.PI / 2, 0, 0], color: PAL.rubber }), n);
    b.add(MAT.METAL, cyl(0.04, 0.04, 0.074, 8, { r: [Math.PI / 2, 0, 0], color: PAL.steel }), n);
    b.add(MAT.DARK, box(0.03, 0.03, 0.075, { p: [0.065, 0, 0], color: PAL.gunmetal }), n);
  }
  b.add(MAT.DARK, cyl(0.07, 0.07, 0.05, 12, { r: [Math.PI / 2, 0, 0], color: PAL.rubber }), 'wheelF');
  b.add(MAT.METAL, cyl(0.03, 0.03, 0.054, 8, { r: [Math.PI / 2, 0, 0], color: PAL.steel }), 'wheelF');
  b.add(MAT.PAINT, rbox(0.3, 0.07, 0.17, 0.025, { p: [-0.03, 0.14, 0], color: PAL.sand }));
  b.add(MAT.HOUSE, prism([[0.02, 0.1], [0.19, 0.12], [0.16, 0.2], [0.02, 0.2]], 0.12));
  for (const z of [-0.045, 0.045]) b.add(MAT.METAL, box(0.2, 0.02, 0.02, { p: [0.12, 0.12, z], r: [0, 0, -0.35], color: PAL.steelDark }));
  b.add(MAT.DARK, rbox(0.1, 0.04, 0.1, 0.015, { p: [-0.06, 0.2, 0], color: PAL.clothDark }));
  b.add(MAT.GLASS, box(0.03, 0.05, 0.1, { p: [0.05, 0.22, 0], r: [0, 0, 0.5], color: PAL.glass }));
  for (const z of [-0.035, 0.035]) b.add(MAT.METAL, cyl(0.009, 0.009, 0.14, 6, { p: [0.08, 0.23, z], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  return b.build({ radius: 0.3, muzzle: [0.16, 0.23, 0] });
}
```

**File: `src/render/models/units/quad.js`**
```js
// Quad: four balloon-tyred buggy with a dark canopy, bumper and twin guns.
import { ModelBuilder, MAT, box, rbox, cyl, dome } from '../kit.js';
import { PAL } from '../palette.js';

export function quad() {
  const b = new ModelBuilder('quad');
  [[0.15, 0.17], [0.15, -0.17], [-0.15, 0.17], [-0.15, -0.17]].forEach(([x, z], k) => {
    const n = `wheel${k}`;
    b.node(n, { pivot: [x, 0.09, z], axis: 'z', param: 'wheel' });
    b.add(MAT.DARK, cyl(0.09, 0.09, 0.09, 14, { r: [Math.PI / 2, 0, 0], color: PAL.rubber }), n);
    b.add(MAT.METAL, cyl(0.045, 0.045, 0.094, 8, { r: [Math.PI / 2, 0, 0], color: PAL.steel }), n);
    b.add(MAT.DARK, box(0.03, 0.03, 0.095, { p: [0.075, 0, 0], color: PAL.gunmetal }), n);
  });
  b.add(MAT.PAINT, rbox(0.42, 0.1, 0.26, 0.035, { p: [0, 0.15, 0], color: PAL.sand }));
  for (const z of [-0.132, 0.132]) b.add(MAT.HOUSE, box(0.3, 0.05, 0.01, { p: [-0.01, 0.15, z] }));
  b.add(MAT.GLASS, dome(0.11, 14, { p: [-0.02, 0.2, 0], s: [1.2, 0.7, 1], color: PAL.glass }));
  b.add(MAT.PAINT, box(0.05, 0.05, 0.28, { p: [0.21, 0.13, 0], color: PAL.sandDark }));
  for (const z of [-0.05, 0.05]) b.add(MAT.METAL, cyl(0.01, 0.01, 0.16, 6, { p: [0.14, 0.24, z], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  b.add(MAT.METAL, box(0.06, 0.03, 0.14, { p: [0.08, 0.235, 0], color: PAL.steelDark }));
  return b.build({ radius: 0.32, muzzle: [0.22, 0.24, 0] });
}
```

**File: `src/render/models/units/infantry.js`**
```js
// Infantry figures: stillsuit soldier with mask and red goggles; bulkier armoured trooper with a
// shoulder rocket launcher. Squads draw three figures per unit.
import { ModelBuilder, MAT, box, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';

function figure(name, armour) {
  const b = new ModelBuilder(name);
  const k = armour ? 1.12 : 1;
  const hip = 0.085 * k, torso = 0.07 * k;
  const body = armour ? PAL.sand : PAL.cloth;
  b.node('legL', { pivot: [0, hip, 0.022 * k], axis: 'z' });
  b.node('legR', { pivot: [0, hip, -0.022 * k], axis: 'z' });
  for (const n of ['legL', 'legR']) {
    b.add(MAT.PAINT, box(0.03 * k, 0.075 * k, 0.028 * k, { p: [0, -0.04 * k, 0], color: armour ? PAL.sandDark : PAL.cloth }), n);
    b.add(MAT.DARK, box(0.04 * k, 0.014 * k, 0.03 * k, { p: [0.006, -0.08 * k, 0], color: PAL.clothDark }), n);
  }
  b.add(MAT.PAINT, box(0.045 * k, torso, 0.07 * k, { p: [0, hip + torso / 2, 0], color: body }));
  b.add(MAT.HOUSE, box(0.05 * k, torso * 0.55, 0.074 * k, { p: [0.002, hip + torso * 0.6, 0] }));
  b.add(MAT.PAINT, sphere(0.022 * k, 10, { p: [0.004, hip + torso + 0.022 * k, 0], color: armour ? PAL.sandDark : PAL.cloth }));
  b.add(MAT.DARK, box(0.016, 0.016, 0.03, { p: [0.022 * k, hip + torso + 0.016 * k, 0], color: PAL.mask }));
  b.add(MAT.LIGHT, box(0.004, 0.006, 0.026, { p: [0.025 * k, hip + torso + 0.027 * k, 0], color: PAL.redGlow, glow: 1.2 }));
  b.add(MAT.PAINT, box(0.03 * k, 0.05 * k, 0.05 * k, { p: [-0.032 * k, hip + torso * 0.55, 0], color: PAL.clothDark }));
  for (const side of [1, -1]) b.add(MAT.PAINT, box(0.05, 0.018, 0.018, { p: [0.025, hip + torso * 0.55, side * 0.04 * k], r: [0, side * 0.3, 0], color: body }));
  if (armour) {
    b.add(MAT.METAL, cyl(0.016, 0.016, 0.1, 8, { p: [0, hip + torso + 0.01, -0.045], r: [0, 0, Math.PI / 2], color: PAL.steelDark }));
    b.add(MAT.HOUSE, box(0.03, 0.03, 0.03, { p: [-0.05, hip + torso + 0.01, -0.045] }));
    b.add(MAT.METAL, cyl(0.008, 0.008, 0.07, 6, { p: [0.05, hip + torso * 0.5, 0.02], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  } else {
    b.add(MAT.METAL, box(0.1, 0.012, 0.012, { p: [0.05, hip + torso * 0.5, 0.01], color: PAL.gunmetal }));
  }
  return b.build({ radius: 0.12 * k, muzzle: [0.1, hip + torso * 0.5, 0] });
}

export const soldier = () => figure('soldier', false);
export const trooper = () => figure('trooper', true);
```

- [ ] **Step 6: Construction Yard, placeholders, registry and pose helper**

**File: `src/render/models/structures/construction-yard.js`**
```js
// Construction Yard (2x2): concrete apron, fence, assembly hall with a south-facing door and house
// band, glazed control tower with a beacon, bulldozer blade and girders, a slowly turning crane.
import { ModelBuilder, MAT, box, rbox, cyl, sphere, torus, prism } from '../kit.js';
import { PAL } from '../palette.js';

export function constructionYard() {
  const b = new ModelBuilder('constructionYard');
  b.add(MAT.PAINT, box(1.94, 0.11, 1.94, { p: [0, -0.005, 0], color: PAL.concrete }));
  for (const t of [-0.95, 0.95]) {
    b.add(MAT.DARK, box(1.94, 0.012, 0.02, { p: [0, 0.056, t], color: PAL.concreteDark }));
    b.add(MAT.DARK, box(0.02, 0.012, 1.94, { p: [t, 0.056, 0], color: PAL.concreteDark }));
  }
  for (let k = 0; k <= 6; k++) {
    const t = -0.94 + k * 0.313;
    b.add(MAT.METAL, cyl(0.012, 0.012, 0.18, 5, { p: [t, 0.14, -0.94], color: PAL.steelDark }));
    b.add(MAT.METAL, cyl(0.012, 0.012, 0.18, 5, { p: [-0.94, 0.14, t], color: PAL.steelDark }));
  }
  b.add(MAT.METAL, box(1.88, 0.012, 0.012, { p: [0, 0.22, -0.94], color: PAL.steel }));
  b.add(MAT.METAL, box(0.012, 0.012, 1.88, { p: [-0.94, 0.22, 0], color: PAL.steel }));
  b.add(MAT.PAINT, rbox(1.05, 0.42, 0.7, 0.04, { p: [-0.3, 0.26, -0.45], color: PAL.steel }));
  b.add(MAT.PAINT, prism([[-0.35, 0], [0.35, 0], [0.3, 0.12], [-0.3, 0.12]], 1.05, { p: [-0.3, 0.47, -0.45], r: [0, Math.PI / 2, 0], color: PAL.steelDark }));
  b.add(MAT.DARK, box(0.5, 0.3, 0.02, { p: [-0.3, 0.2, -0.09], color: PAL.gunmetal }));
  b.add(MAT.HOUSE, box(1.06, 0.06, 0.71, { p: [-0.3, 0.4, -0.45] }));
  b.add(MAT.PAINT, box(0.32, 0.6, 0.32, { p: [0.62, 0.33, 0.52], color: PAL.steel }));
  b.add(MAT.GLASS, box(0.34, 0.1, 0.34, { p: [0.62, 0.58, 0.52], color: PAL.glass }));
  b.add(MAT.PAINT, box(0.38, 0.03, 0.38, { p: [0.62, 0.645, 0.52], color: PAL.steelDark }));
  b.add(MAT.HOUSE_LIGHT, sphere(0.03, 8, { p: [0.62, 0.69, 0.52], glow: 2.5 }));
  b.add(MAT.PAINT, prism([[0, 0], [0.18, 0], [0.18, 0.04], [0.04, 0.16], [0, 0.16]], 0.36, { p: [-0.55, 0.05, 0.55], r: [0, -0.3, 0], color: PAL.yellow }));
  for (let k = 0; k < 3; k++) b.add(MAT.METAL, box(0.5, 0.03, 0.04, { p: [0.05, 0.065 + k * 0.035, 0.15 + (k % 2) * 0.03], color: PAL.steelDark }));
  b.node('crane', { pivot: [0.66, 0.05, -0.62] });
  b.add(MAT.PAINT, box(0.06, 1.0, 0.06, { p: [0, 0.5, 0], color: PAL.yellow }), 'crane');
  b.add(MAT.PAINT, box(0.95, 0.045, 0.06, { p: [-0.3, 1.0, 0], color: PAL.yellow }), 'crane');
  b.add(MAT.PAINT, box(0.14, 0.09, 0.09, { p: [0.18, 0.99, 0], color: PAL.concreteDark }), 'crane');
  b.add(MAT.METAL, cyl(0.004, 0.004, 0.42, 4, { p: [-0.68, 0.79, 0], color: PAL.gunmetal }), 'crane');
  b.add(MAT.METAL, torus(0.022, 0.006, 4, 8, { p: [-0.68, 0.57, 0], r: [Math.PI / 2, 0, 0], color: PAL.gunmetal }, Math.PI * 1.4), 'crane');
  b.add(MAT.HOUSE_LIGHT, sphere(0.02, 6, { p: [0, 1.04, 0], glow: 2.5 }), 'crane');
  return b.build({ radius: 1.0 });
}
```

**File: `src/render/models/structures/placeholder.js`**
```js
// Stand-ins for structures and units whose models arrive in plan 1b.
import { ModelBuilder, MAT, box } from '../kit.js';
import { PAL } from '../palette.js';

export function placeholderStructure(w, h) {
  const b = new ModelBuilder(`placeholder${w}x${h}`);
  b.add(MAT.PAINT, box(w * 0.94, 0.5, h * 0.94, { p: [0, 0.25, 0], color: PAL.steel }));
  b.add(MAT.HOUSE, box(w * 0.95, 0.08, h * 0.95, { p: [0, 0.4, 0] }));
  return b.build({ radius: Math.max(w, h) / 2 });
}

export function placeholderUnit() {
  const b = new ModelBuilder('placeholderUnit');
  b.add(MAT.PAINT, box(0.5, 0.2, 0.35, { p: [0, 0.1, 0], color: PAL.sand }));
  b.add(MAT.HOUSE, box(0.3, 0.05, 0.36, { p: [0, 0.22, 0] }));
  return b.build({ radius: 0.35 });
}
```

**File: `src/render/models/index.js`**
```js
// Model registry: which model draws which unit or structure type, built lazily and cached.
import { combatTank } from './units/combat-tank.js';
import { siegeTank } from './units/siege-tank.js';
import { missileTank } from './units/missile-tank.js';
import { deviator } from './units/deviator.js';
import { sonicTank } from './units/sonic-tank.js';
import { devastator } from './units/devastator.js';
import { harvester } from './units/harvester.js';
import { mcv } from './units/mcv.js';
import { trike } from './units/trike.js';
import { quad } from './units/quad.js';
import { soldier, trooper } from './units/infantry.js';
import { constructionYard } from './structures/construction-yard.js';
import { placeholderStructure, placeholderUnit } from './structures/placeholder.js';

const BUILDERS = { combatTank, siegeTank, missileTank, deviator, sonicTank, devastator, harvester, mcv, trike, quad, soldier, trooper, constructionYard, placeholderUnit };

export const UNIT_MODEL = {
  soldier: 'soldier', infantry: 'soldier', saboteur: 'soldier', trooper: 'trooper', troopers: 'trooper',
  trike: 'trike', raider: 'trike', quad: 'quad', combatTank: 'combatTank', siegeTank: 'siegeTank',
  missileTank: 'missileTank', deviator: 'deviator', sonicTank: 'sonicTank', devastator: 'devastator',
  harvester: 'harvester', mcv: 'mcv',
};
export const STRUCTURE_MODEL = { constructionYard: 'constructionYard' };

const cache = new Map();

export function modelDef(id) {
  if (!cache.has(id)) {
    const m = /^placeholder(\d)x(\d)$/.exec(id);
    const build = BUILDERS[id] ?? (m ? () => placeholderStructure(+m[1], +m[2]) : placeholderUnit);
    cache.set(id, build());
  }
  return cache.get(id);
}

export const unitModelId = (typeId) => UNIT_MODEL[typeId] ?? 'placeholderUnit';
export const structureModelId = (typeId, w, h) => STRUCTURE_MODEL[typeId] ?? `placeholder${w}x${h}`;
```

**File: `src/render/views/pose.js`**
```js
// Root matrix for a model facing `heading` (0 = +x east, π/2 = +z south) standing on `normal`.
import * as THREE from 'three';

const f = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3();

export function poseMatrix(out, x, y, z, heading, normal = null) {
  up.set(normal ? normal.x : 0, normal ? normal.y : 1, normal ? normal.z : 0);
  f.set(Math.cos(heading), 0, Math.sin(heading));
  f.addScaledVector(up, -f.dot(up)).normalize();
  side.crossVectors(f, up);   // right-handed basis: x = forward, y = up, z = forward × up
  out.makeBasis(f, up, side);
  out.setPosition(x, y, z);
  return out;
}
```

- [ ] **Step 7: Run the catalogue test**

Run: `node --test tests/models-catalog.test.mjs`
Expected: PASS (4 tests). A failure naming a model points at a primitive with bad dimensions (for example an `rbox` radius larger than half a side) — fix the numbers in that model file.

- [ ] **Step 8: Gallery scene**

**File: `src/scenes/gallery.js`**
```js
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
```

Modify `src/main.js` — add to `SCENES`:
```js
  gallery: () => import('./scenes/gallery.js'),
```

Modify `scripts/scenarios.mjs` — add:
```js
  'gallery-atreides': { query: 'scene=gallery&house=atreides' },
  'gallery-harkonnen': { query: 'scene=gallery&house=harkonnen' },
  'gallery-ordos': { query: 'scene=gallery&house=ordos' },
  'gallery-closeup': { query: 'scene=gallery&house=atreides&dist=4.5&x=5&z=3.6&pitch=30' },
```

- [ ] **Step 9: Capture the gallery and review it against the references**

Run: `npm run smoke gallery-atreides gallery-harkonnen gallery-ordos gallery-closeup`
Expected: four screenshots, no errors. Review each with the Read tool next to the Mentat info cards in `docs/research/refs/pc-unit-*.jpg` and `pc-structure-construction-yard.gif`, and check:
- every model reads as its original unit at gallery distance: long-barrel Combat Tank, bigger Siege Tank, rocket-box Missile Tank, single-missile Deviator, golden-horn Sonic Tank, twin-barrel Devastator, wedge Harvester, eight-wheel MCV with folded crane, three-wheel Trike, four-wheel Quad with canopy, masked soldiers, armoured troopers;
- house colour shows clearly on every model (stripes, turret bands, side panels, vests) and changes between the three screenshots;
- nothing floats above or sinks into the ground; treads and wheels touch the rock;
- metal parts are not black (the environment map lights them) and glow parts (Devastator vents, Deviator warhead, Sonic core, goggles, beacons) bloom slightly.
Fix proportions or colours in the model files and re-run until all four hold.

- [ ] **Step 10: Commit**

```bash
git add src/render/models src/render/views/pose.js src/scenes/gallery.js src/main.js scripts/scenarios.mjs tests/models-catalog.test.mjs
git commit -m "feat(render): procedural unit models, Construction Yard and model gallery scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Views — units and structures in 3D

**Files:**
- Create: `src/render/views/unit-views.js`, `src/render/views/structure-views.js`
- Test: `tests/views.test.mjs`

**Interfaces:**
- Consumes: `World` unit/structure records (Task 6; unit fields `px, py, pheading, pturret, pdistance, distance, hp, maxHp, move, type.figures, house`), `Heightfield` (Task 9), `InstancedModel`, `modelDef`, `unitModelId`, `structureModelId`, `poseMatrix` (Tasks 11–12), `lerpAngle`, `wrapAngle`.
- Produces: `class UnitViews(scene, hf)` with `sync(world, alpha, dt)`, `renderPos(unit)` → `{x, z}` (interpolated), `views` (Map id → `{model, handles, x, z, recoil, visible, color, house}`), `model(id)`; `recoil` is set by later tasks when a unit fires. `class StructureViews(scene, hf)` with `sync(world, nowMs)`, `views` (Map id → `{model, handle, cx, cz, y, born, house}`).

- [ ] **Step 1: Write the failing test**

**File: `tests/views.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/data/terrain.js';
import { Heightfield } from '../src/render/heightfield.js';
import { UnitViews } from '../src/render/views/unit-views.js';
import { StructureViews } from '../src/render/views/structure-views.js';
import { flatWorld } from './helpers.mjs';

const pos = (m) => new THREE.Vector3().setFromMatrixPosition(m);

test('unit views follow the simulation: create, pose, hide squad members, remove', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3, { heading: 0 });
  const squad = world.spawnUnit('troopers', 'harkonnen', 6, 6);
  views.sync(world, 1, 0.016);
  const p = pos(views.views.get(tank.id).handles[0].matrix);
  assert.deepEqual([+p.x.toFixed(2), +p.z.toFixed(2)], [3.5, 3.5]);
  assert.ok(Math.abs(p.y - hf.heightAt(3.5, 3.5)) < 0.01);
  assert.equal(views.views.get(squad.id).handles.length, 3);
  squad.hp = 40;
  views.sync(world, 1, 0.016);
  assert.deepEqual(views.views.get(squad.id).handles.map((h) => h.visible), [true, false, false]);
  world.removeUnit(tank);
  views.sync(world, 1, 0.016);
  assert.equal(views.views.has(tank.id), false);
  assert.equal(views.model('combatTank').count, 0);
});

test('interpolation and the turret sign convention', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3, { heading: 0 });
  tank.px = 3.5; tank.x = 4.5;              // moved one tile east during the last tick
  tank.turret = tank.pturret = Math.PI / 2; // turret faces south, hull faces east
  views.sync(world, 0.5, 0.016);
  assert.ok(Math.abs(views.renderPos(tank).x - 4.0) < 1e-9);
  assert.ok(Math.abs(views.views.get(tank.id).handles[0].params.turret + Math.PI / 2) < 1e-9);
});

test('house changes recolour the view', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const views = new UnitViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3);
  views.sync(world, 1, 0.016);
  tank.house = 'ordos';
  views.sync(world, 1, 0.016);
  assert.equal(views.views.get(tank.id).handles[0].color.getHex(), new THREE.Color(0x2e9e3e).getHex());
});

test('structure views sit on the footprint centre and rise over 0.9 s', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf);
  const cy = world.spawnStructure('constructionYard', 'ordos', 4, 6);
  views.sync(world, 1000);
  const v = views.views.get(cy.id);
  const p = pos(v.handle.matrix);
  assert.deepEqual([p.x, p.z], [5, 7]);
  const s0 = new THREE.Vector3().setFromMatrixScale(v.handle.matrix).y;
  views.sync(world, 1450);
  const s1 = new THREE.Vector3().setFromMatrixScale(v.handle.matrix).y;
  views.sync(world, 2000);
  const s2 = new THREE.Vector3().setFromMatrixScale(v.handle.matrix).y;
  assert.ok(s0 < s1 && s1 < s2 && Math.abs(s2 - 1) < 1e-9);
  world.removeStructure(cy);
  views.sync(world, 2100);
  assert.equal(views.views.size, 0);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/views.test.mjs`
Expected: FAIL — cannot find `../src/render/views/unit-views.js`.

- [ ] **Step 3: Implement the views**

**File: `src/render/views/unit-views.js`**
```js
// One instanced-model handle per sim unit (three for squads), posed every frame from interpolated
// sim state: position, heading, terrain tilt for vehicles, turret yaw, recoil, wheels, treads, legs.
import * as THREE from 'three';
import { HOUSES } from '../../data/houses.js';
import { lerpAngle, wrapAngle } from '../../sim/geometry.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef, unitModelId } from '../models/index.js';
import { poseMatrix } from './pose.js';

const SQUAD = [[0.1, 0], [-0.08, 0.11], [-0.08, -0.11]];
const UP = { x: 0, y: 1, z: 0 };

export class UnitViews {
  constructor(scene, hf) {
    this.scene = scene;
    this.hf = hf;
    this.models = new Map();
    this.views = new Map();
    this.normal = { x: 0, y: 1, z: 0 };
  }

  model(id) {
    let m = this.models.get(id);
    if (!m) { m = new InstancedModel(modelDef(id), this.scene); this.models.set(id, m); }
    return m;
  }

  sync(world, alpha, dt) {
    for (const u of world.units.values()) if (!this.views.has(u.id)) this.create(u);
    for (const [id, v] of this.views) if (!world.units.has(id)) this.destroy(id, v);
    for (const u of world.units.values()) this.pose(u, this.views.get(u.id), alpha, dt);
    for (const m of this.models.values()) m.update();
  }

  create(u) {
    const model = this.model(unitModelId(u.typeId));
    const color = new THREE.Color(HOUSES[u.house]?.color ?? 0xffffff);
    const handles = [];
    for (let k = 0; k < (u.type.figures ?? 1); k++) { const h = model.add(); h.color.copy(color); handles.push(h); }
    this.views.set(u.id, { model, handles, color, house: u.house, x: u.x, z: u.y, recoil: 0, visible: true });
  }

  destroy(id, v) {
    for (const h of v.handles) v.model.remove(h);
    this.views.delete(id);
  }

  renderPos(u) {
    const v = this.views.get(u.id);
    return v ? { x: v.x, z: v.z } : { x: u.x, z: u.y };
  }

  pose(u, v, alpha, dt) {
    const x = u.px + (u.x - u.px) * alpha, z = u.py + (u.y - u.py) * alpha;
    const heading = lerpAngle(u.pheading, u.heading, alpha);
    const turret = lerpAngle(u.pturret, u.turret, alpha);
    const dist = u.pdistance + (u.distance - u.pdistance) * alpha;
    v.x = x;
    v.z = z;
    v.recoil = Math.max(0, v.recoil - dt * 0.3);
    if (v.house !== u.house) {
      v.house = u.house;
      v.color.set(HOUSES[u.house]?.color ?? 0xffffff);
      for (const h of v.handles) h.color.copy(v.color);
    }
    const foot = u.move === 'foot';
    const walking = u.distance !== u.pdistance;
    const shown = v.handles.length > 1 && u.hp <= u.maxHp / 2 ? 1 : v.handles.length;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    for (let k = 0; k < v.handles.length; k++) {
      const h = v.handles[k];
      h.visible = v.visible && k < shown;
      let fx = x, fz = z;
      if (v.handles.length > 1) { const [a, b] = SQUAD[k]; fx += cos * a - sin * b; fz += sin * a + cos * b; }
      const n = foot ? UP : this.hf.normalAt(fx, fz, this.normal);
      poseMatrix(h.matrix, fx, this.hf.heightAt(fx, fz) + 0.004, fz, heading, n);
      const p = h.params;
      p.turret = -wrapAngle(turret - heading);
      p.barrel = -v.recoil;
      p.wheel = -dist / 0.09;
      p.tread = dist * 3.2;
      p.drum = dist * 6;
      const swing = walking ? Math.sin(dist * 26 + k * 1.7) * 0.6 : 0;
      p.legL = swing;
      p.legR = -swing;
    }
  }
}
```

**File: `src/render/views/structure-views.js`**
```js
// One handle per structure, standing on its footprint centre; new structures rise out of the ground
// over 0.9 s (spec §5.3). Animated parts (crane) run from wall-clock time.
import { HOUSES } from '../../data/houses.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef, structureModelId } from '../models/index.js';

export class StructureViews {
  constructor(scene, hf) {
    this.scene = scene;
    this.hf = hf;
    this.models = new Map();
    this.views = new Map();
  }

  model(id) {
    let m = this.models.get(id);
    if (!m) { m = new InstancedModel(modelDef(id), this.scene); this.models.set(id, m); }
    return m;
  }

  sync(world, now) {
    for (const s of world.structures.values()) if (!this.views.has(s.id)) this.create(s, now);
    for (const [id, v] of this.views) if (!world.structures.has(id)) { v.model.remove(v.handle); this.views.delete(id); }
    for (const s of world.structures.values()) this.pose(s, this.views.get(s.id), now);
    for (const m of this.models.values()) m.update();
  }

  create(s, now) {
    const model = this.model(structureModelId(s.typeId, s.w, s.h));
    const handle = model.add();
    handle.color.set(HOUSES[s.house]?.color ?? 0xffffff);
    let sum = 0, n = 0;
    for (let dy = 0; dy <= s.h; dy++) for (let dx = 0; dx <= s.w; dx++) { sum += this.hf.heightAt(s.x + dx, s.y + dy); n++; }
    this.views.set(s.id, { model, handle, born: now, cx: s.x + s.w / 2, cz: s.y + s.h / 2, y: sum / n, house: s.house });
  }

  pose(s, v, now) {
    const t = Math.min(1, (now - v.born) / 900);
    const rise = 1 - Math.pow(1 - t, 3);
    v.handle.matrix.makeScale(1, Math.max(0.02, rise), 1).setPosition(v.cx, v.y, v.cz);
    v.handle.params.crane = (now / 1000) * 0.25;
    if (v.house !== s.house) { v.house = s.house; v.handle.color.set(HOUSES[s.house]?.color ?? 0xffffff); }
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/views.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/views tests/views.test.mjs
git commit -m "feat(render): unit and structure views driven by interpolated simulation state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Input — pointer, selection, groups, controller, cursors, overlay, message bar

**Files:**
- Create: `src/input/pointer.js`, `src/input/keyboard.js`, `src/input/selection.js`, `src/input/groups.js`, `src/input/controller.js`, `src/ui/cursors.js`, `src/ui/hud.js`, `src/render/overlay.js`
- Modify: `src/ui/styles.css` (message bar)
- Test: `tests/selection.test.mjs`, `tests/controller.test.mjs`

**Interfaces:**
- Consumes: `World` (Task 6–7 commands `move`, `stop`, `guard`, `scatter`, `deploy`), `deploySpot` (Task 7).
- Produces:
  - `class Selection` with `ids` (Set), `version`, `set(ids)`, `add(ids)`, `toggle(id)`, `clear()`, `has(id)`, `list()`, `prune(alive)`; `pickAt(candidates, x, y)` → candidate or null (own units win ties); `inBox(candidates, x0, y0, x1, y1)` → ids.
  - `class Groups` with `assign(n, ids)`, `get(n, alive)`, `tap(n, nowMs)` → `'select' | 'center'`, `groupOf(id)`.
  - `class Pointer(element, {onClick(x,y,button,mods,double), onDrag(x0,y0,x1,y1), onDragEnd(x0,y0,x1,y1,mods), onDragCancel(), onMove(x,y)})`; `class Keyboard(onKey(key, code, mods) → handled)`.
  - `class Controller({world, house, selection, groups, settings, project(x,z,lift)→{x,y,visible,pxPerUnit}, ground(sx,sy)→{x,y,z}|null, viewport()→{left,top,right,bottom}, rig, positionOf(unit)→{x,z}, onCursor(name), onMarker(x,z), onDragBox(box|null)})` with `onClick`, `onDrag`, `onDragEnd`, `onDragCancel`, `onMove`, `onKey`, `frame()`, `hoverId`, `cursorFor(hit)`.
  - `CURSORS`, `makeCursorSetter(element)`; `class Hud(root)` with `message(text, seconds)`, `update(dt)`; `class Overlay(canvas)` with `resize()`, `setDragBox(box)`, `marker(x, z)`, `draw({world, selection, hoverId, project, positionOf, groups, dt, healthBars})`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/selection.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Selection, pickAt, inBox } from '../src/input/selection.js';
import { Groups } from '../src/input/groups.js';

const c = (id, sx, sy, own = true, r = 12) => ({ id, sx, sy, own, r });

test('pickAt returns the nearest candidate inside its radius and prefers own units', () => {
  const list = [c(1, 100, 100), c(2, 108, 100, false), c(3, 300, 300)];
  assert.equal(pickAt(list, 104, 100).id, 1);
  assert.equal(pickAt(list, 200, 200), null);
  assert.equal(pickAt([c(4, 100, 100, false), c(5, 103, 100, true)], 100, 100).id, 5);
});

test('inBox selects centres inside any-direction rectangles', () => {
  const list = [c(1, 10, 10), c(2, 50, 50), c(3, 90, 10)];
  assert.deepEqual(inBox(list, 60, 60, 0, 0), [1, 2]);
});

test('selection set, toggle, prune and version', () => {
  const s = new Selection();
  s.set([1, 2]);
  s.toggle(2);
  s.toggle(3);
  assert.deepEqual(s.list(), [1, 3]);
  const v = s.version;
  s.prune((id) => id !== 3);
  assert.deepEqual(s.list(), [1]);
  assert.ok(s.version > v);
});

test('groups assign, recall live members and detect double taps', () => {
  const g = new Groups();
  g.assign(1, [5, 6]);
  assert.deepEqual(g.get(1, (id) => id !== 6), [5]);
  assert.equal(g.tap(1, 1000), 'select');
  assert.equal(g.tap(1, 1200), 'center');
  assert.equal(g.tap(1, 1300), 'select');
  assert.equal(g.tap(2, 1400), 'select');
  assert.equal(g.groupOf(5), 1);
});
```

**File: `tests/controller.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { Controller } from '../src/input/controller.js';
import { Selection } from '../src/input/selection.js';
import { Groups } from '../src/input/groups.js';
import { flatWorld } from './helpers.mjs';

const NONE = { shift: false, ctrl: false, alt: false };
const px = (t) => (t + 0.5) * 40;

function setup(scheme = 'classic') {
  const world = flatWorld(20, 20, G.ROCK);
  world.map.ground[world.map.idx(15, 15)] = G.MOUNTAIN;
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  const tank2 = world.spawnUnit('combatTank', 'atreides', 7, 5);
  const enemy = world.spawnUnit('combatTank', 'harkonnen', 12, 5);
  const mcv = world.spawnUnit('mcv', 'atreides', 8, 8);
  const issued = [];
  const issue = world.issue.bind(world);
  world.issue = (h, cmd) => { issued.push(cmd); issue(h, cmd); };
  const looked = [];
  const cursors = [];
  const c = new Controller({
    world, house: 'atreides', selection: new Selection(), groups: new Groups(), settings: { scheme },
    project: (x, z) => ({ x: x * 40, y: z * 40, visible: true, pxPerUnit: 40 }),
    ground: (sx, sy) => (sy < 20 ? null : { x: sx / 40, y: 0, z: sy / 40 }),
    viewport: () => ({ left: 0, top: 0, right: 2000, bottom: 2000 }),
    rig: { lookAt: (x, z) => looked.push([x, z]) },
    positionOf: (u) => ({ x: u.x, z: u.y }),
    onCursor: (name) => cursors.push(name),
  });
  return { world, tank, tank2, enemy, mcv, c, issued, looked, cursors };
}

test('classic: click selects, click on ground moves, right click deselects', () => {
  const { tank, c, issued } = setup();
  c.onClick(px(5), px(5), 0, NONE, false);
  assert.deepEqual(c.selection.list(), [tank.id]);
  c.onClick(px(10), px(9), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 10, y: 9 });
  c.onClick(px(3), px(15), 2, NONE, false);
  assert.equal(c.selection.list().length, 0);
});

test('a click that meets no ground issues nothing and does not throw', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(300, 10, 0, NONE, false);
  c.onClick(300, 10, 2, NONE, false);
  assert.equal(issued.length, 0);
});

test('classic: clicking the selected MCV again deploys it', () => {
  const { mcv, c, issued } = setup();
  c.onClick(px(8), px(8), 0, NONE, false);
  c.onClick(px(8), px(8), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'deploy', ids: [mcv.id] });
});

test('modern: right click orders, left click on empty ground deselects', () => {
  const { tank, c, issued } = setup('modern');
  c.onClick(px(5), px(5), 0, NONE, false);
  c.onClick(px(10), px(12), 2, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 10, y: 12 });
  c.onClick(px(10), px(12), 0, NONE, false);
  assert.equal(c.selection.list().length, 0);
});

test('drag box selects own units only; shift adds', () => {
  const { tank, tank2, mcv, c } = setup();
  c.onDragEnd(0, 0, px(12) + 20, px(6), NONE);
  assert.deepEqual(c.selection.list().sort(), [tank.id, tank2.id].sort());
  c.onDragEnd(px(8) - 10, px(8) - 10, px(8) + 10, px(8) + 10, { ...NONE, shift: true });
  assert.ok(c.selection.has(mcv.id) && c.selection.has(tank.id));
});

test('double click selects every visible own unit of the same type', () => {
  const { tank, tank2, c } = setup();
  c.onClick(px(5), px(5), 0, NONE, true);
  assert.deepEqual(c.selection.list().sort(), [tank.id, tank2.id].sort());
});

test('control groups: ctrl+digit assigns, digit recalls, double tap centres', () => {
  const { tank, c, looked } = setup();
  c.selection.set([tank.id]);
  assert.equal(c.onKey('1', 'Digit1', { ...NONE, ctrl: true }), true);
  c.selection.clear();
  c.onKey('1', 'Digit1', NONE);
  assert.deepEqual(c.selection.list(), [tank.id]);
  c.onKey('1', 'Digit1', NONE);
  assert.equal(looked.length, 1);
});

test('hotkeys issue stop, guard, scatter and deploy for the selection', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  for (const k of ['s', 'g', 'x', 'd']) c.onKey(k, `Key${k.toUpperCase()}`, NONE);
  assert.deepEqual(issued.map((i) => i.type), ['stop', 'guard', 'scatter', 'deploy']);
});

test('cursor reflects what a click would do', () => {
  const { tank, mcv, c } = setup();
  c.selection.set([tank.id]);
  assert.equal(c.cursorFor(c.hitTest(px(10), px(10))), 'move');
  assert.equal(c.cursorFor(c.hitTest(px(15), px(15))), 'noMove');
  assert.equal(c.cursorFor(c.hitTest(px(12), px(5))), 'attack');
  c.selection.set([mcv.id]);
  assert.equal(c.cursorFor(c.hitTest(px(8), px(8))), 'deploy');
  assert.equal(c.cursorFor(null), 'noMove');
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/selection.test.mjs tests/controller.test.mjs`
Expected: FAIL — cannot find `../src/input/selection.js`.

- [ ] **Step 3: Implement selection, groups, pointer and keyboard**

**File: `src/input/selection.js`**
```js
// Selection state plus pure screen-space hit tests (testable without a browser).
export class Selection {
  constructor() { this.ids = new Set(); this.version = 0; }
  set(ids) { this.ids = new Set(ids); this.version++; }
  add(ids) { for (const id of ids) this.ids.add(id); this.version++; }
  toggle(id) { if (this.ids.has(id)) this.ids.delete(id); else this.ids.add(id); this.version++; }
  clear() { if (this.ids.size) { this.ids.clear(); this.version++; } }
  has(id) { return this.ids.has(id); }
  list() { return [...this.ids]; }
  prune(alive) {
    let changed = false;
    for (const id of this.ids) if (!alive(id)) { this.ids.delete(id); changed = true; }
    if (changed) this.version++;
  }
}

/** Nearest candidate whose radius contains the point; own units win close calls. */
export function pickAt(candidates, x, y) {
  let best = null, bestScore = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.sx - x, c.sy - y);
    if (d > c.r) continue;
    const score = d - (c.own ? 4 : 0);
    if (score < bestScore) { best = c; bestScore = score; }
  }
  return best;
}

export function inBox(candidates, x0, y0, x1, y1) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  return candidates.filter((c) => c.sx >= ax && c.sx <= bx && c.sy >= ay && c.sy <= by).map((c) => c.id);
}
```

**File: `src/input/groups.js`**
```js
// Control groups (spec §5.7): Ctrl+digit assigns, digit selects, a quick second tap centres the view.
export class Groups {
  constructor() { this.map = new Map(); this.last = { n: -1, t: -1e9 }; }
  assign(n, ids) { this.map.set(n, [...ids]); }
  get(n, alive = () => true) {
    const ids = (this.map.get(n) ?? []).filter(alive);
    this.map.set(n, ids);
    return ids;
  }
  tap(n, now) {
    const double = this.last.n === n && now - this.last.t < 350;
    this.last = { n, t: double ? -1e9 : now };
    return double ? 'center' : 'select';
  }
  groupOf(id) {
    for (const [n, ids] of this.map) if (ids.includes(id)) return n;
    return null;
  }
}
```

**File: `src/input/pointer.js`**
```js
// Raw pointer events → clicks, drags and double-clicks (5 px drag threshold, 300 ms double-click).
const mods = (e) => ({ shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey });

export class Pointer {
  constructor(el, handlers) {
    this.h = handlers;
    this.down = null;
    this.lastClick = { t: 0, x: 0, y: 0, button: -1 };
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      el.setPointerCapture?.(e.pointerId);
      this.down = { x: e.clientX, y: e.clientY, button: e.button, dragging: false };
    });
    el.addEventListener('pointermove', (e) => {
      const d = this.down;
      if (d && d.button === 0 && !d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.dragging = true;
      if (d?.dragging) this.h.onDrag?.(d.x, d.y, e.clientX, e.clientY);
      this.h.onMove?.(e.clientX, e.clientY);
    });
    el.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || e.button !== d.button) return;
      if (d.dragging) { this.h.onDragEnd?.(d.x, d.y, e.clientX, e.clientY, mods(e)); return; }
      const now = performance.now(), lc = this.lastClick;
      const double = d.button === lc.button && now - lc.t < 300 && Math.hypot(e.clientX - lc.x, e.clientY - lc.y) < 6;
      this.lastClick = { t: double ? 0 : now, x: e.clientX, y: e.clientY, button: d.button };
      this.h.onClick?.(e.clientX, e.clientY, d.button, mods(e), double);
    });
    el.addEventListener('pointercancel', () => {
      if (this.down?.dragging) this.h.onDragCancel?.();
      this.down = null;
    });
  }
}
```

**File: `src/input/keyboard.js`**
```js
// Keyboard → controller hotkeys. Arrow keys belong to the camera control. Browsers may reserve
// Ctrl+digit for tab switching, so Ctrl+Shift+digit also assigns a group (see README).
export class Keyboard {
  constructor(onKey) {
    this.handler = (e) => {
      if (e.target instanceof HTMLInputElement || e.key.startsWith('Arrow')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (onKey(key, e.code, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, repeat: e.repeat })) e.preventDefault();
    };
    window.addEventListener('keydown', this.handler);
  }
  dispose() { window.removeEventListener('keydown', this.handler); }
}
```

- [ ] **Step 4: Implement the controller**

**File: `src/input/controller.js`**
```js
// Mouse and keyboard → selection and commands for the Classic (C&C 1995) and Modern schemes
// (spec §5.7). Classic: left click selects or orders by context, right click deselects.
// Modern: left click selects, right click orders.
import { pickAt, inBox } from './selection.js';
import { deploySpot } from '../sim/deploy.js';

const HOTKEYS = { s: 'stop', g: 'guard', x: 'scatter', d: 'deploy' };

export class Controller {
  constructor({ world, house, selection, groups, settings, project, ground, viewport, rig, positionOf, onCursor = () => {}, onMarker = () => {}, onDragBox = () => {} }) {
    Object.assign(this, { world, house, selection, groups, settings, project, ground, viewport, rig, positionOf, onCursor, onMarker, onDragBox });
    this.mouse = { x: -1, y: -1 };
    this.hoverId = null;
  }

  candidates() {
    const out = [];
    for (const u of this.world.units.values()) {
      const p = this.positionOf(u);
      const s = this.project(p.x, p.z, u.isGround ? 0.12 : 1.5);
      if (!s.visible) continue;
      out.push({ id: u.id, unit: u, sx: s.x, sy: s.y, own: u.house === this.house, r: Math.max(10, s.pxPerUnit * (u.move === 'foot' ? 0.3 : 0.42)) });
    }
    return out;
  }

  hitTest(x, y) {
    const hit = pickAt(this.candidates(), x, y);
    if (hit) return { kind: 'unit', unit: hit.unit };
    const g = this.ground(x, y);
    if (!g) return null;
    const map = this.world.map, tx = Math.floor(g.x), ty = Math.floor(g.z);
    if (!map.inBounds(tx, ty)) return null;
    const sid = map.structure[map.idx(tx, ty)];
    if (sid) return { kind: 'structure', structure: this.world.structures.get(sid), tx, ty };
    return { kind: 'ground', tx, ty };
  }

  inViewport(x, y) { const v = this.viewport(); return x >= v.left && x <= v.right && y >= v.top && y <= v.bottom; }
  ownSelected() { return this.selection.list().map((id) => this.world.units.get(id)).filter((u) => u && u.house === this.house); }
  issue(cmd) { this.world.issue(this.house, cmd); }

  onClick(x, y, button, mods, double) {
    if (!this.inViewport(x, y)) return;
    const classic = this.settings.scheme !== 'modern';
    const hit = this.hitTest(x, y);
    if (button === 2) {
      if (classic) this.selection.clear(); else this.order(hit);
      return;
    }
    if (hit?.kind === 'unit' && hit.unit.house === this.house) {
      const u = hit.unit;
      if (double) { this.selectSameType(u); return; }
      if (classic && !mods.shift && u.type.deploysTo && this.selection.ids.size === 1 && this.selection.has(u.id)) { this.issue({ type: 'deploy', ids: [u.id] }); return; }
      if (mods.shift) this.selection.toggle(u.id); else this.selection.set([u.id]);
      return;
    }
    if (classic && this.ownSelected().length) { this.order(hit); return; }
    if (hit?.kind === 'unit') { this.selection.set([hit.unit.id]); return; }
    if (!mods.shift) this.selection.clear();
  }

  order(hit) {
    const units = this.ownSelected();
    if (!units.length || !hit) return;
    if (hit.kind === 'unit' && units.length === 1 && units[0].id === hit.unit.id && units[0].type.deploysTo) {
      this.issue({ type: 'deploy', ids: [units[0].id] });
      return;
    }
    const tx = hit.kind === 'unit' ? hit.unit.tx : hit.tx, ty = hit.kind === 'unit' ? hit.unit.ty : hit.ty;
    this.issue({ type: 'move', ids: units.map((u) => u.id), x: tx, y: ty });
    this.onMarker(tx + 0.5, ty + 0.5);
  }

  selectSameType(u) {
    const v = this.viewport();
    this.selection.set(this.candidates()
      .filter((c) => c.own && c.unit.typeId === u.typeId && c.sx >= v.left && c.sx <= v.right && c.sy >= v.top && c.sy <= v.bottom)
      .map((c) => c.id));
  }

  onDrag(x0, y0, x1, y1) { this.onDragBox({ x0, y0, x1, y1 }); }

  onDragEnd(x0, y0, x1, y1, mods) {
    this.onDragBox(null);
    const ids = inBox(this.candidates().filter((c) => c.own), x0, y0, x1, y1);
    if (mods.shift) this.selection.add(ids);
    else if (ids.length) this.selection.set(ids);
    else this.selection.clear();
  }

  onDragCancel() { this.onDragBox(null); }
  onMove(x, y) { this.mouse.x = x; this.mouse.y = y; }

  onKey(key, code, mods) {
    const digit = code?.startsWith('Digit') ? Number(code.slice(5)) : null;
    if (digit !== null) {
      if (mods.ctrl) { this.groups.assign(digit, this.ownSelected().map((u) => u.id)); return true; }
      const ids = this.groups.get(digit, (id) => this.world.units.has(id));
      if (!ids.length) return true;
      if (mods.shift) this.selection.add(ids); else this.selection.set(ids);
      if (this.groups.tap(digit, performance.now()) === 'center' || mods.alt) this.centerOn(ids);
      return true;
    }
    if (HOTKEYS[key]) {
      const ids = this.ownSelected().map((u) => u.id);
      if (ids.length) this.issue({ type: HOTKEYS[key], ids });
      return true;
    }
    if (key === 'h' || key === 'Home') { this.centerOnBase(); return true; }
    if (key === 'Escape') { this.selection.clear(); return true; }
    return false;
  }

  centerOn(ids) {
    let x = 0, z = 0, n = 0;
    for (const id of ids) { const u = this.world.units.get(id); if (!u) continue; const p = this.positionOf(u); x += p.x; z += p.z; n++; }
    if (n) this.rig.lookAt(x / n, z / n);
  }

  centerOnBase() {
    const yard = [...this.world.structures.values()].find((s) => s.house === this.house && s.typeId === 'constructionYard');
    if (yard) { this.rig.lookAt(yard.x + yard.w / 2, yard.y + yard.h / 2); return; }
    const mcv = [...this.world.units.values()].find((u) => u.house === this.house && u.typeId === 'mcv');
    if (mcv) this.rig.lookAt(mcv.x, mcv.y);
  }

  frame() {
    const { x, y } = this.mouse;
    const hit = x >= 0 && this.inViewport(x, y) ? this.hitTest(x, y) : null;
    this.hoverId = hit?.kind === 'unit' ? hit.unit.id : null;
    this.onCursor(this.cursorFor(hit));
  }

  cursorFor(hit) {
    const own = this.ownSelected();
    if (!hit) return own.length ? 'noMove' : 'default';
    if (hit.kind === 'unit') {
      if (hit.unit.house !== this.house) return own.length ? 'attack' : 'select';
      if (own.length === 1 && own[0].id === hit.unit.id && hit.unit.type.deploysTo) return deploySpot(this.world, hit.unit) ? 'deploy' : 'noDeploy';
      return 'select';
    }
    if (!own.length) return 'default';
    if (hit.kind === 'structure') return 'noMove';
    const i = this.world.map.idx(hit.tx, hit.ty);
    return own.some((u) => this.world.map.moveFactor(i, u.move) > 0) ? 'move' : 'noMove';
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/selection.test.mjs tests/controller.test.mjs`
Expected: PASS (13 tests).

- [ ] **Step 6: Cursors, message bar and overlay (browser-only)**

**File: `src/ui/cursors.js`**
```js
// SVG cursors (spec §5.6), applied to the game canvas.
const svg = (body, hx, hy) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`)}") ${hx} ${hy}, auto`;

const BRACKETS = 'M4 11V4h7M21 4h7v7M28 21v7h-7M11 28H4v-7';
export const CURSORS = {
  default: 'default',
  select: svg(`<path d='${BRACKETS}' fill='none' stroke='#000' stroke-width='4' opacity='.5'/><path d='${BRACKETS}' fill='none' stroke='#fff' stroke-width='2'/>`, 16, 16),
  move: svg(`<path d='M16 2l5 6h-3v6h6v-3l6 5-6 5v-3h-6v6h3l-5 6-5-6h3v-6H8v3l-6-5 6-5v3h6V8h-3z' fill='#7dff7a' stroke='#000' stroke-width='1.2'/>`, 16, 16),
  noMove: svg(`<circle cx='16' cy='16' r='11' fill='none' stroke='#000' stroke-width='5' opacity='.5'/><circle cx='16' cy='16' r='11' fill='none' stroke='#ff4a3a' stroke-width='3'/><path d='M8 24L24 8' stroke='#ff4a3a' stroke-width='3'/>`, 16, 16),
  attack: svg(`<g fill='none' stroke='#ff3b30' stroke-width='2.2'><circle cx='16' cy='16' r='9'/><path d='M16 2v8M16 22v8M2 16h8M22 16h8'/></g>`, 16, 16),
  deploy: svg(`<path d='M6 26h20v-4H6zM9 22l7-12 7 12z' fill='#ffd24a' stroke='#000' stroke-width='1'/>`, 16, 16),
  noDeploy: svg(`<path d='M6 26h20v-4H6zM9 22l7-12 7 12z' fill='#888' stroke='#000' stroke-width='1'/><path d='M6 6L26 26' stroke='#ff4a3a' stroke-width='3'/>`, 16, 16),
};

export function makeCursorSetter(el) {
  let current = null;
  return (name) => {
    if (name === current) return;
    current = name;
    el.style.cursor = CURSORS[name] ?? 'default';
  };
}
```

**File: `src/ui/hud.js`**
```js
// Message bar at the top of the battlefield (Dune II style) for announcer and status text.
export class Hud {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'message-bar';
    root.appendChild(this.el);
    this.timer = 0;
  }
  message(text, seconds = 4) {
    this.el.textContent = text;
    this.el.classList.add('show');
    this.timer = seconds;
  }
  update(dt) {
    if (this.timer > 0 && (this.timer -= dt) <= 0) this.el.classList.remove('show');
  }
}
```

Modify `src/ui/styles.css` — append:
```css
.message-bar { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); min-width: 320px; max-width: 60vw; padding: 6px 18px;
  background: linear-gradient(#3a2a18, #22170c); border: 2px solid #b8893a; border-radius: 3px; box-shadow: 0 2px 10px rgba(0,0,0,.6);
  font: bold 15px "Trebuchet MS", sans-serif; letter-spacing: .04em; color: #f5d48a; text-align: center; text-shadow: 0 1px 0 #000;
  opacity: 0; transition: opacity .25s; pointer-events: none; }
.message-bar.show { opacity: 1; }
```

**File: `src/render/overlay.js`**
```js
// 2D overlay (spec §5.6): C&C white corner brackets, health bars, group numbers, drag box and
// order markers, drawn over the 3D view every frame.
export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dragBox = null;
    this.markers = [];
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth || innerWidth;
    this.h = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setDragBox(box) { this.dragBox = box; }
  marker(x, z) { this.markers.push({ x, z, t: 0 }); }

  draw({ world, selection, hoverId, project, positionOf, groups, dt, healthBars = 'selected' }) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    for (const u of world.units.values()) {
      const selected = selection.has(u.id), hovered = u.id === hoverId;
      const damaged = u.hp < u.maxHp;
      if (!selected && !hovered && healthBars !== 'always' && !(healthBars === 'damaged' && damaged)) continue;
      const p = positionOf(u);
      const s = project(p.x, p.z, u.move === 'foot' ? 0.12 : 0.18);
      if (!s.visible) continue;
      const half = Math.max(8, s.pxPerUnit * (u.move === 'foot' ? 0.2 : 0.34));
      if (selected || hovered) brackets(c, s.x, s.y, half, selected ? '#ffffff' : 'rgba(255,255,255,0.45)');
      healthBar(c, s.x, s.y - half - 7, half * 2, u.hp / u.maxHp);
      const g = selected ? groups.groupOf(u.id) : null;
      if (g !== null) {
        c.font = 'bold 12px "Trebuchet MS", sans-serif';
        c.fillStyle = '#000';
        c.fillText(String(g), s.x + half - 5, s.y + half + 1);
        c.fillStyle = '#fff';
        c.fillText(String(g), s.x + half - 6, s.y + half);
      }
    }
    this.markers = this.markers.filter((m) => (m.t += dt) < 0.6);
    for (const m of this.markers) {
      const p = project(m.x, m.z, 0.02);
      if (!p.visible) continue;
      const k = m.t / 0.6, rx = (0.18 + 0.25 * k) * p.pxPerUnit;
      c.strokeStyle = `rgba(125,255,122,${1 - k})`;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(p.x, p.y, rx, rx * 0.5, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (this.dragBox) {
      const { x0, y0, x1, y1 } = this.dragBox;
      c.fillStyle = 'rgba(255,255,255,0.07)';
      c.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1;
      c.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }
}

function brackets(c, x, y, h, color) {
  const l = Math.max(4, h * 0.45);
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.lineWidth = 4;
  path(c, x, y, h, l);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = 2;
  path(c, x, y, h, l);
  c.stroke();
}

function path(c, x, y, h, l) {
  c.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = x + sx * h, cy = y + sy * h;
    c.moveTo(cx, cy - sy * l);
    c.lineTo(cx, cy);
    c.lineTo(cx - sx * l, cy);
  }
}

function healthBar(c, x, y, w, frac) {
  c.fillStyle = 'rgba(0,0,0,0.65)';
  c.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  c.fillStyle = frac > 0.5 ? '#35d04a' : frac > 0.25 ? '#e3c237' : '#e0412f';
  c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 3);
}
```

- [ ] **Step 7: Commit**

```bash
git add src/input src/ui src/render/overlay.js tests/selection.test.mjs tests/controller.test.mjs
git commit -m "feat(input): selection, control groups, classic/modern controller, cursors, overlay and message bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Skirmish scene, debug hook and end-to-end test

**Files:**
- Create: `src/game/setup.js`, `src/game/debug.js`, `src/scenes/skirmish.js`, `scripts/e2e.mjs`
- Modify: `src/main.js` (register `skirmish`), `scripts/scenarios.mjs` (skirmish scenes)
- Test: `tests/setup.test.mjs`

**Interfaces:**
- Consumes: everything above — `generateMap`, `World`, `deploySpot`, `Renderer3D`, `Heightfield`, `TerrainView`, `CameraRig`, `CameraControl`, picking, `UnitViews`, `StructureViews`, `Overlay`, `Pointer`, `Keyboard`, `Selection`, `Groups`, `Controller`, `makeCursorSetter`, `Hud`, `FixedLoop`, `loadSettings`, `readParams`, `DT`, `GAME_SPEED`, `startServer` (from `scripts/smoke.mjs`), `launchChrome`/`openPage`/`MODIFIERS` (from `scripts/cdp.mjs`).
- Produces: `findFreeTile(world, x, y, moveClass, maxR=8, minR=0)` → `{x,y}` or `null`; `spawnStartingForces(world, house, start)` → units; `setupSkirmish({seed, size, house, enemy, credits})` → `{world, starts, house, rival}`; `window.__dune` API: `ready`, `scene`, `world`, `house`, `selection()`, `units(typeId?, house?)`, `unit(id)`, `structures(typeId?)`, `screenOfUnit(id)`, `screenOfTile(x, y)`, `freeTileNear(x, y, moveClass)`, `lookAt(x, z)`. URL flags for the skirmish scene: `seed`, `size`, `house`, `enemy`, `quality`, `scheme`, `dist`, `ticks`.

- [ ] **Step 1: Write the failing test**

**File: `tests/setup.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { setupSkirmish, findFreeTile } from '../src/game/setup.js';
import { deploySpot } from '../src/sim/deploy.js';
import { flatWorld } from './helpers.mjs';

test('each side starts with an MCV on rock and five escorts on distinct tiles', () => {
  const { world, house, rival } = setupSkirmish({ seed: 4, size: 64, house: 'ordos' });
  assert.equal(rival, 'atreides');
  assert.ok(world.houses.get(rival).isAI && !world.houses.get(house).isAI);
  for (const h of [house, rival]) {
    const units = [...world.units.values()].filter((u) => u.house === h);
    assert.equal(units.length, 6);
    const mcv = units.find((u) => u.typeId === 'mcv');
    assert.equal(world.map.ground[world.map.idx(mcv.tx, mcv.ty)], G.ROCK);
  }
  const tiles = [...world.units.values()].map((u) => `${u.tx},${u.ty}`);
  assert.equal(new Set(tiles).size, tiles.length);
});

test('the player MCV can deploy where it starts, on many seeds', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const { world, house } = setupSkirmish({ seed });
    const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
    assert.ok(deploySpot(world, mcv), `seed ${seed}`);
  }
});

test('findFreeTile respects the minimum radius and passability', () => {
  const world = flatWorld(12, 12, G.ROCK);
  world.map.ground[world.map.idx(6, 5)] = G.MOUNTAIN;
  const t = findFreeTile(world, 5, 5, 'tracked', 4, 1);
  assert.ok(Math.max(Math.abs(t.x - 5), Math.abs(t.y - 5)) >= 1);
  assert.notDeepEqual([t.x, t.y], [6, 5]);
  assert.equal(findFreeTile(flatWorld(3, 3, G.MOUNTAIN), 1, 1, 'tracked', 2), null);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/setup.test.mjs`
Expected: FAIL — cannot find `../src/game/setup.js`.

- [ ] **Step 3: Implement set-up and the debug hook**

**File: `src/game/setup.js`**
```js
// Skirmish set-up: map, houses and the Dune II style opening force — an MCV on the plateau centre
// with an escort parked at least two tiles away so the Construction Yard has room.
import { generateMap } from '../sim/mapgen.js';
import { World } from '../sim/world.js';
import { LIGHT_VEHICLE, INFANTRY, PLAYABLE_HOUSES } from '../data/houses.js';
import { UNITS } from '../data/units.js';

export function findFreeTile(world, x, y, moveClass, maxR = 8, minR = 0) {
  const map = world.map;
  for (let r = minR; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = x + dx, ty = y + dy;
      if (!map.inBounds(tx, ty)) continue;
      const i = map.idx(tx, ty);
      if (!map.unit[i] && !map.structure[i] && map.moveFactor(i, moveClass) > 0) return { x: tx, y: ty };
    }
  }
  return null;
}

export function spawnStartingForces(world, house, start) {
  const facing = Math.atan2(world.map.h / 2 - start.y, world.map.w / 2 - start.x);
  const units = [world.spawnUnit('mcv', house, start.x, start.y, { heading: facing })];
  for (const type of ['combatTank', 'combatTank', LIGHT_VEHICLE[house], INFANTRY[house], INFANTRY[house]]) {
    const spot = findFreeTile(world, start.x, start.y, UNITS[type].move, 8, 2);
    if (spot) units.push(world.spawnUnit(type, house, spot.x, spot.y, { heading: facing }));
  }
  return units;
}

export function setupSkirmish({ seed = 1, size = 64, house = 'atreides', enemy = null, credits = 3000 } = {}) {
  const { map, starts } = generateMap({ w: size, h: size, seed, players: 2 });
  const world = new World({ map, seed });
  const rival = enemy && enemy !== house ? enemy : PLAYABLE_HOUSES.find((h) => h !== house);
  world.addHouse(house, { credits });
  world.addHouse(rival, { credits, ai: true });
  spawnStartingForces(world, house, starts[0]);
  spawnStartingForces(world, rival, starts[1]);
  return { world, starts, house, rival };
}
```

**File: `src/game/debug.js`**
```js
// window.__dune: read-only hooks for smoke and end-to-end tests (no cheats).
import { findFreeTile } from './setup.js';

export function createDebugApi({ world, house, selection, project, positionOf, rig }) {
  const brief = (u) => u && { id: u.id, typeId: u.typeId, house: u.house, tx: u.tx, ty: u.ty, x: u.x, y: u.y, order: u.order.type, hp: u.hp };
  const screen = (x, z, lift) => { const s = project(x, z, lift); return { x: Math.round(s.x), y: Math.round(s.y), visible: s.visible }; };
  return {
    ready: false,
    scene: 'skirmish',
    world,
    house,
    selection: () => selection.list(),
    units: (typeId = null, h = house) => [...world.units.values()].filter((u) => u.house === h && (!typeId || u.typeId === typeId)).map(brief),
    unit: (id) => brief(world.units.get(id)),
    structures: (typeId = null) => [...world.structures.values()].filter((s) => !typeId || s.typeId === typeId).map((s) => ({ id: s.id, typeId: s.typeId, house: s.house, x: s.x, y: s.y })),
    screenOfUnit: (id) => { const u = world.units.get(id); if (!u) return null; const p = positionOf(u); return screen(p.x, p.z, 0.12); },
    screenOfTile: (x, y) => screen(x + 0.5, y + 0.5, 0),
    freeTileNear: (x, y, moveClass = 'tracked') => findFreeTile(world, x, y, moveClass, 6),
    lookAt: (x, z) => rig.lookAt(x, z, true),
  };
}
```

- [ ] **Step 4: Run the set-up tests**

Run: `node --test tests/setup.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Assemble the skirmish scene**

**File: `src/scenes/skirmish.js`**
```js
// Skirmish (plan 1a scope): generated map, both houses' opening forces, RTS camera, selection,
// movement and MCV deployment. Production, combat, fog and AI arrive in plan 1b.
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { screenToGround, worldToScreen, pixelsPerUnit } from '../render/picking.js';
import { UnitViews } from '../render/views/unit-views.js';
import { StructureViews } from '../render/views/structure-views.js';
import { Overlay } from '../render/overlay.js';
import { CameraControl } from '../input/camera-control.js';
import { Pointer } from '../input/pointer.js';
import { Keyboard } from '../input/keyboard.js';
import { Selection } from '../input/selection.js';
import { Groups } from '../input/groups.js';
import { Controller } from '../input/controller.js';
import { makeCursorSetter } from '../ui/cursors.js';
import { Hud } from '../ui/hud.js';
import { FixedLoop } from '../core/loop.js';
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { DT, GAME_SPEED } from '../data/tuning.js';
import { setupSkirmish } from '../game/setup.js';
import { createDebugApi } from '../game/debug.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const { world, starts } = setupSkirmish({ seed: params.num('seed', 1), size: params.num('size', 64), house, enemy: params.str('enemy') });
  for (let i = 0, n = params.num('ticks', 0); i < n; i++) world.step();

  const canvas = document.getElementById('gl');
  const r3d = new Renderer3D(canvas, settings.quality);
  const hf = new Heightfield(world.map, { sub: r3d.quality.terrainSub, seed: world.map.seed });
  const heightAt = (x, z) => hf.heightAt(x, z);
  const terrain = new TerrainView(world.map, hf);
  r3d.scene.add(terrain.group);
  const unitViews = new UnitViews(r3d.scene, hf);
  const structureViews = new StructureViews(r3d.scene, hf);

  const rig = new CameraRig(r3d.camera, world.map.w, world.map.h);
  const dist = params.num('dist');
  if (dist) rig.goalDistance = rig.distance = dist;
  rig.lookAt(starts[0].x + 0.5, starts[0].y + 2.5, true);
  const cameraControl = new CameraControl(rig, canvas, settings);
  const overlay = new Overlay(document.getElementById('overlay'));
  const hud = new Hud(document.getElementById('ui'));
  const selection = new Selection();
  const groups = new Groups();

  const project = (x, z, lift = 0) => {
    const y = heightAt(x, z) + lift;
    const s = worldToScreen(r3d.camera, x, y, z, r3d.width, r3d.height);
    s.pxPerUnit = pixelsPerUnit(r3d.camera, x, y, z, r3d.height);
    s.visible = s.visible && s.x > -60 && s.x < r3d.width + 60 && s.y > -60 && s.y < r3d.height + 60;
    return s;
  };
  const ground = (sx, sy) => screenToGround(r3d.camera, (sx / r3d.width) * 2 - 1, 1 - (sy / r3d.height) * 2, heightAt);
  const positionOf = (u) => unitViews.renderPos(u);
  const controller = new Controller({
    world, house, selection, groups, settings, project, ground, rig, positionOf,
    viewport: () => ({ left: 0, top: 0, right: r3d.width, bottom: r3d.height }),
    onCursor: makeCursorSetter(canvas),
    onMarker: (x, z) => overlay.marker(x, z),
    onDragBox: (box) => overlay.setDragBox(box),
  });
  new Pointer(canvas, controller);
  new Keyboard((key, code, mods) => controller.onKey(key, code, mods));

  const loop = new FixedLoop(DT);
  const speed = GAME_SPEED[settings.gameSpeed] ?? 1;
  let last = performance.now();
  let paused = document.hidden;
  document.addEventListener('visibilitychange', () => { paused = document.hidden; last = performance.now(); });
  r3d.onContextLost = () => hud.message('The graphics device was reset — reload the page to continue.', 3600);

  const handleEvents = () => {
    for (const e of world.events.drain()) {
      if (e.type === 'eva' && e.house === house) hud.message(e.text);
      else if (e.type === 'deployed' && e.house === house) hud.message('Construction Yard deployed.');
    }
  };

  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const { steps, alpha } = paused ? { steps: 0, alpha: 1 } : loop.advance(dt, speed);
    for (let i = 0; i < steps; i++) world.step();
    handleEvents();
    selection.prune((id) => world.units.has(id));
    cameraControl.update(dt);
    rig.update(dt, heightAt);
    r3d.follow(rig.target.x, rig.target.z, rig.distance * 1.1);
    unitViews.sync(world, alpha, dt);
    structureViews.sync(world, now);
    terrain.update(now);
    r3d.render();
    controller.frame();
    overlay.draw({ world, selection, hoverId: controller.hoverId, project, positionOf, groups, dt, healthBars: settings.healthBars });
    hud.update(dt);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame((now) => {
    last = now;
    rig.update(1, heightAt);
    frame(now);
    window.__dune = createDebugApi({ world, house, selection, project, positionOf, rig });
    window.__dune.ready = true;
  });
}
```

Modify `src/main.js` — add to `SCENES`:
```js
  skirmish: () => import('./scenes/skirmish.js'),
```

Modify `scripts/scenarios.mjs` — add:
```js
  'skirmish-atreides': { query: 'scene=skirmish&seed=11&house=atreides' },
  'skirmish-harkonnen': { query: 'scene=skirmish&seed=5&house=harkonnen' },
  'skirmish-ordos-close': { query: 'scene=skirmish&seed=8&house=ordos&dist=12' },
  'skirmish-wide': { query: 'scene=skirmish&seed=11&house=atreides&dist=55' },
```

- [ ] **Step 6: Smoke the skirmish scenes and review**

Run: `npm run smoke skirmish-atreides skirmish-harkonnen skirmish-ordos-close skirmish-wide`
Expected: four screenshots, no errors. Check: the opening force (MCV, two Combat Tanks, a light vehicle, two infantry squads) stands on the rock plateau in the correct house colour, casts shadows, sits on the ground; the close-up shows tread and figure detail; the wide shot shows plateaus, dunes, spice fields and mountains reading clearly as 3D relief.

- [ ] **Step 7: Write the end-to-end script**

**File: `scripts/e2e.mjs`**
```js
// End-to-end: plays the opening of a skirmish with real mouse and keyboard input in headless Chrome
// and checks the simulation through window.__dune.
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage, MODIFIERS } from './cdp.mjs';
import { startServer } from './smoke.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_PORT || 8472);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

const server = await startServer(PORT);
const chrome = await launchChrome({ width: 1400, height: 800 });
let page;
try {
  page = await openPage(chrome, `http://localhost:${PORT}/?scene=skirmish&seed=11&house=atreides&quality=low`);
  await page.waitFor('window.__dune && window.__dune.ready === true', 120000);
  await sleep(600);
  const ev = (expr) => page.eval(expr);
  const deselect = async () => { await page.click(8, 400, { button: 'right' }); await sleep(120); };

  const [tank] = await ev(`__dune.units('combatTank')`);
  let s = await ev(`__dune.screenOfUnit(${tank.id})`);
  await page.click(s.x, s.y);
  await sleep(150);
  check('click selects a tank', JSON.stringify(await ev('__dune.selection()')) === JSON.stringify([tank.id]));

  const target = await ev(`__dune.freeTileNear(${tank.tx + 4}, ${tank.ty + 1})`);
  const ts = await ev(`__dune.screenOfTile(${target.x}, ${target.y})`);
  await sleep(350);
  await page.click(ts.x, ts.y);
  let arrived = false;
  for (let i = 0; i < 120 && !arrived; i++) {
    await sleep(200);
    const u = await ev(`__dune.unit(${tank.id})`);
    arrived = Math.max(Math.abs(u.tx - target.x), Math.abs(u.ty - target.y)) <= 1 && u.order === 'idle';
  }
  check('clicking the ground moves the selected tank there', arrived);

  await deselect();
  check('right click deselects', (await ev('__dune.selection()')).length === 0);

  const own = await ev('__dune.units()');
  const pts = (await Promise.all(own.map((u) => ev(`__dune.screenOfUnit(${u.id})`)))).filter((p) => p.visible);
  await page.drag(Math.min(...pts.map((p) => p.x)) - 30, Math.min(...pts.map((p) => p.y)) - 30, Math.max(...pts.map((p) => p.x)) + 30, Math.max(...pts.map((p) => p.y)) + 30);
  await sleep(150);
  const boxed = await ev('__dune.selection()');
  check('drag box selects several units', boxed.length >= 3, `${boxed.length} selected`);

  await page.key('1', { code: 'Digit1', modifiers: MODIFIERS.ctrl });
  await deselect();
  await page.key('1', { code: 'Digit1' });
  await sleep(120);
  check('control group 1 recalls the selection', (await ev('__dune.selection()')).length === boxed.length);

  await deselect();
  const [mcv] = await ev(`__dune.units('mcv')`);
  s = await ev(`__dune.screenOfUnit(${mcv.id})`);
  await page.click(s.x, s.y);
  await sleep(400);
  await page.click(s.x, s.y);
  let deployed = false;
  for (let i = 0; i < 25 && !deployed; i++) {
    await sleep(200);
    deployed = (await ev(`__dune.structures('constructionYard')`)).some((c) => c.house === 'atreides');
  }
  check('clicking the selected MCV again deploys a Construction Yard', deployed);

  await sleep(1500);
  await mkdir(path.join(root, 'screenshots'), { recursive: true });
  await page.screenshot(path.join(root, 'screenshots', 'e2e-final.png'));
  const errors = page.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
  check('no console errors or exceptions', errors.length === 0, errors.join(' | '));
} catch (err) {
  check('end-to-end run completed', false, err.message);
} finally {
  page?.close();
  await chrome.close();
  server.kill();
}
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 8: Run the end-to-end test**

Run: `npm run e2e`
Expected: every line `PASS`, last line `6/6 checks passed` (7 including the console check). Look at `screenshots/e2e-final.png`: the moved tank, the new Construction Yard on the plateau, no selection brackets left behind after the final deselect.

- [ ] **Step 9: Commit**

```bash
git add src/game src/scenes/skirmish.js src/main.js scripts/e2e.mjs scripts/scenarios.mjs tests/setup.test.mjs
git commit -m "feat(game): playable skirmish opening — selection, movement, groups and MCV deployment in 3D

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: README and full verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

**File: `README.md`**
````markdown
# Dune II 3D — fan remake

A browser remake of Westwood's *Dune II: The Battle for Arrakis* (1992 PC, 1993 Sega Mega Drive)
built with Three.js and played with a Command & Conquer style mouse interface. Every model, texture,
sound, melody and line of text is made from scratch in code; no original game files are included.

    npm install     # dev dependency only: three (Node tests + vendoring)
    npm start       # http://localhost:8080
    npm test        # simulation, data and render-logic tests (Node)
    npm run smoke   # screenshots of the test scenes via headless Chrome → screenshots/
    npm run e2e     # plays the opening of a skirmish with real mouse input

## Status

Plan 1a (engine core) is done: generated Arrakis maps in 3D, house-coloured 3D units, C&C-style
selection and movement, control groups and MCV deployment. Production, economy, combat, fog of war,
radar and the computer opponent arrive with plan 1b.

## Controls (Classic scheme, like C&C 1995)

| Input | Action |
|---|---|
| Left click | Select a unit; with units selected, order them by context (move, attack) |
| Left click the selected MCV | Deploy it into a Construction Yard |
| Right click | Deselect |
| Left drag | Box select; Shift adds |
| Double click | Select all visible units of that type |
| Ctrl + 1–9 (or Ctrl + Shift + 1–9) | Assign a control group |
| 1–9, tap twice | Select a group, centre on it |
| S · G · X · D | Stop · guard · scatter · deploy |
| H or Home | Centre on the Construction Yard |
| Screen edges, arrow keys, middle drag | Scroll |
| Mouse wheel · Alt + middle drag | Zoom · rotate and tilt |

Browsers may keep Ctrl + digit for switching tabs; Ctrl + Shift + digit always works.
`?scheme=modern` swaps to right-click orders.

## URL flags

`?scene=skirmish|terrain|gallery|render-test` · `seed=11` · `size=64` ·
`house=atreides|harkonnen|ordos` · `enemy=…` · `quality=low|medium|high` · `scheme=classic|modern` ·
`dist=30` (camera distance)

## Docs

Research: `docs/research/` · design: `docs/superpowers/specs/` · plans: `docs/superpowers/plans/`.
Three.js 0.186.1 (MIT) is vendored in `vendor/three/`.
````

- [ ] **Step 2: Run everything**

Run: `npm test && npm run smoke && npm run e2e`
Expected: all Node tests pass; every smoke scenario writes a screenshot with no errors; the end-to-end run passes every check.

- [ ] **Step 3: Review the whole screenshot set once more**

Open every file in `screenshots/` with the Read tool. Nothing black, nothing floating, house colours correct, terrain varied and readable. Note anything that needs art polish in plan 1b rather than blocking here, unless it breaks readability.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README for the plan 1a engine core

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
