// The in-game menu (src/ui/game-menu.js): while it is open it has the keyboard — the rest of the battle's
// interface is set inert, so Tab cannot reach a sidebar or panel button behind the pause.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, FakeEl } from './campaign-dom.mjs';

const body = installDom();
const { GameMenu } = await import('../src/ui/game-menu.js');

/** A #ui container holding the battle's interface (a sidebar, a selection panel) and the menu. */
function battle() {
  const root = new FakeEl('div');
  body.appendChild(root);
  const sidebar = root.appendChild(new FakeEl('div')), panel = root.appendChild(new FakeEl('div'));
  let closed = 0;
  const menu = new GameMenu(root, { settings: {}, onClose: () => { closed++; }, onRestart() {}, onQuit() {} });
  return { root, sidebar, panel, menu, closes: () => closed };
}

test('while the game menu is open the rest of the interface is inert, and it is live again once the menu closes', () => {
  const { sidebar, panel, menu } = battle();
  menu.open();
  assert.equal(sidebar.inert, true, 'the sidebar cannot be tabbed into');
  assert.equal(panel.inert, true, 'nor the selection panel');
  assert.ok(!menu.el.inert, 'the menu itself stays live');
  menu.close();
  assert.ok(!sidebar.inert && !panel.inert, 'closing gives the battle its keyboard back');
});

test('opening the game menu twice, going to another page and closing it twice leaves the interface exactly as it was', () => {
  const { sidebar, panel, menu } = battle();
  panel.inert = true;   // something else had already made this one inert; the menu must not lift that on close
  menu.open();
  menu.show('restart');
  menu.open();
  assert.equal(panel.inert, true);
  menu.close();
  menu.close();   // close without an open menu does nothing
  assert.ok(!sidebar.inert, 'the sidebar is live again');
  assert.equal(panel.inert, true, 'what was inert before the menu stays inert');
});

test('closing a game menu that was never opened touches nothing', () => {
  const { sidebar, menu, closes } = battle();
  menu.close();
  assert.ok(!sidebar.inert);
  assert.equal(closes(), 0);
});
