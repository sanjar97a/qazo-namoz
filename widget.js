// Android bosh ekran vidjeti uchun ma'lumot: 30 kunlik namoz vaqtlari (vidjet internetsiz ishlaydi).
import { addDays, dayKey, dayWindows, noon } from './prayer.js';

const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const W = () => (window.Capacitor?.isNativePlatform?.()
  ? (window.Capacitor.Plugins?.PrayerWidget || window.Capacitor.registerPlugin?.('PrayerWidget')) : null);
export const widgetSupported = () => Boolean(W());

// { city, days: { 'YYYY-MM-DD': [bomdod, quyosh, peshin, asr, shom, xufton] (ms) } }
export function widgetData(settings, now = new Date(), days = 30) {
  const out = { city: String(settings.city || '').split(',')[0].trim() || 'Namoz vaqtlari', days: {} };
  for (let i = -1; i < days; i++) {
    const d = addDays(noon(now), i);
    const { windows, times } = dayWindows(d, settings);
    out.days[dayKey(d)] = KEYS.map((k) => (k === 'sunrise' ? times.sunrise : windows[k].start).getTime());
  }
  return out;
}

let lastSig = '';
export async function syncWidget(state, force = false) {
  const w = W();
  if (!w || !state?.settings) return;
  const sig = dayKey(new Date()) + JSON.stringify(state.settings);
  if (!force && sig === lastSig) return;
  lastSig = sig;
  try { await w.update({ data: JSON.stringify(widgetData(state.settings)) }); } catch {}
}

// Vidjetni bosh ekranga qo'shish oynasini ochadi (Android 8+). { ok, count }
export async function pinWidget() {
  try { return await W().pin(); } catch { return { ok: false, count: 0 }; }
}
