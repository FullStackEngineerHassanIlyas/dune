#!/usr/bin/env python3
"""The Mentats' voices (notes docs/superpowers/notes/2026-10-05-mentat-voice.md): every word a Mentat says on the
campaign's screens (the clips of src/audio/mentat-lines.js, read from src/data/story.js), spoken by Kokoro-82M
(kokoro-onnx) in one voice per Mentat, slowly and gravely, in the room of his chamber, with a timing track per clip
for the text and the face: the words (start, end, and where each sits in the screen's lines), visemes, an amplitude
envelope at 30 Hz and an expression per sentence. Writes assets/voice/mentat/<house>/<key>.ogg (mono Ogg Opus,
-19 LUFS like the music) and <key>.json, and assets/voice/mentat/manifest.json. The runtime is
src/audio/mentat-voice.js; the announcer and unit voices are scripts/voices/generate.py's and are not touched.

The timings are Kokoro's own: a copy of the model graph with one more output, the frames (25 ms each, 600 samples
at 24 kHz) it gives every phoneme, so nothing is guessed after the fact. Each sentence is spoken on its own (the
model reads a sentence at a time well, and it bounds the phoneme count), its silence trimmed by the speech's energy,
and the sentences joined with the Mentat's own pause.

Reproduce (the venv of generate.py, plus onnx to add that output; the copy is written next to the models once):
  uv venv --python 3.12 /tmp/tts && uv pip install -p /tmp/tts/bin/python kokoro-onnx==0.6.1 soundfile onnx
  (kokoro-v1.0.onnx and voices-v1.0.bin: see generate.py)
  /tmp/tts/bin/python scripts/voices/mentat.py --models <dir> [--houses atreides] [--only m1-briefing,page-1] [--skip-existing]
  /tmp/tts/bin/python scripts/voices/mentat.py --models <dir> --audition <out dir> --houses ordos --only m2-briefing \
      --voices 'bm_lewis*0.7+am_eric*0.3:0.9:0.96,bm_daniel:0.9:1'     (voice blend : Kokoro speed : tape factor)
  /tmp/tts/bin/python scripts/voices/mentat_measure.py <dir>   (pitch, loudness, pace, Whisper word error rate, timing)
Needs ffmpeg with libopus and node on the PATH. VOICE_THREADS (default 2) sets the ONNX threads.
"""
import argparse, json, os, re, subprocess, sys, tempfile
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate as G   # noqa: E402  (ffmpeg, loudness, voice blends: the same tools as the announcer)

ROOT = G.ROOT
OUT = os.path.join(ROOT, 'assets', 'voice', 'mentat')
RATE = G.RATE                # Kokoro's output, 24 kHz
FRAME = 600                  # samples per duration frame (25 ms)
TARGET_LUFS = -19.0          # as loud as the music (src/audio/music), so the menu needs no other balance
CEILING_DB = -2.0
BITRATE = '20k'              # Opus, mono, speech: about 2.5 kB a second; the whole campaign stays near 5 MB
ENV_HZ = 30                  # the envelope's rate
B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'   # 0..63, one character a frame

