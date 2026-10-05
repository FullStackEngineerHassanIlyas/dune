#!/usr/bin/env python3
"""Announcer and unit voices (spec §6 Announcer; research audio-ui-controls.md §A.1; notes
docs/superpowers/notes/2026-10-03-phase3-voices.md): renders every line of scripts/voices/lines.json with
the Kokoro-82M neural TTS (kokoro-onnx), gives each voice set its own character with an ffmpeg chain,
normalises loudness and writes small mono Ogg Opus files plus assets/voice/manifest.json (house -> set,
set -> line id -> file). The runtime is src/audio/voice.js; which unit speaks in which voice is
src/data/unit-voices.js.

One deep announcer shared by every house ('announcer', the default: the Mega Drive release has one, credited
to Frank Klepacki, the PC's Harkonnen voice); one announcer per Great House, like the PC original's three
(Atreides calm and clear, Harkonnen deep and harsh, Ordos cool and precise; Options -> Announcer "Each
house"); the old field-radio replies shared by every unit ('units', now only the
fallback); and a voice for each kind of unit (role 'unit': foot soldiers on a field radio, troopers in
powered suits, scouts on the wind, tank crews on the intercom, harvester and MCV drivers, pilots in their
headsets, the Saboteur close and quiet, the Fremen far off in the open desert).

Reproduce (nothing lands in the repo but assets/voice). Keep the venv on a short path: the espeak-ng
bundled with espeakng-loader ignores a data directory over 160 characters long and dies looking for its
build machine's copy ("Error processing file '/home/runner/...phontab'"):
  uv venv --python 3.12 /tmp/tts && uv pip install -p /tmp/tts/bin/python kokoro-onnx==0.6.1 soundfile
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  /tmp/tts/bin/python scripts/voices/generate.py --models <dir with both files> [--sets atreides,grunt] [--only building,select.1] [--skip-existing]
  /tmp/tts/bin/python scripts/voices/generate.py --models <dir> --audition <out dir> --sets tanker --voices bm_fable,bm_lewis
Needs ffmpeg with libopus on the PATH. VOICE_THREADS (default 4) sets the ONNX threads; about 0.5 GB of
memory. Licences: see README.md, "Announcer voices".
"""
import argparse, html, json, os, re, subprocess, sys, tempfile
import numpy as np
import soundfile as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'voice')
TARGET_LUFS = -16.0      # every line equally loud; voice.js sets the level against the effects
CEILING_DB = -2.0        # peak limit after normalising: Opus overshoots it by a few tenths
BITRATE = '32k'          # Opus, mono: speech is transparent well below this
RATE = 24000             # Kokoro's output rate


def slower(factor):
    """Played back at `factor` of its speed like a tape (pitch and formants together; no time-stretch artefacts)."""
    return [f'asetrate={round(RATE * factor)}', f'aresample={RATE}']


# The ffmpeg chains: band-limit gently, shape presence, compress, then a touch of a short room (the command
# console) or of a field radio. Loudness is normalised afterwards, so gains here only shape the timbre.
CONSOLE_ROOM = 'aecho=0.85:0.55:13|29|47:0.16|0.09|0.04'
FIELD_RADIO = ['highpass=f=320:p=2', 'lowpass=f=3600:p=2', 'equalizer=f=1700:t=q:w=1.2:g=5', 'volume=8dB',
               'asoftclip=type=tanh:threshold=0.7:output=1', 'volume=-5dB', 'lowpass=f=4800:p=2',   # the clipper's overtones stay in the radio's band
               'acompressor=threshold=-20dB:ratio=6:attack=2:release=60:makeup=3']
