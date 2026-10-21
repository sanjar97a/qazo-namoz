// Bildirishnomalar — faqat Android ilovada (Capacitor LocalNotifications).
// Telefonning o'zida rejalashtiriladi: internet ham, server ham kerak emas.
import { QAZO, START, WARN, fmtQuote, pick } from './quotes.js';
import { NAMES, PRAYERS, addDays, currentPrayerDay, dayKey, dayWindows, fmtTime, totalQazo } from './prayer.js';

export const APK_URL = 'https://github.com/sanjar97a/qazo-namoz/releases/latest/download/namoz-qazo.apk';
export const DEFAULT_NOTIFY = { enabled: true, start: true, before: 20, daily: '' };

const DAYS = 10;          // necha kun oldinga rejalashtiriladi (har ochilganda yangilanadi)
const CHANNEL = 'namoz';

export const isNative = () => Boolean(window.Capacitor?.isNativePlatform?.());
const LN = () => window.Capacitor?.Plugins?.LocalNotifications || window.Capacitor?.registerPlugin?.('LocalNotifications');

export const notifyStatus = { permission: 'unknown', exact: 'unknown' };

export async function refreshStatus() {
  if (!isNative()) return notifyStatus;
  try { notifyStatus.permission = (await LN().checkPermissions()).display; } catch {}
  try { notifyStatus.exact = (await LN().checkExactNotificationSetting()).exact_alarm; } catch { notifyStatus.exact = 'granted'; }
  return notifyStatus;
}

export async function requestPermission() {
  if (!isNative()) return false;
  try { notifyStatus.permission = (await LN().requestPermissions()).display; } catch {}
  return notifyStatus.permission === 'granted';
}

// Android 12+: aniq vaqtda kelishi uchun "Signal va eslatmalar" ruxsati sozlamalar oynasida beriladi
export async function openExactSetting() {
  try { notifyStatus.exact = (await LN().changeExactNotificationSetting()).exact_alarm; } catch {}
}

let channelReady = false;
async function ensureChannel() {
  if (channelReady) return;
  try {
    await LN().createChannel({ id: CHANNEL, name: 'Namoz vaqtlari', description: 'Namoz vaqti kirishi va tugashi haqida',
      importance: 5, visibility: 1, vibration: true });
  } catch {}
  channelReady = true;
}

async function cancelAll() {
  try {
    const { notifications } = await LN().getPending();
    if (notifications?.length) await LN().cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  } catch {}
}

function atTime(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

export function buildSchedule(state, now = new Date()) {
  const s = state.settings;
  const n = { ...DEFAULT_NOTIFY, ...(s?.notify || {}) };
  if (!s || !n.enabled || s.excused) return []; // uzrli kunlarda eslatma yuborilmaydi
  const list = [];
  const first = currentPrayerDay(now, s);
  for (let i = 0; i < DAYS; i++) {
    const day = addDays(first, i);
    const key = dayKey(day);
    const { windows } = dayWindows(day, s);
    const dayNo = Math.floor(day.getTime() / 86400000); // har kuni boshqa gap chiqishi uchun
    PRAYERS.slice(0, 5).forEach((p, j) => {
      const w = windows[p];
      if (n.start && w.start > now) {
        const qo = pick(START, dayNo * 5 + j, p), q = fmtQuote(qo);
        list.push({ id: i * 100 + j * 2 + 1, at: w.start, quote: qo.id, title: `🕌 ${NAMES[p]} vaqti kirdi · ${fmtTime(w.start)}–${fmtTime(w.end)}`,
          body: q, largeBody: `${q}\n\nO‘qigach, ilovada “O‘qidim” deb belgilang.` });
      }
      const warn = new Date(w.end.getTime() - Number(n.before) * 60000);
      if (Number(n.before) > 0 && warn > now && warn > w.start && state.log[key]?.[p] !== 'prayed') {
        const qo = pick(WARN, dayNo * 5 + j, p), q = fmtQuote(qo);
        list.push({ id: i * 100 + j * 2 + 2, at: warn, quote: qo.id, title: `⏳ ${NAMES[p]}: ${n.before} daqiqa qoldi (${fmtTime(w.end)} gacha)`,
          body: q, largeBody: `${q}\n\nO‘qilmasa, qazo hisobiga qo‘shiladi.` });
      }
    });
    if (n.daily) {
      const at = atTime(day, n.daily);
      if (at > now) {
        const qo = pick(QAZO, dayNo), q = fmtQuote(qo);
        list.push({ id: i * 100 + 50, at, quote: qo.id, title: `📿 Qazo vaqti · bugungi maqsad ${s.dailyGoal || 0} ta`,
          body: q, largeBody: `${q}\n\nJami qoldi: ${totalQazo(state)} ta. Bugun ${s.dailyGoal || 0} tasini ado qilaylik.` });
      }
    }
  }
  // Ilova uzoq ochilmasa — eslatmalar to'xtab qolmasligi uchun
  const last = atTime(addDays(first, DAYS - 2), '20:00');
  if (last > now) list.push({ id: 9999, at: last, title: 'Namoz va Qazo', body: 'Eslatmalar davom etishi uchun ilovani bir marta oching.' });
  return list;
}

let lastRun = 0;
export async function reschedule(state, force = false) {
  if (!isNative() || !state?.settings) return;
  if (!force && Date.now() - lastRun < 10 * 60000) return;
  lastRun = Date.now();
  await refreshStatus();
  await cancelAll();
  if (notifyStatus.permission !== 'granted') return;
  const list = buildSchedule(state);
  if (!list.length) return;
  await ensureChannel();
  try {
    await LN().schedule({
      notifications: list.map((x) => ({
        id: x.id, title: x.title, body: x.body, largeBody: x.largeBody, channelId: CHANNEL, extra: { quote: x.quote || null }, smallIcon: 'ic_stat_notify', iconColor: '#4C8DF6',
        schedule: { at: x.at, allowWhileIdle: true },
      })),
    });
  } catch (e) { console.warn('schedule', e); }
}

// Bildirishnoma bosilganda: ilova ochiladi va unga biriktirilgan oyat/hadis ko'rsatiladi
export function onNotificationTap(handler) {
  if (!isNative()) return;
  try { LN().addListener('localNotificationActionPerformed', (e) => handler(e?.notification?.extra?.quote || null)); } catch {}
}

export async function testNotification() {
  await ensureChannel();
  const qo = pick(START, Date.now() / 1000), q = fmtQuote(qo);
  await LN().schedule({ notifications: [{ id: 9998, title: '🕌 Sinov bildirishnomasi', body: q, largeBody: `${q}\n\nBosing — to‘liq matni ochiladi.`, extra: { quote: qo.id },
    channelId: CHANNEL, smallIcon: 'ic_stat_notify', iconColor: '#4C8DF6', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
}
