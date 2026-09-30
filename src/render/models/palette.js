// Shared colours (sRGB hex). HOUSE parts are white in the geometry and get the house colour per instance
// (a grey vertex colour on a HOUSE part gives a darker shade of the house colour).
export const PAL = {
  sand: 0xb88f58, sandDark: 0x8d6d44, sandLight: 0xcfb07c,
  steel: 0x9aa1a8, steelDark: 0x4f555c, gunmetal: 0x383c42,
  rubber: 0x2a2623, glass: 0x1d3446, white: 0xe8e4dc, offWhite: 0xcac3b6,
  brass: 0xc8963c, gold: 0xe3b24c, rocketRed: 0xd6392a, yellow: 0xd9a52e,
  concrete: 0x9d998f, concreteDark: 0x76726a,
  olive: 0x7d7a52, oliveDark: 0x5c5a3c, adobe: 0xb58a5c, adobeDark: 0x8e6843, beige: 0xcbb896,
  cloth: 0x8c6d4b, clothDark: 0x5b4632, mask: 0x3a3936,
  orangeGlow: 0xff8c2e, greenGlow: 0x7dff8e, redGlow: 0xff4a36, blueGlow: 0x88d8ff,
  // Genesis structure palette (docs/research/raw/visual-structures.md §1.2, darkened a little for the lit
  // 3D scene): olive concrete plates with khaki bevelled rims, lavender machinery with navy recesses and
  // white highlights, orange grilles, the Wind Traps' red-brick floors and gold cowls, amber pad lights.
  slab: 0x4c4c28, slabRim: 0x9c9c7a, slabSeam: 0x262610,
  machine: 0x6c6d92, machineLight: 0x9d9fbb, machineDark: 0x43445f, navy: 0x20204a, navyLight: 0x35356a,
  grille: 0xde6b00, grilleDark: 0xb52100, brick: 0x55281f, brickDark: 0x2a0c08, mortar: 0xc9a262,
  goldDark: 0x944a00, amber: 0xe0a000, brassDark: 0x886622, crate: 0x944a00,
};

// Genesis house ramps (docs/research/raw/visual-units.md §1.3), eased for the lit 3D scene: shadow, body
// and highlight tones. The highlight shifts hue (blue → cyan, red → amber, green → lime) as the sprites'
// does. The HOUSE material paints with the ramp of the house whose colour an instance carries.
export const HOUSE_RAMP = {
  atreides: [0x0b1f66, 0x1f5ee0, 0x2ee6ff],
  harkonnen: [0x420a08, 0xb81810, 0xffa81c],
  ordos: [0x0d420f, 0x22a82e, 0xbfe01c],
  fremen: [0x4e3818, 0xa8834a, 0xf0d596],
  sardaukar: [0x2c0c48, 0x5e22b0, 0xb060ff],
};