SETS = {
    'announcer': {   # every house's, as on the Mega Drive: deeper than the Harkonnen set, and clean where that one is gritty
        # (its grit is that house's character): am_fenrir, the Harkonnen voice, weighted with am_onyx, spoken a little quick
        # and slowed like a tape to 83 % (about 4.4 semitones under the Harkonnen set: median F0 of every voiced frame of
        # all 63 lines), then presence at 2.6 and 4.5 kHz so the deep voice stays clear, no clipper;
        # notes docs/superpowers/notes/2026-10-04-art-announcer.md
        'voice': [('am_fenrir', 0.6), ('am_onyx', 0.4)], 'lang': 'en-us', 'speed': 1.08, 'role': 'announcer',
        'chain': slower(0.83) + ['highpass=f=75:p=1', 'lowpass=f=10500:p=1', 'equalizer=f=300:t=q:w=1:g=-3', 'equalizer=f=2600:t=q:w=1:g=6.5',
                                 'equalizer=f=4500:t=q:w=1.2:g=3.5', 'acompressor=threshold=-24dB:ratio=3.5:attack=4:release=90:makeup=3', CONSOLE_ROOM],
    },
    'atreides': {   # calm and clear
        'voice': 'af_heart', 'lang': 'en-us', 'speed': 0.94, 'role': 'announcer',
        'chain': ['highpass=f=120:p=1', 'lowpass=f=9800:p=1', 'equalizer=f=260:t=q:w=1.1:g=-2.5', 'equalizer=f=3200:t=q:w=1.3:g=2.5',
                  'acompressor=threshold=-24dB:ratio=3:attack=4:release=90:makeup=3', CONSOLE_ROOM],
    },
    'harkonnen': {   # deep and harsh
        # played at 88 % speed like a slowed tape (pitch and formants down together, no time-stretch artefacts: a
        # rubberband pitch shift left a sound after the last word, heard as 'Low-powered'), with some grit
        'voice': 'am_fenrir', 'lang': 'en-us', 'speed': 0.98, 'role': 'announcer',
        'chain': ['asetrate=21120', 'aresample=24000', 'highpass=f=80:p=1', 'lowpass=f=9000:p=1', 'equalizer=f=300:t=q:w=1:g=-2',
                  'equalizer=f=2500:t=q:w=1.2:g=5', 'equalizer=f=5000:t=q:w=1.2:g=3', 'volume=9dB', 'asoftclip=type=atan:threshold=0.6:output=1',
                  'volume=-6dB', 'acompressor=threshold=-22dB:ratio=5:attack=3:release=70:makeup=3', 'aecho=0.85:0.5:9|21|37:0.18|0.1|0.05'],
    },
    'ordos': {   # cool and precise (bf_emma was tried first: it breathes after its last word, heard as 'Unit laster')
        'voice': 'af_bella', 'lang': 'en-us', 'speed': 1.0, 'role': 'announcer',
        'chain': ['highpass=f=150:p=1', 'lowpass=f=10500:p=1', 'equalizer=f=300:t=q:w=1:g=-3', 'equalizer=f=5200:t=q:w=1.2:g=2.5',
                  'aecho=0.9:0.45:4.5:0.22', 'acompressor=threshold=-24dB:ratio=3.5:attack=3:release=80:makeup=3', 'aecho=0.85:0.5:11|25|41:0.14|0.08|0.04'],
    },
    'units': {   # the old shared replies: a soldier on a field radio for every unit (now the fallback)
        'voice': 'am_michael', 'lang': 'en-us', 'speed': 1.08, 'role': 'units', 'radio': True, 'chain': FIELD_RADIO,
    },
    # ——— a voice for each kind of unit (role 'unit', the set's name is its group in src/data/unit-voices.js) ———
    'grunt': {   # Light Infantry and squads: the old field-radio soldier
        'voice': 'am_michael', 'lang': 'en-us', 'speed': 1.08, 'role': 'unit', 'radio': True, 'chain': FIELD_RADIO,
    },
    'trooper': {   # Heavy Troopers: a bigger man in a powered suit, boxier and harder on the radio
        'voice': 'bm_george', 'lang': 'en-gb', 'speed': 1.0, 'role': 'unit', 'radio': True,
        'chain': slower(0.94) + ['highpass=f=240:p=2', 'lowpass=f=3400:p=2', 'equalizer=f=900:t=q:w=1.2:g=4', 'equalizer=f=2200:t=q:w=1.4:g=3',
                                 'volume=10dB', 'asoftclip=type=tanh:threshold=0.6:output=1', 'volume=-7dB', 'lowpass=f=4200:p=2',
                                 'acompressor=threshold=-20dB:ratio=6:attack=2:release=60:makeup=3'],
    },
    'scout': {   # Trikes and Quads: quick and light, a clean radio and the wind going by
        'voice': 'am_puck', 'lang': 'en-us', 'speed': 1.04, 'role': 'unit', 'bed': ('wind', -30),   # at 1.12 Whisper lost 'Strafing', 'Scouting'
        'chain': ['highpass=f=280:p=2', 'lowpass=f=4600:p=2', 'equalizer=f=2000:t=q:w=1.2:g=3', 'volume=5dB',
                  'asoftclip=type=tanh:threshold=0.8:output=1', 'volume=-4dB', 'acompressor=threshold=-21dB:ratio=5:attack=2:release=60:makeup=3'],
    },
    'tanker': {   # every tank's crew on the intercom, the engine under it
        'voice': 'bm_fable', 'lang': 'en-gb', 'speed': 1.0, 'role': 'unit', 'bed': ('engine', -27),
        'chain': ['highpass=f=250:p=2', 'lowpass=f=3200:p=2', 'equalizer=f=1200:t=q:w=1.1:g=4', 'equalizer=f=450:t=q:w=1:g=-2',
                  'aecho=0.8:0.4:6|11:0.22|0.12', 'volume=6dB', 'asoftclip=type=tanh:threshold=0.75:output=1', 'volume=-4dB',
                  'acompressor=threshold=-20dB:ratio=6:attack=2:release=60:makeup=3'],
    },
    'harvester': {   # the driver in the cab, its machinery humming
        'voice': 'af_sarah', 'lang': 'en-us', 'speed': 0.95, 'role': 'unit', 'bed': ('hum', -29),
        'chain': ['highpass=f=200:p=1', 'lowpass=f=5200:p=1', 'equalizer=f=1500:t=q:w=1.2:g=3', 'equalizer=f=350:t=q:w=1:g=-2',
                  'aecho=0.85:0.4:8|17:0.18|0.08', 'acompressor=threshold=-22dB:ratio=4:attack=3:release=70:makeup=3'],
    },
    'carryall': {   # a pilot in a headset ('Course set' was heard as 'Core set' in every voice tried: reworded)
        'voice': 'af_kore', 'lang': 'en-us', 'speed': 1.0, 'role': 'unit', 'bed': ('wind', -32),
        'chain': ['highpass=f=400:p=2', 'lowpass=f=3200:p=2', 'equalizer=f=1800:t=q:w=1.2:g=4',
                  'acompressor=threshold=-22dB:ratio=5:attack=2:release=60:makeup=3'],
    },
    'mcv': {   # the convoy's driver, calm on the radio
        'voice': 'bm_lewis', 'lang': 'en-gb', 'speed': 0.97, 'role': 'unit',
        'chain': ['highpass=f=250:p=2', 'lowpass=f=4200:p=2', 'equalizer=f=2200:t=q:w=1.2:g=3', 'volume=4dB',
                  'asoftclip=type=tanh:threshold=0.8:output=1', 'volume=-3dB', 'acompressor=threshold=-22dB:ratio=4:attack=3:release=70:makeup=3'],
    },
    'ornithopter': {   # a fighter pilot, quicker and higher, in the cockpit's rush of air
        'voice': 'af_nova', 'lang': 'en-us', 'speed': 1.0, 'role': 'unit', 'bed': ('wind', -28),   # af_aoede was heard as 'Thanking', 'Dr. Ready'
        'chain': slower(1.05) + ['highpass=f=350:p=2', 'lowpass=f=3800:p=2', 'equalizer=f=2000:t=q:w=1.2:g=4', 'volume=5dB',
                                 'asoftclip=type=tanh:threshold=0.8:output=1', 'volume=-4dB', 'acompressor=threshold=-21dB:ratio=6:attack=2:release=60:makeup=3'],
    },
    'saboteur': {   # close and dry, no radio: he is beside you
        'voice': 'af_nicole', 'lang': 'en-us', 'speed': 0.92, 'role': 'unit',
        'chain': ['highpass=f=90:p=1', 'lowpass=f=11000:p=1', 'equalizer=f=220:t=q:w=1:g=2', 'equalizer=f=6000:t=q:w=1.2:g=2',
                  'acompressor=threshold=-24dB:ratio=3:attack=4:release=90:makeup=3'],
    },
    'fremen': {   # deep and slow, far out in the open desert
        'voice': [('bm_george', 0.6), ('am_fenrir', 0.4)], 'lang': 'en-gb', 'speed': 0.95, 'role': 'unit',
        'chain': slower(0.9) + ['highpass=f=90:p=1', 'lowpass=f=8000:p=1', 'equalizer=f=2600:t=q:w=1.2:g=3', 'equalizer=f=300:t=q:w=1:g=-2',
                                'acompressor=threshold=-22dB:ratio=3:attack=4:release=90:makeup=3', 'aecho=0.8:0.35:170|320:0.2|0.09'],
    },
}
HOUSE_SETS = {'atreides': 'atreides', 'harkonnen': 'harkonnen', 'ordos': 'ordos'}
SHARED_SET = 'announcer'   # the manifest's 'shared': the set src/audio/voice.js gives every house by default

