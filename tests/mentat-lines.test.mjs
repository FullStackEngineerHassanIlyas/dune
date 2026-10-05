// Every word a Mentat says on the campaign's screens has his voice (src/audio/mentat-lines.js, scripts/voices/
// mentat.py, assets/voice/mentat/): the clip list covers the story's lines exactly as the screens show them, the
// manifest holds every clip with the same words, each file is mono Ogg Opus as long as its track says, and each
// track is sound: words in order and on the text, sentences covering them, mouth shapes in time and the envelope.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import * as STORY from '../src/data/story.js';
import { mentatClips, clipId, clipKey, clipText, KINDS } from '../src/audio/mentat-lines.js';
import { words as wordsOf } from '../src/ui/campaign/words.js';
import { MentatTrack, VISEMES, EXPRESSIONS } from '../src/audio/mentat-voice.js';

const DIR = new URL('../assets/voice/mentat/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', DIR), 'utf8'));
const clips = mentatClips(STORY);
const HOUSES = Object.keys(STORY.MENTATS);
const BUDGET = 6.5e6;   // bytes: the brief's ~6 MB, sound and tracks together

/** An Ogg Opus file's length in seconds: the last page's granule position less the pre-skip, at 48 kHz. */
function oggSeconds(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'OggS');
  const head = buf.indexOf('OpusHead');
  assert.ok(head > 0, 'an Opus stream');
  assert.equal(buf[head + 9], 1, 'mono');
  const preSkip = buf.readUInt16LE(head + 10);
  const last = buf.lastIndexOf('OggS');
  return (Number(buf.readBigInt64LE(last + 6)) - preSkip) / 48000;
}

test('the clip list: every Mentat line of the story, as the screens show it', () => {
  const w = wordsOf(STORY, null);
  assert.deepEqual(KINDS, ['page', 'question', 'briefing', 'advice', 'win', 'lose', 'ending']);
  assert.equal(clips.length, HOUSES.length * (3 + 1 + 9 * 4 + 1));
  assert.equal(new Set(clips.map((c) => c.id)).size, clips.length, 'ids are unique');
  for (const house of HOUSES) {
    const of = (kind, n = null) => clips.find((c) => c.id === clipId(house, kind, n))?.lines;
    w.pages(house).forEach((page, i) => assert.deepEqual(of('page', i + 1), page));
    assert.deepEqual(of('question'), [w.question(house)]);
    for (let n = 1; n <= 9; n++) {
      assert.deepEqual(of('briefing', n), w.briefing(house, n));
      assert.deepEqual(of('advice', n), w.advice(house, n));
      assert.deepEqual(of('win', n), w.win(house, n));
      assert.deepEqual(of('lose', n), w.lose(house, n));
    }
    assert.deepEqual(of('ending'), w.ending(house));
  }
  assert.equal(clipKey('page', 0), null);
  assert.equal(clipKey('briefing', null), null);
  assert.equal(clipId('ordos', 'advice', 3), 'ordos/m3-advice');
  assert.equal(clipText([' a ', '', 'b']), ' a \nb');
});

test('the manifest: every clip, with the very words of the story, a Mentat for each house, within the budget', () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.lufs, -19.7);   // what the clips measure after the Opus encode (the target before it is -19)
  assert.deepEqual(Object.keys(manifest.mentats).sort(), [...HOUSES].sort());
  for (const house of HOUSES) assert.equal(manifest.mentats[house].name, STORY.MENTATS[house].name);
  assert.deepEqual(Object.keys(manifest.clips).sort(), clips.map((c) => c.id).sort(), 'no clip missing, none left over');
  let bytes = statSync(new URL('manifest.json', DIR)).size;
  for (const c of clips) {
    const e = manifest.clips[c.id];
    assert.equal(e.text, clipText(c.lines), c.id);
    assert.equal(e.file, `${c.id}.ogg`);
    assert.equal(e.track, `${c.id}.json`);
    bytes += statSync(new URL(e.file, DIR)).size + statSync(new URL(e.track, DIR)).size;
  }
  assert.ok(bytes <= BUDGET, `${(bytes / 1e6).toFixed(2)} MB`);
});

