import test from 'node:test';
import assert from 'node:assert/strict';
import { milestones, layout, journeySvg } from '../journey.js';
import { insights, unlockDates, heatLevel, heatWeeks, durationText } from '../stats.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const base = () => ({ settings: { dailyGoal: 5 }, qazo: { fajr: 100, dhuhr: 100, asr: 100, maghrib: 100, isha: 100, vitr: 0 }, log: {}, done: {} });

test('Qazo yo‘li: bosqichlar va joriy nuqta', () => {
  assert.deepEqual(milestones(4280), [0, 100, 500, 1000, 2500, 4280]);
  assert.deepEqual(milestones(40), [0, 10, 20, 30, 40]);
  assert.deepEqual(milestones(3), [0, 3]);
  assert.equal(milestones(100000).length, 9);
  const L = layout(4280, 750);
  assert.equal(L.here.k, 2);               // 500 va 1000 orasida
  assert.ok(Math.abs(L.here.t - 0.5) < 1e-9);
  assert.equal(L.nodes.filter((n) => n.reached).length, 3); // 0, 100, 500
  const z = layout(4280, 0); assert.equal(z.here.y, z.nodes[0].y);
  const e = layout(4280, 4280); assert.equal(e.here.y, e.nodes.at(-1).y);
  assert.match(journeySvg(4280, 750), /Siz · 750/);
  assert.equal(journeySvg(0, 0), '');
});

test('Aqlli tahlil, yutuq sanalari, issiqlik xaritasi', () => {
  const s = base();
  // 2026-10-19 (Du) .. 21 (Ch): 6, 6, 6; o'tgan hafta 12..14: 3, 3, 3
  for (const d of [19, 20, 21]) s.done[`2026-10-${d}`] = { fajr: 6 };
  for (const d of [12, 13, 14]) s.done[`2026-10-${d}`] = { asr: 3 };
  const ins = insights(s, at(2026, 10, 21));
  assert.match(ins[0].text, /<b>6<\/b>/);
  assert.match(ins[1].text, /100% ko‘proq/);
  assert.ok(ins.some((x) => /taxminan/.test(x.text)));
  const u = unlockDates(s, at(2026, 10, 21));
  assert.equal(u.first, '2026-10-12');
  assert.equal(u.goal, '2026-10-19');
  assert.equal(u.t100, undefined);
  assert.deepEqual([0, 1, 3, 5, 12].map((n) => heatLevel(n, 5)), [0, 1, 2, 3, 4]);
  const hw = heatWeeks(s, at(2026, 10, 21), 2);
  assert.equal(hw[1][0].n, 6); assert.equal(hw[1][4].n, null);
  assert.equal(durationText(400), '13 oy');
  assert.equal(durationText(800), '2.2 yil');
});
