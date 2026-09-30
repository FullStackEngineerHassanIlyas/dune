// Infantry, after the Genesis sprites: small figures painted in the house colour — helmet and armour
// in the house ramp, legs a step darker, black boots, a dark visor. The Soldier carries a lavender
// rifle with a white muzzle across his body and a pack on his back; the Trooper is bulkier, with
// domed helmet and pauldrons, and shoulders the long white launcher tube that is his Genesis cue.
// The Fremen are Trooper-class figures in their sand house tint with a hood over a dark stillsuit
// mask and a short cloak. The Ordos Saboteur is slim and dark: hooded, crouched in a run, pistol in
// hand and a bright satchel charge on his hip. Squads draw three figures; legs swing on legL / legR.
import * as THREE from 'three';
import { ModelBuilder, MAT, shape, box, cbox, cyl, sphere, torus, hull, place } from '../kit.js';
import { PAL } from '../palette.js';
import { rod } from '../detail.js';

const LAV = PAL.machineLight, LAV_DARK = PAL.machine, BOOT = 0x14141e, VISOR = 0x0e1224, TUBE = 0xd6d6de;
const along = [0, 0, -Math.PI / 2];
const grey = (k) => new THREE.Color(k, k, k).getHex();

/** Tapered block through two cross-sections: [y, halfX, halfZ, dx] at the bottom and the top. */
const taper = ([y0, x0, z0, d0 = 0], [y1, x1, z1, d1 = 0], o) => hull([
  [d0 - x0, y0, -z0], [d0 + x0, y0, -z0], [d0 - x0, y0, z0], [d0 + x0, y0, z0],
  [d1 - x1, y1, -z1], [d1 + x1, y1, -z1], [d1 - x1, y1, z1], [d1 + x1, y1, z1],
], o);

/** A band of a sphere (visors, hoods): phi centred on +x spanning `wide`, theta (from the top) between t0 and t1. */
const band = (r, wide, t0, t1, o, seg = 10) => shape(new THREE.SphereGeometry(r, seg, 3, Math.PI - wide / 2, wide, t0, t1 - t0), o);

const STYLES = {
  soldier: { k: 1, hip: 0.115, lean: 0, suit: 1, legs: 0.62, gear: 'rifle', head: 'helmet', pack: true },
  trooper: { k: 1.1, hip: 0.112, lean: 0, suit: 1, legs: 0.62, gear: 'tube', head: 'dome', pack: true, pads: true },
  fremen: { k: 1.06, hip: 0.112, lean: 0, suit: 0.95, legs: 0.6, gear: 'tube', head: 'hood', cloak: true },
  saboteur: { k: 0.94, hip: 0.1, lean: -0.34, suit: 0.2, belt: 0.9, legs: 0.2, gear: 'pistol', head: 'cowl', slim: true, satchel: true },
};

