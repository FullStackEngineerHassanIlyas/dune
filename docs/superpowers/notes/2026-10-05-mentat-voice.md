# The Mentats speak (part 1 of 2: voice, timings, playback)

Branch `phase3/mentat-voice` (from `5ac1499`). The manager (Roman Urdu, translated): "The briefing character
should give the briefing in voice, with facial expressions, the text that shows on screen; that would make it
much better." Talking Mentats are an addition the original should have had: neither the Sega nor the PC game
spoke the briefings. This part gives every Mentat line a voice, the timings a face needs, and plays them on the
campaign screens; part 2 animates the face on `src/ui/campaign/portraits.js` through the contract below.

## What changed

- **Speech for every Mentat line** (123 clips, 41 per house): each house's three pages and its "join?"
  question, every mission's briefing, advice, win and lose lines, and the last words after mission 9.
  `src/audio/mentat-lines.js` lists them from `src/data/story.js` exactly as the screens show them (the same
  line filter as `words.js`); `scripts/voices/mentat.py` renders them into `assets/voice/mentat/<house>/
  <key>.ogg` (mono Ogg Opus, 20 kb/s VBR, -19 LUFS like the music, limited at -2 dBFS) with a timing track
  `<key>.json` each and `assets/voice/mentat/manifest.json`.
- **One voice per Mentat**, chosen by measured auditions (below), slow and grave, in the room of his chamber
  as a light reverb: Cyril (Atreides) a calm, warm older man by the Caladan sea window; Radnor (Harkonnen)
  dark, flat and harsh in the furnace hall; Ammon (Ordos) smooth and cool in the ice hall. The names follow
  `story.js` (Radnor is the Harkonnen Mentat, Ammon the Ordos one; the brief had them the other way round).
- **Timings from Kokoro itself**: a copy of the model graph with one more output, the frames (25 ms) it gives
  every phoneme, so each word's start and end and each mouth shape comes from the model, not a guess.
- **Playback** (`src/audio/mentat-voice.js`, `src/ui/campaign/stage.js` `followSpeech`, `index.js`): the
  Mentat speaks when his words show; the pair of lines being said is typed in step with his voice, the word
  being said marked in spice gold (underlined too, so not by colour alone); the menu music ducks under him.
- **Options → Mentat voice: On / Off** (`mentatVoice`, on by default; `?mentatVoice=0`). The Voices slider
  sets his level with the announcer's; Sound off, volume 0 or Voices 0 also silence him.

## The voices (chosen by measurement; a person still has to listen)

An agent cannot listen, so each candidate blend was rendered on the same clips and measured by
`scripts/voices/mentat_measure.py`: loudness and true peak (EBU R128), median F0 of the voiced frames and its
spread in semitones (intonation), spectral centroid (brightness), pace, and Whisper small.en's transcript
against the text (word error rate, British and American spellings counted alike, numbers as words).

Round 1 (page-1, question, m3-win; Kokoro speed 0.88-0.92):

| Mentat | blend : speed : tape | F0 Hz | spread st | centroid Hz | WER | |
|---|---|---|---|---|---|---|
| Cyril | george : .88 : .95 | 139 | 3.8 | 1911 | 0 | younger, higher |
| Cyril | **george .6 + fable .4** : .88 : .95 | 129 | 4.3 | 1920 | 0 | **kept**: older, lively |
| Cyril | george .7 + michael .3 : .88 : .96 | 133 | 4.0 | 1910 | 0 | |
| Radnor | daniel .5 + fenrir .5 : .9 : .9 | 129 | 4.0 | 1967 | 0.09 | "House Haakonnen" |
| Radnor | **daniel .6 + onyx .4** : .9 : .9 | 108 | 1.9 | 1549 | 0 | **kept**: low, flat, dark |
| Radnor | lewis .5 + onyx .5 : .9 : .88 | 104 | 3.6 | 1422 | 0.07 | "House Harkening" |
| Ammon | lewis .7 + eric .3 : .9 : .97 | 128 | 5.2 | 1824 | 0 | as low as Cyril |
| Ammon | fable .6 + eric .4 : .9 : .97 | 139 | 5.8 | 1990 | 0 | fable's murmur, brighter |
| Ammon | **eric .6 + lewis .4** : .92 : .97 | 138 | 4.7 | 1791 | 0 | **kept**: smooth, American |