# Names espeak gets wrong, as Kokoro phonemes per accent.
PRONOUNCE = {
    'Atreides': {'en-us': 'ɐtɹˈeɪdiːz', 'en-gb': 'ətɹˈeɪdiːz'},
    'Harkonnen': {'en-us': 'hˈɑːɹkənən', 'en-gb': 'hˈɑːkənən'},
    'Ordos': {'en-us': 'ˈɔːɹdoʊs', 'en-gb': 'ˈɔːdɒs'},
    'Fremen': {'en-us': 'fɹˈɛmən', 'en-gb': 'fɹˈɛmən'},
    'Wormsign': {'en-us': 'wˈɜɹm sˌaɪn', 'en-gb': 'wˈɜːm sˌaɪn'},
}


def table_of(lines, name, spec):
    """A set's lines, id -> text: a unit group's lists become '<kind>.<n>' (n from 1)."""
    if spec['role'] == 'unit':
        return {f'{kind}.{n}': text for kind, texts in lines['unitVoices'][name].items() for n, text in enumerate(texts, 1)}
    return lines['units' if spec['role'] == 'units' else 'announcer']


def voice_name(voice):
    return voice if isinstance(voice, str) else '+'.join(f'{v}*{w:g}' for v, w in voice)


def voice_style(kokoro, voice):
    """A voice by name, or a blend of several ([(name, weight)]): their style vectors averaged."""
    if isinstance(voice, str):
        return voice
    total = sum(w for _, w in voice)
    return sum(kokoro.get_voice_style(v) * (w / total) for v, w in voice).astype(np.float32)


