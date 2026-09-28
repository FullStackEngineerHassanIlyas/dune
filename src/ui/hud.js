// Message bar at the top of the battlefield (Dune II style) for announcer and status text.
export class Hud {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'message-bar';
    root.appendChild(this.el);
    this.timer = 0;
  }
  message(text, seconds = 4) {
    this.el.textContent = text;
    this.el.classList.add('show');
    this.timer = seconds;
  }
  update(dt) {
    if (this.timer > 0 && (this.timer -= dt) <= 0) this.el.classList.remove('show');
  }
}
