// Message bar at the top of the battlefield (Dune II style) for announcer and status text. A held
// message (the pause notice) stays underneath passing ones and returns when they fade. A campaign mission
// adds its objective line just below (game/mission.js hudLine): a slot of its own, so pausing, resuming and
// passing messages never wipe it.
const OBJECTIVE_STYLE = 'position: absolute; top: 46px; left: calc((100% - var(--sidebar-w, 0px)) / 2); transform: translateX(-50%); max-width: 60vw;'
  + ' padding: 3px 14px; box-sizing: border-box; background: rgba(22, 14, 6, .62); border: 1px solid rgba(184, 137, 58, .55); border-radius: 3px;'
  + ' color: #ecd9a8; font: 13px/1.35 "Trebuchet MS", sans-serif; letter-spacing: .02em; text-align: center; white-space: nowrap; overflow: hidden;'
  + ' text-overflow: ellipsis; text-shadow: 0 1px 2px #000; pointer-events: none; z-index: 4;';

export class Hud {
  constructor(root, doc = document) {
    this.root = root;
    this.doc = doc;
    this.el = doc.createElement('div');
    this.el.className = 'message-bar';
    root.appendChild(this.el);
    this.timer = 0;
    this.held = null;
    this.goal = null;   // the objective line, made on first use
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

  /** The mission's objective line; null or '' hides it. Cheap to call every frame: it writes only what changed. */
  objective(text) {
    if (!text && !this.goal) return;
    if (!this.goal) {
      this.goal = this.doc.createElement('div');
      this.goal.className = 'objective-line';
      this.goal.style.cssText = OBJECTIVE_STYLE;
      this.goal.setAttribute?.('role', 'status');
      this.root.appendChild(this.goal);
    }
    const shown = text || '';
    if (this.goal.textContent !== shown) this.goal.textContent = shown;
    const display = shown ? '' : 'none';
    if (this.goal.style.display !== display) this.goal.style.display = display;
  }

  update(dt) {
    if (this.timer > 0 && (this.timer -= dt) > 0) return;
    this.timer = 0;
    if (this.held) { if (this.el.textContent !== this.held) this.el.textContent = this.held; this.el.classList.add('show'); }
    else this.el.classList.remove('show');
  }
}
