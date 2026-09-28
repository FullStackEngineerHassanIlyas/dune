// Keyboard → controller hotkeys. Arrow keys belong to the camera control. Browsers may reserve
// Ctrl+digit for tab switching, so Ctrl+Shift+digit also assigns a group (see README).
export class Keyboard {
  constructor(onKey) {
    this.handler = (e) => {
      if (e.target instanceof HTMLInputElement || e.key.startsWith('Arrow')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (onKey(key, e.code, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, repeat: e.repeat })) e.preventDefault();
    };
    window.addEventListener('keydown', this.handler);
  }
  dispose() { window.removeEventListener('keydown', this.handler); }
}
