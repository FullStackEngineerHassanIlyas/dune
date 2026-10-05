// Graphics presets (spec §8). shadows: the sun's shadow map size (0 = off); it is one map that follows the camera, so
// one cascade. shadowRadius: PCF blur in shadow texels (High's soft shadows). msaa: samples of the scene target, else
// fxaa. bloomRes: the bloom's first blur level against the frame (Medium half, High full). particles: the effect pools'
// budget. pixelRatio: a cap on devicePixelRatio. terrainSub: terrain vertices per tile side. flashLights: point lights
// lent to muzzle flashes and blasts.
export const QUALITY = {
  low:    { shadows: 0,    shadowCascades: 0, shadowRadius: 0, msaa: 0, fxaa: true,  bloom: false, bloomRes: 0,   particles: 1500, pixelRatio: 0.75, terrainSub: 3, flashLights: 0 },
  medium: { shadows: 1024, shadowCascades: 1, shadowRadius: 1, msaa: 0, fxaa: true,  bloom: true,  bloomRes: 0.5, particles: 4000, pixelRatio: 1,    terrainSub: 4, flashLights: 2 },
  high:   { shadows: 2048, shadowCascades: 1, shadowRadius: 3, msaa: 4, fxaa: false, bloom: true,  bloomRes: 1,   particles: 8000, pixelRatio: 2,    terrainSub: 4, flashLights: 4 },
};
/** Cheapest first. */
export const QUALITY_ORDER = ['low', 'medium', 'high'];

export function qualityPreset(name) { return QUALITY[name] ?? QUALITY.medium; }

/** The next cheaper preset, or null below Low (and for unknown names). */
export function lowerQuality(name) {
  const i = QUALITY_ORDER.indexOf(name);
  return i > 0 ? QUALITY_ORDER[i - 1] : null;
}

/** The drawing buffer's pixel ratio: the device's, capped by the preset (Low 0.75, Medium 1, High up to 2). */
export function pixelRatioFor(preset, dpr) { return Math.min(dpr > 0 ? dpr : 1, preset.pixelRatio); }

/** The size to hand UnrealBloomPass, which blurs from half of what it is given: twice bloomRes times the frame. */
export function bloomSize(preset, w, h) {
  const s = 2 * (preset.bloomRes || 0.5);
  return [Math.max(2, Math.round(w * s)), Math.max(2, Math.round(h * s))];
}

/** Large maps drop to three terrain vertices per tile side (spec §5.2). */
export function terrainSubFor(mapW, preset) { return mapW > 64 ? Math.min(3, preset.terrainSub) : preset.terrainSub; }
