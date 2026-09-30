#!/usr/bin/env python3
"""Announcer voices (spec §6 Announcer; research audio-ui-controls.md §A.1): renders every line of
scripts/voices/lines.json with the Kokoro-82M neural TTS (kokoro-onnx), gives each voice set its own
character with an ffmpeg chain, normalises loudness and writes small mono Ogg Opus files plus
assets/voice/manifest.json (house -> set, set -> line id -> file). The runtime is src/audio/voice.js.

One announcer per Great House, like the original's three (Atreides calm and clear, Harkonnen deep and
harsh, Ordos cool and precise), and one field-radio voice shared by every house for the units' order
acknowledgements, as the original shared those.

Reproduce (nothing lands in the repo but assets/voice):
  uv venv /tmp/tts/.venv && uv pip install -p /tmp/tts/.venv/bin/python kokoro-onnx==0.6.1 soundfile
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  /tmp/tts/.venv/bin/python scripts/voices/generate.py --models <dir with both files> [--sets atreides,units] [--only building,unitReady]
Needs ffmpeg with libopus and librubberband on the PATH. Licences: see README.md, "Announcer voices".
"""
import argparse, json, os, re, subprocess, sys, tempfile
import numpy as np
import soundfile as sf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'voice')
TARGET_LUFS = -16.0      # every line equally loud; voice.js sets the level against the effects
CEILING_DB = -2.0        # peak limit after normalising: Opus overshoots it by a few tenths
BITRATE = '32k'          # Opus, mono: speech is transparent well below this
RATE = 24000             # Kokoro's output rate

# The ffmpeg chains: band-limit gently, shape presence, compress, then a touch of a short room (the command
# console) or of a field radio. Loudness is normalised afterwards, so gains here only shape the timbre.
CONSOLE_ROOM = 'aecho=0.85:0.55:13|29|47:0.16|0.09|0.04'
SETS = {
    'atreides': {   # calm and clear
        'voice': 'af_heart', 'lang': 'en-us', 'speed': 0.94, 'role': 'announcer',
        'chain': ['highpass=f=120:p=1', 'lowpass=f=9800:p=1', 'equalizer=f=260:t=q:w=1.1:g=-2.5', 'equalizer=f=3200:t=q:w=1.3:g=2.5',
                  'acompressor=threshold=-24dB:ratio=3:attack=4:release=90:makeup=3', CONSOLE_ROOM],
    },
    'harkonnen': {   # deep and harsh
        'voice': 'am_fenrir', 'lang': 'en-us', 'speed': 0.9, 'role': 'announcer',   # pitched and formant-shifted down, with some grit
        'chain': ['rubberband=pitch=0.9:formant=shifted', 'highpass=f=80:p=1', 'lowpass=f=9000:p=1', 'equalizer=f=300:t=q:w=1:g=-2',
                  'equalizer=f=2500:t=q:w=1.2:g=5', 'equalizer=f=5000:t=q:w=1.2:g=3', 'volume=9dB', 'asoftclip=type=atan:threshold=0.6:output=1',
                  'volume=-6dB', 'acompressor=threshold=-22dB:ratio=5:attack=3:release=70:makeup=3', 'aecho=0.85:0.5:9|21|37:0.18|0.1|0.05'],
    },
    'ordos': {   # cool and precise
        'voice': 'bf_emma', 'lang': 'en-gb', 'speed': 1.0, 'role': 'announcer',
        'chain': ['highpass=f=150:p=1', 'lowpass=f=10500:p=1', 'equalizer=f=300:t=q:w=1:g=-3', 'equalizer=f=5200:t=q:w=1.2:g=2.5',
                  'aecho=0.9:0.45:4.5:0.22', 'acompressor=threshold=-24dB:ratio=3.5:attack=3:release=80:makeup=3', 'aecho=0.85:0.5:11|25|41:0.14|0.08|0.04'],
    },
    'units': {   # a soldier on a field radio, shared by every house (the original shared its acknowledgements)
        'voice': 'am_michael', 'lang': 'en-us', 'speed': 1.08, 'role': 'units', 'radio': True,
        'chain': ['highpass=f=320:p=2', 'lowpass=f=3600:p=2', 'equalizer=f=1700:t=q:w=1.2:g=5', 'volume=8dB',
                  'asoftclip=type=tanh:threshold=0.7:output=1', 'volume=-5dB', 'lowpass=f=4800:p=2',   # the clipper's overtones stay in the radio's band
                  'acompressor=threshold=-20dB:ratio=6:attack=2:release=60:makeup=3'],
    },
}
HOUSE_SETS = {'atreides': 'atreides', 'harkonnen': 'harkonnen', 'ordos': 'ordos'}