Round 2 (m2-briefing and m2-lose, slower) settled the pace at Kokoro speed 0.82-0.85, about 120 words a
minute with the pauses; Cyril's tape went to 0.94 and Ammon's to 1.0 to set their pitches further apart.

The shipped clips, all 123 measured the same way (`mentat_measure.py assets/voice/mentat`, Whisper small.en):

| Mentat | blend : speed : tape | clips | speech | size | LUFS | F0 Hz | spread st | centroid Hz | words/min (speech; with pauses) | WER mean (max) | heard word for word |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cyril (Atreides) | george .6 + fable .4 : .82 : .94 | 41 | 621 s | 1.56 MB | -19.8..-19.5 | 131 | 4.1 | 1905 | 140; 121 | 0.021 (0.14) | 27 of 41 |
| Radnor (Harkonnen) | daniel .6 + onyx .4 : .85 : .9 | 41 | 571 s | 1.46 MB | -19.8..-19.5 | 108 | 2.4 | 1531 | 147; 124 | 0.015 (0.12) | 29 of 41 |
| Ammon (Ordos) | eric .6 + lewis .4 : .82 : 1.0 | 41 | 505 s | 1.28 MB | -19.8..-19.5 | 141 | 4.8 | 1835 | 151; 121 | 0.040 (0.25) | 22 of 41 |

All together WER 0.026, 78 of 123 clips word for word; the others differ by a word or two, almost always a name.
Radnor sits 23 Hz below Cyril and 300 Hz darker, and flat; Cyril and Ammon are close in pitch (131 and 141 Hz) and
told apart by accent (British, American), a wider spread and a brighter, smoother tone for Ammon: a person
should judge whether those two are far enough apart. True peaks are at most -0.9 dBTP after the Opus encode (the
limiter is at -2 dBFS before it).

## Text normalisation

`mentat.py` respells what espeak would say wrong, per accent, as whole words (a possessive keeps its 's'):
Arrakis, Harkonnen, Atreides, Ordos, Fremen, Caladan, Sardaukar, Ornithopter(s), Melange, Giedi, and WOR (the
Harkonnen barracks, said letter by letter). Numbers are said as words, credits the way people say them
(2700: "twenty-seven hundred", 1000: "one thousand"). Whisper small.en hears, over the shipped clips, Arrakis 14 of 14, Atreides 24 of 25, Ordos 28 of 29, Harkonnen 23 of
26 (the misses "Harkon and", "Harkan"), Sardaukar 22 of 32 (the rest "sardicar", which is also how many say it),
Fremen and Ornithopter(s) all, Giedi as "Gidi". That judge is noisy: the same pronunciation of Sardaukar came out
26 and 22 of 32 on two renders. Stress mattered more than vowels. The first respellings, "HAR-ko-nen" and
"SAR-dow-kar", were heard as "harkening" and "sardau car" (Harkonnen 18 of 26, Sardaukar 19 of 32); on isolated
sentences (4 per Mentat and variant) har-KON-en was heard right 7 of 7 and sar-DAW-kar 8 of 12, but on whole clips
sar-DAW-kar fell to 15 of 32 ("sardorcar"), so Harkonnen is said har-KON-en and Sardaukar SAR-də-kar (the comments
beside `PRONOUNCE` keep the counts). A person should still listen to the names.

## Timings

Each sentence is spoken on its own, its silence trimmed by its energy, and the sentences joined with the
Mentat's own pause (0.42-0.5 s), so the sentence boundaries in the track are exact. Within a sentence the
times are Kokoro's frame counts, moved 70 ms earlier: a probe on six sentences found the sound rising 40-100
ms before the frame its first phoneme is given, and words after a comma 40-75 ms (median about 70). The tape
factor scales every time with the sound.