test('each file: mono Ogg Opus as long as the manifest and its track say', () => {
  for (const c of clips) {
    const e = manifest.clips[c.id];
    const seconds = oggSeconds(readFileSync(new URL(e.file, DIR)));
    const track = JSON.parse(readFileSync(new URL(e.track, DIR), 'utf8'));
    assert.ok(Math.abs(seconds - e.seconds) < 0.03, `${c.id}: ${seconds} s, manifest ${e.seconds}`);
    assert.ok(Math.abs(seconds - track.ms / 1000) < 0.03, `${c.id}: ${seconds} s, track ${track.ms} ms`);
    assert.ok(seconds > 1 && seconds < 60, `${c.id}: ${seconds} s`);
  }
});

test('each track: the words in order on the text, sentences over them, mouth shapes and envelope in time', () => {
  const WORD = /[A-Za-z0-9][A-Za-z0-9'-]*/g;
  let words = 0, loud = 0;
  for (const c of clips) {
    const json = JSON.parse(readFileSync(new URL(manifest.clips[c.id].track, DIR), 'utf8'));
    assert.equal(json.v, 1);
    assert.equal(json.id, c.id);
    assert.deepEqual(json.lines, c.lines);
    // the words: every display word, where it stands, in order, each said within the clip
    const want = c.lines.flatMap((l, li) => [...l.matchAll(WORD)].map((m) => [li, m.index, m.index + m[0].length]));
    assert.deepEqual(json.words.map((w) => w.slice(2)), want, `${c.id}: the words on the text`);
    let prev = 0;
    for (const [s, e] of json.words) {
      assert.ok(s >= prev && e > s && e <= json.ms, `${c.id}: word ${s}-${e} after ${prev}`);
      prev = s;
    }
    // the sentences: in order, one after another, covering every word once, each with an expression
    let next = 0;
    for (const [s, e, w0, w1, ex] of json.sentences) {
      assert.equal(w0, next, `${c.id}: sentences cover the words in turn`);
      assert.ok(w1 >= w0 && s === json.words[w0][0] && e >= json.words[w1][1] - 1 && e <= json.ms, `${c.id}: sentence ${w0}-${w1}`);
      assert.ok(EXPRESSIONS.includes(ex), `${c.id}: ${ex}`);
      next = w1 + 1;
    }
    assert.equal(next, json.words.length);
    // the mouth: a shape from 0 (rest, or the first sound's when he starts at once: at() blends it in from rest),
    // rising times within the clip, a known shape each, back to rest at the end
    const { t, s } = json.visemes;
    assert.equal(t.length, s.length);
    assert.equal(t[0], 0);
    assert.equal(s.at(-1), 'r', `${c.id}: the mouth rests at the end`);
    for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1] && t[i] < json.ms && s[i] !== s[i - 1], `${c.id}: viseme ${i}`);
    assert.match(s, /^[rmfaeol]+$/);
    // the envelope: 30 a second over the dry voice (the room's tail after it is silence to the jaw), past the
    // last word, and loud while the words are said
    assert.equal(json.env.hz, 30);
    const envMs = json.env.q.length / 30 * 1000;
    assert.ok(envMs >= json.words.at(-1)[1] && envMs <= json.ms + 70, `${c.id}: ${json.env.q.length} envelope frames for ${json.ms} ms`);
    const tr = new MentatTrack(json);
    for (const [a, b, li, c0, c1] of json.words) {
      let m = 0;
      for (let x = a / 1000; x <= b / 1000; x += 1 / 60) m = Math.max(m, tr.at(x).open);
      assert.ok(m > 0.25, `${c.id}: "${c.lines[li].slice(c0, c1)}" at ${a} ms has no voice under it (${m.toFixed(2)})`);
      words++;
      loud += m > 0.4;   // the loudest part of the word within 25 dB of the clip's loud frames
    }
    for (const x of [0, json.ms / 2000, json.ms / 1000]) assert.ok(VISEMES.includes(tr.at(x).viseme));
  }
  assert.ok(loud / words > 0.995, `${loud} of ${words} words have the voice loud under them`);
});