def phonemes(kokoro, text, lang):
    out = kokoro.tokenizer.phonemize(text, lang)
    for word, by_lang in PRONOUNCE.items():
        if word in text:
            said = kokoro.tokenizer.phonemize(word, lang).strip()
            if said not in out:
                sys.exit(f'cannot respell {word!r} in {text!r}: {said!r} not in {out!r}')
            out = out.replace(said, by_lang[lang])
    return out


def speech_only(samples):
    """Kokoro's own silence off both ends, judged in the speech band (300 Hz-4 kHz): some voices (bm_fable)
    murmur on under 300 Hz for half a second after the last word, which the chains filter out but which kept
    the line long. A unit answers at once, and a noise bed would otherwise fill that time too."""
    f = np.fft.rfftfreq(len(samples), 1 / RATE)
    spectrum = np.fft.rfft(samples)
    spectrum[(f < 300) | (f > 4000)] = 0
    band = np.abs(np.fft.irfft(spectrum, len(samples)))
    loud = np.flatnonzero(band > band.max() * 0.01)   # -40 dB of the band's peak
    out = samples[max(0, loud[0] - int(0.01 * RATE)):loud[-1] + int(0.04 * RATE)].copy()
    n = min(len(out), int(0.03 * RATE))
    out[-n:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, n))   # no click where the murmur is cut
    return out


