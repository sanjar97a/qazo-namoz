// Namoz vaqtlari va avtomatik qazo hisoblash mantiqi (UI'siz, toza funksiyalar)
import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Madhab,
} from './adhan.js';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'vitr'];

export const NAMES = {
  fajr: 'Bomdod',
  dhuhr: 'Peshin',
  asr: 'Asr',
  maghrib: 'Shom',
  isha: 'Xufton',
  vitr: 'Vitr',
};

export function activePrayers(settings) {
  return settings?.includeVitr ? PRAYERS : PRAYERS.slice(0, 5);
}

// --- Sana yordamchilari ---
export const noon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fmtDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

// "KK.OO.YYYY" -> Date | null
export function parseDate(str) {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec((str || '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], 12);
  if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1) return null;
  return d;
}

// --- Hisoblash parametrlari (Hanafiy asr) ---
function params(settings) {
  const p = CalculationMethod.Other();
  p.fajrAngle = Number(settings.fajrAngle ?? 15);
  p.ishaAngle = Number(settings.ishaAngle ?? 15);
  p.madhab = Madhab.Hanafi;
  return p;
}

// Bir kunning namoz vaqtlari va har bir namozning "oynasi" (boshlanish - tugash)
export function dayWindows(date, settings) {
  const c = new Coordinates(Number(settings.lat), Number(settings.lng));
  const pr = params(settings);
  const d = noon(date);
  const t = new PrayerTimes(c, d, pr);
  const tn = new PrayerTimes(c, addDays(d, 1), pr);
  return {
    times: t,
    windows: {
      fajr: { start: t.fajr, end: t.sunrise },
      dhuhr: { start: t.dhuhr, end: t.asr },
      asr: { start: t.asr, end: t.maghrib },
      maghrib: { start: t.maghrib, end: t.isha },
      isha: { start: t.isha, end: tn.fajr },
      vitr: { start: t.isha, end: tn.fajr },
    },
  };
}

// Xufton/Vitr ertasi kungi bomdodgacha davom etadi. Hozir qaysi kunning
// namozlari "joriy" ekanini aniqlaymiz: bugungi bomdoddan oldin bo'lsa, kechagi kun.
export function currentPrayerDay(now, settings) {
  const today = noon(now);
  const { windows } = dayWindows(today, settings);
  return now < windows.fajr.start ? addDays(today, -1) : today;
}

// Asosiy qoida: vaqti tugagan va "o'qildi" deb belgilanmagan har bir namoz qazo +1.
// Ilova yopiq turgan davr ham ochilganda bir yo'la hisoblanadi.
export function processMissed(state, now = new Date()) {
  const s = state.settings;
  if (!s || s.lat == null || !state.lastProcessed) return { state, added: {} };
  const last = new Date(state.lastProcessed);
  if (last >= now) return { state, added: {} };

  const qazo = { ...state.qazo };
  const log = { ...state.log };
  const added = {};

  let d = addDays(last, -1); // kechagi xufton ham bugun tugashi mumkin
  const endDay = noon(now);
  while (d <= endDay) {
    const key = dayKey(d);
    const { windows } = dayWindows(d, s);
    for (const p of activePrayers(s)) {
      const end = windows[p].end;
      if (end > last && end <= now && !log[key]?.[p]) {
        qazo[p] = (qazo[p] || 0) + 1;
        added[p] = (added[p] || 0) + 1;
        log[key] = { ...log[key], [p]: 'qazo' };
      }
    }
    d = addDays(d, 1);
  }

  return {
    state: { ...state, qazo, log: pruneLog(log, now), lastProcessed: now.getTime() },
    added,
  };
}

// Faqat vaqti kirgan va hali tugamagan namozni "o'qidim" deb belgilash/bekor qilish mumkin
export function togglePrayed(state, day, p, now = new Date()) {
  const { windows } = dayWindows(day, state.settings);
  const w = windows[p];
  if (now < w.start || now >= w.end) return state;
  const key = dayKey(day);
  const cur = state.log[key]?.[p];
  if (cur === 'qazo') return state;
  const dayLog = { ...state.log[key] };
  if (cur === 'prayed') delete dayLog[p];
  else dayLog[p] = 'prayed';
  return { ...state, log: { ...state.log, [key]: dayLog } };
}

function pruneLog(log, now) {
  const limit = dayKey(addDays(now, -60));
  const out = {};
  for (const k of Object.keys(log)) if (k >= limit) out[k] = log[k];
  return out;
}

// Boshlang'ich qazo: balog'at sanasidan namozni boshlagan sanagacha bo'lgan kunlar.
// Ayollar uchun oyiga o'rtacha hayz kunlari ayirib tashlanadi.
export function initialQazo({ birth, bulughAge, startDate, includeVitr, gender, hayzDays }) {
  const bulugh = new Date(birth.getFullYear() + Number(bulughAge), birth.getMonth(), birth.getDate(), 12);
  let days = Math.max(0, Math.round((noon(startDate) - bulugh) / 86400000));
  if (gender === 'ayol' && Number(hayzDays) > 0) {
    days = Math.round(days * (1 - Math.min(Number(hayzDays), 15) / 30));
  }
  const q = {};
  for (const p of includeVitr ? PRAYERS : PRAYERS.slice(0, 5)) q[p] = days;
  if (!includeVitr) q.vitr = 0;
  return q;
}

export function totalQazo(state) {
  return activePrayers(state.settings).reduce((a, p) => a + (state.qazo[p] || 0), 0);
}

export function estimatedFinish(state, now = new Date()) {
  const goal = Number(state.settings.dailyGoal) || 0;
  const total = totalQazo(state);
  if (goal <= 0 || total === 0) return null;
  return addDays(now, Math.ceil(total / goal));
}