# ——— the three Mentats ———
# voice: a Kokoro voice or a blend [(name, weight)]; speed: Kokoro's; tape: played back at this share of its speed
# (pitch and formants down together, as generate.py's slower()); pause: seconds between sentences; chain: ffmpeg
# filters for the timbre (before the room); room: the chamber, a light reverb (room_ir below).
# Chosen by measured auditions (mentat_measure.py on page-1, question, m3-win, then m2-briefing and m2-lose; notes):
# every blend kept was heard word for word by Whisper; daniel+fenrir ('House Haakonnen') and lewis+onyx ('Harkening')
# were not. Cyril is george with fable (median F0 about 130 Hz, a lively 4 semitones of spread: warm, older than
# george alone at 139), Radnor daniel with onyx slowed to 90 % (108 Hz and a flat 2 semitones: cold menace, dark
# timbre), Ammon eric with lewis, American, untaped (about 140 Hz, smooth): three voices apart in pitch and accent.
# All three a little slower than speech (Kokoro speed 0.82-0.85): with the pauses about 120 words a minute.
MENTATS = {
    'atreides': {   # Cyril: a calm, warm, wise older man; Caladan's chamber with its window on the sea
        'name': 'Cyril', 'voice': [('bm_george', 0.6), ('bm_fable', 0.4)], 'lang': 'en-gb', 'speed': 0.82, 'tape': 0.94, 'pause': 0.5,
        'chain': ['highpass=f=70:p=1', 'lowpass=f=10000:p=1', 'equalizer=f=220:t=q:w=1:g=2', 'equalizer=f=500:t=q:w=1.2:g=-1.5',
                  'equalizer=f=3000:t=q:w=1.4:g=2', 'acompressor=threshold=-24dB:ratio=2.5:attack=6:release=120:makeup=2'],
        'room': {'name': 'Caladan sea window', 'predelay': 0.012, 'early': [(0.009, 0.5), (0.017, 0.35), (0.029, 0.25), (0.041, 0.15)],
                 'bands': [(80, 900, 0.75), (900, 4000, 0.55), (4000, 11000, 0.35)], 'wet': -17.0},
    },
    'harkonnen': {   # Radnor: harsh, menacing, contemptuous; the furnace hall of Giedi Prime, iron and dark
        'name': 'Radnor', 'voice': [('bm_daniel', 0.6), ('am_onyx', 0.4)], 'lang': 'en-gb', 'speed': 0.85, 'tape': 0.9, 'pause': 0.42,
        'chain': ['highpass=f=60:p=1', 'lowpass=f=9000:p=1', 'equalizer=f=300:t=q:w=1:g=-2', 'equalizer=f=2400:t=q:w=1.2:g=4',
                  'equalizer=f=5000:t=q:w=1.2:g=1.5', 'volume=6dB', 'asoftclip=type=atan:threshold=0.75:output=1', 'volume=-5dB',
                  'acompressor=threshold=-24dB:ratio=4:attack=4:release=90:makeup=3'],
        'room': {'name': 'Harkonnen furnace hall', 'predelay': 0.024, 'early': [(0.021, 0.45), (0.037, 0.35), (0.058, 0.25), (0.083, 0.18)],
                 'bands': [(60, 700, 1.6), (700, 3000, 1.0), (3000, 11000, 0.45)], 'wet': -16.0},
    },
    'ordos': {   # Ammon: smooth, cool, calculating; the Ordos ice hall, hard and bright
        'name': 'Ammon', 'voice': [('am_eric', 0.6), ('bm_lewis', 0.4)], 'lang': 'en-us', 'speed': 0.82, 'tape': 1.0, 'pause': 0.45,
        'chain': ['highpass=f=80:p=1', 'lowpass=f=11000:p=1', 'equalizer=f=300:t=q:w=1:g=-2', 'equalizer=f=1200:t=q:w=1:g=-1',
                  'equalizer=f=5500:t=q:w=1.2:g=2', 'acompressor=threshold=-24dB:ratio=3:attack=5:release=100:makeup=2'],
        'room': {'name': 'Ordos ice hall', 'predelay': 0.035, 'early': [(0.031, 0.4), (0.049, 0.3), (0.071, 0.22), (0.097, 0.15)],
                 'bands': [(80, 1000, 1.2), (1000, 5000, 1.3), (5000, 11000, 1.1)], 'wet': -18.0},
    },
}

# Names espeak says wrong, as Kokoro phonemes per accent (the whole word; a possessive keeps its 's').
PRONOUNCE = {
    'arrakis': {'en-us': 'ɐɹˈækɪs', 'en-gb': 'ɐɹˈakɪs'},
    'harkonnen': {'en-us': 'hɑːɹkˈɑːnən', 'en-gb': 'hɑːkˈɒnən'},   # har-KON-en: heard 'Harkonnen' in 23 of 26 whole clips; 'HAR-kənən' 21, 'HAR-kənɛn' 18 ('harkening', 'harken and')
    'atreides': {'en-us': 'ɐtɹˈeɪdiːz', 'en-gb': 'ətɹˈeɪdiːz'},
    'ordos': {'en-us': 'ˈɔːɹdoʊs', 'en-gb': 'ˈɔːdɒs'},
    'fremen': {'en-us': 'fɹˈɛmən', 'en-gb': 'fɹˈɛmən'},
    'caladan': {'en-us': 'kˈælədæn', 'en-gb': 'kˈaladan'},
    # SAR-də-kar: Whisper heard 'Sardaukar' in 22-26 of 32 whole clips (two runs; the rest 'sardicar', as many say it); 'SAR-dow-kar'
    # in 19 ('sardau car'), 'sar-DAW-kar' in 15 ('sardorcar'), though that one won on isolated sentences.
    'sardaukar': {'en-us': 'sˈɑːɹdəkˌɑːɹ', 'en-gb': 'sˈɑːdəkˌɑː'},
    'ornithopter': {'en-us': 'ˈɔːɹnɪθˌɑːptɚ', 'en-gb': 'ˈɔːnɪθˌɒptə'},
    'ornithopters': {'en-us': 'ˈɔːɹnɪθˌɑːptɚz', 'en-gb': 'ˈɔːnɪθˌɒptəz'},
    'melange': {'en-us': 'meɪlˈɑːnʒ', 'en-gb': 'meɪlˈɒnʒ'},
    'giedi': {'en-us': 'ɡˈiːdi', 'en-gb': 'ɡˈiːdi'},   # Giedi Prime: GEE-dee
    'wor': {'en-us': 'dˈʌbəljˌuː ˈoʊ ˈɑːɹ', 'en-gb': 'dˈʌbəljˌuː ˈəʊ ˈɑː'},   # the Harkonnen barracks, said letter by letter
}

ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
        'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']


