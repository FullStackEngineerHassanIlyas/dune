#!/usr/bin/env python3
"""Listening by measurement, for the Mentats' voices (scripts/voices/mentat.py; an agent cannot listen): for every
rendered clip (<house>/<key>.ogg beside its <key>.json track, or an audition's <house>/<candidate>/<key>.ogg) it
measures the loudness and true peak (EBU R128), the voice's pitch (median F0 of the voiced frames, and its spread
in semitones), its brightness (spectral centroid), its pace (words a minute of speech), how well Whisper hears the
words (word error rate against the clip's own text, numbers said as words), and whether the track's timings sit on
the sound: Whisper's own word starts against the track's (median and 90th percentile of the difference, words
matched in order), each sentence's start against the moment its sound rises, and the share of the track's
words that fall on speech rather than silence.

  /tmp/tts/bin/python scripts/voices/mentat_measure.py <folder> [--out results.json] [--model small.en] [--whisper-dir <dir>]
Needs ffmpeg, numpy and faster-whisper (uv pip install faster-whisper); WHISPER_THREADS (default 2).
"""
import argparse, difflib, json, os, re, subprocess, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mentat import number_words   # noqa: E402  (numbers are said as words: compare them as words)

RATE = 16000


def decode(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-'], capture_output=True)
    return np.frombuffer(r.stdout, np.float32).copy()


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    s = r.stderr[r.stderr.rfind('Summary:'):]
    return float(re.search(r'I:\s+(-?[\d.]+) LUFS', s).group(1)), float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', s).group(1))


def pitch(x):
    """Median F0 (Hz) of the voiced frames and the spread of F0 (interquartile range, semitones): normalised
    autocorrelation of 40 ms frames every 10 ms, 60-320 Hz, a frame voiced when its peak passes 0.55."""
    n, hop = int(0.04 * RATE), int(0.01 * RATE)
    lo, hi = RATE // 320, RATE // 60
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop]
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    loud = rms > np.percentile(rms, 95) * 0.1
    f0 = []
    win = np.hanning(n)
    for fr in frames[loud]:
        fr = (fr - fr.mean()) * win
        spec = np.fft.rfft(fr, 2 * n)
        ac = np.fft.irfft(spec * np.conj(spec))[:n]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.55 and 0 < k < n - 1:
            a, b, c = ac[k - 1], ac[k], ac[k + 1]   # parabolic peak
            d = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) else 0
            f0.append(RATE / (k + d))
    if len(f0) < 10:
        return None, None
    f0 = np.array(f0)
    st = 12 * np.log2(f0 / np.median(f0))
    return float(np.median(f0)), float(np.percentile(st, 75) - np.percentile(st, 25))


def centroid(x):
    """The spectral centroid (Hz) of the loud part: how bright the voice is."""
    n = 1024
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::n // 2]
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    frames = frames[rms > np.percentile(rms, 95) * 0.1]
    mag = np.abs(np.fft.rfft(frames * np.hanning(n), axis=1))
    f = np.fft.rfftfreq(n, 1 / RATE)
    return float(np.sum(mag * f) / np.sum(mag))


def spelling(word):
    """British and American spellings alike (Whisper writes 'honor' and 'defenses' for the story's 'honour' and
    'defences'): -our as -or, -ence as -ense, z as s."""
    return re.sub(r'ence(s?)$', r'ense\1', re.sub(r'(?<=.o)ur(s|ed|ing)?$', lambda m: 'r' + (m.group(1) or ''), word)).replace('z', 's')


def norm_words(text):
    """Lower case words, numbers as words, hyphens and commas in numbers undone, one spelling."""
    text = re.sub(r'(\d),(\d)', r'\1\2', text.lower())
    text = re.sub(r'\d+', lambda m: number_words(int(m.group(0))), text)
    return [spelling(w) for w in re.findall(r"[a-z]+(?:'[a-z]+)?", text.replace('-', ' '))]


