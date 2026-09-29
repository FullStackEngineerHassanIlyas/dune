// Message bar at the top of the battlefield (Dune II style) for announcer and status text. A held
// message (the pause notice) stays underneath passing ones and returns when they fade.
export class Hud {
  constructor(root, doc = document) {
    this.el = doc.createElement('div');
    this.el.className = 'message-bar';
    root.appendChild(this.el);
    this.timer = 0;
    this.held = null;
  }

  message(text, seconds = 4) {
    this.el.textContent = text;
    this.el.classList.add('show');
    this.timer = seconds;
  }

  hold(text) {
    this.held = text;
    if (this.timer <= 0) { this.el.textContent = text; this.el.classList.add('show'); }
  }

  release() { this.held = null; }

  update(dt) {
    if (this.timer > 0 && (this.timer -= dt) > 0) return;
    this.timer = 0;
    if (this.held) { if (this.el.textContent !== this.held) this.el.textContent = this.held; this.el.classList.add('show'); }
    else this.el.classList.remove('show');
  }
}
