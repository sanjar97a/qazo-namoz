// O'zbekistonda: islomapi.uz rasmiy taqvimi (oylik), telefonda keshlanadi.
// Chet elda yoki internet bo'lmasa — ishlatilmaydi, vaqtlar GPS bo'yicha hisoblanadi.
import { setOfficial } from './prayer.js';
import { nearestUzRegion } from './location.js';

const KEY = 'namoz-qazo-official-v1';
const pad = (n) => String(n).padStart(2, '0');
const HM = /^\d{1,2}:\d{2}$/;

let cache = {};
try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}

export function officialRegionFor(s) {
  if (!s || s.source === 'gps' || s.lat == null) return null;
  const r = nearestUzRegion(Number(s.lat), Number(s.lng));
  return r && r.km <= 100 ? r : null;
}

export function applyOfficial(s) {
  const r = officialRegionFor(s);
  if (!r) return setOfficial(null);
  const days = {};
  for (const [k, v] of Object.entries(cache)) if (k.startsWith(r.name + '|')) Object.assign(days, v.days);
  setOfficial(Object.keys(days).length ? { region: r.name, lat: r.lat, lng: r.lng, days } : null);
}

function parseMonthly(data, y, m) {
  const list = Array.isArray(data) ? data : data?.data || [];
  const out = {};
  for (const it of list) {
    const t = it?.times || {};
    let day = Number(it?.day);
    if (!day && it?.date) day = new Date(it.date).getUTCDate();
    if (it?.month && Number(it.month) !== m) continue;
    const rec = { fajr: t.tong_saharlik, sunrise: t.quyosh, dhuhr: t.peshin, asr: t.asr, maghrib: t.shom_iftor, isha: t.hufton };
    if (day >= 1 && day <= 31 && Object.values(rec).every((v) => HM.test(v || ''))) out[`${y}-${pad(m)}-${pad(day)}`] = rec;
  }
  return out;
}

// Joriy (va oy oxirida keyingi) oy taqvimini yuklaydi. Natija: yangi ma'lumot keldimi.
export async function refreshOfficial(s) {
  const r = officialRegionFor(s);
  if (!r || !navigator.onLine) { applyOfficial(s); return false; }
  const now = new Date();
  const months = [[now.getFullYear(), now.getMonth() + 1]];
  if (now.getDate() >= 25) { const n = new Date(now.getFullYear(), now.getMonth() + 1, 1); months.push([n.getFullYear(), n.getMonth() + 1]); }
  let changed = false;
  for (const [y, m] of months) {
    const ck = `${r.name}|${y}-${pad(m)}`;
    if (cache[ck] && Date.now() - cache[ck].at < 7 * 86400000) continue;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 10000);
      const res = await fetch(`https://islomapi.uz/api/monthly?region=${encodeURIComponent(r.name.replace(/‘/g, "'"))}&month=${m}`, { signal: ctl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const days = parseMonthly(await res.json(), y, m);
      if (Object.keys(days).length >= 20) { cache[ck] = { at: Date.now(), days }; changed = true; }
    } catch {}
  }
  if (changed) {
    const keys = Object.keys(cache).sort((a, b) => cache[b].at - cache[a].at);
    for (const k of keys.slice(6)) delete cache[k];
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  }
  applyOfficial(s);
  return changed;
}
