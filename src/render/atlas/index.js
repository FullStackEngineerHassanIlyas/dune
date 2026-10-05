// The territory map of Arrakis between missions (spec §5.8; contract C5; research.md §3 and §6). As on the Sega: a
// tilted relief map whose three coloured territories grow as the campaign goes on; after the briefing the camera
// dives onto the mission's region (about seven seconds), and when a mission is won the new land floods in the house's
// colour. Its own canvas and WebGL renderer inside `container`; draws only while shown (and, with reduced motion,
// only when something changes); rebuilds what the GPU held after a lost context; dispose() frees everything.
//
//   const atlas = createAtlas(container, { quality });
//   atlas.show({ house, step });                  // the map after `step` missions won, the next mission's region pulsing
//   await atlas.zoomTo({ house, mission });       // the dive onto mission `mission`'s region
//   await atlas.conquer({ house, step });         // the land won at `step` floods in, then the next region pulses
//   atlas.hide(); atlas.resize(); atlas.dispose(); atlas.debug();
import * as THREE from 'three';
import { REGIONS, MAP, OWNERS, ownerOf, targetRegion, changes } from '../../data/territory.js';
import { HOUSES } from '../../data/houses.js';
import { qualityPreset, pixelRatioFor } from '../quality.js';
import { acquireRasters, releaseRasters, heldRasters, BORDER_RANGE } from './raster.js';
import { FOV, WORLD, RELIEF, overviewPose, regionPose, zoomPose, posePosition, drift, easeInOut } from './camera-path.js';
import { BAKE_VERTEX, BAKE_TERRAIN, BAKE_COLOUR, SURFACE_VERTEX, SURFACE_FRAGMENT, NOISE_SIZE } from './shaders.js';
import { Rng } from '../../core/rng.js';

// Per preset: texels across the map (relief, regions and borders) and the mesh's quads across it.
const DETAIL = { low: { tex: 1024, seg: 160, aniso: 1 }, medium: { tex: 2048, seg: 256, aniso: 4 }, high: { tex: 2048, seg: 320, aniso: 8 } };
const TINT = 0.84;            // how strongly a house's colour lies over its land
const FLOOD_SPEED = 0.22;     // map heights a second the conquest's front advances
const FLOOD_MIN = 1.1;        // seconds a region takes to flood, however small
const FLOOD_STAGGER = 0.45;   // seconds between one region and the next changing hands
const FLOOD_SOFT = 0.012;     // the front's width, in map heights
const HOLD = 0.6;             // seconds the finished conquest holds before its promise resolves
const STILL_HOLD = 0.8;       // reduced motion: the new map is shown at once and held this long
const PULSE = 1.6;            // seconds per pulse of the mission's region
const FAR = 1e3;              // a flood radius that covers the map: the region shows its final owner

const CAMPAIGNS = ['atreides', 'harkonnen', 'ordos'];
const houseOf = (house) => (CAMPAIGNS.includes(house) ? house : 'atreides');

