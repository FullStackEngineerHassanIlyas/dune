// The controls screen (spec §5.7) for the chosen mouse scheme.
import { h } from './dom.js';

export function controlRows(scheme) {
  const classic = scheme !== 'modern';
  const order = classic ? 'Left click' : 'Right click';
  return [
    ['Scroll the map', 'Push the pointer against a screen edge (it keeps going past the edge) · hold the right button and pull · arrow keys · middle drag'],
    ['Zoom · rotate', 'Mouse wheel · Alt + middle drag · Home resets the view'],
    ['Select', 'Left click · left drag a box · Shift adds or removes · double click takes every visible unit of that type'],
    ['Move · attack · harvest', `${order} with units selected — the cursor shows what will happen`],
    ['Deploy the MCV', classic ? 'Left click the selected MCV · D' : 'D'],
    ['Deselect', classic ? 'Right click' : 'Left click on empty ground'],
    ['Force fire · attack-move', 'Ctrl + click · A, then click'],
    ['Stop · guard · scatter', 'S · G · X'],
    ['Carryall', `Select it, then ${order.toLowerCase()} an own vehicle to lift it, the ground to fly there or set the load down, the Repair Facility or a Refinery to deliver it · S holds it · G back to duty · D drops the load`],
    ['Control groups', 'Ctrl + 1–9 assigns (Ctrl + Shift + 1–9 if the browser keeps Ctrl + digit) · 1–9 selects · tap twice to centre'],
    ['Build', 'Sidebar icon: left click builds or places · right click holds, twice cancels · Shift + left click queues five'],
    ['Rally point · primary', `Select a factory, then ${order.toLowerCase()} the ground · double click a factory`],
    ['Menu · pause · sound', 'Esc or F10 · P · M'],
    ['Full screen', 'Alt + Enter · the ⛶ button (hold Esc to leave)'],
  ];
}

export function controlsTable(scheme) {
  return h('table', { class: 'dm-keys' }, h('tbody', {}, controlRows(scheme).map(([what, how]) => h('tr', {}, h('th', {}, what), h('td', {}, how)))));
}
