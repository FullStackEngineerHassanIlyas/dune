// The Mentat's words typed two lines at a time (research.md §4, §6: the Sega's briefing), and the score screen's
// bars filling row by row, driven by a hand-cranked clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, FakeEl } from './campaign-dom.mjs';

installDom();
const { typeLines, mentatStage } = await import('../src/ui/campaign/stage.js');
const { scoreScreen, scoreRows } = await import('../src/ui/campaign/results.js');
const { readResult } = await import('../src/campaign/result.js');

/** A clock the test turns: later(fn, ms) queues, run() fires everything due by then. */
function clock() {
  let now = 0;
  const queue = [];
  return {
    later: (fn, ms) => queue.push({ at: now + ms, fn }),
    run(ms) {
      const end = now + ms;
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        if (!queue.length || queue[0].at > end) break;
        const job = queue.shift();
        now = job.at;
        job.fn();
      }
      now = end;
    },
  };
}
const shown = (box) => box.children.map((c) => c.textContent);

test('two lines at a time, letter by letter, held, then the next two; the last pair stays', () => {
  const box = new FakeEl('div');
  const c = clock();
  let done = 0;
  const typer = typeLines(box, ['One line', 'Two', 'Three', 'Four', 'Five'], { later: c.later, instant: false, onDone: () => done++ });
  assert.deepEqual(shown(box), ['', '']);
  c.run(26 * 4);
  assert.deepEqual(shown(box), ['One ', '']);
  c.run(26 * 7);
  assert.deepEqual(shown(box), ['One line', 'Two']);
  assert.equal(typer.typing, false);
  c.run(2000);
  assert.deepEqual(shown(box), ['One line', 'Two'], 'held a while');
  c.run(600);
  assert.deepEqual(shown(box), ['', ''], 'then the next pair starts');
  c.run(26 * 9);
  assert.deepEqual(shown(box), ['Three', 'Four']);
  c.run(2600 + 26 * 5);
  assert.deepEqual(shown(box), ['Five', '']);
  assert.equal(done, 1);
  assert.equal(typer.done, true);
  c.run(10000);
  assert.deepEqual(shown(box), ['Five', ''], 'the last pair stays');
  assert.equal(done, 1, 'done once');
});

test('skip finishes the pair being typed, then moves on to the next', () => {
  const box = new FakeEl('div');
  const c = clock();
  const typer = typeLines(box, ['Alpha', 'Beta', 'Gamma'], { later: c.later, instant: false });
  c.run(26 * 2);
  typer.skip();
  assert.deepEqual(shown(box), ['Alpha', 'Beta']);
  c.run(26 * 3);
  assert.deepEqual(shown(box), ['Alpha', 'Beta'], 'no stray letters from the old typing');
  typer.skip();
  c.run(26 * 5);
  assert.deepEqual(shown(box), ['Gamma', '']);
  assert.equal(typer.done, true);
  typer.skip();
  assert.deepEqual(shown(box), ['Gamma', ''], 'nothing after the last');
});

test('instant (reduced motion) shows each pair whole', () => {
  const box = new FakeEl('div');
  const c = clock();
  typeLines(box, ['A', 'B', 'C'], { later: c.later, instant: true });
  assert.deepEqual(shown(box), ['A', 'B']);
  c.run(2600);
  assert.deepEqual(shown(box), ['C', '']);
});

test('every pair is laid out unseen beside the words, so the box keeps the tallest pair\'s height while they type', () => {
  const c = clock();
  const stage = mentatStage('harkonnen', { mentatName: 'Radnor', later: c.later });
  const box = stage.el.find((e) => e.className === 'cp-lines');
  const room = stage.el.find((e) => e.className.split(' ').includes('cp-room'));
  assert.ok(room, 'a room for the words');
  assert.equal(room.parent, box.parent, 'beside the box');
  assert.equal(box.parent.className, 'cp-say', 'the two share one cell (campaign.css)');
  assert.ok(room.className.split(' ').includes('cp-lines'), 'set in the same type as the box');
  assert.equal(room.attrs['aria-hidden'], 'true');
  const lines = ['A short one', 'A much longer line that wraps on a narrow window', 'Three', 'Four', 'Five'];
  stage.say(lines);
  const pairs = () => room.children.map((p) => p.children.map((l) => l.textContent));
  assert.deepEqual(pairs(), [[lines[0], lines[1]], [lines[2], lines[3]], [lines[4], '']], 'every pair whole, from the first letter');
  assert.deepEqual(shown(box), ['', ''], 'while the box types');
  c.run(26 * 10);
  assert.deepEqual(pairs(), [[lines[0], lines[1]], [lines[2], lines[3]], [lines[4], '']], 'and it stays as they type');
  stage.say(['New words']);
  assert.deepEqual(pairs(), [['New words', '']], 'new words, a new room');
});

test('the score bars fill row by row to their share of the row\'s larger number, the numbers counting up', () => {
  const r = readResult({ dune: 'missionEnd', house: 'ordos', mission: 3, won: true, seconds: 900,
    stats: { rows: [{ label: 'Spice harvested', you: 8000, enemy: 2000 }, { label: 'Units destroyed', you: 10, enemy: 40 }, { label: 'Buildings destroyed', you: 5, enemy: 0 }] } });
  assert.deepEqual(scoreRows(r).map((row) => row.key), ['spice', 'units', 'structures']);
  const c = clock();
  const el = scoreScreen(r, { later: c.later, onContinue() {}, steps: 4, stepMs: 10 });
  const fills = el.findAll((e) => e.className.startsWith('cp-fill'));
  const nums = el.findAll((e) => e.className === 'cp-num');
  assert.equal(fills.length, 6);
  assert.deepEqual(fills.map((f) => f.style.width), ['0.0%', '0.0%', '0.0%', '0.0%', '0.0%', '0.0%']);
  c.run(505);
  assert.deepEqual(fills.slice(0, 2).map((f) => f.style.width), ['25.0%', '6.3%']);
  assert.equal(fills[2].style.width, '0.0%', 'the next row waits');
  c.run(30);
  assert.deepEqual(fills.slice(0, 2).map((f) => f.style.width), ['100.0%', '25.0%']);
  assert.deepEqual(nums.slice(0, 2).map((n) => n.textContent), ['8,000', '2,000']);
  c.run(5000);
  assert.deepEqual(fills.map((f) => f.style.width), ['100.0%', '25.0%', '25.0%', '100.0%', '100.0%', '0.0%']);
  assert.deepEqual(nums.map((n) => n.textContent), ['8,000', '2,000', '10', '40', '5', '0']);
  const now = scoreScreen(r, { later: c.later, onContinue() {}, instant: true });
  assert.deepEqual(now.findAll((e) => e.className.startsWith('cp-fill')).map((f) => f.style.width), ['100.0%', '25.0%', '25.0%', '100.0%', '100.0%', '0.0%'], 'instant: full at once');
});