function gridGeometry(seg) {
  const sx = seg, sy = seg / 2, n = (sx + 1) * (sy + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let j = 0, k = 0; j <= sy; j++) {
    for (let i = 0; i <= sx; i++, k++) {
      pos[k * 3] = (i / sx - 0.5) * WORLD.w;
      pos[k * 3 + 2] = (j / sy - 0.5) * WORLD.h;
      uv[k * 2] = i / sx;
      uv[k * 2 + 1] = j / sy;
    }
  }
  const index = new (n > 65535 ? Uint32Array : Uint16Array)(sx * sy * 6);
  for (let j = 0, k = 0; j < sy; j++) {
    for (let i = 0; i < sx; i++) {
      const a = j * (sx + 1) + i, b = a + 1, c = a + sx + 1, d = c + 1;
      index.set([a, c, b, b, c, d], k);
      k += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

function dataTexture(data, size, filter) {
  const t = new THREE.DataTexture(data, size, size / 2, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = filter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** The relief's noise: NOISE_SIZE² seeded random values, half floats (smooth under linear filtering), repeating. */
function noiseTexture(seed = 1992) {
  const rng = new Rng(seed), data = new Uint16Array(NOISE_SIZE * NOISE_SIZE);
  for (let k = 0; k < data.length; k++) data[k] = THREE.DataUtils.toHalfFloat(rng.next());
  const t = new THREE.DataTexture(data, NOISE_SIZE, NOISE_SIZE, THREE.RedFormat, THREE.HalfFloatType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** A ring of the last samples (milliseconds) with mean and 95th percentile; record() allocates nothing. */
function ring(n = 600) {
  const buf = new Float32Array(n);
  let count = 0, head = 0;
  return {
    record(v) { buf[head] = v; head = (head + 1) % n; count = Math.min(n, count + 1); },
    stats() {
      if (!count) return null;
      const v = Array.from(buf.subarray(0, count)).sort((a, b) => a - b);
      return { n: count, mean: +(v.reduce((s, x) => s + x, 0) / count).toFixed(2), p95: +v[Math.min(count - 1, Math.floor(count * 0.95))].toFixed(2) };
    },
    reset() { count = 0; head = 0; },
  };
}

/** Where the land a house takes floods in from: the point of the region's outline nearest that house's closest
 *  region before the step, or the region's centre when it has none next door. */
function floodOrigin(region, owner, house, before) {
  let near = null, best = Infinity;
  for (const n of region.neighbours) {
    if (ownerOf(house, before, n) !== owner) continue;
    const c = REGIONS[n - 1].centre, d = Math.hypot(c[0] - region.centre[0], c[1] - region.centre[1]);
    if (d < best) { best = d; near = c; }
  }
  if (!near) return region.centre;
  let at = region.centre;
  best = Infinity;
  for (const p of region.polygon) { const d = Math.hypot(p[0] - near[0], p[1] - near[1]); if (d < best) { best = d; at = p; } }
  return at;
}

/**
 * The territory map in `container` (which it fills; give it a size and position). Options: quality ('low' | 'medium'
 * | 'high'), reducedMotion (default: the system's setting), inset ({ left, right, top, bottom } shares of the picture
 * the map keeps clear of), measure (time the GPU per frame, for debug()).
 */
export function createAtlas(container, { quality = 'medium', reducedMotion, inset = null, measure = false } = {}) {
  const q = qualityPreset(quality), detail = DETAIL[quality] ?? DETAIL.medium;
  const canvas = document.createElement('canvas');
  canvas.className = 'atlas-canvas';
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q.msaa > 0, alpha: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const gl = renderer.getContext();

  // ---- what the map is made of
  const size = detail.tex, rasterStart = performance.now();
  const raster = acquireRasters(REGIONS, MAP, size);   // shared with the other atlases alive; the last dispose() frees it
  const regionTex = dataTexture(raster.ids, size, THREE.NearestFilter);
  const edgeTex = dataTexture(raster.edges, size, THREE.LinearFilter);
  const rasterMs = +(performance.now() - rasterStart).toFixed(1);
  const vec4s = () => Array.from({ length: 28 }, () => new THREE.Vector4(0, 0, FAR, 0.001));
  const uniforms = {
    uRelief: { value: null }, uReliefHeight: { value: RELIEF },
    uRegion: { value: regionTex }, uEdge: { value: edgeTex }, uRange: { value: BORDER_RANGE },
    uFrom: { value: vec4s() }, uTo: { value: vec4s() }, uFlood: { value: vec4s() },
    uTarget: { value: 0 }, uPulse: { value: 0.6 },
  };
  const surface = new THREE.ShaderMaterial({ uniforms, vertexShader: SURFACE_VERTEX, fragmentShader: SURFACE_FRAGMENT });
  const geometry = gridGeometry(detail.seg);
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.frustumCulled = false;   // the relief is lifted in the vertex shader
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 400);

  // The relief, baked on the GPU: pass 1 the terrain, pass 2 the lit colour. The programs first compile in the
  // driver's own time (KHR_parallel_shader_compile, through compileAsync), so the page does not stall, and the map
  // draws once the bake is done. A lost context bakes again.
  const bakeUniforms = { uMap: { value: new THREE.Vector2(MAP.w, MAP.h) }, uTerrain: { value: null }, uSize: { value: new THREE.Vector2(size, size / 2) },
    uWorld: { value: new THREE.Vector2(WORLD.w, WORLD.h) }, uRelief: { value: RELIEF }, uNoise: { value: noiseTexture() } };
  const bakeTerrain = new THREE.ShaderMaterial({ uniforms: bakeUniforms, vertexShader: BAKE_VERTEX, fragmentShader: BAKE_TERRAIN, depthTest: false, depthWrite: false });
  const bakeColour = new THREE.ShaderMaterial({ uniforms: bakeUniforms, vertexShader: BAKE_VERTEX, fragmentShader: BAKE_COLOUR, depthTest: false, depthWrite: false });
  const quad = new THREE.PlaneGeometry(2, 2);
  const bakeQuad = new THREE.Mesh(quad, bakeTerrain), spareQuad = new THREE.Mesh(quad, bakeColour);
  bakeQuad.frustumCulled = spareQuad.frustumCulled = false;
  const bakeScene = new THREE.Scene().add(bakeQuad), bakeCamera = new THREE.Camera();
  let relief = null, baked = false;
  const bakeMs = {};
  const target = (options) => new THREE.WebGLRenderTarget(size, size / 2, { depthBuffer: false, generateMipmaps: false, ...options });
  function bake() {
    let t = performance.now();
    const lap = (name) => { if (measure) gl.finish(); const now = performance.now(); bakeMs[name] = +(now - t).toFixed(1); t = now; };
    relief?.dispose();
    relief = target({ generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, colorSpace: THREE.SRGBColorSpace,
      anisotropy: Math.min(detail.aniso, renderer.capabilities.getMaxAnisotropy()) });
    const terrain = target({ type: THREE.HalfFloatType });   // linear: the hollows ring reads between texels
    const previous = renderer.getRenderTarget();
    bakeQuad.material = bakeTerrain;
    renderer.setRenderTarget(terrain);
    renderer.render(bakeScene, bakeCamera);
    lap('terrain');
    bakeUniforms.uTerrain.value = terrain.texture;
    bakeQuad.material = bakeColour;
    renderer.setRenderTarget(relief);
    renderer.render(bakeScene, bakeCamera);
    renderer.setRenderTarget(previous);
    lap('colour');
    terrain.dispose();
    bakeUniforms.uTerrain.value = null;
    uniforms.uRelief.value = relief.texture;
    baked = true;
    startWaiting();
  }
  async function prepare() {
    const t0 = performance.now(), scratch = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false });
    try {
      // the bake's programs as they draw into a target (linear output), the map's as it draws to the screen
      bakeScene.add(spareQuad);
      renderer.setRenderTarget(scratch);
      const offscreen = renderer.compileAsync(bakeScene, bakeCamera);
      renderer.setRenderTarget(null);
      bakeScene.remove(spareQuad);
      await Promise.all([offscreen, renderer.compileAsync(scene, camera)]);
    } catch { /* they compile when first drawn instead */ }
    renderer.setRenderTarget(null);
    scratch.dispose();
    bakeMs.compile = +(performance.now() - t0).toFixed(1);
    if (disposed || lost) return;
    bake();
    wake();
  }

  // ---- state
  const colour = {};
  for (const owner of OWNERS) colour[owner] = new THREE.Color(HOUSES[owner].color);
  const media = reducedMotion === undefined ? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null : null;
  const still = { value: reducedMotion ?? media?.matches ?? false };
  const onMotion = (e) => { still.value = e.matches; wake(); };
  media?.addEventListener?.('change', onMotion);
  const s = { house: 'atreides', step: 0, target: 0, mission: null, shown: false, view: 'overview' };
  const view = { w: 0, h: 0, aspect: 16 / 9, inset };
  const overview = overviewPose(view.aspect, inset), close = {}, pose = {}, wobble = {}, at = {};
  let zoom = null, floods = null, waiting = null, lost = false, disposed = false, raf = 0, frames = 0, lastFrame = 0, generation = 0, firstDraw;
  const ready = new Promise((resolve) => { firstDraw = resolve; });
  const frameMs = ring(), gpuMs = ring();

  function setTint(vec, owner) {
    const c = owner ? colour[owner] : null;
    vec.set(c?.r ?? 0, c?.g ?? 0, c?.b ?? 0, c ? TINT : 0);
  }
  function paint(house, step) {
    for (let id = 1; id <= 27; id++) {
      const owner = ownerOf(house, step, id);
      setTint(uniforms.uFrom.value[id], owner);
      setTint(uniforms.uTo.value[id], owner);
      uniforms.uFlood.value[id].set(0, 0, FAR, 0.001);
    }
  }

  // A zoom or conquest asked for before the map can be seen waits for the bake (its clock starts then). Only the
  // latest one waits: anything shown, hidden or disposed meanwhile settles it with false, so no promise is left hanging.
  function afterBake(resolve, start) {
    dropWaiting();
    if (baked) start();
    else waiting = { resolve, start };
  }
  function startWaiting() { const w = waiting; waiting = null; w?.start(); }
  function dropWaiting() { const w = waiting; waiting = null; w?.resolve(false); }

  function endZoom(done) {
    if (!zoom) return;
    clearTimeout(zoom.timer);
    const z = zoom;
    zoom = null;
    if (done) { s.view = 'region'; Object.assign(close, z.to); }
    z.resolve(done);
  }
  function endConquer(done) {
    if (!floods) return;
    clearTimeout(floods.timer);
    const f = floods;
    floods = null;
    paint(s.house, s.step);
    s.target = targetRegion(s.house, s.step + 1) ?? 0;
    f.resolve(done);
  }

  /** The map after `step` missions of `house`'s campaign, seen whole; `target` (default: the next mission's
   *  region; null for none) pulses. Cancels a zoom or conquest in progress (their promises resolve false). */
  function show({ house, step = 0, target } = {}) {
    if (disposed) return;
    generation++;
    dropWaiting();
    endZoom(false);
    endConquer(false);
    s.house = houseOf(house);
    s.step = Math.min(9, Math.max(0, Math.round(Number(step) || 0)));
    s.target = target === undefined ? targetRegion(s.house, s.step + 1) ?? 0 : Number(target) || 0;
    s.mission = null;
    s.view = 'overview';
    paint(s.house, s.step);
    s.shown = true;
    wake();
  }

  /** The dive onto mission `mission`'s region over `seconds` (ease in and out). Resolves true when it lands (false
   *  if something else is shown first); the view then stays on the region. Reduced motion: the view cuts to the
   *  region at once and the promise still takes `seconds`. `hold` (0–1, for inspection) stops the dive that far
   *  along, until something else is shown. */
  function zoomTo({ house, mission, seconds = 7, hold } = {}) {
    if (disposed) return Promise.resolve(false);
    const h = houseOf(house ?? s.house), n = Math.min(9, Math.max(1, Math.round(Number(mission) || 1)));
    if (!s.shown || h !== s.house) show({ house: h, step: n - 1 });
    endZoom(false);
    endConquer(false);
    const id = targetRegion(h, n), token = ++generation;
    s.target = id;
    s.mission = n;
    return new Promise((resolve) => {
      afterBake(resolve, () => {   // the clock starts when the map can be seen
        if (token !== generation || disposed) { resolve(false); return; }
        const t = performance.now() / 1000;
        const from = basePose(t, {}), k0 = driftWeight(t), to = regionPose(REGIONS[id - 1], view.aspect, view.inset, {});
        const held = hold >= 0 && hold <= 1, span = held ? 1e9 : Math.max(0.001, seconds);
        const timer = held ? 0 : setTimeout(() => { endZoom(true); wake(); }, Math.max(0, seconds) * 1000);
        zoom = { from, to, k0, start: held ? t - hold * span : t, seconds: span, region: id, resolve, timer };
        s.view = 'zoom';
        if (still.value) { s.view = 'region'; Object.assign(close, to); }
        wake();
      });
    });
  }

  /** The land that changes hands at `step` of `house`'s campaign floods in its new owner's colour, region after
   *  region (the player's first); then the map rests at `step` with the next mission's region pulsing. Resolves
   *  true when done, at once when nothing changes hands. Reduced motion: the new map shows at once. */
  function conquer({ house, step } = {}) {
    if (disposed) return Promise.resolve(false);
    const h = houseOf(house ?? s.house), st = Math.min(9, Math.max(1, Math.round(Number(step) || 1)));
    show({ house: h, step: st - 1, target: null });
    s.step = st;
    const list = changes(h, st).sort((a, b) => (b.to === h) - (a.to === h));
    if (!list.length) { paint(h, st); s.target = targetRegion(h, st + 1) ?? 0; wake(); return Promise.resolve(true); }
    const token = ++generation;
    return new Promise((resolve) => {
      afterBake(resolve, () => {
        if (token !== generation || disposed) { resolve(false); return; }
        const now = performance.now() / 1000;
        const items = list.map(({ id, to }, k) => {
          const region = REGIONS[id - 1], o = floodOrigin(region, to, h, st - 1);
          const ox = o[0] / MAP.h, oy = o[1] / MAP.h;   // flood space: map heights, as the shader measures (uv · (2, 1))
          let reach = 0;
          for (const p of region.polygon) reach = Math.max(reach, Math.hypot(p[0] / MAP.h - ox, p[1] / MAP.h - oy));
          reach += FLOOD_SOFT * 2;
          setTint(uniforms.uTo.value[id], to);
          uniforms.uFlood.value[id].set(o[0] / MAP.w, o[1] / MAP.h, still.value ? FAR : -FLOOD_SOFT, FLOOD_SOFT);
          return { id, reach, start: now + k * FLOOD_STAGGER, duration: Math.max(FLOOD_MIN, reach / FLOOD_SPEED) };
        });
        const total = still.value ? STILL_HOLD : Math.max(...items.map((it) => it.start - now + it.duration)) + HOLD;
        floods = { items, resolve, timer: setTimeout(() => { endConquer(true); wake(); }, total * 1000) };
        wake();
      });
    });
  }

  function hide() {
    generation++;
    s.shown = false;
    dropWaiting();
    endZoom(false);
    endConquer(false);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // ---- frames
  // The camera: the overview, the zoom's path or the region it landed on, plus the idle drift, which weighs half as
  // much over a region and eases from one weight to the other along the zoom (so nothing jumps).
  function basePose(t, out) {
    if (s.view === 'zoom' && zoom) return zoomPose(zoom.from, zoom.to, (t - zoom.start) / zoom.seconds, out);
    return Object.assign(out, s.view === 'region' ? close : overview);
  }
  function driftWeight(t) {
    if (still.value) return 0;
    if (s.view === 'zoom' && zoom) return zoom.k0 + (0.5 - zoom.k0) * easeInOut((t - zoom.start) / zoom.seconds);
    return s.view === 'region' ? 0.5 : 1;
  }
  function currentPose(t, out) {
    basePose(t, out);
    const k = driftWeight(t);
    if (k) {
      drift(t, wobble);
      out.yaw += wobble.yaw * k;
      out.elev += wobble.elev * k;
      out.dist *= 1 + wobble.dist * k;
    }
    return out;
  }

  function update(t) {
    uniforms.uTarget.value = s.target || 0;
    uniforms.uPulse.value = still.value ? 0.6 : 0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / PULSE);
    if (floods && !still.value) {
      for (const it of floods.items) {
        const p = (t - it.start) / it.duration;
        uniforms.uFlood.value[it.id].z = p <= 0 ? -FLOOD_SOFT : p >= 1 ? FAR : easeInOut(p) * it.reach;
      }
    }
    currentPose(t, pose);
    posePosition(pose, at);
    camera.position.set(at.x, at.y, at.z);
    camera.lookAt(pose.tx, pose.ty, pose.tz);
  }

  // GPU time per frame (debug only): EXT_disjoint_timer_query_webgl2, a few queries in flight.
  const timer = measure ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
  const queries = timer ? [0, 1, 2, 3].map(() => ({ q: gl.createQuery(), busy: false })) : [];
  function pollQueries() {
    for (const slot of queries) {
      if (!slot.busy || !gl.getQueryParameter(slot.q, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) gpuMs.record(gl.getQueryParameter(slot.q, gl.QUERY_RESULT) / 1e6);
      slot.busy = false;
    }
  }

  function draw() {
    if (lost || disposed || !baked) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;   // hidden: nothing to draw
    if (w !== view.w || h !== view.h) resize();
    let slot = null;
    if (timer) {
      pollQueries();
      for (const sl of queries) if (!sl.busy) { slot = sl; break; }
      if (slot) gl.beginQuery(timer.TIME_ELAPSED_EXT, slot.q);
    }
    renderer.render(scene, camera);
    if (slot) { gl.endQuery(timer.TIME_ELAPSED_EXT); slot.busy = true; }
    frames++;
    if (frames === 1) firstDraw(true);
  }

  function animating() { return !still.value || s.view === 'zoom'; }

  function frame(now) {
    raf = 0;
    if (disposed || !s.shown) return;
    if (lastFrame) frameMs.record(now - lastFrame);
    lastFrame = now;
    update(now / 1000);
    draw();   // may resize, which asks for a frame of its own
    if (animating()) wake();
    else if (!raf) lastFrame = 0;
  }

  function wake() {
    if (!raf && s.shown && !disposed) raf = requestAnimationFrame(frame);
  }

  /** Fits the picture to the canvas's size (called by itself when that changes; call it after layout changes). */
  function resize() {
    if (disposed) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    view.w = w; view.h = h; view.aspect = w / h;
    renderer.setPixelRatio(pixelRatioFor(q, globalThis.devicePixelRatio));
    renderer.setSize(w, h, false);
    camera.aspect = view.aspect;
    camera.updateProjectionMatrix();
    // an inset shifts the picture's centre into the part of the canvas left for the map
    const l = view.inset?.left ?? 0, r = view.inset?.right ?? 0, t = view.inset?.top ?? 0, b = view.inset?.bottom ?? 0;
    camera.projectionMatrix.elements[8] = -(l - r);
    camera.projectionMatrix.elements[9] = -(b - t);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    overviewPose(view.aspect, view.inset, overview);
    if (s.view === 'region' || zoom) {
      const id = zoom?.region ?? s.target;
      if (id) regionPose(REGIONS[id - 1], view.aspect, view.inset, zoom ? zoom.to : close);
    }
    wake();
  }

  /** Keeps the map clear of part of the picture ({ left, right, top, bottom } shares), e.g. for a Mentat. */
  function setInset(next) { view.inset = next ?? null; view.w = 0; resize(); }

  // lost before the first bake: a waiting zoom or conquest starts its clock anyway (as one under way keeps its own),
  // so its promise settles on time even if the context never comes back
  const onLost = (e) => { e.preventDefault(); lost = true; startWaiting(); };
  const onRestored = () => { lost = false; bake(); wake(); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  const observer = globalThis.ResizeObserver ? new ResizeObserver(() => resize()) : null;
  observer?.observe(canvas);

  function dispose() {
    if (disposed) return;
    hide();
    disposed = true;
    observer?.disconnect();
    media?.removeEventListener?.('change', onMotion);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    for (const slot of queries) gl.deleteQuery(slot.q);
    geometry.dispose(); surface.dispose(); regionTex.dispose(); edgeTex.dispose(); relief?.dispose();
    releaseRasters(size);
    quad.dispose(); bakeTerrain.dispose(); bakeColour.dispose(); bakeUniforms.uNoise.value.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  function debug() {
    const info = renderer.info.render;
    return {
      house: s.house, step: s.step, target: s.target, mission: s.mission, view: s.view, shown: s.shown, zooming: !!zoom,
      zoomProgress: zoom ? +Math.min(1, (performance.now() / 1000 - zoom.start) / zoom.seconds).toFixed(3) : null,
      conquering: floods ? floods.items.map((it) => it.id) : [], reducedMotion: still.value, quality, lost, frames,
      size: [view.w, view.h], pixelRatio: renderer.getPixelRatio(), textures: size, segments: detail.seg, rasterMs, rastersHeld: heldRasters(), bakeMs,
      camera: { x: +at.x?.toFixed(3), y: +at.y?.toFixed(3), z: +at.z?.toFixed(3), tx: +pose.tx?.toFixed(3), tz: +pose.tz?.toFixed(3), dist: +pose.dist?.toFixed(3) },
      draws: info.calls, triangles: info.triangles, frameMs: frameMs.stats(), gpuMs: gpuMs.stats(),
      resetTimes() { frameMs.reset(); gpuMs.reset(); },
    };
  }

  resize();
  prepare();
  return { canvas, ready, show, hide, zoomTo, conquer, resize, setInset, dispose, debug };
}
