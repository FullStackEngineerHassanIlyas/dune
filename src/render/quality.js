// Graphics presets (spec §8). pixelRatio is a cap on devicePixelRatio; terrainSub = terrain vertices per tile side.
export const QUALITY = {
  low:    { shadows: 0,    msaa: 0, fxaa: true,  bloom: false, particles: 1500, pixelRatio: 0.75, terrainSub: 3 },
  medium: { shadows: 1024, msaa: 0, fxaa: true,  bloom: true,  particles: 4000, pixelRatio: 1,    terrainSub: 4 },
  high:   { shadows: 2048, msaa: 4, fxaa: false, bloom: true,  particles: 8000, pixelRatio: 2,    terrainSub: 4 },
};

export function qualityPreset(name) { return QUALITY[name] ?? QUALITY.medium; }
