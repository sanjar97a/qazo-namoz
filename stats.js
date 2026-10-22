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

// Maqsad bajarilgan kunlar ketma-ketligi (kunlik reja to'liq bajarilgan kunlar)
export function goalStreak(state, now = new Date()) {
  const goal = Number(state.settings?.dailyGoal) || 0;
  if (!goal) return { current: 0, best: 0 };
  const met = (k) => dayDone(state, k) >= goal;
  let d = noon(now);
  if (!met(dayKey(d))) d = addDays(d, -1);
  let current = 0;
  while (met(dayKey(d))) { current++; d = addDays(d, -1); }
  const keys = Object.keys(state.done || {}).filter(met).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    const cur = new Date(`${k}T12:00:00`);
    run = prev && Math.round((cur - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = cur;
  }
  return { current, best: Math.max(best, current) };
}

// Qazo safari: boshlanishdagi jami, ado qilingan, qolgan
export function journey(state) {
  const done = totalDone(state), left = totalQazo(state);
  const start = Math.max(Number(state.startTotal) || 0, done + left);
  return { start, done, left, pct: start ? Math.round((done / start) * 1000) / 10 : 0 };
}

const ACH = [
  { id: 'first', tier: 'bronze', icon: '🌱', title: 'Birinchi qadam', desc: '1 ta qazo ado qilindi', kind: 'total', need: 1 },
  { id: 't100', tier: 'bronze', icon: '🏅', title: '100 talik', desc: '100 ta qazo ado qilindi', kind: 'total', need: 100 },
  { id: 't500', tier: 'silver', icon: '🥈', title: '500 talik', desc: '500 ta qazo', kind: 'total', need: 500 },
  { id: 't1000', tier: 'gold', icon: '🥇', title: '1000 talik', desc: '1 000 ta qazo', kind: 'total', need: 1000 },
  { id: 't5000', tier: 'platinum', icon: '🏆', title: '5000 talik', desc: '5 000 ta qazo', kind: 'total', need: 5000 },
  { id: 't10000', tier: 'diamond', icon: '👑', title: '10 000 talik', desc: '10 000 ta qazo', kind: 'total', need: 10000 },
  { id: 'goal', tier: 'bronze', icon: '🎯', title: 'Maqsadga yetdim', desc: 'Bir kunda kunlik maqsad bajarildi', kind: 'goalDays', need: 1 },
  { id: 'g10', tier: 'silver', icon: '🎯', title: '10 kun reja', desc: '10 kun ketma-ket maqsad bajarildi', kind: 'goalStreak', need: 10 },
  { id: 'g30', tier: 'gold', icon: '🏹', title: '30 kun reja', desc: '30 kun ketma-ket maqsad bajarildi', kind: 'goalStreak', need: 30 },
  { id: 'g100', tier: 'diamond', icon: '⭐', title: '100 kun reja', desc: '100 kun ketma-ket maqsad bajarildi', kind: 'goalStreak', need: 100 },
  { id: 's7', tier: 'bronze', icon: '🔥', title: '7 kun', desc: '7 kun ketma-ket', kind: 'streak', need: 7 },
  { id: 's30', tier: 'gold', icon: '🔥', title: '30 kun', desc: '30 kun ketma-ket', kind: 'streak', need: 30 },
  { id: 's100', tier: 'diamond', icon: '💎', title: '100 kun', desc: '100 kun ketma-ket', kind: 'streak', need: 100 },
  { id: 'ontime', tier: 'emerald', icon: '🕌', title: 'O‘z vaqtida', desc: 'Bir kunda 5 vaqt namoz o‘z vaqtida o‘qildi', kind: 'onTimeDays', need: 1 },
  { id: 'clear', tier: 'emerald', icon: '🌙', title: 'Qazo tugadi', desc: 'Barcha qazolar ado qilindi', kind: 'clear', need: 1 },
];

// Yutuq qachon qo'lga kiritilgani: tarix bo'yicha kunma-kun hisoblanadi
export function unlockDates(state, now = new Date()) {
  const goal = Number(state.settings?.dailyGoal) || 0;
  const keys = [...new Set([...Object.keys(state.done || {}), ...Object.keys(state.log || {})])].sort();
  const out = {};
  if (!keys.length) return out;
  const set = (id, key) => { if (!out[id]) out[id] = key; };
  let cum = 0, run = 0, grun = 0, goalDays = 0, onTime = 0;
  const end = dayKey(now);
  for (let d = new Date(`${keys[0]}T12:00:00`); dayKey(d) <= end; d = addDays(d, 1)) {
    const k = dayKey(d), n = dayDone(state, k);
    cum += n;
    run = n > 0 ? run + 1 : 0;
    const met = goal && n >= goal;
    grun = met ? grun + 1 : 0;
    if (met) goalDays++;
    if (PRAYERS.slice(0, 5).every((p) => state.log?.[k]?.[p] === 'prayed')) onTime++;
    for (const a of ACH) {
      const v = { total: cum, streak: run, goalDays, goalStreak: grun, onTimeDays: onTime }[a.kind];
      if (v != null && v >= a.need) set(a.id, k);
    }
  }
  return out;
}

const fmt1 = (x) => (Math.round(x * 10) / 10).toString();
export function durationText(days) {
  if (days < 45) return `${days} kun`;
  if (days < 730) return `${Math.round(days / 30.4)} oy`;
  return `${fmt1(days / 365)} yil`;
}

// "Aqlli tahlil" — oddiy statistik xulosalar (AI emas)
export function insights(state, now = new Date()) {
  const out = [];
  const ws = weekStart(now);
  const n = Math.round((noon(now) - ws) / 86400000) + 1; // haftaning nechanchi kuni
  const week = rangeDone(state, ws, n);
  const prev = rangeDone(state, addDays(ws, -7), n);    // o'tgan haftaning xuddi shu kunlari
  const goal = Number(state.settings?.dailyGoal) || 0;
  const pace = recentPace(state, now, 14);
  const left = totalQazo(state);
  if (week) out.push({ icon: '📊', text: `Bu hafta kuniga o‘rtacha <b>${fmt1(week / n)}</b> ta qazo ado qildingiz (jami ${week} ta).` });
  if (week && prev) {
    const ch = Math.round(((week - prev) / prev) * 100);
    if (ch > 0) out.push({ icon: '🔥', text: `O‘tgan haftaning shu kunlariga nisbatan <b>${ch}% ko‘proq</b>. Barakalla!` });
    else if (ch < 0) out.push({ icon: '📉', text: `O‘tgan haftaning shu kunlariga nisbatan <b>${-ch}% kamroq</b> — bugun biroz qo‘shsangiz, yetib olasiz.` });
    else out.push({ icon: '⚖️', text: 'O‘tgan hafta bilan bir xil sur’atdasiz.' });
  } else if (week && !prev) out.push({ icon: '🌱', text: 'O‘tgan haftaning shu kunlarida qazo o‘qilmagan edi — yaxshi boshlanish!' });
  if (left && pace >= 0.3) {
    const days = Math.ceil(left / pace);
    out.push({ icon: '🎯', text: `Oxirgi 14 kundagi sur’atda (kuniga ${fmt1(pace)} ta) qolgan qazolar taxminan <b>${durationText(days)}</b>da tugaydi.` });
  }
  if (left && goal && pace >= 0.3) {
    if (pace + 0.05 < goal) out.push({ icon: '💡', text: `Kunlik rejangiz ${goal} ta — rejaga yetish uchun kuniga yana <b>${fmt1(goal - pace)}</b> ta qo‘shish kerak.` });
    else out.push({ icon: '⭐', text: `Kunlik rejangizni (${goal} ta) muntazam bajaryapsiz — shu tarzda davom eting.` });
  }
  const wd = Array(7).fill(0);
  for (let i = 0; i < 28; i++) { const d = addDays(noon(now), -i); wd[(d.getDay() + 6) % 7] += dayDone(state, dayKey(d)); }
  const max = Math.max(...wd);
  if (max > 0 && wd.filter((v) => v > 0).length >= 3) {
    out.push({ icon: '📅', text: `Oxirgi 4 haftada eng faol kuningiz — <b>${['dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'][wd.indexOf(max)]}</b>.` });
  }
  if (!out.length) out.push({ icon: '🌱', text: 'Bir necha kun qazo o‘qing — shu yerda haftalik tahlil va tugash muddati paydo bo‘ladi.' });
  return out;
}

// Muntazamlik xaritasi: oxirgi `weeks` hafta, ustunlar — haftalar, qatorlar — Du..Ya
export function heatWeeks(state, now = new Date(), weeks = 12) {
  const start = addDays(weekStart(now), -7 * (weeks - 1));
  const today = dayKey(now);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, w * 7 + i), key = dayKey(d);
    return { key, n: key > today ? null : dayDone(state, key) };
  }));
}

// Kun intensivligi: 0..4
export function heatLevel(n, goal) {
  if (!n) return 0;
  if (goal) return n >= goal * 2 ? 4 : n >= goal ? 3 : n >= goal / 2 ? 2 : 1;
  return n >= 10 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : 1;
}

export function achievements(state, now = new Date()) {
  const total = totalDone(state);
  const { best } = streak(state, now);
  const goal = Number(state.settings?.dailyGoal) || 0;
  const goalDays = goal ? Object.keys(state.done || {}).filter((k) => dayDone(state, k) >= goal).length : 0;
  const onTimeDays = Object.values(state.log || {}).filter((d) => PRAYERS.slice(0, 5).every((p) => d?.[p] === 'prayed')).length;
  const clear = total > 0 && totalQazo(state) === 0 ? 1 : 0;
  const val = { total, streak: best, goalDays, onTimeDays, clear, goalStreak: goalStreak(state, now).best };
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
