import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDone, summary, streak, weekBars, achievements, monthGrid, weekStart } from '../stats.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const base = () => ({ settings: { dailyGoal: 5, includeVitr: true }, qazo: { fajr: 100, dhuhr: 100, asr: 100, maghrib: 100, isha: 100, vitr: 100 }, log: {}, done: {} });

test('Ado qilish qazoni kamaytiradi va sanasi bilan yoziladi; bekor qilish qaytaradi', () => {
  let s = recordDone(base(), 'fajr', 1, at(2026, 10, 21));
  s = recordDone(s, 'fajr', 1, at(2026, 10, 21));
  assert.equal(s.qazo.fajr, 98);
  assert.deepEqual(s.done['2026-10-21'], { fajr: 2 });
  s = recordDone(s, 'fajr', -1, at(2026, 10, 21));
  assert.equal(s.qazo.fajr, 99);
  assert.equal(recordDone(s, 'asr', -1, at(2026, 10, 21)), s); // bugun asr ado qilinmagan — o'zgarmaydi
  const z = { ...base(), qazo: { ...base().qazo, isha: 0 } };
  assert.equal(recordDone(z, 'isha', 1), z); // qazo 0 bo'lsa kamaymaydi
});

test('Statistika: bugun, hafta, oy, jami, foiz', () => {
  const s = { ...base(), done: { '2026-10-19': { fajr: 5 }, '2026-10-20': { asr: 3 }, '2026-10-21': { isha: 2 }, '2026-10-12': { fajr: 4 }, '2026-09-30': { fajr: 1 } } };
  const r = summary(s, at(2026, 10, 21));
  assert.equal(r.today, 2);
  assert.equal(r.week, 10);        // 19-oktabr dushanba
  assert.equal(r.month, 14);
  assert.equal(r.total, 15);
  assert.equal(r.remaining, 600);
  assert.equal(r.pct, 2.4);
  assert.equal(dayKeyOf(weekStart(at(2026, 10, 25))), '2026-10-19');
  const bars = weekBars(s, at(2026, 10, 21));
  assert.deepEqual(bars.map((b) => b.n), [5, 3, 2, 0, 0, 0, 0]);
  assert.ok(bars[2].isToday && bars[3].future);
});
const dayKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('Streak: joriy va eng uzun', () => {
  const done = {};
  for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) done[`2026-10-${String(d).padStart(2, '0')}`] = { fajr: 1 };
  for (const d of [18, 19, 20]) done[`2026-10-${d}`] = { fajr: 1 };
  const s = { ...base(), done };
  assert.deepEqual(streak(s, at(2026, 10, 21)), { current: 3, best: 10 }); // bugun hali yo'q — kechagacha
  s.done['2026-10-21'] = { asr: 1 };
  assert.equal(streak(s, at(2026, 10, 21)).current, 4);
  assert.equal(streak(s, at(2026, 10, 23)).current, 0);
});

test('Yutuqlar', () => {
  const s = { ...base(), done: { '2026-10-21': { fajr: 5 } }, log: { '2026-10-20': { fajr: 'prayed', dhuhr: 'prayed', asr: 'prayed', maghrib: 'prayed', isha: 'prayed' } } };
  const a = Object.fromEntries(achievements(s, at(2026, 10, 21)).map((x) => [x.id, x.unlocked]));
  assert.equal(a.first, true); assert.equal(a.goal, true); assert.equal(a.ontime, true);
  assert.equal(a.t100, false); assert.equal(a.s7, false); assert.equal(a.clear, false);
});

test('Kalendar katakchalari', () => {
  const g = monthGrid(2026, 9); // Oktabr 2026: 1-oktabr payshanba
  assert.equal(g.length % 7, 0);
  assert.equal(g.slice(0, 3).every((x) => x === null), true);
  assert.equal(g[3].getDate(), 1);
});
