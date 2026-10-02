// The controls screen (spec §5.7) for the chosen mouse scheme: every row of the spec's table, in the
// words of the scheme the player uses.
import { h } from './dom.js';

export function controlRows(scheme) {
  const classic = scheme !== 'modern';
  const order = classic ? 'Left click' : 'Right click';
  return [
    ['Scroll the map', 'Push the pointer against a screen edge (it keeps going past the edge) · hold the right button and pull · arrow keys · middle drag'],
    ['Zoom · rotate', 'Mouse wheel · Alt + middle drag · Home resets the view'],
    ['Select', 'Left click · left drag a box (Carryalls only when nothing else is in it) · Shift adds or removes · double click takes every visible unit of that type'],
    ['Move · attack · harvest', `${order} with units selected — the cursor shows what will happen`],
    ['Deploy · destruct', `${order} the selected MCV · D deploys an MCV, or blows up a Devastator`],
    ['Deselect', classic ? 'Right click (it cancels placement, Sell, Repair or aiming first)' : 'Left click on empty ground'],
    ['Force fire · force move', `Ctrl + click fires at the ground or a friend · Alt + ${classic ? 'click' : 'right click'} drives there, over enemy soldiers`],
    ['Attack-move · stop · guard · scatter', 'A, then click · S · G · X'],
    ['Carryall', `Select it, then ${order.toLowerCase()} an own vehicle to lift it, the ground to fly there or set the load down, the Repair Facility or a Refinery to deliver it · S holds it · G back to duty · D drops the load`],
    ['Control groups', 'Ctrl + 1–9 assigns (Ctrl + Shift + 1–9 if the browser keeps Ctrl + digit) · 1–9 selects · tap twice to centre'],
    ['Build', 'Sidebar icon: left click builds or places · right click holds, twice cancels · Shift + left click queues five'],
    ['Rally point · primary', `Select a factory, then ${order.toLowerCase()} the ground · double click a factory`],
    ['Centre on base · last alert', 'H or Home · Space'],
    ['Radar', classic ? 'Left click or drag jumps the camera; with units selected, a left click orders them there'
      : 'Left click or drag jumps the camera · right click orders the selection there, or moves a selected factory\'s rally point'],
    ['Menu · pause · sound', 'Esc or F10 · P · M'],
    ['Full screen', 'Alt + Enter · the ⛶ button (hold Esc to leave)'],
  ];
}

export function controlsTable(scheme) {
  return h('table', { class: 'dm-keys' }, h('tbody', {}, controlRows(scheme).map(([what, how]) => h('tr', {}, h('th', {}, what), h('td', {}, how)))));
}