def radio(samples, seed):
    """A faint hiss under the line and a short squelch after it, for the field-radio sets."""
    rng = np.random.default_rng(seed)
    loud = np.flatnonzero(np.abs(samples) > np.abs(samples).max() * 0.01)   # the squelch follows the last word (-40 dB)
    samples = samples[:loud[-1] + int(0.04 * RATE)]
    hiss = rng.normal(0, 0.004, len(samples)).astype(np.float32)
    n = int(0.07 * RATE)
    tail = (rng.normal(0, 0.09, n) * np.exp(-np.linspace(0, 5, n))).astype(np.float32)
    gap = np.zeros(int(0.03 * RATE), np.float32)
    return np.concatenate([samples + hiss, gap, tail])


BEDS = {   # (band in Hz, wobble Hz, wobble depth): noise shaped in the frequency domain
    'wind': ((300, 1400), 0.8, 0.5),   # air rushing past an open vehicle or a cockpit
    'engine': ((30, 140), 17, 0.35),   # a tank's diesel under the intercom
    'hum': ((60, 260), 9, 0.25),       # a harvester's machinery
}


def bed(samples, kind, db, seed):
    """A quiet bed of noise `db` under the speech's level, faded in and out with the line."""
    (lo, hi), rate, depth = BEDS[kind]
    rng = np.random.default_rng(1000 + seed)
    n = len(samples)
    spectrum = np.fft.rfft(rng.normal(0, 1, n))
    f = np.fft.rfftfreq(n, 1 / RATE)
    spectrum[(f < lo) | (f > hi)] = 0
    noise = np.fft.irfft(spectrum, n)
    t = np.arange(n) / RATE
    noise *= 1 - depth * (0.5 + 0.5 * np.sin(2 * np.pi * rate * t + rng.uniform(0, 6.28)))
    speech = samples[np.abs(samples) > np.abs(samples).max() * 0.01]
    noise *= np.sqrt(np.mean(speech ** 2)) * 10 ** (db / 20) / max(np.sqrt(np.mean(noise ** 2)), 1e-9)
    fade = np.ones(n)
    a, b = int(0.03 * RATE), int(0.08 * RATE)
    fade[:a] = np.linspace(0, 1, a)
    fade[-b:] = np.linspace(1, 0, b)
    return (samples + noise * fade).astype(np.float32)


def ffmpeg(*args):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-2000:])
    return r.stderr


