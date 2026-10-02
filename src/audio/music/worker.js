// The soundtrack without an AudioWorklet (spec §6 Music; a page served over plain http on a LAN has none): the same
// FM mixer in a worker thread, rendering ahead in small blocks only when the page asks for them, so the page can
// keep a fraction of a second queued and a suspended context (the game paused) simply stops asking.
import { MusicMixer, BLOCK } from './mixer.js';

let mixer = null;

self.onmessage = ({ data }) => {
  if (data.init) { mixer = new MusicMixer({ rate: data.rate, onEvent: (e) => self.postMessage({ event: e }) }); return; }
  if (!mixer) return;
  if (data.want) {
    for (let i = 0; i < data.want && mixer.active; i++) {
      const L = new Float32Array(BLOCK), R = new Float32Array(BLOCK);
      mixer.render(L, R, BLOCK);
      self.postMessage({ L, R }, [L.buffer, R.buffer]);
    }
    self.postMessage({ done: true });
    return;
  }
  mixer.command(data);
};