# Names espeak gets wrong, as Kokoro phonemes per accent.
PRONOUNCE = {
    'Atreides': {'en-us': 'ɐtɹˈeɪdiːz', 'en-gb': 'ətɹˈeɪdiːz'},
    'Harkonnen': {'en-us': 'hˈɑːɹkənən', 'en-gb': 'hˈɑːkənən'},
    'Ordos': {'en-us': 'ˈɔːɹdoʊs', 'en-gb': 'ˈɔːdɒs'},
    'Fremen': {'en-us': 'fɹˈɛmən', 'en-gb': 'fɹˈɛmən'},
    'Wormsign': {'en-us': 'wˈɜɹm sˌaɪn', 'en-gb': 'wˈɜːm sˌaɪn'},
}


# Whole lines whose stress espeak gets wrong ("On hold" came out as one word).
PHRASES = {
    'On hold.': {'en-us': 'ˈɔn hˈoʊld.', 'en-gb': 'ˈɒn hˈəʊld.'},
}


def phonemes(kokoro, text, lang):
    if text in PHRASES:
        return PHRASES[text][lang]
    out = kokoro.tokenizer.phonemize(text, lang)
    for word, by_lang in PRONOUNCE.items():
        if word in text:
            said = kokoro.tokenizer.phonemize(word, lang).strip()
            if said not in out:
                sys.exit(f'cannot respell {word!r} in {text!r}: {said!r} not in {out!r}')
            out = out.replace(said, by_lang[lang])
    return out


def radio(samples, seed):
    """A faint hiss under the line and a short squelch after it, for the field-radio set."""
    rng = np.random.default_rng(seed)
    loud = np.flatnonzero(np.abs(samples) > np.abs(samples).max() * 0.01)   # the squelch follows the last word (-40 dB)
    samples = samples[:loud[-1] + int(0.04 * RATE)]
    hiss = rng.normal(0, 0.004, len(samples)).astype(np.float32)
    n = int(0.07 * RATE)
    tail = (rng.normal(0, 0.09, n) * np.exp(-np.linspace(0, 5, n))).astype(np.float32)
    gap = np.zeros(int(0.03 * RATE), np.float32)
    return np.concatenate([samples + hiss, gap, tail])


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
    samples, rate = kokoro.create(phonemes(kokoro, text, spec['lang']), voice=spec['voice'], speed=spec['speed'], lang=spec['lang'], is_phonemes=True)
    assert rate == RATE, rate
    samples = np.asarray(samples, np.float32)
    lead = np.zeros(int(0.03 * RATE), np.float32)
    samples = np.concatenate([lead, samples, np.zeros(int((0.02 if spec.get('radio') else 0.12) * RATE), np.float32)])   # room for the echo tail
    if spec.get('radio'):
        samples = radio(samples, seed)
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
    manifest = {'version': 1, 'houses': HOUSE_SETS, 'sets': {}}
    for name, spec in SETS.items():
        table = lines['units' if spec['role'] == 'units' else 'announcer']
        entry = {'voice': spec['voice'], 'role': spec['role'], 'lines': {}}
        for key in sorted(table):
            file = f'{name}/{key}.ogg'
            if os.path.exists(os.path.join(out, file)):
                entry['lines'][key] = {'file': file, 'text': table[key], 'seconds': seconds_of(os.path.join(out, file))}
        if entry['lines']:
            manifest['sets'][name] = entry
    tmp = os.path.join(out, 'manifest.json.tmp')
    with open(tmp, 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, os.path.join(out, 'manifest.json'))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--models', required=True, help='directory holding kokoro-v1.0.onnx and voices-v1.0.bin')
    ap.add_argument('--sets', default=','.join(SETS), help='comma-separated voice sets to render')
    ap.add_argument('--only', default='', help='comma-separated line ids to render (default: all)')
    ap.add_argument('--skip-existing', action='store_true', help='keep lines already rendered (to resume, or to run sets in parallel)')
    ap.add_argument('--out', default=OUT)
    args = ap.parse_args()
    import onnxruntime as rt
    from kokoro_onnx import Kokoro
    opts = rt.SessionOptions()
    opts.intra_op_num_threads = int(os.environ.get('VOICE_THREADS', '4'))   # polite on a shared machine
    session = rt.InferenceSession(os.path.join(args.models, 'kokoro-v1.0.onnx'), opts, providers=['CPUExecutionProvider'])
    kokoro = Kokoro.from_session(session, os.path.join(args.models, 'voices-v1.0.bin'))
    with open(os.path.join(os.path.dirname(__file__), 'lines.json')) as f:
        lines = json.load(f)
    only = set(filter(None, args.only.split(',')))
    with tempfile.TemporaryDirectory() as tmp:
        for name in args.sets.split(','):
            spec = SETS[name]
            table = lines['units' if spec['role'] == 'units' else 'announcer']
            os.makedirs(os.path.join(args.out, name), exist_ok=True)
            for n, (key, text) in enumerate(table.items()):
                dest = os.path.join(args.out, name, f'{key}.ogg')
                if (only and key not in only) or (args.skip_existing and os.path.exists(dest)):
                    continue
                encode(render_line(kokoro, spec, text, n, tmp), dest)
                print(f'{name}/{key}.ogg  {seconds_of(dest):5.2f} s  {text}', flush=True)
    write_manifest(args.out, lines)


if __name__ == '__main__':
    main()
