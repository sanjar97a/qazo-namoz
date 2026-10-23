// Namoz vaqtlari va avtomatik qazo hisoblash mantiqi (UI'siz, toza funksiyalar)
import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Madhab,
  HighLatitudeRule,
  PolarCircleResolution,
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
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec((str || '').trim());
  if (iso) str = `${iso[3]}.${iso[2]}.${iso[1]}`;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec((str || '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], 12);
  if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1) return null;
  return d;
}

// --- Hisoblash usullari (dunyo bo'yicha) ---
const angles = (f, i) => () => { const p = CalculationMethod.Other(); p.fajrAngle = f; p.ishaAngle = i; return p; };
export const METHODS = {
  uzbekistan: { label: 'O‘zbekiston / Markaziy Osiyo (15°/15°)', make: angles(15, 15) },
  russia: { label: 'Rossiya (16°/15°)', make: angles(16, 15) },
  turkey: { label: 'Turkiya (Diyanet)', make: () => CalculationMethod.Turkey() },
  mwl: { label: 'Musulmon olami ligasi (Yevropa, Osiyo)', make: () => CalculationMethod.MuslimWorldLeague() },
  isna: { label: 'Shimoliy Amerika (ISNA)', make: () => CalculationMethod.NorthAmerica() },
  moonsighting: { label: 'Buyuk Britaniya (Moonsighting)', make: () => CalculationMethod.MoonsightingCommittee() },
  ummalqura: { label: 'Saudiya Arabistoni (Umm al-Quro)', make: () => CalculationMethod.UmmAlQura() },
  dubai: { label: 'BAA (Dubay)', make: () => CalculationMethod.Dubai() },
  qatar: { label: 'Qatar', make: () => CalculationMethod.Qatar() },
  kuwait: { label: 'Quvayt', make: () => CalculationMethod.Kuwait() },
  egypt: { label: 'Misr', make: () => CalculationMethod.Egyptian() },
  karachi: { label: 'Pokiston, Hindiston', make: () => CalculationMethod.Karachi() },
  singapore: { label: 'Malayziya, Indoneziya, Singapur', make: () => CalculationMethod.Singapore() },
  custom: { label: 'O‘zim belgilayman (burchaklar)', make: null },
};

const BY_COUNTRY = {
  UZ: 'uzbekistan', KZ: 'uzbekistan', KG: 'uzbekistan', TJ: 'uzbekistan', TM: 'uzbekistan', AF: 'uzbekistan',
  RU: 'russia', BY: 'russia', TR: 'turkey', AZ: 'turkey',
  US: 'isna', CA: 'isna', GB: 'moonsighting', IE: 'moonsighting',
  SA: 'ummalqura', YE: 'ummalqura', AE: 'dubai', QA: 'qatar', KW: 'kuwait',
  EG: 'egypt', SD: 'egypt', LY: 'egypt', PK: 'karachi', IN: 'karachi', BD: 'karachi',
  MY: 'singapore', ID: 'singapore', SG: 'singapore', BN: 'singapore',
};
const TZ_COUNTRY = {
  'Asia/Tashkent': 'UZ', 'Asia/Samarkand': 'UZ', 'Asia/Almaty': 'KZ', 'Asia/Bishkek': 'KG', 'Asia/Dushanbe': 'TJ',
  'Europe/Moscow': 'RU', 'Europe/Istanbul': 'TR', 'Europe/London': 'GB', 'Asia/Riyadh': 'SA', 'Asia/Dubai': 'AE',
  'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Africa/Cairo': 'EG', 'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN',
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Jakarta': 'ID', 'Asia/Singapore': 'SG', 'Asia/Baku': 'AZ', 'Europe/Minsk': 'BY',
};

