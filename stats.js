// Statistika, streak, maqsadlar, yutuqlar — toza funksiyalar (UI'siz).
// state.done = { '2026-10-21': { fajr: 2, asr: 1 } } — shu kuni ado qilingan qazolar soni.
import { PRAYERS, addDays, dayKey, noon, totalQazo } from './prayer.js';

export const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
export const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const sum = (o) => Object.values(o || {}).reduce((a, n) => a + (Number(n) || 0), 0);
export const dayDone = (state, key) => sum(state.done?.[key]);

// Qazo ado qilindi (+1) yoki xato bosilgani bekor qilindi (-1)
export function recordDone(state, p, delta = 1, now = new Date()) {
  const key = dayKey(now);
  const day = { ...(state.done?.[key] || {}) };
  const cur = day[p] || 0;
  if (delta > 0 && (state.qazo[p] || 0) <= 0) return state;
  if (delta < 0 && cur <= 0) return state;
  day[p] = cur + delta;
  if (!day[p]) delete day[p];
  return {
    ...state,
    qazo: { ...state.qazo, [p]: Math.max(0, (state.qazo[p] || 0) - delta) },
    done: { ...state.done, [key]: day },
  };
}

// Haftaning dushanbasi
export function weekStart(d) {
  const x = noon(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

export function totalDone(state) {
  return Object.values(state.done || {}).reduce((a, d) => a + sum(d), 0);
}

export function rangeDone(state, from, days) {
  let n = 0;
  for (let i = 0; i < days; i++) n += dayDone(state, dayKey(addDays(from, i)));
  return n;
}

export function summary(state, now = new Date()) {
  const today = dayDone(state, dayKey(now));
  const week = rangeDone(state, weekStart(now), 7);
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const month = rangeDone(state, m0, daysInMonth);
  const total = totalDone(state);
  const remaining = totalQazo(state);
  const goal = Number(state.settings?.dailyGoal) || 0;
  const pct = total + remaining ? Math.round((total / (total + remaining)) * 1000) / 10 : 0;
  return { today, week, month, total, remaining, pct, goal, weekGoal: goal * 7, monthGoal: goal * daysInMonth, daysInMonth };
}

export function weekBars(state, now = new Date()) {
  const start = weekStart(now);
  const todayKey = dayKey(now);
  return WEEKDAYS.map((label, i) => {
    const key = dayKey(addDays(start, i));
    return { label, key, n: dayDone(state, key), isToday: key === todayKey, future: key > todayKey };
  });
}

// Ketma-ket kunlar: kamida 1 ta qazo ado qilingan kunlar. Bugun hali bo'lmasa, kechagacha hisoblanadi.
export function streak(state, now = new Date()) {
  let d = noon(now);
  if (!dayDone(state, dayKey(d))) d = addDays(d, -1);
  let current = 0;
  while (dayDone(state, dayKey(d)) > 0) { current++; d = addDays(d, -1); }
  const keys = Object.keys(state.done || {}).filter((k) => dayDone(state, k) > 0).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    const cur = new Date(`${k}T12:00:00`);
    run = prev && Math.round((cur - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return { current, best: Math.max(best, current) };
}

const ACH = [
  { id: 'first', icon: '🌱', title: 'Birinchi qadam', desc: '1 ta qazo ado qilindi', kind: 'total', need: 1 },
  { id: 't100', icon: '🏅', title: '100 talik', desc: '100 ta qazo ado qilindi', kind: 'total', need: 100 },
  { id: 't500', icon: '🥈', title: '500 talik', desc: '500 ta qazo', kind: 'total', need: 500 },
  { id: 't1000', icon: '🥇', title: '1000 talik', desc: '1 000 ta qazo', kind: 'total', need: 1000 },
  { id: 't5000', icon: '🏆', title: '5000 talik', desc: '5 000 ta qazo', kind: 'total', need: 5000 },
  { id: 'goal', icon: '🎯', title: 'Maqsadga yetdim', desc: 'Bir kunda kunlik maqsad bajarildi', kind: 'goalDays', need: 1 },
  { id: 's7', icon: '🔥', title: '7 kun', desc: '7 kun ketma-ket', kind: 'streak', need: 7 },
  { id: 's30', icon: '🔥', title: '30 kun', desc: '30 kun ketma-ket', kind: 'streak', need: 30 },
  { id: 's100', icon: '💎', title: '100 kun', desc: '100 kun ketma-ket', kind: 'streak', need: 100 },
  { id: 'ontime', icon: '🕌', title: 'O‘z vaqtida', desc: 'Bir kunda 5 vaqt namoz o‘z vaqtida o‘qildi', kind: 'onTimeDays', need: 1 },
  { id: 'clear', icon: '🌙', title: 'Qazo tugadi', desc: 'Barcha qazolar ado qilindi', kind: 'clear', need: 1 },
];

export function achievements(state, now = new Date()) {
  const total = totalDone(state);
  const { best } = streak(state, now);
  const goal = Number(state.settings?.dailyGoal) || 0;
  const goalDays = goal ? Object.keys(state.done || {}).filter((k) => dayDone(state, k) >= goal).length : 0;
  const onTimeDays = Object.values(state.log || {}).filter((d) => PRAYERS.slice(0, 5).every((p) => d?.[p] === 'prayed')).length;
  const clear = total > 0 && totalQazo(state) === 0 ? 1 : 0;
  const val = { total, streak: best, goalDays, onTimeDays, clear };
  return ACH.map((a) => ({ ...a, value: Math.min(val[a.kind], a.need), unlocked: val[a.kind] >= a.need }));
}

// Kalendar: oy kataklari (dushanbadan boshlanadi), bo'sh joylar null
export function monthGrid(year, month) {
  const first = new Date(year, month, 1, 12);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d, 12));
  while (cells.length % 7) cells.push(null);
  return cells;
}
