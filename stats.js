// Statistika, streak, maqsadlar, yutuqlar — toza funksiyalar (UI'siz).
// state.done = { '2026-10-21': { fajr: 2, asr: 1 } } — shu kuni ado qilingan qazolar soni.
import { PRAYERS, addDays, dayKey, noon, totalQazo } from './prayer.js';

export const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
export const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const sum = (o) => Object.values(o || {}).reduce((a, n) => a + (Number(n) || 0), 0);
export const dayDone = (state, key) => sum(state.done?.[key]);

// Qazo ado qilindi (delta > 0) yoki xato bosilgani bekor qilindi (delta < 0). Bir nechtasini birdan ham qabul qiladi.
export function recordDone(state, p, delta = 1, now = new Date()) {
  const key = dayKey(now);
  const day = { ...(state.done?.[key] || {}) };
  const cur = day[p] || 0;
  const left = state.qazo[p] || 0;
  const d = delta > 0 ? Math.min(delta, left) : -Math.min(-delta, cur);
  if (!d) return state;
  day[p] = cur + d;
  if (!day[p]) delete day[p];
  return {
    ...state,
    qazo: { ...state.qazo, [p]: Math.max(0, left - d) },
    done: { ...state.done, [key]: day },
  };
}

// Har bir namoz bo'yicha: ado qilingan, qolgan, foiz
export function perPrayer(state, prayers) {
  const done = {};
  for (const d of Object.values(state.done || {})) for (const [p, n] of Object.entries(d || {})) done[p] = (done[p] || 0) + (Number(n) || 0);
  return prayers.map((p) => {
    const dn = done[p] || 0, left = state.qazo[p] || 0;
    return { p, done: dn, left, pct: dn + left ? Math.round((dn / (dn + left)) * 1000) / 10 : 100 };
  });
}

// O'rtacha temp: oxirgi `days` kun ichida kuniga necha ta
export function recentPace(state, now = new Date(), days = 14) {
  return rangeDone(state, addDays(noon(now), -(days - 1)), days) / days;
}

// "Qachon tugaydi?" — turli kunlik miqdorlar uchun
export function finishPlans(remaining, perDays, now = new Date()) {
  return perDays.filter((n) => n > 0).map((n) => {
    const days = Math.ceil(remaining / n);
    return { perDay: n, days, date: addDays(noon(now), days) };
  });
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

// Davr statistikasi: '7' | '30' | '180' | '365' | 'all'
export function periodStats(state, period, now = new Date()) {
  const today = noon(now);
  const keys = Object.keys(state.done || {}).filter((k) => dayDone(state, k) > 0).sort();
  const firstKey = keys[0];
  let start, bucket;
  if (period === '7') { start = weekStart(now); bucket = 'day'; }
  else if (period === '30') { start = addDays(today, -29); bucket = 'day'; }
  else if (period === '180') { start = weekStart(addDays(today, -7 * 25)); bucket = 'week'; }
  else if (period === '365') { start = new Date(today.getFullYear(), today.getMonth() - 11, 1, 12); bucket = 'month'; }
  else {
    const f = firstKey ? new Date(`${firstKey}T12:00:00`) : today;
    start = new Date(f.getFullYear(), f.getMonth(), 1, 12); bucket = 'month';
  }
  const days = Math.round((today - start) / 86400000) + 1;
  const daily = [];
  for (let i = 0; i < days; i++) { const d = addDays(start, i); daily.push({ d, key: dayKey(d), n: dayDone(state, dayKey(d)) }); }

  // Ustunlar
  const bars = [];
  if (bucket === 'day') {
    const len = period === '7' ? 7 : days;
    for (let i = 0; i < len; i++) {
      const d = addDays(start, i), key = dayKey(d);
      bars.push({ label: period === '7' ? WEEKDAYS[i] : String(d.getDate()), n: key > dayKey(today) ? 0 : dayDone(state, key),
        isToday: key === dayKey(today), future: key > dayKey(today) });
    }
  } else if (bucket === 'week') {
    for (let w = 0; w < Math.ceil(days / 7); w++) {
      const ws = addDays(start, w * 7);
      bars.push({ label: w % 4 === 0 ? `${ws.getDate()}.${String(ws.getMonth() + 1).padStart(2, '0')}` : '', n: rangeDone(state, ws, 7),
        isToday: dayKey(ws) <= dayKey(today) && dayKey(addDays(ws, 6)) >= dayKey(today), future: false });
    }
  } else {
    let m = new Date(start);
    while (m <= today) {
      const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      bars.push({ label: MONTHS[m.getMonth()].slice(0, 3), n: rangeDone(state, m, dim),
        isToday: m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth(), future: false });
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1, 12);
    }
  }

  const past = daily.filter((x) => x.key <= dayKey(today));
  const total = past.reduce((a, x) => a + x.n, 0);
  const active = past.filter((x) => x.n > 0).length;
  const best = past.reduce((b, x) => (x.n > (b?.n || 0) ? x : b), null);
  const wd = Array(7).fill(0);
  for (const x of past) wd[(x.d.getDay() + 6) % 7] += x.n;
  const bestWd = wd.some((v) => v > 0) ? wd.indexOf(Math.max(...wd)) : -1;
  let bestWeek = 0;
  for (let i = 0; i + 6 < past.length; i++) bestWeek = Math.max(bestWeek, past.slice(i, i + 7).reduce((a, x) => a + x.n, 0));
  if (past.length < 7) bestWeek = total;
  const prevTotal = period === 'all' ? null : rangeDone(state, addDays(start, -past.length), past.length);
  const change = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  return {
    bars, total, active, days: past.length,
    avg: past.length ? Math.round((total / past.length) * 10) / 10 : 0,
    best: best && best.n ? { date: best.d, n: best.n } : null,
    bestWeekday: bestWd >= 0 ? ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'][bestWd] : null,
    bestWeek, change,
  };
}
