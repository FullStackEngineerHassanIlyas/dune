// Player settings: defaults ← localStorage ← URL overrides. Only whitelisted keys and values survive.
const KEY = 'dune2-3d.settings';
export const DEFAULTS = { quality: 'medium', scheme: 'classic', edgeScroll: true, rightDragScroll: true, scrollSpeed: 1, healthBars: 'selected', gameSpeed: 'normal', sound: true, volume: 0.8 };
const CHOICES = {
  quality: ['low', 'medium', 'high'],
  scheme: ['classic', 'modern'],
  healthBars: ['selected', 'damaged', 'always'],
  gameSpeed: ['slowest', 'slow', 'normal', 'fast', 'fastest'],
};

export function sanitize(obj) {
  const out = { ...DEFAULTS };
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (!(k in DEFAULTS)) continue;
    if (CHOICES[k]) { if (CHOICES[k].includes(v)) out[k] = v; }
    else if (typeof DEFAULTS[k] === 'boolean') out[k] = v === true || v === 'true' || v === '1';
    else if (typeof DEFAULTS[k] === 'number') { const n = Number(v); if (Number.isFinite(n) && n > 0 && n <= 4) out[k] = n; }
  }
  return out;
}

// Reading localStorage itself throws (SecurityError) when the browser blocks site data.
function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function loadSettings(params, storage = defaultStorage()) {
  let stored = {};
  try { stored = JSON.parse(storage?.getItem(KEY) ?? '{}') ?? {}; } catch { stored = {}; }
  const merged = { ...stored };
  if (params) for (const k of Object.keys(DEFAULTS)) { const v = params.str(k); if (v !== null) merged[k] = v; }
  return sanitize(merged);
}

export function saveSettings(settings, storage = defaultStorage()) {
  try { storage?.setItem(KEY, JSON.stringify(sanitize(settings))); } catch { /* private mode: keep for this session only */ }
}
