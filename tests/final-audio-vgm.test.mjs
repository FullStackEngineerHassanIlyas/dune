// The player's Sega tracks evened out: one VGM_GAIN brings the rip up alongside the game's own FM tracks, but the
// rip's own balance left two of them 5-7 dB under the FM tracks they replace (Radnor's Scheme at the Harkonnen
// Mentat, Chosen Destiny at the house selection). Each Sega track now has a gain of its own, from its measured
// loudness, to about VGM_LOUDNESS — a lift never taking its loudest sample past full scale — sent with its data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicMixer, VGM_GAIN, VGM_LOUDNESS, SEGA_LEVELS, ceiling, vgmLevel } from '../src/audio/music/mixer.js';
import { MusicOutput, vgmGain } from '../src/audio/music/output.js';
import { SEGA_TRACKS } from '../src/audio/music/sega-tracks.js';
import { fakeWindow, fakeEngine, fakeVgmDeck, vgmFile, userVgm, settle } from './music-fakes.mjs';

const dB = (g) => 20 * Math.log10(g);

test('every Sega track has its measured level, and its gain brings it to about the same loudness', () => {
  for (const { title } of SEGA_TRACKS) {
    assert.ok(SEGA_LEVELS[title], `${title} measured`);
    const [lufs, peak] = SEGA_LEVELS[title], g = vgmLevel(title), out = lufs + dB(g);
    if (g > 1) assert.ok(peak * g <= 1 + 1e-9, `${title}: lifted ${dB(g).toFixed(1)} dB, its peak ${(peak * g).toFixed(2)} stays under full scale`);
    if (Math.abs(out - VGM_LOUDNESS) > 0.05) assert.ok(out < VGM_LOUDNESS && Math.abs(g - Math.max(1, 1 / peak)) < 1e-9, `${title} at ${out.toFixed(1)} LUFS only where its peak holds the lift`);
  }
  assert.equal(vgmLevel('Something else'), 1, 'a VGM that is not the Sega game\'s keeps its own level');
  assert.equal(vgmLevel(undefined), 1);
});

test('the two quiet ones come up alongside the other Mentats\' themes and the house selection\'s FM track', () => {
  const at = (title) => SEGA_LEVELS[title][0] + dB(vgmLevel(title));
  assert.ok(Math.abs(at('Radnor\'s Scheme') - at('Cyril\'s Council')) < 0.5, `Radnor's Scheme ${at('Radnor\'s Scheme').toFixed(1)} vs Cyril's Council ${at('Cyril\'s Council').toFixed(1)} LUFS`);
  assert.ok(Math.abs(at('Radnor\'s Scheme') - at('Ammon\'s Advice')) < 0.5);
  assert.ok(dB(vgmLevel('Radnor\'s Scheme')) > 5, 'Radnor\'s Scheme lifted over 5 dB');
  const top = SEGA_LEVELS['Chosen Destiny'][1] * vgmLevel('Chosen Destiny'), squash = dB(top / ceiling(top));
  assert.ok(at('Chosen Destiny') > VGM_LOUDNESS - 1, `Chosen Destiny at ${at('Chosen Destiny').toFixed(1)} LUFS`);
  assert.ok(squash < 0.45, `its one loud transient rounded by the ceiling ${squash.toFixed(2)} dB at most`);
});

test('the page sends a Sega track\'s gain with its data (by its tag, else its file name), and the mixer plays it at it', async () => {
  assert.equal(vgmGain(userVgm(1, { track: 'Radnor\'s Scheme' })), vgmLevel('Radnor\'s Scheme'));
  assert.equal(vgmGain({ name: '04 - Radnor\'s Scheme.vgm', meta: { title: '' } }), vgmLevel('Radnor\'s Scheme'), 'a file without a tag, by its name');
  assert.equal(vgmGain({ name: '16 - Atredies Dirge.vgz', meta: null }), vgmLevel('Atreides Dirge'), 'the rip\'s misspelt name too');
  assert.equal(vgmGain(userVgm(2, { track: 'Sonic the Hedgehog - Green Hill Zone' })), 1);
  const win = fakeWindow(), out = new MusicOutput({ audio: fakeEngine(win), win });
  out.open();
  await settle();
  out.playVgm(userVgm(4, { track: 'Radnor\'s Scheme' }));
  await settle(); await settle();
  const sent = win.nodes[0].sent.find((m) => m.cmd === 'vgm');
  assert.equal(sent.gain, vgmLevel('Radnor\'s Scheme'));
  const made = [], m = new MusicMixer({ rate: 1000, VgmDeck: fakeVgmDeck({ made }) });
  m.command(sent);
  m.command({ cmd: 'play', id: sent.id });
  assert.ok(Math.abs(made[0].level - VGM_GAIN * vgmLevel('Radnor\'s Scheme')) < 1e-12, 'the deck at VGM_GAIN times its own');
  m.command({ cmd: 'vgm', id: 'vgm:9', data: vgmFile().buffer });
  m.command({ cmd: 'play', id: 'vgm:9' });
  assert.equal(made[1].level, VGM_GAIN, 'no gain sent: VGM_GAIN alone, as before');
});
