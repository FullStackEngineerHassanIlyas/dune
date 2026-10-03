// The soundtrack without an AudioWorklet (spec §6 Music; a page served over plain http on a LAN has none): the same
// FM mixer in a worker thread, rendering ahead in small blocks only when the page asks for them, so the page can
// keep a fraction of a second queued and a suspended context (the game paused) simply stops asking. The VGM player
// (vgm-deck.js, the player's own Mega Drive files) is loaded the first time a VGM is registered; what arrives
// meanwhile waits for it, in order.
import { MusicMixer, BLOCK } from './mixer.js';

let mixer = null;
let loading = null;      // the VGM player on its way: messages queue behind it
const waiting = [];

function handle(data) {
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
}

self.onmessage = ({ data }) => {
  if (data.cmd === 'vgm' && !loading && !globalThis.duneVgmDeck) {
    loading = import('./vgm-deck.js').then((m) => { globalThis.duneVgmDeck = m.VgmDeck; }, (err) => console.warn('music: no VGM player:', err))
      .finally(() => { for (const d of waiting.splice(0)) handle(d); loading = 'done'; });
  }
  if (loading && loading !== 'done') waiting.push(data);
  else handle(data);
};
