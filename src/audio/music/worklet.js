// The soundtrack's AudioWorklet (spec §6 Music): the FM mixer (mixer.js) runs on the audio thread itself, 128 samples
// at a time, so the music never waits on a busy main thread and holds exactly where it is when the context is
// suspended (the game paused, a hidden tab). Commands arrive on the port; the mixer's events, and now and then how
// much of the audio thread it takes, go back on it. Idle — nothing queued, or the game muted — it costs one check per block.
import { MusicMixer } from './mixer.js';

const REPORT = 1500;   // blocks between load reports (4 s at 48 kHz)

class MusicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.alive = true;
    this.mixer = new MusicMixer({ rate: sampleRate, onEvent: (e) => this.port.postMessage(e) });
    this.port.onmessage = ({ data }) => {
      if (data.cmd === 'dispose') this.alive = false;
      else this.mixer.command(data);
    };
    this.blocks = 0;
    this.busy = 0;   // ms spent rendering over the last REPORT blocks
  }

  process(inputs, outputs) {
    if (!this.alive) return false;
    if (!this.mixer.active) return true;
    const out = outputs[0], L = out[0], R = out[1] ?? out[0], t0 = Date.now();
    this.mixer.render(L, R, L.length);
    this.busy += Date.now() - t0;   // a millisecond clock, but averaged over many blocks its rounding cancels out
    if (++this.blocks >= REPORT) {
      const seconds = (this.blocks * L.length) / sampleRate;
      this.port.postMessage({ type: 'load', share: this.busy / 1000 / seconds });
      this.blocks = 0;
      this.busy = 0;
    }
    return true;
  }
}

registerProcessor('dune-music', MusicProcessor);
