// End of a skirmish (spec §4.11, §7): "Mission accomplished", "Mission failed" or a draw, the player's
// statistics against everyone else, the game time, and buttons to play again, keep watching or go
// back to the main menu.
export const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class EndScreen {
  constructor(root, { onReplay, onMenu = null }) {
    this.hasMenu = !!onMenu;
    this.el = document.createElement('div');
    this.el.className = 'end-screen';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'replay') onReplay();
      else if (act === 'close') this.hide();
      else if (act === 'menu') onMenu?.();
    });
  }

  show(stats) {
    const box = document.createElement('div');
    box.className = 'end-box';
    const title = document.createElement('h2');
    title.textContent = stats.draw ? 'Draw' : stats.won ? 'Mission accomplished' : 'Mission failed';
    title.className = stats.won ? 'won' : 'lost';
    const table = document.createElement('table');
    const head = table.insertRow();
    for (const text of ['', 'You', 'Enemy']) { const th = document.createElement('th'); th.textContent = text; head.appendChild(th); }
    for (const r of stats.rows) {
      const tr = table.insertRow();
      for (const text of [r.label, r.you, r.enemy]) tr.insertCell().textContent = String(text);
    }
    const time = document.createElement('p');
    time.textContent = `Game time ${formatTime(stats.seconds)}`;
    const buttons = document.createElement('div');
    buttons.className = 'end-buttons';
    for (const [act, text] of [['replay', 'Play again'], ['close', 'Keep watching'], ...(this.hasMenu ? [['menu', 'Main menu']] : [])]) {
      const b = document.createElement('button');
      b.dataset.act = act;
      b.textContent = text;
      buttons.appendChild(b);
    }
    box.append(title, table, time, buttons);
    this.el.replaceChildren(box);
    this.el.classList.add('show');
  }

  hide() { this.el.classList.remove('show'); }
}