function figure(name, style) {
  const { k, hip: H, lean, suit, belt = suit * 0.55, legs, gear, head, pack, pads, cloak, slim, satchel } = STYLES[style];
  const b = new ModelBuilder(name);
  const SUIT = { color: grey(suit) }, DARKER = { color: grey(suit * 0.62) }, LEG = { color: grey(legs) };

  // legs: house thigh and shin (bent in the Saboteur's crouch), black boot
  for (const [node, s] of [['legL', -1], ['legR', 1]]) {
    b.node(node, { pivot: [0, H, s * 0.024 * k], axis: 'z' });
    const w = (slim ? 0.016 : 0.019) * k, knee = slim ? [0.03, -0.055] : [0.004, -0.058];
    b.add(MAT.HOUSE, hull([[-w, 0.004, -w], [w, 0.004, -w], [-w, 0.004, w], [w, 0.004, w], [knee[0] - w * 0.85, knee[1], -w * 0.9], [knee[0] + w * 0.85, knee[1], -w * 0.9], [knee[0] - w * 0.85, knee[1], w * 0.9], [knee[0] + w * 0.85, knee[1], w * 0.9]], LEG), node);
    b.add(MAT.HOUSE, hull([[knee[0] - w * 0.85, knee[1] + 0.004, -w * 0.9], [knee[0] + w * 0.85, knee[1] + 0.004, -w * 0.9], [knee[0] - w * 0.85, knee[1] + 0.004, w * 0.9], [knee[0] + w * 0.85, knee[1] + 0.004, w * 0.9],
      [-w * 0.75, -H + 0.022, -w * 0.8], [w * 0.75, -H + 0.022, -w * 0.8], [-w * 0.75, -H + 0.022, w * 0.8], [w * 0.75, -H + 0.022, w * 0.8]], LEG), node);
    if (pads) b.add(MAT.HOUSE, box(0.014, 0.022, w * 2.1, { p: [knee[0] + w * 0.8, knee[1], 0], color: grey(0.85) }), node);
    b.add(MAT.DARK, taper([-H, 0.026 * k, 0.017 * k, 0.009], [-H + 0.028, 0.02 * k, 0.015 * k, 0.004], { color: BOOT }), node);
  }

  // upper body, built from the hip up and leaned forward as a whole
  const up = [];
  const U = (mat, geo) => up.push([mat, geo]);
  const sx = k * (pads ? 1.12 : slim ? 0.86 : 1), sz = k * (pads ? 1.14 : slim ? 0.8 : 1);
  U(MAT.HOUSE, box(0.05 * sx, 0.024, 0.078 * sz, { p: [0, 0.006, 0], color: grey(belt) }));
  U(MAT.HOUSE, taper([0.012, 0.022 * sx, 0.035 * sz, 0.002], [0.066, 0.03 * sx, 0.05 * sz, 0.004], SUIT));
  U(MAT.HOUSE, taper([0.066, 0.03 * sx, 0.05 * sz, 0.004], [0.09, 0.022 * sx, 0.04 * sz, 0], SUIT));
  U(MAT.HOUSE, taper([0.035, 0.006, 0.026 * sz, 0.03 * sx], [0.075, 0.006, 0.03 * sz, 0.035 * sx], { color: grey(suit * 1.15) }));   // chest plate
  const sh = 0.052 * sz, sy = 0.082;
  if (pads) for (const s of [-1, 1]) U(MAT.HOUSE, sphere(0.03 * k, 8, { p: [0, sy + 0.004, s * sh], s: [1, 0.8, 1] }));
  else for (const s of [-1, 1]) U(MAT.HOUSE, sphere(0.02 * k, 6, { p: [0, sy, s * sh], ...SUIT }));
  U(MAT.HOUSE, cyl(0.013, 0.015, 0.02, 6, { p: [0.002, 0.098, 0], ...DARKER }));
  if (pack) {
    U(MAT.HOUSE, taper([0.026, 0.017, 0.032 * sz, -0.045 * sx], [0.086, 0.015, 0.03 * sz, -0.043 * sx], DARKER));
    U(MAT.HOUSE, cyl(0.012, 0.012, 0.07 * sz, 6, { p: [-0.045 * sx, 0.093, 0], r: [Math.PI / 2, 0, 0], color: grey(suit * 0.45) }));
  }
  if (cloak) U(MAT.HOUSE, hull([[-0.03, 0.092, -0.036], [-0.03, 0.092, 0.036], [0.004, 0.086, -0.056], [0.004, 0.086, 0.056], [-0.036, 0.07, -0.058], [-0.036, 0.07, 0.058],
    [-0.066, -0.056, -0.05], [-0.066, -0.056, 0.05], [-0.024, -0.05, -0.07], [-0.024, -0.05, 0.07], [-0.048, -0.062, 0]], { color: grey(0.62) }));
  if (satchel) {
    U(MAT.PAINT, cbox(0.04, 0.034, 0.026, 0.006, { p: [0.004, 0.012, -0.05], color: PAL.yellow }));
    U(MAT.PAINT, cyl(0.006, 0.006, 0.012, 6, { p: [0.014, 0.034, -0.05], color: PAL.rocketRed }));
    U(MAT.DARK, hull([[-0.024, 0.09, 0.03], [-0.02, 0.094, 0.03], [0.03, 0.06, 0.012], [0.03, 0.056, 0.012], [0.02, 0.02, -0.046], [0.024, 0.024, -0.046]], { color: BOOT }));
  }

  // head: helmet with brim and visor, trooper dome, Fremen hood over a dark mask, Saboteur cowl
  const hy = 0.122 + (pads ? 0.004 : 0), hr = (head === 'dome' ? 0.037 : 0.033) * k;
  const hood = head === 'hood' || head === 'cowl';
  U(hood ? MAT.DARK : MAT.HOUSE, sphere(hr, 10, { p: [0.003, hy, 0], s: [1.05, 0.95, 1], color: hood ? VISOR : 0xffffff }));
  if (head === 'helmet') U(MAT.HOUSE, torus(hr * 1.02, 0.005, 3, 10, { p: [0.003, hy - 0.006, 0], r: [Math.PI / 2, 0, 0], color: grey(0.8) }));
  if (!hood) U(MAT.DARK, band(hr * 1.04, head === 'dome' ? 2.2 : 1.9, 1.35, 1.75, { p: [0.003, hy, 0], s: [1.05, 0.95, 1], color: VISOR }));
  if (hood) {
    U(MAT.HOUSE, band(hr * 1.14, Math.PI * 2 - (head === 'cowl' ? 2.1 : 1.6), 0, 2.3, { p: [-0.002, hy + 0.002, 0], r: [0, Math.PI, 0], color: grey(head === 'cowl' ? suit * 1.4 : 0.85) }, 14));
    U(MAT.HOUSE, hull([[-0.03, hy + 0.02, 0], [-0.052, hy - 0.004, 0], [-0.02, hy - 0.02, -0.02], [-0.02, hy - 0.02, 0.02], [-0.02, hy + 0.025, -0.012], [-0.02, hy + 0.025, 0.012]], { color: grey(head === 'cowl' ? suit : 0.72) }));
    if (head === 'hood') for (const s of [-1, 1]) U(MAT.PAINT, sphere(0.005, 5, { p: [hr * 1.02, hy + 0.004, s * 0.012], color: 0x3c8cff }));
  }

  // arms and weapon
  const arm = (pts, color) => {
    for (let i = 0; i < pts.length - 1; i++) U(MAT.HOUSE, rod(pts[i], pts[i + 1], 0.012 * k, 5, { color }));
    U(MAT.DARK, sphere(0.012 * k, 6, { p: pts[pts.length - 1], color: BOOT }));
  };
  let muzzle;
  if (gear === 'rifle') {
    arm([[0, sy, sh + 0.004], [0.01, 0.036, sh + 0.008], [0.05, 0.034, 0.012]], grey(suit * 0.9));
    arm([[0, sy, -sh - 0.004], [0.036, 0.048, -sh - 0.004], [0.094, 0.044, -0.004]], grey(suit * 0.9));
    const gun = [
      [MAT.METAL, box(0.11, 0.019, 0.014, { p: [0.045, 0.04, 0], color: 0xb8b8d0 })],
      [MAT.METAL, box(0.036, 0.024, 0.012, { p: [-0.024, 0.034, 0], color: LAV_DARK })],
      [MAT.METAL, box(0.014, 0.028, 0.01, { p: [0.05, 0.02, 0], color: LAV_DARK })],
      [MAT.METAL, cyl(0.006, 0.006, 0.07, 6, { p: [0.135, 0.042, 0], r: along, color: 0xb8b8d0 })],
      [MAT.PAINT, cyl(0.0075, 0.0075, 0.016, 6, { p: [0.172, 0.042, 0], r: along, color: TUBE })],
    ];
    const a = 0.3;
    for (const [mat, g] of gun) U(mat, place(g, { p: [0, 0, 0.024], r: [0, a, 0] }));
    muzzle = [0.18 * Math.cos(a), 0.042, 0.024 - 0.18 * Math.sin(a)];
  } else if (gear === 'tube') {
    const ty = 0.1 + (pads ? 0.006 : 0), tz = sh + 0.012;
    U(MAT.PAINT, cyl(0.022, 0.022, 0.25, 8, { p: [0.03, ty, tz], r: along, color: TUBE }));
    for (const x of [0.16, -0.1]) U(MAT.METAL, cyl(0.026, 0.026, 0.02, 8, { p: [x, ty, tz], r: along, color: LAV }));
    U(MAT.DARK, cyl(0.017, 0.017, 0.004, 8, { p: [0.171, ty, tz], r: along, color: 0x08080e }));
    U(MAT.METAL, box(0.04, 0.034, 0.03, { p: [-0.09, ty - 0.024, tz], color: LAV_DARK }));
    U(MAT.METAL, box(0.03, 0.012, 0.008, { p: [0.05, ty + 0.026, tz - 0.012], color: LAV_DARK }));
    U(MAT.METAL, box(0.012, 0.03, 0.01, { p: [0.04, ty - 0.03, tz], color: LAV_DARK }));
    arm([[0, sy, sh + 0.004], [0.012, 0.04, sh + 0.018], [0.04, ty - 0.036, tz]], grey(suit * 0.9));
    arm([[0, sy, -sh - 0.004], [0.036, 0.045, -sh + 0.004], [0.095, ty - 0.022, tz - 0.02]], grey(suit * 0.9));
    muzzle = [0.173, ty, tz];
  } else {
    arm([[0, sy, sh], [0.03, 0.05, sh + 0.006], [0.07, 0.03, sh - 0.012]], grey(suit * 1.1));
    arm([[0, sy, -sh], [-0.03, 0.05, -sh - 0.004], [-0.05, 0.016, -sh + 0.004]], grey(suit * 1.1));
    U(MAT.METAL, box(0.05, 0.014, 0.01, { p: [0.09, 0.034, sh - 0.012], color: LAV_DARK }));
    U(MAT.METAL, box(0.012, 0.022, 0.009, { p: [0.072, 0.022, sh - 0.012], color: LAV_DARK }));
    muzzle = [0.115, 0.036, sh - 0.012];
  }

  const c = Math.cos(lean), s = Math.sin(lean);
  for (const [mat, geo] of up) b.add(mat, place(geo, { p: [0, H, 0], r: [0, 0, lean] }));
  const m = [muzzle[0] * c - muzzle[1] * s, H + muzzle[0] * s + muzzle[1] * c, muzzle[2]].map((v) => +v.toFixed(3));
  return b.build({ radius: 0.16 * k, muzzle: m });
}

export const soldier = () => figure('soldier', 'soldier');
export const trooper = () => figure('trooper', 'trooper');
export const saboteur = () => figure('saboteur', 'saboteur');
export const fremen = () => figure('fremen', 'fremen');