def wer(ref, hyp):
    d = np.arange(len(hyp) + 1)
    for i, r in enumerate(ref, 1):
        prev, d[0] = d.copy(), i
        for j, h in enumerate(hyp, 1):
            d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + (r != h))
    return d[len(hyp)] / max(1, len(ref))


def on_speech(x, track):
    """The share of the track's words whose time holds speech: the loudest 10 ms in the word passes -30 dB of the
    clip's loud level (95th percentile of 10 ms RMS)."""
    win = int(0.01 * RATE)
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode='same') + 1e-12)
    ref = np.percentile(env, 95)
    ok = 0
    for s, e, *_ in track['words']:
        seg = env[int(s / 1000 * RATE):max(int(s / 1000 * RATE) + 1, int(e / 1000 * RATE))]
        ok += bool(len(seg)) and 20 * np.log10(seg.max() / ref) > -30
    return ok / max(1, len(track['words']))


def onsets(x, track):
    """Each sentence's start in the track less the moment its sound rises past -30 dB of the clip's loud level
    (ms; positive: the track is late), looked for from 300 ms before it."""
    win = int(0.01 * RATE)
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode='same') + 1e-12)
    db = 20 * np.log10(env / np.percentile(env, 95))
    out = []
    for s, *_ in track['sentences']:
        a = int(max(0, s / 1000 - 0.3) * RATE)
        out.append(s - (a + int(np.argmax(db[a:] > -30))) / RATE * 1000)
    return out


# the names the Mentats say: (what the text holds, what Whisper's transcript must hold to count as heard right)
NAMES = {'Arrakis': ('arrakis', 'arrakis'), 'Atreides': ('atreides', 'atreides'), 'Ordos': (r'\bordos', r'\bordos'), 'Harkonnen': ('harkonnen', 'harkonnen'),
         'Sardaukar': ('sardaukar', 'sardaukar'), 'Fremen': ('fremen', 'fremen'), 'Ornithopter': ('ornithopter', 'ornithopter'), 'Carryall': ('carryall', r'carry[\s-]?all')}


