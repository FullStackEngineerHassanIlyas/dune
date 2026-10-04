// Player settings: defaults ← localStorage ← URL overrides. Only whitelisted keys and values survive.
const KEY = 'dune2-3d.settings';
export const DEFAULTS = { quality: 'medium', scheme: 'classic', edgeScroll: true, rightDragScroll: true, scrollSpeed: 1, healthBars: 'selected', gameSpeed: 'normal', sound: true, volume: 0.8,
  voiceVolume: 0.8,     // the announcer and the units' acknowledgements (src/audio/voice.js); 0 turns them off
  musicVolume: 0.5,     // the music (src/audio/music); 0 turns it off
  musicMode: 'sega',    // in battle: 'sega' plays the battle tunes in random order like the Sega game; 'adaptive' switches peace/battle
  announcer: 'one',     // 'one': one shared announcer for every house, as on the Mega Drive; 'house': each house its own (src/audio/voice.js)
  mentatVoice: true,    // the Mentats speak their words on the campaign screens (src/audio/mentat-voice.js); false: typed, silent
  intro: true,          // the opening before the title (scenes/menu-intro.js); ?intro=0 skips it
  perfCheck: true,      // the frame-rate check offers a lower preset when battles run slow (src/ui/perf-monitor.js, spec §8)
  menuMotion: true };   // false: the main menu's backdrop stands still (its Pause background button, WCAG 2.2.2)
const ZERO_OK = new Set(['voiceVolume', 'musicVolume']);   // numbers that may be 0 (off); the rest must be positive
const MAX = { volume: 1, voiceVolume: 1, musicVolume: 1 };   // other numbers stop at 4
const CHOICES = {
  quality: ['low', 'medium', 'high'],
  scheme: ['classic', 'modern'],
  healthBars: ['selected', 'damaged', 'always'],
  gameSpeed: ['slowest', 'slow', 'normal', 'fast', 'fastest'],
  musicMode: ['sega', 'adaptive'],
  announcer: ['one', 'house'],
};

export function sanitize(obj) {
  const out = { ...DEFAULTS };
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (!(k in DEFAULTS)) continue;
    if (CHOICES[k]) { if (CHOICES[k].includes(v)) out[k] = v; }
    else if (typeof DEFAULTS[k] === 'boolean') out[k] = v === true || v === 'true' || v === '1';
    else if (typeof DEFAULTS[k] === 'number') { const n = typeof v === 'number' || (typeof v === 'string' && v.trim()) ? Number(v) : NaN; if (Number.isFinite(n) && (n > 0 || (n === 0 && ZERO_OK.has(k))) && n <= (MAX[k] ?? 4)) out[k] = n; }
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