def number_words(n):
    """1000 -> 'one thousand', 2700 -> 'twenty-seven hundred' (as credits are said), 450 -> 'four hundred and fifty'."""
    def under_100(k):
        return ONES[k] if k < 20 else TENS[k // 10] + ('' if k % 10 == 0 else '-' + ONES[k % 10])

    def under_1000(k):
        h, r = divmod(k, 100)
        return ' '.join(filter(None, [h and f'{ONES[h]} hundred', h and r and 'and', r and under_100(r)])) if h else under_100(k)
    if n < 1000:
        return under_1000(n)
    if n < 10000 and n % 100 == 0 and n % 1000:
        return f'{under_100(n // 100)} hundred'
    th, r = divmod(n, 1000)
    return ' '.join(filter(None, [f'{under_1000(th)} thousand', r and r < 100 and 'and', r and under_1000(r)]))


# ——— the text: display words, spoken tokens, sentences ———
WORD = re.compile(r"[A-Za-z0-9][A-Za-z0-9'\-]*")


def display_words(lines):
    """[(line, c0, c1, text, trailing)]: every word of the screen's lines where it stands, and what follows it up to the
    next word (punctuation, the space; a line's end counts as a space)."""
    out = []
    for li, line in enumerate(lines):
        ms = list(WORD.finditer(line))
        for k, m in enumerate(ms):
            end = ms[k + 1].start() if k + 1 < len(ms) else len(line)
            out.append([li, m.start(), m.end(), m.group(0), line[m.end():end]])
    return out


def spoken_tokens(word):
    """A display word as the words that are said, each with its phonemes when espeak must not read it."""
    core = word.replace(',', '')
    if core.isdigit():
        return [(t, None) for t in number_words(int(core)).split(' ')]
    base, poss = (word[:-2], "'s") if word.lower().endswith("'s") else (word, '')
    over = PRONOUNCE.get(base.lower())
    return [(word, (over, poss))] if over else [(word, None)]


def sentences(lines):
    """The clip's sentences: lists of display-word indices, split after '.', '?' or '!'."""
    words = display_words(lines)
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if re.search(r'[.?!]', w[4]):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return words, out


# ——— phonemes and their owners ———
STRESS = 'ˈˌː'
PUNCT = set(',.;:!?—…"()“”')


def chunks(ph):
    """The phoneme string's words: [(start, end)] of each run of letters (stress marks included)."""
    return [(m.start(), m.end()) for m in re.finditer(r'[^\s' + re.escape(''.join(PUNCT)) + r']+', ph)]


def align(ph, refs):
    """Which spoken token each character of the sentence's phonemes belongs to (None: a space or punctuation).
    When espeak kept every word apart, word for word; when it ran words together ('aɪɐm' for 'I am', 'ʌvðə' for
    'of the'), by an edit-distance alignment against each token said on its own."""
    owner = [None] * len(ph)
    cs = chunks(ph)
    if len(cs) == len(refs):
        for k, (a, b) in enumerate(cs):
            for i in range(a, b):
                owner[i] = k
        return owner
    # the letters of the sentence (no stress marks) against the tokens' letters, end to end
    pi = [i for a, b in cs for i in range(a, b) if ph[i] not in STRESS]
    rs, ro = [], []
    for k, r in enumerate(refs):
        for ch in r:
            if ch not in STRESS and not ch.isspace() and ch not in PUNCT:
                rs.append(ch)
                ro.append(k)
    n, m = len(pi), len(rs)
    d = np.zeros((n + 1, m + 1), np.int32)
    d[:, 0] = np.arange(n + 1)
    d[0, :] = np.arange(m + 1)
    for i in range(1, n + 1):
        c = ph[pi[i - 1]]
        for j in range(1, m + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (0 if c == rs[j - 1] else 1))
    i, j = n, m
    got = [None] * n
    while i > 0 and j > 0:
        c = ph[pi[i - 1]]
        if d[i, j] == d[i - 1, j - 1] + (0 if c == rs[j - 1] else 1):
            got[i - 1] = ro[j - 1]; i -= 1; j -= 1
        elif d[i, j] == d[i - 1, j] + 1:
            got[i - 1] = ro[j - 1] if j > 0 else 0; i -= 1
        else:
            j -= 1
    while i > 0:
        got[i - 1] = 0; i -= 1
    for k, i in enumerate(pi):
        owner[i] = got[k]
    # stress marks go with the letter after them; a token never goes backwards
    for a, b in cs:
        for i in range(b - 1, a - 1, -1):
            if owner[i] is None:
                owner[i] = owner[i + 1] if i + 1 < b and owner[i + 1] is not None else owner[i - 1] if i > a else 0
    last = 0
    for i in range(len(ph)):
        if owner[i] is not None:
            owner[i] = last = max(last, owner[i])
    return owner


# ——— the model, with its durations ———
DURATIONS_NODE = '/encoder/Cast_output_0'   # the frames per token, after rounding and the clip at 1
# Kokoro's sound runs ahead of its own frame counts: a sentence's first sound rises (-30 dB) 40-100 ms before the
# frame its first phoneme is given, and a word after a comma 40-75 ms (a probe of six sentences, median about
# 70 ms); with 70 ms taken off, the sentences of the first 31 clips still started a median 30 ms after their sound
# (104 sentences, p90 64 ms). Every phoneme's time is moved 100 ms earlier: the words and the mouth sit on the
# sound, a mouth a frame early rather than late (a face lagging its voice shows sooner than one leading it).
AUDIO_LEAD = 0.1


def durations_model(models):
    """kokoro-v1.0.onnx with the durations as a second output: made once (needs the onnx package), kept beside it."""
    path = os.path.join(models, 'kokoro-v1.0.durations.onnx')
    if not os.path.exists(path):
        import onnx
        m = onnx.load(os.path.join(models, 'kokoro-v1.0.onnx'))
        m.graph.output.append(onnx.helper.make_tensor_value_info(DURATIONS_NODE, onnx.TensorProto.INT64, None))
        onnx.save(m, path + '.tmp')
        os.replace(path + '.tmp', path)
    return path


class Voice:
    def __init__(self, models, threads):
        import onnxruntime as rt
        from kokoro_onnx import Kokoro
        opts = rt.SessionOptions()
        opts.intra_op_num_threads = threads
        opts.inter_op_num_threads = 1
        self.sess = rt.InferenceSession(durations_model(models), opts, providers=['CPUExecutionProvider'])
        self.kokoro = Kokoro.from_session(self.sess, os.path.join(models, 'voices-v1.0.bin'))
        self.vocab = self.kokoro.tokenizer.vocab

    def phonemize(self, text, lang):
        return self.kokoro.tokenizer.phonemize(text, lang)

    def sentence(self, spec, tokens):
        """One sentence: tokens [(text, display index, override, trailing)] -> audio, and [(char, token, t0, t1)] in seconds."""
        lang = spec['lang']
        text = ' '.join(t + tr for t, _, _, tr in tokens)
        ph = self.phonemize(text, lang)
        refs = []
        for t, _, over, _ in tokens:
            refs.append(over[0][lang] + ('z' if over[1] else '') if over else self.phonemize(re.sub(r"[^A-Za-z0-9'\- ]", '', t), lang))
        owner = align(ph, refs)
        # the names, said as written down above
        seq = list(zip(ph, owner))
        for k, (_, _, over, _) in enumerate(tokens):
            if not over:
                continue
            at = [i for i, (_, o) in enumerate(seq) if o == k]
            if not at:
                sys.exit(f'cannot respell token {k} of {text!r} ({ph!r})')
            want = over[0][lang] + ('z' if over[1] else '')
            seq = seq[:at[0]] + [(c, k) for c in want] + seq[at[-1] + 1:]
        seq = [(c, o) for c, o in seq if c in self.vocab]
        ids = [self.vocab[c] for c in seq_chars(seq)]
        if len(ids) > 500:
            sys.exit(f'sentence too long for one pass ({len(ids)} phonemes): {text!r}')
        style = G.voice_style(self.kokoro, spec['voice'])
        style = (self.kokoro.get_voice_style(style) if isinstance(style, str) else style)
        audio, dur = self.sess.run(None, {'tokens': np.array([[0, *ids, 0]], np.int64), 'style': style[len(ids) - 1].reshape(1, 256).astype(np.float32),
                                          'speed': np.array([spec['speed']], np.float32)})
        audio, dur = np.asarray(audio, np.float32).ravel(), np.asarray(dur).ravel()
        assert len(audio) == FRAME * int(dur.sum()), (len(audio), dur.sum())
        edges = np.maximum(0, np.concatenate([[0], np.cumsum(dur)]) * FRAME / RATE - AUDIO_LEAD)
        phones = [(c, o, float(edges[i + 1]), float(edges[i + 2])) for i, (c, o) in enumerate(seq)]
        return audio, phones, ''.join(seq_chars(seq))


def seq_chars(seq):
    return [c for c, _ in seq]


def speech_bounds(x):
    """First and last sample of speech: -40 dB of the sentence's loudest 10 ms."""
    win = int(0.01 * RATE)
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode='same'))
    loud = np.flatnonzero(env > env.max() * 0.01)
    return int(loud[0]), int(loud[-1])