// Davlat kodiga (yoki telefon vaqt mintaqasiga) qarab mos hisoblash usuli
export function suggestMethod(countryCode, timeZone) {
  let cc = (countryCode || '').toUpperCase();
  if (!cc && timeZone) {
    cc = TZ_COUNTRY[timeZone] || '';
    if (!cc && /^America\//.test(timeZone)) cc = 'US';
    if (!cc && /^(Asia\/(Yekaterinburg|Omsk|Novosibirsk|Krasnoyarsk|Irkutsk|Yakutsk|Vladivostok)|Europe\/(Samara|Volgograd|Kaliningrad))$/.test(timeZone)) cc = 'RU';
  }
  return BY_COUNTRY[cc] || 'mwl';
}

function params(settings) {
  const m = METHODS[settings.method] || METHODS.uzbekistan;
  let p;
  if (m.make) p = m.make();
  else { p = CalculationMethod.Other(); p.fajrAngle = Number(settings.fajrAngle) || 15; p.ishaAngle = Number(settings.ishaAngle) || 15; }
  p.madhab = settings.madhab === 'shafi' ? Madhab.Shafi : Madhab.Hanafi;
  // Shimoliy mamlakatlarda (Rossiya, Yevropa) yozda tun qisqa — maxsus qoida
  if (Math.abs(Number(settings.lat)) > 48) p.highLatitudeRule = HighLatitudeRule.recommended(new Coordinates(Number(settings.lat), Number(settings.lng)));
  p.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  return p;
}

export const TIME_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const TIME_NAMES = { ...NAMES, sunrise: 'Quyosh chiqishi' };

// Rasmiy taqvim (viloyat markazi uchun): { region, lat, lng, days: { '2026-10-20': { fajr: '05:24', ... } } }
let official = null;
export function setOfficial(o) { official = o && o.days ? o : null; }

function calc(lat, lng, d, settings) {
  const t = new PrayerTimes(new Coordinates(Number(lat), Number(lng)), d, params(settings));
  return { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
}

// Kunning asosiy vaqtlari.
// Rasmiy taqvim bo'lsa: viloyat markazining rasmiy vaqti + (sizning joyingiz bilan markaz orasidagi
// astronomik farq). Shu tarzda vaqt rasmiy taqvimga mos, lekin aynan turgan joyingiz uchun chiqadi.
// Rasmiy taqvim bo'lmasa: GPS koordinatadan hisoblanadi. Oxirida qo'lda kiritilgan tuzatishlar qo'shiladi.
export function baseTimes(date, settings, withOffsets = true) {
  const d = noon(date);
  const here = calc(settings.lat, settings.lng, d, settings);
  let t = here, source = 'calc', region = null;
  const rec = settings.source !== 'gps' && official?.days?.[dayKey(d)];
  if (rec) {
    const center = calc(official.lat, official.lng, d, settings);
    t = {};
    for (const k of TIME_KEYS) {
      const [h, mi] = rec[k].split(':').map(Number);
      const shift = Math.round((here[k] - center[k]) / 60000) * 60000;
      t[k] = new Date(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi).getTime() + shift);
    }
    source = 'official';
    region = official.region;
  }
  if (withOffsets) {
    t = { ...t };
    for (const k of TIME_KEYS) {
      const o = Number(settings.offsets?.[k]) || 0;
      if (o) t[k] = new Date(t[k].getTime() + o * 60000);
    }
  }
  return { ...t, source, region };
}

// Bir kunning namoz vaqtlari va har bir namozning "oynasi" (boshlanish - tugash)
export function dayWindows(date, settings) {
  const d = noon(date);
  const t = baseTimes(d, settings);
  const tn = baseTimes(addDays(d, 1), settings);
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
        if (s.excused) {
          // Uzrli kunlar (hayz/nifos): namoz farz emas — qazoga qo'shilmaydi
          log[key] = { ...log[key], [p]: 'excused' };
          continue;
        }
        qazo[p] = (qazo[p] || 0) + 1;
        added[p] = (added[p] || 0) + 1;
        log[key] = { ...log[key], [p]: 'qazo' };
      }
    }
    d = addDays(d, 1);
  }

  return {
    state: { ...state, qazo, log, lastProcessed: now.getTime() }, // tarix to'liq saqlanadi (o'chirilmaydi)
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

// Avtomatik qazoga tushgan, lekin aslida o'qilgan namozni tuzatish (oxirgi 30 kun ichida)
export const UNDO_DAYS = 30;
export function undoQazo(state, key, p, now = new Date()) {
  if (state.log?.[key]?.[p] !== 'qazo') return state;
  if (key < dayKey(addDays(now, -UNDO_DAYS))) return state;
  return {
    ...state,
    qazo: { ...state.qazo, [p]: Math.max(0, (state.qazo[p] || 0) - 1) },
    log: { ...state.log, [key]: { ...state.log[key], [p]: 'prayed' } },
  };
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

// Sana noma'lum bo'lganlar uchun: hayot davrlari bo'yicha taxminiy hisob.
// periods: [{ to: yosh | null (oxirgisi — hozirgacha), pct: o'qigan foizi 0..100 }]
// Har davr boshlanishi — oldingi davr oxiri (birinchisi — balog'at yoshi).
export function estimateFromPeriods({ age, bulughAge, periods, includeVitr, gender, hayzDays }) {
  const A = Number(age), B = Number(bulughAge);
  const q = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, vitr: 0 };
  if (!(A > 0) || !(B > 0) || A <= B || !periods?.length) return { q, days: 0, rows: [], ok: false };
  const hayz = gender === 'ayol' && Number(hayzDays) > 0 ? 1 - Math.min(Number(hayzDays), 15) / 30 : 1;
  let from = B, days = 0;
  const rows = periods.map((pr, i) => {
    const last = i === periods.length - 1;
    const to = last ? A : Math.min(A, Math.max(from, Number(pr.to) || from));
    const pct = Math.min(100, Math.max(0, Number(pr.pct) || 0));
    const d = (to - from) * 365.2425 * (1 - pct / 100) * hayz;
    const row = { from, to, pct, days: d };
    days += d; from = to;
    return row;
  });
  const n = Math.round(days);
  for (const p of includeVitr ? PRAYERS : PRAYERS.slice(0, 5)) q[p] = n;
  return { q, days: n, rows, ok: true };
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

// Tarix tahrirlovchisi: o'tgan kundagi namoz holatini almashtirish ('prayed' | 'qazo' | 'excused').
// Qazo hisobi mos ravishda o'zgaradi. Vaqti hali tugamagan namozni bu yerda o'zgartirib bo'lmaydi.
export function setDayStatus(state, key, p, status, now = new Date()) {
  const cur = state.log?.[key]?.[p];
  if (cur === status || !['prayed', 'qazo', 'excused'].includes(status)) return state;
  const day = new Date(`${key}T12:00:00`);
  const { windows } = dayWindows(day, state.settings);
  if (!windows[p] || windows[p].end > now) return state;
  let n = state.qazo[p] || 0;
  if (cur === 'qazo') n = Math.max(0, n - 1);
  if (status === 'qazo') n += 1;
  return { ...state, qazo: { ...state.qazo, [p]: n }, log: { ...state.log, [key]: { ...state.log[key], [p]: status } } };
}
