// Graphics presets (spec §8). pixelRatio is a cap on devicePixelRatio; terrainSub = terrain vertices per tile side.
export const QUALITY = {
  low:    { shadows: 0,    msaa: 0, fxaa: true,  bloom: false, particles: 1500, pixelRatio: 0.75, terrainSub: 3, flashLights: 0 },
  medium: { shadows: 1024, msaa: 0, fxaa: true,  bloom: true,  particles: 4000, pixelRatio: 1,    terrainSub: 4, flashLights: 2 },
  high:   { shadows: 2048, msaa: 4, fxaa: false, bloom: true,  particles: 8000, pixelRatio: 2,    terrainSub: 4, flashLights: 4 },
};

export function qualityPreset(name) { return QUALITY[name] ?? QUALITY.medium; }

/** Large maps drop to three terrain vertices per tile side (spec §5.2). */
export function terrainSubFor(mapW, preset) { return mapW > 64 ? Math.min(3, preset.terrainSub) : preset.terrainSub; }
