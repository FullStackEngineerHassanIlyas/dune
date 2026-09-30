// The main menu hosts each battle in a frame, so full screen survives from the menu to the battle
// and back, and quitting throws the whole battle away. A battle opened on its own reloads the menu.
export function inShell(win = globalThis.window) {
  try { return win.parent !== win && !!win.parent.__duneShell; } catch { return false; }
}

export function quitToMenu(win = globalThis.window) {
  if (inShell(win)) win.parent.postMessage({ dune: 'quit' }, win.location.origin);
  else win.location.href = win.location.pathname;
}
