// Renders the sound bank off the main thread (spec §6: effects rendered once at start): the engine sends
// the [id, variation] list in the order it wants them, and each one comes back as soon as it is done,
// its samples transferred rather than copied; the reverb's impulse comes back partway through. Nothing
// here touches the page, so a slow laptop keeps its frame rate while the sounds are made.
import { render, reverbImpulse } from './synth.js';

self.onmessage = ({ data }) => {
  data.todo.forEach(([id, v], k) => {
    const samples = render(id, v);
    self.postMessage({ id, v, samples }, [samples.buffer]);
    if (k === data.reverb?.after) {   // the reverb's impulse, for the rate the engine expects its context to run at
      const channels = reverbImpulse(data.reverb.rate);
      self.postMessage({ reverb: channels, rate: data.reverb.rate }, channels.map((c) => c.buffer));
    }
  });
  self.postMessage({ done: true });
  self.close();
};
