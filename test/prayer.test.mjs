import test from 'node:test';
import assert from 'node:assert/strict';
import { dayWindows, processMissed, togglePrayed, initialQazo, fmtTime, totalQazo } from '../prayer.js';

const settings = { lat: 40.9983, lng: 71.6726, includeVitr: true, dailyGoal: 3, fajrAngle: 15, ishaAngle: 15 };
const base = { settings, qazo: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, vitr: 0 }, log: {} };
const at = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi);

test('Namangan vaqtlari mantiqiy tartibda', () => {
  const { windows: w } = dayWindows(at(2026, 10, 19, 12), settings);
  console.log('Namangan 19.10.2026:', Object.fromEntries(Object.entries(w).map(([k, v]) => [k, fmtTime(v.start)])));
  assert.ok(w.fajr.start < w.fajr.end && w.fajr.end < w.dhuhr.start);
  assert.ok(w.asr.start < w.maghrib.start && w.maghrib.start < w.isha.start);
});

test('Belgilanmagan namozlar bir kunda 6 ta qazo bo‘ladi', () => {
  const s = { ...base, lastProcessed: at(2026, 10, 19, 6).getTime() }; // bomdod vaqti ichida, kechagi xufton tugagan
  const { state, added } = processMissed(s, at(2026, 10, 20, 4)); // ertasi bomdoddan oldin
  // bomdod, peshin, asr, shom tugagan; xufton/vitr hali tugamagan
  assert.deepEqual(added, { fajr: 1, dhuhr: 1, asr: 1, maghrib: 1 });
  const { state: s2, added: a2 } = processMissed(state, at(2026, 10, 20, 7));
  assert.deepEqual(a2, { isha: 1, vitr: 1, fajr: 1 });
  assert.equal(totalQazo(s2), 7);
});

test('O‘qilgan namoz qazoga qo‘shilmaydi va ikki marta sanalmaydi', () => {
  let s = { ...base, lastProcessed: at(2026, 10, 19, 12, 0).getTime() };
  const day = at(2026, 10, 19, 12);
  const { windows: w } = dayWindows(day, settings);
  s = togglePrayed(s, day, 'dhuhr', new Date(w.dhuhr.start.getTime() + 60000));
  const r1 = processMissed(s, at(2026, 10, 19, 23));
  assert.equal(r1.added.dhuhr, undefined);
  assert.equal(r1.added.asr, 1);
  const r2 = processMissed(r1.state, at(2026, 10, 19, 23, 30));
  assert.deepEqual(r2.added, {});
});

test('Vitr o‘chirilsa hisoblanmaydi', () => {
  const s = { ...base, settings: { ...settings, includeVitr: false }, lastProcessed: at(2026, 10, 19, 12).getTime() };
  const { added } = processMissed(s, at(2026, 10, 21, 12));
  assert.equal(added.vitr, undefined);
});

test('Boshlang‘ich qazo hisoblash', () => {
  const q = initialQazo({ birth: at(1998, 1, 2, 12), bulughAge: 12, startDate: at(2009, 12, 30, 12), includeVitr: true, gender: 'erkak' });
  assert.equal(q.fajr, 0); // balog'atdan oldin boshlagan
  const q2 = initialQazo({ birth: at(1998, 1, 2, 12), bulughAge: 12, startDate: at(2015, 1, 2, 12), includeVitr: false, gender: 'erkak' });
  assert.equal(q2.fajr, 1826);
  assert.equal(q2.vitr, 0);
});

import { baseTimes, setOfficial, suggestMethod } from '../prayer.js';

test('Rasmiy taqvim + joyga moslash + qo‘lda tuzatish', () => {
  const d = at(2026, 10, 20, 12);
  setOfficial({ region: 'Namangan', lat: 40.9983, lng: 71.6726,
    days: { '2026-10-20': { fajr: '05:30', sunrise: '06:50', dhuhr: '12:10', asr: '15:40', maghrib: '17:25', isha: '18:45' } } });
  const s = { ...settings, lat: 40.9983, lng: 71.6726, source: 'auto' };
  assert.equal(fmtTime(baseTimes(d, s).fajr), '05:30'); // markazda — aynan rasmiy
  const east = baseTimes(d, { ...s, lng: 72.2 }); // ~45 km sharqda — ertaroq
  assert.ok(east.dhuhr < baseTimes(d, s).dhuhr);
  assert.equal(fmtTime(baseTimes(d, { ...s, offsets: { isha: 5 } }).isha), '18:50');
  assert.equal(baseTimes(d, { ...s, source: 'gps' }).source, 'calc');
  setOfficial(null);
});