Measured on all 494 sentences of the 123 shipped clips (`mentat_measure.py`): the sentence start in the track against
the moment its sound rises (-30 dB of the clip's loud level): median +5 ms (the track a hair late), 10 % early by 34
ms or more, 10 % late by 44 ms or more; 93 % within 50 ms and 98 % within 100 ms. Against Whisper's own word starts
the median difference is 55-62 ms per house (its resolution is about 20-40 ms), 97-99 % of the words matched in order,
and 99.7-100 % of the track's words fall on speech, not silence.

Mouth shapes come from the phonemes: rest; MBP (lips closed); FV; A (open: a ɑ ɐ æ ʌ ə ɚ ɜ); E (wide: i ɪ e ɛ
and the tongue consonants t d n s z k g …); O (round: o ʊ u w ɔ ɒ ɹ ʃ ʒ ʧ ʤ); L (l, θ, ð). A stress mark
opens the sound after it; pauses over 80 ms, punctuation and the gaps between sentences are rest. Shapes
change about seven times a second at this pace.

Expressions, one per sentence, from the Mentat and the words (`CUES`, `ORDER`, `DEFAULT` in `mentat.py`;
`--retag` chooses them again without rendering): Cyril is never angry nor sly (grave, warning, sad, pleased,
neutral), Radnor's defeats are angry and his schemes sly, Ammon's deals sly; a win's sentences are pleased
unless one warns, a defeat's take the Mentat's mood (Cyril sad, Radnor angry, Ammon grave).

## Contract for the face

Everything a face needs is in `src/audio/mentat-voice.js`; nothing in it needs the portrait. The campaign
owns one `MentatVoice`: `CampaignScreens.voice` (`__dune.menu.campaign.voice` in the browser), and every Mentat
stage gets it as `stage.voice`, beside `stage.portrait` (the `<figure class="cp-mentat">` that holds
`mentatSvg(house)`), so part 2 hooks the face up in `mentatStage` (stage.js) or from `portraits.js`.

```js
import { restFrame, VISEMES, EXPRESSIONS } from '../../audio/mentat-voice.js';

// the voice
voice.speak(house, n, kind, { lines })  // → MentatLine | null. kind: 'page' (n = 1..3), 'question', 'briefing' |
                                        //   'advice' | 'win' | 'lose' (n = mission 1..9), 'ending'. null: not spoken
voice.say(ids, { lines })               // the same for clip ids ('ordos/m3-advice'), several said as one line
voice.current                           // the MentatLine loading or playing, or null
voice.now(out)                          // fills `out` for what is heard now (rest when silent); returns it
voice.on('line', (line) => {})          // a line starts to sound          → returns off()
voice.on('end', (line, reason) => {})   // it is over: 'ended' | 'stopped' | 'failed'  → returns off()
voice.stop(); voice.enabled; voice.debug()

// a line
line.id, line.ids, line.house, line.key // 'atreides/m4-briefing', ['atreides/m4-briefing'], 'atreides', 'm4-briefing'
line.duration                           // seconds (from the manifest at once, exact once loaded)
line.state                              // 'loading' | 'playing' | 'ended' | 'stopped' | 'failed'
line.started                            // Promise<boolean>: true when the sound starts, false if it never will
line.time                               // seconds heard so far (output latency taken off)
line.at(t, out) / line.now(out)         // the frame at t / now, written into out (default: line.frame)
line.onEnd((reason) => {}), line.seek(t), line.stop()
line.track                              // MentatTrack: words [{ start, end, line, c0, c1 }], sentences
                                        //   [{ start, end, first, last, expression }], lines, duration (s)

// a frame: make one per face with restFrame(), pass it every frame; nothing is allocated
{ t,                 // seconds into the line
  speaking,          // within a sentence
  viseme,            // 'rest' | 'MBP' | 'FV' | 'A' | 'E' | 'O' | 'L'  (VISEMES[shape])
  shape, from, mix,  // the shape's index, the one before it, 0..1 of the move between them (over 60 ms)
  open,              // 0..1: the voice's loudness (30 Hz, interpolated): the jaw
  expression,        // 'neutral' | 'grave' | 'pleased' | 'warning' | 'angry' | 'sly' | 'sad' (EXPRESSIONS):
                     //   the sentence's, from the line's start, held between sentences and after the last
  word, sentence }   // indices into line.track.words / .sentences being said (or last said), -1 before
```

A face at 60 fps:

```js
const f = restFrame();
const draw = () => {
  voice.now(f);                                    // the line playing, or rest (mouth shut, expression kept)
  mouth.set(f.from, f.shape, f.mix, f.open);       // cross-fade the two shapes, open the jaw by f.open
  face.set(f.expression, f.speaking);              // ease brows and eyes towards the sentence's mood
  if (stage.el.isConnected) requestAnimationFrame(draw);
};
requestAnimationFrame(draw);
```

The shapes are the brief's: rest, closed M/B/P, F/V, open A, wide E/I, round O/U, L/TH. `open` comes from the
dry voice before the room, so the reverb does not hold the jaw open. The track files themselves
(`assets/voice/mentat/<house>/<key>.json`) are `{ v: 1, id, ms, lines, words: [[startMs, endMs, line, c0,
c1]], sentences: [[startMs, endMs, firstWord, lastWord, expression]], visemes: { t: [ms], s: 'rmfaeol…' },
env: { hz: 30, q: '…' } }` (one letter of `0-9A-Za-z-_` per envelope frame, 0..63); `MentatTrack` reads them
into typed arrays once, and `at(t)` is a few binary searches.

## Playback on the campaign screens

- Every Mentat screen asks `CampaignScreens.speak(ids, lines)` for its clip ids (`clipId(house, kind, n)`):
  the join pages and question, the briefing and its advice, the win (after mission 9: the win and then the
  ending as one line, 0.6 s apart), the defeat, and the hub's "watch the ending again". The next clip is
  fetched ahead (the next page; the advice while the briefing plays).
- The voice plays on an audio context of its own (made at the first line, after the player's clicks have
  brought them to the campaign), at volume × Voices; `clock()` takes the output latency off, so the words
  and the face follow what is heard, not what is scheduled.
- A new line stops the old one (Advice / Briefing, Next, a new screen), leaving a screen stops him
  (`render`, `leave`, `launch`, the ending), and nothing loaded late ever starts after it was stopped.
- The music ducks at once (MenuMusic.duck: the conductor's level at 0.4, about -8 dB, eased over 50 ms) and
  comes back 350 ms after the last line, so two lines in a row do not pump it.
- Read on (→, Page Down, Space, a click on the words) takes the voice and the words to the next pair of
  lines; on the last pair it ends the line and shows it whole. Reduced motion: each pair whole once the voice
  reaches it, the word still marked.
- Without the voice: Options → Mentat voice Off, Sound off, Voices 0, no Web Audio, a missing clip, words
  on screen that are not the clip's (the story changed and the clips were not rendered again), or the voice
  not started within 1.5 s (a context the browser holds until a gesture): the words are typed as before.
- Original Game Files keep working: the Mentat's voice is ours either way (the originals have none), and the
  player's own music files duck with the game's (they play through the same music gain).

## Tests

- `tests/mentat-lines.test.mjs`: the clip list covers every Mentat line of `story.js` exactly as `words.js`
  gives it; the manifest holds every clip with the very words, no more, within 6.5 MB; each file is mono Ogg
  Opus as long as the manifest and its track say (granule position, to 30 ms); each track's words are the
  display words in order, sentences cover them, mouth shapes rise in time from and back to rest, the envelope
  runs 30 a second and is loud under more than 95 % of the words; the expressions fit each Mentat.
- `tests/mentat-voice.test.mjs`: a track's at(t) (shapes, mix, open, expression held, word, in one frame
  object) and two tracks joined; the player with a fake Web Audio (playing on the context's clock, ducking,
  end, a new line stopping the old, seek, stop, the voice off / sound off / missing clip / other words / no
  Web Audio, a line stopped while loading never sounding, a context waiting for a gesture); the words
  following the voice with a hand-cranked clock (typing, marking, pairs, read on, the last pair, fallback
  after 1.5 s or on failure, reduced motion); the campaign screens asking for each clip and stopping it
  (Advice, Back, leaving, the last win with the ending), a real MentatVoice on the briefing with fakes; the
  setting's default, sanitising, storage and address round trip and its Options row; the music's duck.

## Verification

- Full suite under the lock after the last render: 1435 of 1435 pass (`npm test`); the Mentat tests alone, 20 of
  20 (`node --test tests/mentat-lines.test.mjs tests/mentat-voice.test.mjs`).
- Measured as above, all 123 shipped clips: loudness -19.8 to -19.5 LUFS, mean WER 0.026, sentence starts within
  +5 ms of the sound's rise (median), 4.57 MB in all.
- Real GPU (Chrome, hardware GL), the Ordos mission 4 briefing on the final clips: the voice context running, the
  line playing, the typed words following the voice with the word being said marked in gold and underlined, the music
  ducked, no console errors. The earlier pass (join pages, briefing, Advice, Back, read on, the ending) was done
  by the first builder on the real GPU with the previous renders of the same player code.
- Not done: nobody has listened. The voices, the names and the faces' timing are judged by measurement only.

## Reproduce

```
uv venv --python 3.12 /tmp/tts && uv pip install -p /tmp/tts/bin/python kokoro-onnx==0.6.1 soundfile onnx faster-whisper
# kokoro-v1.0.onnx and voices-v1.0.bin as in scripts/voices/generate.py, in <models>
VOICE_THREADS=2 /tmp/tts/bin/python scripts/voices/mentat.py --models <models>            # all 123 (~70 min on 2 threads)
/tmp/tts/bin/python scripts/voices/mentat.py --models <models> --houses ordos --only m2-briefing   # one clip
/tmp/tts/bin/python scripts/voices/mentat.py --models <models> --audition <dir> --houses ordos --only page-1 \
    --voices 'am_eric*0.6+bm_lewis*0.4:0.82:1,bm_fable:0.85:0.97'                         # blend:speed:tape
/tmp/tts/bin/python scripts/voices/mentat.py --models <models> --retag                    # expressions only
/tmp/tts/bin/python scripts/voices/mentat_measure.py assets/voice/mentat --out <results.json>
```

## For the README

In "Campaign", after "…a caption for each step of the map and the credits roll.", add:

> The Mentats speak every one of those lines — Cyril warm and unhurried by the sea window of Caladan, Radnor
> low and flat in the Harkonnen furnace hall, Ammon smooth and cool in the Ordos ice hall — and the words on
> screen follow the voice two lines at a time, the word being said marked; any key or a click on the words
> reads on. The music steps back while they speak. Options → Mentat voice turns them off (`mentatVoice=0` in
> the URL); the Voices slider sets their level.

In "Announcer voices", after "…the voices are files: 317 short Ogg Opus lines (about 1.7 MB) in
`assets/voice/`, listed in `assets/voice/manifest.json`.", add:

> The Mentats' 123 lines (about 4.6 MB with their timing tracks) are in `assets/voice/mentat/`, rendered the same way by
> `scripts/voices/mentat.py` (blends of `bm_george` and `bm_fable` for Cyril, `bm_daniel` and `am_onyx` for
> Radnor, `am_eric` and `bm_lewis` for Ammon, each in a light reverb of his chamber, at −19 LUFS), each with a
> timing track of its words, mouth shapes and expressions taken from the model's own phoneme durations.