test('the sentences carry a face fitting the Mentat and the moment', () => {
  const count = (house, kind) => {
    const out = {};
    for (const c of clips.filter((x) => x.house === house && x.kind === kind)) {
      for (const s of JSON.parse(readFileSync(new URL(manifest.clips[c.id].track, DIR), 'utf8')).sentences) out[s[4]] = (out[s[4]] ?? 0) + 1;
    }
    return out;
  };
  assert.ok(!count('atreides', 'briefing').angry && !count('atreides', 'briefing').sly, 'Cyril is never angry nor sly');
  assert.ok(count('harkonnen', 'lose').angry > 0, 'Radnor rages at a defeat');
  assert.ok(count('ordos', 'briefing').sly > 0, 'Ammon schemes');
  for (const house of HOUSES) assert.ok(count(house, 'win').pleased > 0, `${house}: pleased at a win`);
  // the last words: grave as Cyril is, but his thanks are warm (they were a frown on the GPU)
  const ending = (house) => JSON.parse(readFileSync(new URL(manifest.clips[`${house}/ending`].track, DIR), 'utf8')).sentences.map((s) => s[4]);
  assert.deepEqual(ending('atreides'), ['grave', 'grave', 'grave', 'grave', 'grave', 'grave', 'grave', 'pleased', 'pleased'], 'Cyril: "Thank you. It has been an honour to serve with you."');
  assert.ok(ending('ordos').includes('pleased') && ending('ordos').filter((e) => e === 'sly').length >= 5, 'Ammon\'s Council thanks you, and he stays sly');
  assert.ok(existsSync(new URL('atreides/ending.ogg', DIR)));
});

// The ASR check cannot run here (it needs Whisper): mentat_measure.py ran on these very files and its per-clip results
// are kept beside the notes. A clip rendered again without measuring again fails the bytes check below, and the numbers
// the notes quote have to stay true of what is shipped.
test('the committed measurement is of these very files, and says every clip is heard as written, in loudness and in words', () => {
  const rows = JSON.parse(readFileSync(new URL('../docs/superpowers/notes/2026-10-05-mentat-voice-measure.json', import.meta.url), 'utf8'));
  assert.equal(rows.length, clips.length);
  const byId = new Map(rows.map((r) => [`${r.house}/${r.key}`, r]));
  assert.deepEqual([...byId.keys()].sort(), clips.map((c) => c.id).sort());
  for (const c of clips) {
    const r = byId.get(c.id), e = manifest.clips[c.id];
    assert.equal(r.bytes, statSync(new URL(e.file, DIR)).size, `${c.id}: measured on another render (run scripts/voices/mentat_measure.py again)`);
    assert.equal(r.ms, JSON.parse(readFileSync(new URL(e.track, DIR), 'utf8')).ms, `${c.id}: measured on another render`);
    assert.ok(Math.abs(r.lufs - manifest.lufs) <= 0.5, `${c.id}: ${r.lufs} LUFS, the manifest says ${manifest.lufs}`);
    assert.ok(r.peak <= -0.5, `${c.id}: true peak ${r.peak} dBTP`);
    assert.ok(r.wer <= 0.3, `${c.id}: heard "${r.heard}"`);
    assert.ok(r.onSpeech >= 0.9, `${c.id}: ${r.onSpeech} of the words fall on speech`);
  }
  const mean = rows.reduce((s, r) => s + r.wer, 0) / rows.length;
  assert.ok(mean <= 0.03, `word error rate ${mean.toFixed(3)}`);
  // the names, as Whisper small.en heard them in each Mentat's clips: Sardaukar had been heard 4 of 11 for Ammon (his schwa read 'i'),
  // and by base.en none of Cyril's or Radnor's
  const heard = (house, name) => rows.filter((r) => r.house === house).reduce(([a, b], r) => [a + (r.names[name]?.[0] ?? 0), b + (r.names[name]?.[1] ?? 0)], [0, 0]);
  for (const house of HOUSES) {
    const [ok, said] = heard(house, 'Sardaukar');
    assert.ok(said >= 9 && ok / said >= 0.75, `${house}: Sardaukar heard ${ok} of ${said}`);
  }
});