test('Dunyo bo‘yicha: usul tanlash va shimoliy kenglik', () => {
  assert.equal(suggestMethod('RU'), 'russia');
  assert.equal(suggestMethod('', 'Asia/Seoul'), 'mwl');
  assert.equal(suggestMethod('', 'America/New_York'), 'isna');
  assert.equal(suggestMethod('', 'Europe/Istanbul'), 'turkey');
  const places = { Moskva: [55.7558, 37.6173, 'russia'], Seul: [37.5665, 126.978, 'mwl'], NewYork: [40.7128, -74.006, 'isna'], London: [51.5074, -0.1278, 'moonsighting'] };
  for (const [n, [lat, lng, method]] of Object.entries(places)) {
    for (const date of [at(2026, 6, 21, 12), at(2026, 12, 21, 12)]) {
      const t = baseTimes(date, { lat, lng, method, madhab: 'hanafi' });
      const ok = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].every((k) => t[k] instanceof Date && !isNaN(t[k]));
      assert.ok(ok, `${n} ${date}`);
      assert.ok(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha, n);
    }
  }
});

import { undoQazo } from '../prayer.js';

test('Uzrli kunlar: qazo qo‘shilmaydi, keyin o‘chirilsa yana qo‘shiladi', () => {
  const s0 = { ...base, settings: { ...settings, excused: true }, lastProcessed: at(2026, 10, 19, 6).getTime() };
  const r1 = processMissed(s0, at(2026, 10, 20, 7));
  assert.deepEqual(r1.added, {});
  assert.equal(totalQazo(r1.state), 0);
  assert.equal(r1.state.log['2026-10-19'].asr, 'excused');
  const s1 = { ...r1.state, settings: { ...settings, excused: false } };
  const r2 = processMissed(s1, at(2026, 10, 20, 23));
  assert.ok(r2.added.dhuhr === 1 && r2.added.asr === 1);
  assert.equal(r2.added.fajr, undefined); // 20-oktabr bomdodi uzrli paytda o'tgan
});

test('Xato qazoni tuzatish', () => {
  const s0 = { ...base, lastProcessed: at(2026, 10, 19, 12).getTime() };
  const { state: s1 } = processMissed(s0, at(2026, 10, 19, 23));
  assert.equal(s1.qazo.asr, 1);
  const s2 = undoQazo(s1, '2026-10-19', 'asr', at(2026, 10, 20, 9));
  assert.equal(s2.qazo.asr, 0);
  assert.equal(s2.log['2026-10-19'].asr, 'prayed');
  assert.equal(undoQazo(s2, '2026-10-19', 'asr', at(2026, 10, 20, 9)), s2); // ikkinchi marta o'zgarmaydi
  assert.equal(undoQazo(s1, '2026-10-19', 'asr', at(2026, 12, 1, 9)), s1);  // 30 kundan eski — mumkin emas
  const again = processMissed(s2, at(2026, 10, 20, 9));
  assert.equal(again.state.log['2026-10-19'].asr, 'prayed'); // qayta qazoga tushmaydi
});

import { qiblaBearing, sunPosition, distanceToKaaba } from '../qibla.js';
import { declination } from '../geomag.js';

test('Qibla yo‘nalishi va magnit og‘ish', () => {
  // Taniqli ma'lumotnoma qiymatlari (katta doira bo'yicha)
  assert.ok(Math.abs(qiblaBearing(40.7128, -74.006) - 58.48) < 0.05);  // Nyu-York
  assert.ok(Math.abs(qiblaBearing(51.5074, -0.1278) - 118.99) < 0.05); // London
  assert.ok(Math.abs(qiblaBearing(40.9983, 71.6726) - 243.67) < 0.05); // Namangan
  assert.ok(distanceToKaaba(21.4225, 39.8262) < 0.1);
  // Namanganda magnit og'ish taxminan +5°
  const d = declination(40.9983, 71.6726, new Date('2026-10-21'));
  assert.ok(d > 4 && d < 7);
  // Quyosh: Namanganda peshin paytida (taxminan 12:00) azimut ~180°
  const noon = sunPosition(new Date('2026-10-21T06:58:00Z'), 40.9983, 71.6726);
  assert.ok(Math.abs(noon.azimuth - 180) < 2 && noon.altitude > 30);
});

import { setDayStatus, UNDO_DAYS } from '../prayer.js';

test('Tarix saqlanadi va tahrirlanadi', () => {
  const s0 = { ...base, lastProcessed: at(2026, 6, 1, 12).getTime() };
  const r = processMissed(s0, at(2026, 10, 21, 12));
  assert.ok(r.state.log['2026-06-02']); // 60 kundan eski tarix o'chmaydi
  assert.equal(UNDO_DAYS, 30);
  let s = r.state;
  const before = s.qazo.asr;
  s = setDayStatus(s, '2026-06-02', 'asr', 'prayed', at(2026, 10, 21, 12));
  assert.equal(s.qazo.asr, before - 1);
  s = setDayStatus(s, '2026-06-02', 'asr', 'excused', at(2026, 10, 21, 12));
  assert.equal(s.qazo.asr, before - 1);
  s = setDayStatus(s, '2026-06-02', 'asr', 'qazo', at(2026, 10, 21, 12));
  assert.equal(s.qazo.asr, before);
  // Vaqti tugamagan namoz o'zgarmaydi
  assert.equal(setDayStatus(s, '2026-10-21', 'isha', 'qazo', at(2026, 10, 21, 12)), s);
});
