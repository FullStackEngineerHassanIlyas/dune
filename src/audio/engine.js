// Web Audio sound engine (spec §6, §9): one AudioContext opened by the first click or key press (browser
// autoplay rules), every synthesized effect turned into an AudioBuffer once, and play(id, {x, z}) with
// stereo pan and distance attenuation relative to the camera, a per-sound voice limit and a global cap.
// Without Web Audio — or if it fails to start — the engine stays silent and never throws.
import { RECIPES, RATE, render } from './synth.js';

export const MAX_VOICES = 24;
export const VOICE_LIMITS = { rifle: 5, mg: 5, cannon: 4, heavyCannon: 3, rocket: 4, hit: 4, explosionSmall: 4, explosionMedium: 3, explosionLarge: 2, crush: 2, click: 3 };
const DEFAULT_LIMIT = 2;

/** Pan and gain for a sound at (x, z) heard from a camera looking at (listener.x, listener.z). */
export function spatial(listener, x, z) {
  const dx = x - listener.x, dz = z - listener.z;
  const d = Math.hypot(dx, dz), near = listener.range * 0.6, far = listener.range * 2;
  const gain = d <= near ? 1 : d >= far ? 0 : 1 - (d - near) / (far - near);
  const side = dx * listener.rightX + dz * listener.rightZ;
  return { pan: Math.max(-1, Math.min(1, side / (listener.range * 0.8))) || 0, gain };
}

export class VoiceLimiter {
  constructor(limits = VOICE_LIMITS, max = MAX_VOICES) {
    this.limits = limits;
    this.max = max;
    this.counts = new Map();
    this.total = 0;
  }

  tryStart(id) {
    const n = this.counts.get(id) ?? 0;
    if (this.total >= this.max || n >= (this.limits[id] ?? DEFAULT_LIMIT)) return false;
    this.counts.set(id, n + 1);
    this.total++;
    return true;
  }

  end(id) {
    const n = this.counts.get(id) ?? 0;
    if (n <= 0) return;
    this.counts.set(id, n - 1);
    this.total--;
  }
}

export class SoundEngine {
  constructor({ enabled = true, volume = 0.8, win = globalThis.window } = {}) {
    this.win = win ?? {};
    this.available = typeof (this.win.AudioContext ?? this.win.webkitAudioContext) === 'function';
    this.enabled = enabled && this.available;
    this.volume = volume;
    this.muted = !enabled;
    this.ctx = null;
    this.master = null;
    this.buffers = new Map();
    this.limiter = new VoiceLimiter();
    this.listener = { x: 0, z: 0, rightX: 1, rightZ: 0, range: 16 };
    if (this.enabled) {
      const unlock = () => this.unlock();
      this.win.addEventListener('pointerdown', unlock, { once: true });
      this.win.addEventListener('keydown', unlock, { once: true });
    }
  }

  unlock() {
    if (this.ctx || !this.enabled) return;
    try {
      const Context = this.win.AudioContext ?? this.win.webkitAudioContext;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      for (const id of Object.keys(RECIPES)) {
        const data = render(id);
        const buffer = this.ctx.createBuffer(1, data.length, RATE);
        buffer.copyToChannel(data, 0);
        this.buffers.set(id, buffer);
      }
      this.ctx.resume?.();
    } catch (err) {
      console.warn('sound disabled:', err);
      this.enabled = false;
      this.ctx = null;
    }
  }

  setListener(x, z, rightX, rightZ, range) {
    const l = this.listener, n = Math.hypot(rightX, rightZ) || 1;
    l.x = x;
    l.z = z;
    l.rightX = rightX / n;
    l.rightZ = rightZ / n;
    l.range = Math.max(4, range);
  }

  play(id, { x = null, z = null, volume = 1, rate = 1 } = {}) {
    if (!this.ctx || this.muted) return false;
    const buffer = this.buffers.get(id);
    if (!buffer) return false;
    let pan = 0, gain = volume;
    if (x !== null && z !== null) {
      const s = spatial(this.listener, x, z);
      if (s.gain < 0.03) return false;
      pan = s.pan;
      gain *= s.gain;
    }
    if (!this.limiter.tryStart(id)) return false;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = pan;
        g.connect(p);
        p.connect(this.master);
      } else g.connect(this.master);
      src.onended = () => this.limiter.end(id);
      src.start();
      return true;
    } catch {
      this.limiter.end(id);
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}
