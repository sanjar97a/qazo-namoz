// Qibla: yo'nalishni hisoblash, kompas (magnit og'ish tuzatilgan) va quyosh bo'yicha tekshirish.
import { Coordinates, Qibla } from './adhan.js';
import { declination } from './geomag.js';

export const KAABA = { lat: 21.422487, lng: 39.826206 };
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
export const norm = (a) => ((a % 360) + 360) % 360;
export const diff = (a, b) => ((a - b + 540) % 360) - 180; // a-b, [-180,180)

// Haqiqiy shimolga nisbatan qibla burchagi (katta doira bo'yicha)
export const qiblaBearing = (lat, lng) => Qibla(new Coordinates(lat, lng));

// Ka'bagacha masofa (km)
export function distanceToKaaba(lat, lng) {
  const p1 = rad(lat), p2 = rad(KAABA.lat), dl = rad(KAABA.lng - lng), dp = p2 - p1;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

// Magnit og'ish (WMM2025). Telefon kompasi magnit shimolni ko'rsatadi: haqiqiy = magnit + og'ish
export const magDeclination = (lat, lng, date = new Date()) => {
  try { return declination(lat, lng, date); } catch { return 0; }
};

// Quyoshning azimuti va balandligi (NOAA algoritmi), gradusda; azimut shimoldan soat yo'nalishida
export function sunPosition(date, lat, lng) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = norm(280.46646 + T * (36000.76983 + 0.0003032 * T));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const dec = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eqTime = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0))
    - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const tst = (((utcMin + eqTime + 4 * lng) % 1440) + 1440) % 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const cosZ = Math.sin(rad(lat)) * Math.sin(rad(dec)) + Math.cos(rad(lat)) * Math.cos(rad(dec)) * Math.cos(rad(ha));
  const zen = deg(Math.acos(Math.min(1, Math.max(-1, cosZ))));
  const az = norm(deg(Math.atan2(Math.sin(rad(ha)), Math.cos(rad(ha)) * Math.sin(rad(lat)) - Math.tan(rad(dec)) * Math.cos(rad(lat)))) + 180);
  return { azimuth: az, altitude: 90 - zen };
}

// Bugun quyosh qibla yo'nalishida (yoki teskarisida — soya qiblani ko'rsatadi) bo'ladigan vaqtlar
export function qiblaSunTimes(lat, lng, day = new Date()) {
  const q = qiblaBearing(lat, lng);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0).getTime();
  const out = [];
  let prev = null;
  for (let m = 0; m <= 1440; m += 1) {
    const t = new Date(start + m * 60000);
    const { azimuth, altitude } = sunPosition(t, lat, lng);
    const cur = { t, d1: diff(azimuth, q), d2: diff(azimuth, q + 180), altitude };
    if (prev) {
      for (const [key, kind] of [['d1', 'face'], ['d2', 'shadow']]) {
        if (Math.sign(prev[key]) !== Math.sign(cur[key]) && Math.abs(prev[key]) < 20 && cur.altitude > 8) {
          // chiziqli interpolyatsiya bilan aniq daqiqa
          const f = prev[key] / (prev[key] - cur[key]);
          out.push({ kind, at: new Date(prev.t.getTime() + f * 60000), altitude: cur.altitude });
        }
      }
    }
    prev = cur;
  }
  return out;
}

// Kompas: Android (deviceorientationabsolute), iOS (webkitCompassHeading). Magnit yo'nalish qaytaradi.
export function startCompass(onHeading, onUnavailable) {
  let got = false, stopped = false, last = null;
  const smooth = (h) => {
    if (last == null) return (last = h);
    last = norm(last + diff(h, last) * 0.18); // aylana bo'yicha silliqlash
    return last;
  };
  const screenAngle = () => (screen.orientation?.angle ?? window.orientation ?? 0);
  const handler = (e) => {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === 'number') h = norm(360 - e.alpha);
    if (h == null) return;
    got = true;
    onHeading(smooth(norm(h + screenAngle())));
  };
  const absEvt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  const attach = () => window.addEventListener(absEvt, handler, true);
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then((r) => (r === 'granted' ? attach() : onUnavailable('denied'))).catch(() => onUnavailable('denied'));
  } else attach();
  const timer = setTimeout(() => { if (!got && !stopped) onUnavailable('nosensor'); }, 3000);
  return () => { stopped = true; clearTimeout(timer); window.removeEventListener(absEvt, handler, true); };
}
