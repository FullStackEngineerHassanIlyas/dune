// The pictures of the player's own Dune II PC copy that this game's screens show when "Original pictures" is on,
// and where they are in the files (after OpenDUNE, which reads the original's code: gui/mentat.c draws a Mentat,
// sprites.c loads his shapes, gui.c picks the house). Everything is read in the player's browser from their own
// .PAK files and kept there (src/core/user-files.js); none of it is part of this game.
//   - The Mentats: each house's room with the Mentat in it, a full screen (MENTATA.CPS Cyril, MENTATH.CPS Radnor,
//     MENTATO.CPS Ammon), and his shapes (MENSHPA/H/O.SHP): 0-4 the eyes (ahead, to the left and to the right as
//     we see them, down, shut: the original looks at the pointer, and blinks through "down"), 5-9 the mouth (shut,
//     then four open), 10 the right shoulder (drawn in front of the screen beside him), 11-14 the "other": Cyril's
//     book, Ammon's ring. Each is drawn at a fixed place of the room (the original's s_mentatSpritePositions).
//   - The house emblems: the house selection screen HERALD.CPS (HERALD.ENG in the 1.07 English release) shows the
//     three in a row, each in a 96 x 104 box (Atreides, Ordos, Harkonnen from the left).
// All of them use the game's palette, IBM.PAL (a picture with a palette of its own uses that when IBM.PAL is not
// among the files).
import { readPal, toRgba } from './pal.js';
import { readCps } from './cps.js';
import { readShp } from './shp.js';

/** Each Mentat: his letter in the file names, and where his parts go on the 320 x 200 screen ([x, y]). */
export const MENTATS = {
  atreides: { letter: 'A', name: 'Cyril', eyes: [40, 80], mouth: [40, 96], other: [72, 152], shoulder: [128, 128] },
  harkonnen: { letter: 'H', name: 'Radnor', eyes: [32, 88], mouth: [32, 104], other: null, shoulder: [128, 104] },
  ordos: { letter: 'O', name: 'Ammon', eyes: [16, 80], mouth: [16, 96], other: [88, 144], shoulder: [128, 128] },
};

/** The shapes of a Mentat's shape file: [first, last + 1] of each part. */
export const MENTAT_SHAPES = { eyes: [0, 5], mouth: [5, 10], shoulder: [10, 11], other: [11, 15] };

/** The house selection screen's emblem boxes ([x, y, width, height]). */
export const HERALD = { atreides: [16, 56, 96, 104], ordos: [112, 56, 96, 104], harkonnen: [208, 56, 96, 104] };
const HERALD_FILES = ['HERALD.ENG', 'HERALD.CPS'];

/** The files worth keeping from the player's archives: everything the pictures above are made from. */
export const PICTURE_FILES = ['IBM.PAL', ...HERALD_FILES,
  ...Object.values(MENTATS).flatMap((m) => [`MENTAT${m.letter}.CPS`, `MENSHP${m.letter}.SHP`])];

/** A part of a picture: `rgba` (4 bytes a pixel) `width` x `height` at [x, y]. */
function crop(rgba, width, [x, y, w, h]) {
  const out = new Uint8Array(w * h * 4);
  for (let r = 0; r < h; r++) out.set(rgba.subarray(((y + r) * width + x) * 4, ((y + r) * width + x + w) * 4), r * w * 4);
  return out;
}

/**
 * The pictures made from the player's files: `file(name)` gives a file's bytes (Uint8Array) or null. Returns
 * { pictures, problems }: pictures as records the store keeps — { name, kind, house, width, height, rgba, … } —
 * and problems as [{ file, error }] for the files that were there but could not be read (the rest still made).
 *   - 'mentat:<house>': the room (320 x 200) and `parts` { eyes: [5], mouth: [5], shoulder, other: [4] }, each
 *     a { x, y, width, height, rgba } or null where the shape file lacks it.
 *   - 'emblem:<house>': the house's emblem box from the house selection screen.
 */
export function extractPictures(file) {
  const pictures = [], problems = [];
  const read = (name, reader) => {
    const bytes = file(name);
    if (!bytes) return null;
    try { return reader(bytes, name); } catch (err) { problems.push({ file: name, error: err.message }); return null; }
  };
  const ibm = read('IBM.PAL', readPal);
  const paletteOf = (cps, name) => {
    const p = ibm ?? cps.palette;
    if (!p) problems.push({ file: name, error: `${name}: no palette for it (IBM.PAL is not among the files)` });
    return p;
  };

  for (const [house, m] of Object.entries(MENTATS)) {
    const roomName = `MENTAT${m.letter}.CPS`, room = read(roomName, readCps);
    const palette = room && paletteOf(room, roomName);
    if (!palette) continue;
    const shpName = `MENSHP${m.letter}.SHP`, shp = read(shpName, readShp);
    const part = (i, at) => {
      const s = shp?.shapes[i];
      if (!s || !at) return null;
      return { x: at[0], y: at[1], width: s.width, height: s.height, rgba: toRgba(s.indices, palette, s.alpha) };
    };
    const range = ([a, z], at) => Array.from({ length: z - a }, (_, k) => part(a + k, at));
    pictures.push({
      name: `mentat:${house}`, kind: 'mentat', house, mentat: m.name, width: room.width, height: room.height,
      rgba: toRgba(room.pixels, palette), from: shp ? [roomName, shpName] : [roomName],
      parts: {
        eyes: range(MENTAT_SHAPES.eyes, m.eyes), mouth: range(MENTAT_SHAPES.mouth, m.mouth),
        shoulder: part(MENTAT_SHAPES.shoulder[0], m.shoulder), other: m.other ? range(MENTAT_SHAPES.other, m.other) : [],
      },
    });
  }

  const heraldName = HERALD_FILES.find((n) => file(n)), herald = heraldName && read(heraldName, readCps);
  const heraldPalette = herald && paletteOf(herald, heraldName);
  if (heraldPalette && herald.height >= 160) {
    const rgba = toRgba(herald.pixels, heraldPalette);
    for (const [house, box] of Object.entries(HERALD)) {
      pictures.push({ name: `emblem:${house}`, kind: 'emblem', house, width: box[2], height: box[3], rgba: crop(rgba, herald.width, box), from: [heraldName] });
    }
  }
  return { pictures, problems };
}

/** What a set of stored pictures covers, for the page: { mentats: [house…], emblems: [house…], count }. */
export function summarizePictures(names) {
  const list = [...names];
  const of = (kind) => Object.keys(MENTATS).filter((h) => list.includes(`${kind}:${h}`));
  return { mentats: of('mentat'), emblems: of('emblem'), count: list.length };
}