def speak(voice, spec, lines):
    """A clip: the audio at 24 kHz before the chain, its phones [(char, display word, t0, t1)], and its sentences
    [(t0, t1, first word, last word)], times in seconds."""
    words, groups = sentences(lines)
    parts, phones, spans, at = [], [], [], 0.0
    lead_in = int(0.06 * RATE)
    for g, group in enumerate(groups):
        tokens = []
        for wi in group:
            said = spoken_tokens(words[wi][3])
            for k, (t, over) in enumerate(said):
                trailing = words[wi][4].strip() if k == len(said) - 1 else ''
                tokens.append((t, wi, over, trailing))
        audio, ph, _ = voice.sentence(spec, tokens)
        a, last = speech_bounds(audio)
        a = max(0, a - (lead_in if g == 0 else int(0.04 * RATE)))
        b = min(len(audio), last + int(0.08 * RATE))
        cut = audio[a:b].copy()
        n = min(len(cut) // 4, int(0.012 * RATE))
        cut[:n] *= np.linspace(0, 1, n)
        cut[-n:] *= np.linspace(1, 0, n)
        shift = at - a / RATE
        # Kokoro holds a sentence's last phonemes past the sound (the last word ended a median 105 ms, at most 340
        # ms, after it fell under -30 dB): nothing is said after the speech's last loud sample
        said = at + (last - a) / RATE
        for c, o, t0, t1 in ph:
            t0 = min(max(t0 + shift, at), said)
            phones.append((c, tokens[o][1] if o is not None else None, t0, max(t0, min(t1 + shift, said))))
        spans.append((at, at + len(cut) / RATE, group[0], group[-1]))
        parts.append(cut)
        at += len(cut) / RATE
        if g < len(groups) - 1:
            gap = np.zeros(int(spec['pause'] * RATE), np.float32)
            parts.append(gap)
            at += len(gap) / RATE
    tail = np.zeros(int(0.05 * RATE), np.float32)
    return np.concatenate(parts + [tail]), phones, spans, words


# ——— the room ———
def band_noise(rng, n, lo, hi):
    s = np.fft.rfft(rng.normal(0, 1, n))
    f = np.fft.rfftfreq(n, 1 / RATE)
    s[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(s, n)


def room_ir(room, seed=7):
    """A small impulse response: a few early reflections, then a diffuse tail decaying band by band (rt60 each)."""
    rng = np.random.default_rng(seed)
    longest = max(rt for _, _, rt in room['bands'])
    n = int((room['predelay'] + longest * 1.1) * RATE)
    t = np.arange(n) / RATE
    tail = np.zeros(n)
    for lo, hi, rt in room['bands']:
        tail += band_noise(rng, n, lo, hi) * np.exp(-6.91 * np.maximum(0, t - room['predelay']) / rt)
    onset = np.clip((t - room['predelay']) / 0.02, 0, 1)   # the tail builds up over 20 ms after the pre-delay
    tail *= onset
    tail /= np.sqrt(np.sum(tail ** 2)) + 1e-12
    ir = tail
    for at, g in room['early']:
        i = int(at * RATE)
        if i < n:
            ir[i] += g * 0.35
    return ir / (np.sqrt(np.sum(ir ** 2)) + 1e-12)


def reverb(x, room):
    """The dry voice plus the room, `wet` dB under it in energy."""
    ir = room_ir(room)
    n = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:len(x) + len(ir)]
    gain = 10 ** (room['wet'] / 20) * np.sqrt(np.sum(x ** 2) / (np.sum(wet ** 2) + 1e-12))
    out = np.concatenate([x, np.zeros(len(ir), np.float32)]) + wet * gain
    return out.astype(np.float32)


# ——— the track ———
VISEME = {   # Kokoro's phonemes -> rest, MBP (closed), FV, A (open), E (wide), O (round), L (L and TH)
    **{c: 'm' for c in 'mbp'}, **{c: 'f' for c in 'fv'}, **{c: 'l' for c in 'lɫθð'},
    **{c: 'o' for c in 'oʊuwɔɒɹʃʒʧʤɥ'},
    **{c: 'a' for c in 'aɑɐæʌəɚɜɝᵊ'},
    **{c: 'e' for c in 'iɪeɛᵻjyɨtdnszkgɡŋhçxʔɾʲʝɲ'},
}
VISEME_NAMES = {'r': 'rest', 'm': 'MBP', 'f': 'FV', 'a': 'A', 'e': 'E', 'o': 'O', 'l': 'L'}


def visemes(phones, duration):
    """[(ms, code)]: each phoneme's mouth from where it starts; stress marks open the sound after them, length marks
    hold the one before; a pause over 80 ms between words, punctuation, and the silence between sentences (a gap
    in the phonemes) are 'r', rest."""
    events, pending, end = [], None, 0.0
    for c, word, t0, t1 in phones:
        if t0 > end + 0.08 and events:
            events.append((end, 'r'))   # the sentences' gap
        end = max(end, t1)
        if c in 'ˈˌ':
            pending = t0 if pending is None else pending
            continue
        if c == 'ː':
            continue
        if c == ' ' or c in PUNCT:
            if t1 - t0 > 0.08 or c in PUNCT:
                events.append((t0, 'r'))
            pending = None
            continue
        events.append((pending if pending is not None else t0, VISEME.get(c, 'e')))
        pending = None
    events.append((end, 'r'))
    out = [(0, 'r')]
    for t, code in sorted(events, key=lambda e: e[0]):
        ms = min(int(round(t * 1000)), int(duration * 1000))
        if code == out[-1][1]:
            continue
        if ms <= out[-1][0]:
            out[-1] = (out[-1][0], code)   # two sounds in one millisecond: the later one
            if len(out) > 1 and out[-2][1] == code:
                out.pop()
            continue
        out.append((ms, code))
    return out


def envelope(x, hz=ENV_HZ):
    """The dry voice's loudness, `hz` values a second, 0..63: -42..0 dB of its loud frames (the 95th percentile)."""
    hop = RATE // hz
    n = int(np.ceil(len(x) / hop))
    pad = np.concatenate([x, np.zeros(n * hop - len(x), np.float32)])
    rms = np.sqrt(np.mean(pad.reshape(n, hop) ** 2, axis=1) + 1e-12)
    ref = np.percentile(rms[rms > rms.max() * 0.01], 95) if np.any(rms > rms.max() * 0.01) else rms.max()
    db = 20 * np.log10(rms / (ref + 1e-12))
    v = np.clip((db + 42) / 42, 0, 1)
    return ''.join(B64[int(round(q * 63))] for q in v)


# ——— the expression of each sentence: the Mentat and the words ———
CUES = {
    'angry': r"\b(kill\w*|crush\w*|burn\w*|weep|corpses?|punish\w*|vanish|fools?|obituary|waste|hates?|wipe|kneel|begged|dead|blood|"
             r"bleed|trampled|failure|failed|pathetic|disappoint\w*|tear|smash\w*|leave nothing|nothing standing|no mercy|suffer\w*|breathing)\b",
    'warning': r"\b(beware|careful|watch\w*|danger\w*|worms?|hunt\w*|raid\w*|guard\w*|do not|never|keep (an eye|our|your)|"
               r"will not leave|out of its|strike where|close|ambush\w*|sky|mind the)\b",
    'pleased': r"\b(well done|excellent|fine victory|good work|impressed|proud|thank\w*|satisfied|pleasure|enjoy\w*|"
               r"remarkable|elegant|splendid|victory)\b",
    'sad': r"\b(not met|despair|disgrace|fault|lost|no joy|sorrow|regret|could not|fell|failed)\b",
    'sly': r"\b(profit\w*|prices?|buy|sell\w*|sold|deals?|share|cheap\w*|credits|contract\w*|quietly|undermine|rent|acquire\w*|"
           r"insurance|business|bankrupt|toy|clever|fortune|spend\w*|bargain|investment|on sale|we keep him|written|interest\w*|"
           r"bought|balance|ledgers?|margins?|accountants?|coin)\b",
    'grave': r"\b(emperor\w*|sardaukar|death hand|decree|treachery|trial|destroy|must fall|cannot share|war|both bases|the last|"
             r"palace|devastator\w*|everything)\b",
}
DEFAULT = {   # house -> kind -> tone of a sentence no cue speaks for
    'atreides': {'page': 'neutral', 'question': 'grave', 'briefing': 'grave', 'advice': 'neutral', 'win': 'pleased', 'lose': 'sad', 'ending': 'grave'},
    'harkonnen': {'page': 'sly', 'question': 'angry', 'briefing': 'sly', 'advice': 'sly', 'win': 'pleased', 'lose': 'angry', 'ending': 'pleased'},
    'ordos': {'page': 'neutral', 'question': 'sly', 'briefing': 'neutral', 'advice': 'neutral', 'win': 'pleased', 'lose': 'grave', 'ending': 'sly'},
}
ORDER = {   # which cues a Mentat answers to, first match wins: Cyril is never angry nor sly, Ammon never angry
    'atreides': ['warning', 'sad', 'pleased', 'grave'],
    'harkonnen': ['angry', 'warning', 'pleased', 'sly', 'grave'],
    'ordos': ['warning', 'sly', 'pleased', 'grave'],
}
EXPRESSIONS = ['neutral', 'grave', 'pleased', 'warning', 'angry', 'sly', 'sad']


def expression(house, kind, sentence):
    text = sentence.lower()
    if kind in ('win', 'lose', 'ending'):
        # the outcome sets the mood; a cue of its own kind or a warning may still speak
        if re.search(CUES['warning'], text):
            return 'warning'
        return DEFAULT[house][kind]
    for cue in ORDER[house]:
        if re.search(CUES[cue], text):
            return cue
    return DEFAULT[house][kind]


def track_of(clip, phones, spans, words, duration, env):
    """The clip's timing track (contract in the notes, read by src/audio/mentat-voice.js)."""
    first = {}
    last = {}
    for c, w, t0, t1 in phones:
        if w is None or c in STRESS or c == ' ' or c in PUNCT:
            continue
        first[w] = min(first.get(w, t0), t0)
        last[w] = max(last.get(w, t1), t1)
    out_words = []
    prev = 0
    for i, (li, c0, c1, text, _) in enumerate(words):
        if i not in first:
            sys.exit(f'{clip["id"]}: word {text!r} got no phonemes')
        s = max(prev, int(round(first[i] * 1000)))
        e = max(s + 1, int(round(last[i] * 1000)))
        out_words.append([s, e, li, c0, c1])
        prev = s
    out_sent = []
    for t0, t1, w0, w1 in spans:
        text = ' '.join(words[i][3] + words[i][4].strip() for i in range(w0, w1 + 1))
        out_sent.append([out_words[w0][0], max(out_words[w1][1], out_words[w0][0] + 1), w0, w1, expression(clip['house'], clip['kind'], text)])
    vis = visemes(phones, duration)
    ms = int(round(duration * 1000))
    vis = [(t, c) for t, c in vis if t < ms]
    return {'v': 1, 'id': clip['id'], 'ms': ms, 'lines': clip['lines'], 'words': out_words, 'sentences': out_sent,
            'visemes': {'t': [t for t, _ in vis], 's': ''.join(c for _, c in vis)}, 'env': {'hz': ENV_HZ, 'q': env}}


# ——— render, encode ———
def shape(spec, x, tmp):
    """The chain (tape, timbre) on the dry voice -> the dry shaped voice (for the envelope) and the voice in its room."""
    raw, dry = os.path.join(tmp, 'raw.wav'), os.path.join(tmp, 'dry.wav')
    sf.write(raw, x, RATE, subtype='FLOAT')
    chain = (G.slower(spec['tape']) if spec['tape'] != 1 else []) + spec['chain'] + [f'aresample={RATE}']
    G.ffmpeg('-i', raw, '-af', ','.join(chain), '-c:a', 'pcm_f32le', dry)
    y, rate = sf.read(dry, dtype='float32')
    assert rate == RATE
    return y, reverb(y, spec['room'])


def encode(x, dest, tmp):
    wet = os.path.join(tmp, 'wet.wav')
    sf.write(wet, x, RATE, subtype='FLOAT')
    i, _ = G.loudness(wet)
    limit = 10 ** (CEILING_DB / 20)
    G.ffmpeg('-i', wet, '-af', f'volume={TARGET_LUFS - i:.2f}dB,alimiter=limit={limit:.4f}:attack=2:release=60:level=disabled,'
             'areverse,silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.05,afade=t=in:d=0.05,areverse,afade=t=in:d=0.01',
             '-ac', '1', '-ar', str(RATE), '-c:a', 'libopus', '-b:a', BITRATE, '-vbr', 'on', '-application', 'voip', '-frame_duration', '20',
             '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', dest)


def render_clip(voice, spec, clip, dest, tmp):
    """One clip -> <dest>.ogg and <dest>.json; returns its seconds."""
    x, phones, spans, words = speak(voice, spec, clip['lines'])
    scale = 1 / spec['tape']   # the tape slows every time with the sound
    phones = [(c, w, t0 * scale, t1 * scale) for c, w, t0, t1 in phones]
    spans = [(a * scale, b * scale, w0, w1) for a, b, w0, w1 in spans]
    dry, wet = shape(spec, x, tmp)
    encode(wet, dest + '.ogg', tmp)
    seconds = G.seconds_of(dest + '.ogg')
    track = track_of(clip, phones, spans, words, seconds, envelope(dry[:int(seconds * RATE) + 1]))
    with open(dest + '.json', 'w') as f:
        json.dump(track, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    return seconds


def all_clips():
    r = subprocess.run(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mentat-lines.mjs')], capture_output=True, text=True, cwd=ROOT)
    if r.returncode:
        sys.exit(r.stderr)
    return json.loads(r.stdout)


def write_manifest(out, clips):
    """The manifest from what is on disk: every clip that has its sound and its track."""
    manifest = {'version': 1, 'lufs': TARGET_LUFS, 'mentats': {}, 'clips': {}}
    for house, spec in MENTATS.items():
        manifest['mentats'][house] = {'name': spec['name'], 'voice': G.voice_name(spec['voice']), 'speed': spec['speed'], 'tape': spec['tape'], 'room': spec['room']['name']}
    for clip in clips:
        base = os.path.join(out, clip['id'])
        if os.path.exists(base + '.ogg') and os.path.exists(base + '.json'):
            manifest['clips'][clip['id']] = {'file': clip['id'] + '.ogg', 'track': clip['id'] + '.json', 'seconds': G.seconds_of(base + '.ogg'),
                                             'text': '\n'.join(clip['lines'])}
    tmp = os.path.join(out, 'manifest.json.tmp')
    with open(tmp, 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, os.path.join(out, 'manifest.json'))


def retag(out, clips):
    """The expressions of every track on disk chosen again from its text (CUES, DEFAULT, ORDER), the timings kept."""
    for clip in clips:
        path = os.path.join(out, clip['id'] + '.json')
        if not os.path.exists(path):
            continue
        with open(path) as f:
            track = json.load(f)
        words = display_words(clip['lines'])
        for s in track['sentences']:
            s[4] = expression(clip['house'], clip['kind'], ' '.join(words[i][3] + words[i][4].strip() for i in range(s[2], s[3] + 1)))
        with open(path, 'w') as f:
            json.dump(track, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')


def candidate(spec, text):
    """'bm_george*0.7+am_michael*0.3:0.88:0.96' -> the spec with that voice, Kokoro speed and tape factor."""
    voice, speed, tape = (text.split(':') + ['', ''])[:3]
    parts = [(p.split('*')[0], float(p.split('*')[1]) if '*' in p else 1.0) for p in voice.split('+')]
    main = max(parts, key=lambda p: p[1])[0]
    return {**spec, 'voice': parts[0][0] if len(parts) == 1 else parts, 'lang': 'en-gb' if main.startswith('b') else 'en-us',
            'speed': float(speed or spec['speed']), 'tape': float(tape or spec['tape'])}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--models', required=True, help='directory holding kokoro-v1.0.onnx and voices-v1.0.bin')
    ap.add_argument('--houses', default=','.join(MENTATS))
    ap.add_argument('--only', default='', help='comma-separated clip keys (m1-briefing, page-2, question, ending)')
    ap.add_argument('--skip-existing', action='store_true')
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--audition', default='', help='render the clips in --voices into this directory instead')
    ap.add_argument('--voices', default='', help="candidates for --audition: 'blend:speed:tape', comma-separated")
    ap.add_argument('--retag', action='store_true', help="only choose the sentences' expressions of the tracks on disk again (no model)")
    args = ap.parse_args()
    if args.retag:
        retag(args.out, [c for c in all_clips() if c['house'] in args.houses.split(',')])
        return
    voice = Voice(args.models, int(os.environ.get('VOICE_THREADS', '2')))
    clips = all_clips()
    only = set(filter(None, args.only.split(',')))
    houses = args.houses.split(',')
    todo = [c for c in clips if c['house'] in houses and (not only or c['key'] in only)]
    with tempfile.TemporaryDirectory() as tmp:
        if args.audition:
            for house in houses:
                for cand in (args.voices.split(',') if args.voices else ['']):
                    spec = candidate(MENTATS[house], cand) if cand else MENTATS[house]
                    folder = os.path.join(args.audition, house, cand.replace(':', '_').replace('*', 'x').replace('+', '-') or 'shipped')
                    os.makedirs(folder, exist_ok=True)
                    for clip in (c for c in todo if c['house'] == house):
                        dest = os.path.join(folder, clip['key'])
                        if not (args.skip_existing and os.path.exists(dest + '.ogg')):
                            render_clip(voice, spec, clip, dest, tmp)
                        print(f'{house}/{cand or "shipped"}/{clip["key"]}  {G.seconds_of(dest + ".ogg"):6.2f} s', flush=True)
            return
        for clip in todo:
            dest = os.path.join(args.out, clip['id'])
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if args.skip_existing and os.path.exists(dest + '.ogg') and os.path.exists(dest + '.json'):
                continue
            seconds = render_clip(voice, MENTATS[clip['house']], clip, dest, tmp)
            print(f'{clip["id"]}.ogg  {seconds:6.2f} s  {os.path.getsize(dest + ".ogg"):7d} B', flush=True)
    write_manifest(args.out, clips)


if __name__ == '__main__':
    main()
