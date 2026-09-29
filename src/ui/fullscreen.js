// Fullscreen for the whole game. The top page (the main menu, which hosts each battle in a frame)
// is what goes fullscreen, so the game stays fullscreen from the menu to the battle and back. In
// fullscreen the Escape key is kept for the game where the browser allows it: hold Esc to leave.
export function hostWindow(win = globalThis.window) {
  try { return win.top?.document ? win.top : win; } catch { return win; }   // a foreign top page: this frame alone
}

export const isFullscreen = (win) => !!hostWindow(win)?.document.fullscreenElement;
export const fullscreenAvailable = (win) => !!hostWindow(win)?.document.fullscreenEnabled;

export async function toggleFullscreen(win) {
  const host = hostWindow(win), doc = host.document;
  try {
    if (doc.fullscreenElement) {
      host.navigator.keyboard?.unlock?.();
      await doc.exitFullscreen();
    } else {
      await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
      await host.navigator.keyboard?.lock?.(['Escape']).catch(() => {});
    }
  } catch (err) {
    console.warn('fullscreen refused:', err.message);
  }
  return isFullscreen(win);
}

export function onFullscreenChange(fn, win) {
  const host = hostWindow(win);
  host.document.addEventListener('fullscreenchange', () => fn(isFullscreen(win)));
}
