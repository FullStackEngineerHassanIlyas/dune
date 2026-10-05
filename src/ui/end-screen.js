// End of a skirmish (spec §4.11, §7): "Mission accomplished", "Mission failed" or a draw, every house's
// statistics in a column of its own (the player's first, a house that fell marked with the time it fell), who
// fights on when the player is out of a free-for-all, the game time, and buttons to play again, keep watching
// or go back to the main menu. A campaign mission played on its own (no menu shell to take its result) names
// the mission under the heading and offers Play again (the same mission) and the main menu.
export const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** The table as text: one column per house with its colour and its note (you, winner, out at m:ss). */
export function endTable(stats) {
  const head = stats.houses.map((h) => ({ name: h.name, color: hex(h.color), note: [h.you && 'you', h.winner && 'winner', h.out !== null && `out ${formatTime(h.out)}`].filter(Boolean).join(' · ') }));
  return { head, rows: stats.rows.map((r) => [r.label, ...r.values.map(String)]) };
}

/** "Harkonnen and Ordos fight on." when the player fell while others still stand. */
export function fightOn(names) {
  if (!names?.length) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? 'fights' : 'fight'} on.`;
}

/** The heading, the line under it and the buttons ([act, label]) for a skirmish or, with `mission`, a mission. */
export function endLayout(stats, { mission = null, hasMenu = true } = {}) {
  const heading = stats.draw ? 'Draw' : stats.won ? 'Mission accomplished' : 'Mission failed';
  const menu = hasMenu ? [['menu', 'Main menu']] : [];
  const buttons = mission ? [['replay', 'Play again'], ...menu] : [['replay', 'Play again'], ['close', 'Keep watching'], ...menu];
  return { heading, subtitle: mission?.title ?? '', buttons };
}

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

  show(stats, { mission = null } = {}) {
    const layout = endLayout(stats, { mission, hasMenu: this.hasMenu });
    const el = (tag, text = '', css = '') => { const e = document.createElement(tag); if (text) e.textContent = text; if (css) e.style.cssText = css; return e; };
    const box = el('div', '', 'box-sizing: border-box; max-width: calc(100vw - 24px); overflow-x: auto;');   // four houses fit a phone by scrolling the table
    box.className = 'end-box';
    const title = el('h2', layout.heading);
    title.className = stats.won ? 'won' : 'lost';
    const { head, rows } = endTable(stats);
    const table = el('table');
    const top = table.insertRow();
    top.appendChild(el('th'));
    head.forEach((h, k) => {
      const th = el('th', '', `vertical-align: bottom;${k === 0 ? ' color: #ffd24a;' : ''}`);
      th.append(el('span', '', `display: inline-block; width: 10px; height: 10px; margin-right: 6px; border: 1px solid rgba(0,0,0,.6); background: ${h.color};`), h.name);
      if (h.note) th.append(el('small', h.note, 'display: block; font-weight: normal; font-size: 11px; color: #a88a5c;'));
      top.appendChild(th);
    });
    for (const r of rows) {
      const tr = table.insertRow();
      r.forEach((text, k) => { const td = tr.insertCell(); td.textContent = text; if (k === 1) td.style.color = '#ffe7a8'; });
    }
    const time = el('p', `Game time ${formatTime(stats.seconds)}`);
    const onward = !stats.won && !stats.draw ? fightOn(stats.standing) : '';
    const buttons = el('div');
    buttons.className = 'end-buttons';
    for (const [act, text] of layout.buttons) {
      const b = el('button', text);
      b.dataset.act = act;
      buttons.appendChild(b);
    }
    const subtitle = layout.subtitle ? [el('p', layout.subtitle, 'margin: -6px 0 12px; color: #e8cf95; font-style: italic;')] : [];
    box.append(title, ...subtitle, ...(onward ? [el('p', onward, 'margin: -4px 0 12px;')] : []), table, time, buttons);
    this.el.replaceChildren(box);
    this.el.classList.add('show');
  }

  hide() { this.el.classList.remove('show'); }
}
