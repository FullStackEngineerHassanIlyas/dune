// Renders the sound bank off the main thread (spec §6: effects rendered once at start): the engine sends
// the [id, variation] list in the order it wants them, and each one comes back as soon as it is done,
// its samples transferred rather than copied. Nothing here touches the page, so a slow laptop keeps
// its frame rate while the sounds are made.
import { render } from './synth.js';

self.onmessage = ({ data }) => {
  for (const [id, v] of data.todo) {
    const samples = render(id, v);
    self.postMessage({ id, v, samples }, [samples.buffer]);
  }
  self.postMessage({ done: true });
  self.close();
};
