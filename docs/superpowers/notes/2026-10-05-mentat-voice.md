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
  <key>.ogg` (mono Ogg Opus, 20 kb/s VBR, normalised to -19 LUFS like the music before the encode and about -19.7 after
  it, limited at -2 dBFS) with a timing track `<key>.json` each and `assets/voice/mentat/manifest.json`.
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
| Cyril (Atreides) | george .6 + fable .4 : .82 : .94 | 41 | 623 s | 1.56 MB | -19.8..-19.5 | 130 | 4.1 | 1905 | 139; 121 | 0.018 (0.14) | 29 of 41 |
| Radnor (Harkonnen) | daniel .6 + onyx .4 : .85 : .9 | 41 | 572 s | 1.46 MB | -19.8..-19.5 | 108 | 2.3 | 1528 | 147; 123 | 0.016 (0.12) | 28 of 41 |
| Ammon (Ordos) | eric .6 + lewis .4 : .82 : 1.0 | 41 | 506 s | 1.28 MB | -19.8..-19.5 | 142 | 4.8 | 1831 | 150; 121 | 0.032 (0.25) | 28 of 41 |

All together WER 0.022, 85 of 123 clips word for word (after the review fixes below; 0.026 and 78 before them, Ammon's
Sardaukar being most of the difference); the others differ by a word or two, almost always a name. Whisper is a noisy judge:
clips that did not change moved a little between runs. Radnor sits 22 Hz below
Cyril and 300 Hz darker, and flat; Cyril and Ammon are close in pitch (130 and 142 Hz) and told apart by accent (British,
American), a wider spread and a brighter, smoother tone for Ammon: a person should judge whether those two are far
enough apart. True peaks are at most -0.9 dBTP after the Opus encode (the limiter is at -2 dBFS before it).

**Loudness.** The clips measure -19.8 to -19.5 LUFS (mean about -19.7; the manifest's `lufs` says -19.7): the
normalisation is to -19 before the encode and the limiter and Opus take about 0.7 LU off. That is the menu music's own
level, and 3.7 LU under the announcer's clips (-16.3 LUFS), which is how it was left: the announcer calls over a battle,
the Mentat speaks over music that is itself ducked 8 dB under him (`SPEECH_DUCK`), and the clips' true peaks (-0.9 dBTP)
leave no room to raise them without another limiter pass. A person who finds him too quiet should raise `TARGET_LUFS`
in `mentat.py` and render again (about 70 minutes on two threads), or the Voices slider.

Every figure in this note comes from `2026-10-05-mentat-voice-measure.json` (one row per clip, Whisper small.en) beside
it, made by `mentat_measure.py assets/voice/mentat --out ...` on the shipped files; `tests/mentat-lines.test.mjs`
checks that the file is of these very files (bytes and length of every clip), so a clip rendered again must be
measured again. A second opinion by Whisper base.en is in `2026-10-05-mentat-voice-measure-base.json`.

## Text normalisation

`mentat.py` respells what espeak would say wrong, per accent, as whole words (a possessive keeps its 's'):
Arrakis, Harkonnen, Atreides, Ordos, Fremen, Caladan, Sardaukar, Ornithopter(s), Melange, Giedi, and WOR (the
Harkonnen barracks, said letter by letter); a Mentat's own `say` table in `MENTATS` wins over it for him (Ammon's
Sardaukar). Numbers are said as words, credits the way people say them (2700: "twenty-seven hundred", 1000: "one
thousand"). Whisper small.en hears, over the shipped clips, Arrakis 14 of 14, Atreides 24 of 25, Ordos 26 of 29,
Harkonnen 23 of 26, Sardaukar 29 of 32 (Cyril 10 of 11, Radnor 8 of 10, Ammon 11 of 11), Fremen and Ornithopter(s) all,
Carryall 3 of 6, Giedi as "Gidi" (`names heard right` in `mentat_measure.py`'s summary); base.en, a weaker model that is
wrong about more of everything (WER 0.047), Sardaukar 20 of 32 (7, 6 and 7), Harkonnen 19 of 26, Ordos 20 of 29. Stress and
vowels mattered a good deal, and the judge is noisy (the same pronunciation of Sardaukar came out 26 and 22 of 32 on two
renders); the first respellings, "HAR-ko-nen" and "SAR-dow-kar" with the stress on the first syllable, were heard as
"harkening" and "sardau car" (Harkonnen 18 of 26, Sardaukar 19 of 32), so Harkonnen is said har-KON-en and Sardaukar
sar-DOW-kar (Ammon's: sar-DAW-kar), the comments beside `PRONOUNCE` and `MENTATS` keep the counts; Review fixes tells how they
were chosen. A person should still listen to the names, above all Ammon's.

## Timings

Each sentence is spoken on its own, its silence trimmed by its energy, and the sentences joined with the
Mentat's own pause (0.42-0.5 s), so the sentence boundaries in the track are exact. Within a sentence the
times are Kokoro's frame counts, moved 100 ms earlier (`AUDIO_LEAD` in `mentat.py`): a probe on six sentences
found the sound rising 40-100 ms before the frame its first phoneme is given, and words after a comma 40-75 ms
(median about 70), so the lead was first 70 ms; with 70 ms the sentences of the first 31 clips still started a
median 30 ms after their sound (commit `aef4217` made it 100). The tape factor scales every time with the sound.

Measured on all 494 sentences of the 123 shipped clips (`mentat_measure.py`): the sentence start in the track against
the moment its sound rises (-30 dB of the clip's loud level): median +2 ms (the track a hair late), 10 % early by 34
ms or more, 10 % late by 44 ms or more; 93 % within 50 ms and 98 % within 100 ms. Against Whisper's own word starts
the median difference is 57-60 ms per house (its resolution is about 20-40 ms), 98-99 % of the words matched in order,
and 99.7-100 % of the track's words fall on speech, not silence.

Mouth shapes come from the phonemes: rest; MBP (lips closed); FV; A (open: a ɑ ɐ æ ʌ ə ɚ ɜ); E (wide: i ɪ e ɛ
and the tongue consonants t d n s z k g …); O (round: o ʊ u w ɔ ɒ ɹ ʃ ʒ ʧ ʤ); L (l, θ, ð). A stress mark
opens the sound after it; pauses over 80 ms, punctuation and the gaps between sentences are rest. Shapes
change about seven times a second at this pace.

Expressions, one per sentence, from the Mentat and the words (`CUES`, `ORDER`, `DEFAULT` in `mentat.py`;
`--retag` chooses them again without rendering): Cyril is never angry nor sly (grave, warning, sad, pleased,
neutral), Radnor's defeats are angry and his schemes sly, Ammon's deals sly; a win's sentences are pleased
unless one warns, a defeat's take the Mentat's mood (Cyril sad, Radnor angry, Ammon grave), and the last words take
it too (Cyril grave, Radnor pleased, Ammon sly) except their thanks, which are pleased (`WARM`, added after the GPU
check of the talking face: Cyril had thanked the Commander with a frown).

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
voice.track(ids, { lines })             // → Promise<MentatTrack | null>: the timing track alone (the JSON, no sound, no audio
                                        //   context), also with the voice Off: see "A face without the voice"
voice.stop(); voice.enabled; voice.debug()

// a line
line.id, line.ids, line.house, line.key // 'atreides/m4-briefing', ['atreides/m4-briefing'], 'atreides', 'm4-briefing'
line.duration                           // seconds (from the manifest at once, exact once loaded)
line.state                              // 'loading' | 'playing' | 'ended' | 'stopped' | 'failed'
line.started                            // Promise<boolean>: true when the sound starts, false if it never will
line.time                               // seconds heard so far (output latency taken off); the audio clock, which steps
line.smooth()                           // line.time carried on between those steps by the page's clock (see below)
line.at(t, out) / line.now(out)         // the frame at t / at smooth(), written into out (default: line.frame)
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

`voice.now()` and `line.now()` give the frame at `line.smooth()`, not at `line.time`: the browser's audio clock
(`ctx.currentTime`) moves in steps (measured in real Chrome at 60 Hz over 239 frames: 10.7 or 21.3 ms a frame, three
frames with no advance at all, output latency 48 ms), so between two steps `smooth()` carries the time on with
`performance.now()`, at most `STEP_MAX` (30 ms) past the last step and never back (a read-on to an earlier place
starts it again). A face that calls `line.at(line.time)` itself should do the same. What remains is a jitter of a few
ms in a mouth that changes shape seven times a second over a 60 ms blend.

The shapes are the brief's: rest, closed M/B/P, F/V, open A, wide E/I, round O/U, L/TH. `open` comes from the
dry voice before the room, so the reverb does not hold the jaw open. The track files themselves
(`assets/voice/mentat/<house>/<key>.json`) are `{ v: 1, id, ms, lines, words: [[startMs, endMs, line, c0,
c1]], sentences: [[startMs, endMs, firstWord, lastWord, expression]], visemes: { t: [ms], s: 'rmfaeol…' },
env: { hz: 30, q: '…' } }` (one letter of `0-9A-Za-z-_` per envelope frame, 0..63); `MentatTrack` reads them
into typed arrays once, and `at(t)` is a few binary searches.

### A face without the voice

`voice.now()` is at rest whenever no line plays: Options → Mentat voice Off, Sound off, Voices 0, no Web Audio, the
browser holding the sound until a click, a clip that failed. The words are then typed (`typeLines`), and the face
can still show the sentences' moods for them: `stage.typer.clips` (set by `CampaignScreens`; null where a screen's
words have no clip) holds the clip ids, `voice.track(clips)` gives the track without the voice being on or any
sound loaded, `track.sentences[s]` the words it spans (`first`..`last`) and its `expression`, and each word of
`track.words` its screen line and characters (`line`, `c0`, `c1`). The clock is the typing's: count the characters
typed so far in the line, take the last word whose `c0` has been passed, and that word's sentence.

## Playback on the campaign screens

- Every Mentat screen asks `CampaignScreens.speak(ids, lines)` for its clip ids (`clipId(house, kind, n)`):
  the join pages and question, the briefing and its advice, the win (after mission 9: the win and then the
  ending as one line, 0.6 s apart), the defeat, and the hub's "watch the ending again". The next clip is
  fetched ahead (the next page; the advice while the briefing plays).
- The voice plays on an audio context of its own, at volume × Voices; `clock()` takes the output latency off, so
  the words and the face follow what is heard, not what is scheduled. The context is made, and asked to run, in
  `prepare()` (a screen's render) and in `say()`: inside the click that opens the screen or asks for the line, where
  Safari wants it (not tested there). A context the browser still holds (a refresh or a direct link: no click yet)
  is given 0.3 s (1.2 s once the page has had a click) and then the line gives way, so the words are typed at once
  instead of after 1.5 s; the next click's line sounds.
- A new line stops the old one (Advice / Briefing, Next, a new screen), leaving a screen stops him and his typing
  (`CampaignScreens.quiet()` in `render`, `leave`, `launch`, the ending), and nothing loaded late ever starts after it
  was stopped.
- The music ducks at once (MenuMusic.duck: the conductor's level at 0.4, about -8 dB, eased over 50 ms) and
  comes back 350 ms after the last line, so two lines in a row do not pump it.
- Read on (→, Page Down, Space, a click on the words) takes the voice and the words to the next pair of
  lines (the old sound ramps to nothing and the new comes up from nothing over 15 ms, so the cut does not click);
  on the last pair it ends the line and shows it whole. Reduced motion: each pair whole once the voice
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
  The last test there reads the committed measurement (`2026-10-05-mentat-voice-measure.json`): one row for every clip, of
  the very files shipped (their bytes and lengths), loudness within 0.5 LU of the manifest's, true peak, words heard
  (every clip's WER at most 0.3, the mean at most 0.03), the words' share on speech, and every Mentat's Sardaukar
  heard in at least 85 % of its mentions.
- `tests/mentat-voice.test.mjs`: a track's at(t) (shapes, mix, open, expression held, word, in one frame
  object) and two tracks joined; the player with a fake Web Audio (playing on the context's clock, ducking,
  end, a new line stopping the old, seek with its 15 ms ramps, stop's ramp to nothing, the voice off / sound off / missing
  clip / other words / no Web Audio, a line stopped while loading never sounding, `now()` carrying the stepped audio clock
  on, `track()` without the voice or any sound); a context the browser holds: the context made and resumed inside the
  call, the line giving way after 0.3 s (1.2 s after a click on the page) and typing starting then, the next click's
  line sounding, a late-starting context still playing; the words following the voice with a hand-cranked clock (typing,
  marking, pairs, read on, the last pair, fallback after 1.5 s or on failure, reduced motion); the campaign screens asking
  for each clip and stopping it (Advice, Back, leaving, the last win with the ending); a real MentatVoice over the shipped
  manifest and tracks (fake sound only) on a join page, the question, a briefing, a defeat, the last win with the ending
  and the ending again, each playing with the words following and `typer.clips` set; a screen left while its clip still
  loads leaves no typing timer and no typer following or typing; the setting's default, sanitising, storage and
  address round trip and its Options row; the music's duck, now to the level the synth is told (a fake output: ×0.4 under
  a line, the full level 350 ms after it) and wired to a real line.

## Verification

- Full suite under the lock (`flock /tmp/dune-npmtest.lock npm test`) after the review fixes and the last render:
  1444 of 1444 pass (1435 before the fixes); the Mentat tests alone (`node --test tests/mentat-lines.test.mjs tests/mentat-voice.test.mjs`), 29 of 29.
- Measured as above, all 123 shipped clips (`2026-10-05-mentat-voice-measure.json`): loudness -19.8 to -19.5 LUFS, mean
  WER 0.022, sentence starts within +2 ms of the sound's rise (median), 4.57 MB in all.
- Real GPU (Chrome, hardware GL), the Ordos mission 4 briefing on the final clips: the voice context running, the
  line playing, the typed words following the voice with the word being said marked in gold and underlined, the music
  ducked, no console errors. The earlier pass (join pages, briefing, Advice, Back, read on, the ending) was done
  by the first builder on the real GPU with the previous renders of the same player code.
- After the review fixes, real Chrome (hardware GL) without the autoplay flag, opened straight on
  `scene=menu&intro=0&screen=campaign-briefing&house=harkonnen&mission=3` (no click): the context suspended, the
  line failed, the Mentat's words typing at 0.8 s (they had been blank until 2.3 s), then a real click on Advice and
  `harkonnen/m3-advice` playing with the music ducked, no console errors. With a real ArrowRight, the browser's
  audio-node calls show the old gain ramping 1 → 0 over 15 ms with its source stopped at the ramp's end and the new
  source starting 5 ms later on a gain ramping 0 → 1 over 15 ms.
- Not done: nobody has listened. The voices, the names and the faces' timing are judged by measurement only, and Safari
  (where the context has to be resumed inside the click) was not tried.

## Reproduce

```
VENV=/tmp/tts   # any path
uv venv --python 3.12 $VENV && uv pip install -p $VENV/bin/python kokoro-onnx==0.6.1 soundfile onnx faster-whisper
# kokoro-v1.0.onnx and voices-v1.0.bin as in scripts/voices/generate.py, in <models>
VOICE_THREADS=2 $VENV/bin/python scripts/voices/mentat.py --models <models>            # all 123 (~70 min on 2 threads)
$VENV/bin/python scripts/voices/mentat.py --models <models> --houses ordos --only m2-briefing   # one clip
$VENV/bin/python scripts/voices/mentat.py --models <models> --audition <dir> --houses ordos --only page-1 \
    --voices 'am_eric*0.6+bm_lewis*0.4:0.82:1,bm_fable:0.85:0.97'                         # blend:speed:tape