def loudness(path):
    """Integrated loudness (LUFS) and true peak (dBTP) of a file."""
    log = ffmpeg('-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-')
    summary = log[log.rfind('Summary:'):]
    i = float(re.search(r'I:\s+(-?[\d.]+|-inf) LUFS', summary).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', summary).group(1))
    return i, tp


def render_line(kokoro, spec, text, seed, tmp):
    voice = voice_style(kokoro, spec['voice'])
    samples, rate = kokoro.create(phonemes(kokoro, text, spec['lang']), voice=voice, speed=spec['speed'], lang=spec['lang'], is_phonemes=True)
    assert rate == RATE, rate
    samples = np.asarray(samples, np.float32)
    if spec['role'] == 'unit':
        samples = speech_only(samples)
    lead = np.zeros(int(0.03 * RATE), np.float32)
    samples = np.concatenate([lead, samples, np.zeros(int((0.02 if spec.get('radio') else 0.12) * RATE), np.float32)])   # room for the echo tail
    if spec.get('radio'):
        samples = radio(samples, seed)
    if spec.get('bed'):
        samples = bed(samples, *spec['bed'], seed)
    raw, shaped = os.path.join(tmp, 'raw.wav'), os.path.join(tmp, 'shaped.wav')
    sf.write(raw, samples, RATE, subtype='FLOAT')
    ffmpeg('-i', raw, '-af', ','.join(spec['chain'] + ['aresample=24000', 'afade=t=in:d=0.01']), '-c:a', 'pcm_f32le', shaped)
    return shaped


def encode(shaped, dest):
    i, _ = loudness(shaped)
    gain = TARGET_LUFS - i
    limit = 10 ** (CEILING_DB / 20)
    ffmpeg('-i', shaped, '-af', f'volume={gain:.2f}dB,alimiter=limit={limit:.4f}:attack=2:release=40:level=disabled,'   # trailing silence off, a short fade out
           'areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.03,afade=t=in:d=0.03,areverse',
           '-ac', '1', '-ar', str(RATE), '-c:a', 'libopus', '-b:a', BITRATE, '-vbr', 'on', '-application', 'audio',
           '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', dest)


def seconds_of(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True)
    return round(float(r.stdout.strip()), 3)


def write_manifest(out, lines):
    """The manifest from what is on disk: every set, every line of lines.json that has its file."""
    manifest = {'version': 1, 'houses': HOUSE_SETS, 'shared': SHARED_SET, 'sets': {}}
    for name, spec in SETS.items():
        table = table_of(lines, name, spec)
        entry = {'voice': voice_name(spec['voice']), 'role': spec['role'], **({'group': name} if spec['role'] == 'unit' else {}), 'lines': {}}
        for key in sorted(table):
            file = f'{name}/{key}.ogg'
            if os.path.exists(os.path.join(out, file)):
                entry['lines'][key] = {'file': file, 'text': table[key], 'seconds': seconds_of(os.path.join(out, file))}
        if entry['lines']:
            manifest['sets'][name] = entry
    if SHARED_SET not in manifest['sets']:
        del manifest['shared']   # not rendered: every house keeps its own
    tmp = os.path.join(out, 'manifest.json.tmp')
    with open(tmp, 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, os.path.join(out, 'manifest.json'))


def audition(kokoro, lines, args):
    """Each named set's lines in each candidate voice (its own chain), under <dir>/<set>/<voice>/, and a page to listen."""
    voices = [v for v in args.voices.split(',') if v]
    with tempfile.TemporaryDirectory() as tmp:
        for name in args.sets.split(','):
            spec, table = SETS[name], table_of(lines, name, SETS[name])
            for voice in voices or [voice_name(spec['voice'])]:
                v, speed, factor = (voice.split(':') + ['', ''])[:3]   # name:speed:tape factor (bm_lewis:0.95:0.9) tries those too
                trial = {**spec, 'voice': v, 'speed': float(speed or spec['speed'])}
                if v != voice_name(spec['voice']):
                    trial['lang'] = 'en-gb' if v.startswith('b') else 'en-us'   # bf_/bm_ voices are British
                else:
                    trial['voice'] = spec['voice']
                if factor:
                    trial['chain'] = slower(float(factor)) + [f for f in spec['chain'] if not f.startswith(('asetrate', 'aresample'))]
                folder = os.path.join(args.audition, name, voice.replace(':', '_'))
                os.makedirs(folder, exist_ok=True)
                for n, (key, text) in enumerate(table.items()):
                    if args.only and key not in args.only.split(','):
                        continue
                    dest = os.path.join(folder, f'{key}.ogg')
                    if not (args.skip_existing and os.path.exists(dest)):
                        encode(render_line(kokoro, trial, text, n, tmp), dest)
                    print(f'{name}/{voice}/{key}.ogg  {seconds_of(dest):5.2f} s  {text}', flush=True)
    audition_page(args.audition, lines)


def audition_page(folder, lines):
    """index.html: a row per line, a player per candidate voice."""
    rows = []
    for name in sorted(d for d in os.listdir(folder) if os.path.isdir(os.path.join(folder, d)) and d in SETS):
        spec, table = SETS[name], table_of(lines, name, SETS[name])
        voices = sorted(os.listdir(os.path.join(folder, name)))
        rows.append(f'<h2>{name} <small>(shipped: {html.escape(voice_name(spec["voice"]))})</small></h2><table><tr><th>line</th>'
                    + ''.join(f'<th>{html.escape(v)}</th>' for v in voices) + '</tr>')
        for key, text in table.items():
            cells = ''.join(f'<td><audio controls preload="none" src="{name}/{v}/{key}.ogg"></audio></td>' if os.path.exists(os.path.join(folder, name, v, f'{key}.ogg')) else '<td></td>' for v in voices)
            rows.append(f'<tr><td>{key}<br><b>{html.escape(text)}</b></td>{cells}</tr>')
        rows.append('</table>')
    page = ('<!doctype html><meta charset="utf-8"><title>Unit voices audition</title><style>body{font:14px sans-serif;margin:16px;background:#1b1712;color:#eadfc8}'
            'table{border-collapse:collapse;margin-bottom:24px}td,th{border:1px solid #4a3f30;padding:4px 6px;text-align:left;vertical-align:top}audio{width:180px;height:32px}</style>'
            '<h1>Unit voices: audition</h1><p>Each column a candidate voice through the group\'s own chain. The shipped choice is named by each heading.</p>'
            + '\n'.join(rows))
    with open(os.path.join(folder, 'index.html'), 'w') as f:
        f.write(page)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--models', required=True, help='directory holding kokoro-v1.0.onnx and voices-v1.0.bin')
    ap.add_argument('--sets', default=','.join(SETS), help='comma-separated voice sets to render')
    ap.add_argument('--only', default='', help='comma-separated line ids to render (default: all)')
    ap.add_argument('--skip-existing', action='store_true', help='keep lines already rendered (to resume, or to run sets in parallel)')
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--audition', default='', help='render the sets\' lines in --voices into this directory instead, with an index.html to listen')
    ap.add_argument('--voices', default='', help='candidate voices for --audition (name, or name:speed:tape factor)')
    args = ap.parse_args()
    import onnxruntime as rt
    from kokoro_onnx import Kokoro
    opts = rt.SessionOptions()
    opts.intra_op_num_threads = int(os.environ.get('VOICE_THREADS', '4'))   # polite on a shared machine
    session = rt.InferenceSession(os.path.join(args.models, 'kokoro-v1.0.onnx'), opts, providers=['CPUExecutionProvider'])
    kokoro = Kokoro.from_session(session, os.path.join(args.models, 'voices-v1.0.bin'))
    with open(os.path.join(os.path.dirname(__file__), 'lines.json')) as f:
        lines = json.load(f)
    if args.audition:
        return audition(kokoro, lines, args)
    only = set(filter(None, args.only.split(',')))
    with tempfile.TemporaryDirectory() as tmp:
        for name in args.sets.split(','):
            spec = SETS[name]
            os.makedirs(os.path.join(args.out, name), exist_ok=True)
            for n, (key, text) in enumerate(table_of(lines, name, spec).items()):
                dest = os.path.join(args.out, name, f'{key}.ogg')
                if (only and key not in only) or (args.skip_existing and os.path.exists(dest)):
                    continue
                encode(render_line(kokoro, spec, text, n, tmp), dest)
                print(f'{name}/{key}.ogg  {seconds_of(dest):5.2f} s  {text}', flush=True)
    write_manifest(args.out, lines)


if __name__ == '__main__':
    main()