def names_heard(text, heard):
    """{name: [heard right, said]}: each name counted in the text and in what Whisper heard (the lesser of the two counts)."""
    out = {}
    for name, (said, got) in NAMES.items():
        n = len(re.findall(said, text, re.I))
        if n:
            out[name] = [min(n, len(re.findall(got, heard, re.I))), n]
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('folder')
    ap.add_argument('--out', default='')
    ap.add_argument('--model', default='small.en')
    ap.add_argument('--whisper-dir', default=None)
    ap.add_argument('--no-whisper', action='store_true')
    args = ap.parse_args()
    model = None
    if not args.no_whisper:
        from faster_whisper import WhisperModel
        model = WhisperModel(args.model, device='cpu', compute_type='int8', cpu_threads=int(os.environ.get('WHISPER_THREADS', '2')), download_root=args.whisper_dir)
    results = []
    for dirpath, _, files in sorted(os.walk(args.folder)):
        for f in sorted(files):
            if not f.endswith('.ogg') or not os.path.exists(os.path.join(dirpath, f[:-4] + '.json')):
                continue
            path = os.path.join(dirpath, f)
            rel = os.path.relpath(path, args.folder).split(os.sep)
            track = json.load(open(path[:-4] + '.json'))
            x = decode(path)
            text = ' '.join(track['lines'])
            want = norm_words(text)
            lufs, peak = loudness(path)
            f0, spread = pitch(x)
            speech_s = sum(e - s for s, e, *_ in track['sentences']) / 1000
            row = {'house': rel[0], 'voice': rel[1] if len(rel) == 3 else '', 'key': f[:-4], 'seconds': round(len(x) / RATE, 3), 'ms': track['ms'],
                   'bytes': os.path.getsize(path), 'lufs': lufs, 'peak': peak, 'f0': f0 and round(f0, 1), 'spread': spread and round(spread, 2),
                   'centroid': round(centroid(x)), 'wpm': round(len(track['words']) / speech_s * 60, 1), 'onSpeech': round(on_speech(x, track), 3),
                   'onsetsMs': [round(d) for d in onsets(x, track)]}
            if model:
                pad = np.concatenate([np.zeros(RATE // 2, np.float32), x, np.zeros(RATE // 2, np.float32)])
                segs, _ = model.transcribe(pad, language='en', beam_size=5, condition_on_previous_text=False, vad_filter=False, word_timestamps=True)
                heard_words = [w for s in segs for w in (s.words or [])]
                heard = ''.join(w.word for w in heard_words).strip()
                got = norm_words(heard)
                row['heard'] = heard
                row['names'] = names_heard(text, heard)
                row['wer'] = round(wer(want, got), 3)
                # Whisper's word starts against the track's: each word as said (a number's first word) matched in order
                said = [(norm_words(w.word), w.start - 0.5) for w in heard_words]
                said = [(ws[0], t) for ws, t in said if ws]
                mine = [(norm_words(track['lines'][li][c0:c1]), s / 1000) for s, e, li, c0, c1 in track['words']]
                mine = [(ws[0], t) for ws, t in mine if ws]
                sm = difflib.SequenceMatcher(a=[w for w, _ in mine], b=[w for w, _ in said], autojunk=False)
                diffs = [abs(mine[b.a + k][1] - said[b.b + k][1]) for b in sm.get_matching_blocks() for k in range(b.size)]
                row['startErrMs'] = round(float(np.median(diffs)) * 1000) if diffs else None
                row['startErrP90Ms'] = round(float(np.percentile(diffs, 90)) * 1000) if diffs else None
                row['matched'] = round(len(diffs) / max(1, len(mine)), 3)
            results.append(row)
            print(f"{row['house']:9} {row['voice']:34} {row['key']:12} {row['seconds']:6.2f}s {row['lufs']:6.1f} LUFS pk {row['peak']:5.1f} "
                  f"F0 {row['f0'] or 0:5.1f} ±{row['spread'] or 0:4.1f}st c {row['centroid']:4d} {row['wpm']:5.1f} wpm on {row['onSpeech']:.2f}"
                  + (f" WER {row['wer']:.2f} Δt {row['startErrMs']}/{row['startErrP90Ms']} ms  {row['heard']!r}" if model else ''), flush=True)
    if args.out:
        json.dump(results, open(args.out, 'w'), indent=1)
    groups = {}
    for r in results:
        groups.setdefault((r['house'], r['voice']), []).append(r)
    print('\nsummary')
    for (house, voice), rs in groups.items():
        med = lambda k: float(np.median([r[k] for r in rs if r.get(k) is not None])) if any(r.get(k) is not None for r in rs) else float('nan')
        print(f"{house:9} {voice:34} n {len(rs):3} {sum(r['seconds'] for r in rs):7.1f}s {sum(r['bytes'] for r in rs) / 1e6:5.2f} MB "
              f"LUFS {min(r['lufs'] for r in rs):.1f}..{max(r['lufs'] for r in rs):.1f} pk<={max(r['peak'] for r in rs):.1f} F0 {med('f0'):.1f} "
              f"±{med('spread'):.1f}st c {med('centroid'):.0f} {med('wpm'):.0f} wpm on>={min(r['onSpeech'] for r in rs):.2f}"
              + f" onsets {np.median([d for r in rs for d in r['onsetsMs']]):+.0f} ms (p10 {np.percentile([d for r in rs for d in r['onsetsMs']], 10):+.0f}, p90 {np.percentile([d for r in rs for d in r['onsetsMs']], 90):+.0f})"
              + (f" WER mean {np.mean([r['wer'] for r in rs]):.3f} max {max(r['wer'] for r in rs):.2f} Δt med {med('startErrMs'):.0f} p90 {med('startErrP90Ms'):.0f} ms" if model else ''))
        if model:
            total = {}
            for r in rs:
                for name, (a, b) in r['names'].items():
                    t = total.setdefault(name, [0, 0])
                    t[0] += a
                    t[1] += b
            print(f"{'':9} {'':34} names heard right: " + ', '.join(f'{name} {a}/{b}' for name, (a, b) in total.items()))


if __name__ == '__main__':
    main()