$VENV/bin/python scripts/voices/mentat.py --models <models> --retag                    # expressions only
# the measurement (Whisper small.en; --model base.en for the second opinion; the models download into --whisper-dir)
$VENV/bin/python scripts/voices/mentat_measure.py assets/voice/mentat --whisper-dir <dir> \
    --out docs/superpowers/notes/2026-10-05-mentat-voice-measure.json
```

## Review fixes

A review (report only, with its own Whisper base.en pass and real-Chrome probes) found these; what was done, each
reproduced first and checked again after.

**The names (important).** The first render's Sardaukar was heard right by Whisper small.en in 22 of 32 whole clips, and the
misses were nearly all Ammon's: 4 of 11 ("sardikar", "sardicar": his schwa in the second syllable reads as "i"); base.en
heard 0 of 32, Cyril's and Radnor's all as "Sardica". Ammon's Harkonnen was heard 9 of 12 and 8 of 12 ("Harkon share",
"Harkan"). Variants were rendered on the real sentences, in each Mentat's own voice and room, and heard by both models.
Cyril's 11 Sardaukar sentences, four to a clip (small.en / base.en right): SAR-də-kar (before) 4 / 0; sar-DAW-kar with a
long ɔː 4 / 6, with a short ɒ 1 / 0, with ɑː 0 / 0; **sar-DOW-kar (`sɑːdˈaʊkɑː`) 10 / 11**. Then on whole clips,
before and after: Cyril 10 of 11 and 10 (small.en), 0 and 7 (base.en); Radnor 9 of 10 and 8, 0 and 6 (the near misses
are "Sardau" and "Sardauka"). It is the shared form now (`PRONOUNCE`, both accents). For Ammon, American: schwa 0 / 0,
long ɔː 6 / 3, "DOW" 10 / 4, "DAH" 10 / 3, **short ɔ (`sɑːɹdˈɔkɑːɹ`) 10 / 7** (base.en spells four more of them
"Sardaucar": the same sound); on his 18 whole clips that hold Sardaukar, Harkonnen or Carryall 11 of 11 and 7 of 11, against
4 and 0 shipped. It is his own (`'say'` in `MENTATS`, which wins over `PRONOUNCE` for him). The 29 clips with the name were
rendered again (Cyril's 10: `m4-briefing`, `m4-lose`, `m5-briefing`, `m6`-`m8-briefing`, `m9-briefing`, `m9-advice`, `m9-win`,
`m9-lose`; Radnor's 9, the same without `m4-lose`; Ammon's 10, the same ten as Cyril's); the output is byte for byte what
`mentat.py` gives with the new tables, and the 29 were measured again. Result on all 123 clips: Sardaukar 29 of 32 (22 before;
Ammon 11 of 11, Cyril 10 of 11, Radnor 8 of 10) by small.en and 20 of 32 (7) by base.en; Ammon's WER 0.032 (0.040) and 28 of
41 clips word for word (22); all 0.022 (0.026) and 85 of 123 (78).

Looked at and **not changed**: *Harkonnen* stays har-KON-en for all three. The usual Dune stress is HAR-kuh-nen, but on Ammon's
12 mentions in whole clips it was heard 8 and 3 (small.en and base.en) against 9 and 6-8 for har-KON-en, and said four to a
clip every variant was heard 12 of 12 by both models, so his three misses ("Harkonnen thugs / bases / brute" opening a
sentence) are the transcriber's context, not the sound. *Carryall* ("karyol", "carrioles": both models hear a "carriole")
did no better with `kˈæɹiˌɔːl` or `kˈɛɹiˌɔːl`, and Ammon's own "Ordos" in his ending is heard 0 of 2 (3 of 5 in all his clips).
Changing a stress is one line in `PRONOUNCE` (or a Mentat's `say`) and the render of the clips that hold the name
(`mentat.py --houses ... --only ...`, about a minute a clip). Still for a person: listen to `ordos/m4-briefing`,
`m5-advice` and `ending` and the Sardaukar clips of all three.

**Blocked audio.** Real Chrome opened straight on a campaign screen (no click, no autoplay flag) kept the Mentat's text
blank 1.5 s before typing (the context was made and resumed in `load()` after an await, outside the click). `prepare()`
(the screen's render) and `say()` now make and resume the context, and a context still suspended after 0.3 s (1.2 s once
the page has had a click, by `navigator.userActivation`) fails the line at once so the words type; the same page now types
at 0.8 s and a click on Advice plays. Not tried in Safari.

**Typing into a discarded box.** A screen left while its clip was loading left its typer typing (`following` false,
`typing` true, one live timer). `CampaignScreens.quiet()` stops the typer and the voice in `render`, `leave`, `launch`
and the ending; the test reproduces it and fails without the fix.

**Read on clicks.** The seek cut the sound at an arbitrary sample and started the new part at full level. It now ramps the
old gain to 0 over 15 ms (the source stops at the ramp's end), and the new one up from 0 over 15 ms; a plain stop also
ramps (linear, to exactly 0 where it stops) instead of the exponential that left -26 dB. Seen in Chrome's own node calls.

**The contract for the face.** `voice.track(ids)` gives the timing track alone (JSON only, also with the voice Off or
the sound blocked), `typer.clips` the screen's clip ids, and `now()` is smoothed between the audio clock's steps
(`line.smooth()`, at most 30 ms past the last step and never back); the notes say how a face follows typed text.

**Notes and manifest.** The lead is 100 ms; the manifest says `lufs` -19.7 (what the clips measure, -19.8..-19.5) and the
loudness section says the Mentat is 3.7 LU under the announcer on purpose; the counts come from the committed measurement
(Ordos 26 of 29, not 28); the per-clip measurements are `2026-10-05-mentat-voice-measure.json` (small.en) and
`-base.json`; the Reproduce block uses a variable for the venv; `mentat_measure.py` counts names heard right.

**Tests.** The vacuous `UNDUCK_AFTER > 0` is gone: the duck test now checks the level the synth is told (a fake
output) and wires a real line to it; a real `MentatVoice` over the shipped manifest and tracks drives a join page, the
question, a briefing, a defeat, the last win with the ending and the ending again; the measurement test ties the
shipped audio to the text through the committed Whisper results.

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
> Radnor, `am_eric` and `bm_lewis` for Ammon, each in a light reverb of his chamber, at about −19.7 LUFS), each with a
> timing track of its words, mouth shapes and expressions taken from the model's own phoneme durations.
