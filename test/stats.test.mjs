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

import { perPrayer, finishPlans, periodStats, recentPace } from '../stats.js';

test('Bir nechtasini birdan ado qilish va cheklov', () => {
  const s0 = { ...base(), qazo: { ...base().qazo, fajr: 3 } };
  const s1 = recordDone(s0, 'fajr', 10, at(2026, 10, 21));
  assert.equal(s1.qazo.fajr, 0); assert.equal(s1.done['2026-10-21'].fajr, 3); // qolganidan ko'p ayrilmaydi
  const s2 = recordDone(s1, 'fajr', -5, at(2026, 10, 21));
  assert.equal(s2.qazo.fajr, 3); assert.equal(s2.done['2026-10-21'].fajr, undefined);
});

test('Namozlar bo‘yicha progress, kalkulyator, temp', () => {
  const s = { ...base(), done: { '2026-10-20': { fajr: 20, isha: 5 }, '2026-10-21': { fajr: 5 } } };
  const pp = perPrayer(s, ['fajr', 'isha', 'asr']);
  assert.deepEqual(pp.map((x) => x.pct), [20, 4.8, 0]);
  const f = finishPlans(1000, [5, 10, 0], at(2026, 10, 21));
  assert.deepEqual(f.map((x) => x.days), [200, 100]);
  assert.equal(recentPace(s, at(2026, 10, 21), 2), 15);
});

test('Davr statistikasi', () => {
  const done = {};
  for (let i = 0; i < 40; i++) { const d = new Date(2026, 9, 21 - i, 12); done[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = { fajr: i % 2 ? 2 : 4 }; }
  const s = { ...base(), done };
  const m30 = periodStats(s, '30', at(2026, 10, 21));
  assert.equal(m30.bars.length, 30); assert.equal(m30.total, 90); assert.equal(m30.avg, 3);
  assert.equal(m30.best.n, 4); assert.equal(m30.change, 200); // oldingi 30 kunda faqat 10 kunlik ma'lumot (30 ta)
  const w = periodStats(s, '7', at(2026, 10, 21));
  assert.equal(w.bars.length, 7); assert.equal(w.total, 10); // Du 4, Se 2, Ch 4
  assert.equal(periodStats(s, '180', at(2026, 10, 21)).bars.length, 26);
  assert.equal(periodStats(s, '365', at(2026, 10, 21)).bars.length, 12);
  assert.equal(periodStats(s, 'all', at(2026, 10, 21)).total, 120);
  assert.equal(periodStats({ ...base(), done: {} }, 'all', at(2026, 10, 21)).total, 0);
});

import { goalStreak, journey } from '../stats.js';

test('Maqsad streak va qazo safari', () => {
  const s = { ...base(), done: { '2026-10-18': { fajr: 5 }, '2026-10-19': { fajr: 6 }, '2026-10-20': { fajr: 2 }, '2026-10-21': { fajr: 5 } } };
  assert.deepEqual(goalStreak(s, at(2026, 10, 21)), { current: 1, best: 2 });
  const j = journey({ ...s, startTotal: 0 });
  assert.equal(j.done, 18); assert.equal(j.left, 600); assert.equal(j.start, 618);
  assert.equal(journey({ ...s, startTotal: 1000 }).start, 1000);
  const a = Object.fromEntries(achievements(s, at(2026, 10, 21)).map((x) => [x.id, x.unlocked]));
  assert.equal(a.g10, false); assert.equal(a.t10000, false);
});
