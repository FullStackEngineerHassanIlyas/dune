// Wraps a per-frame function: the first exception stops the loop and is reported once, so a bug
// shows an error screen instead of silently freezing the game (spec §9).
export function guardFrame(frame, onError) {
  let failed = false;
  return (...args) => {
    if (failed) return false;
    try {
      frame(...args);
      return true;
    } catch (err) {
      failed = true;
      onError(err);
      return false;
    }
  };
}
