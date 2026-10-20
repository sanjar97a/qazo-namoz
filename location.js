// Joylashuvni aniqlash (GPS -> internet orqali taxminiy), shahar nomi va shahar qidiruvi.
// Hammasi dunyo bo'yicha ishlaydi.

// O'zbekiston viloyat markazlari (rasmiy taqvim uchun)
export const UZ_REGIONS = [
  ['Toshkent', 41.3111, 69.2797], ['Andijon', 40.7821, 72.3442], ['Namangan', 40.9983, 71.6726],
  ['Farg‘ona', 40.3864, 71.7864], ['Qo‘qon', 40.5286, 70.9425], ['Samarqand', 39.6542, 66.9597],
  ['Buxoro', 39.7747, 64.4286], ['Navoiy', 40.0844, 65.3792], ['Qarshi', 38.8606, 65.7891],
  ['Termiz', 37.2242, 67.2783], ['Jizzax', 40.1158, 67.8422], ['Guliston', 40.4897, 68.7842],
  ['Nukus', 42.4531, 59.6103], ['Urganch', 41.55, 60.6333],
];

export function distanceKm(a, b, c, d) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearestUzRegion(lat, lng) {
  let best = null;
  for (const [name, la, ln] of UZ_REGIONS) {
    const km = distanceKm(lat, lng, la, ln);
    if (!best || km < best.km) best = { name, lat: la, lng: ln, km };
  }
  return best;
}

const getPos = (opts) => new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, opts));

async function fetchJson(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// 1) Aniq GPS  2) Taxminiy GPS (Wi-Fi/tarmoq)  3) Internet (IP) orqali taxminiy
export async function detectLocation() {
  let error = 'unsupported';
  if (navigator.geolocation) {
    const tries = [
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 },
    ];
    for (const opts of tries) {
      try {
        const p = await getPos(opts);
        return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), how: 'gps' };
      } catch (e) {
        error = e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable';
        if (e.code === 1) break;
      }
    }
  }
  try {
    const j = await fetchJson('https://get.geojs.io/v1/ip/geo.json');
    const lat = Number(j.latitude), lng = Number(j.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) {
      return { lat, lng, how: 'ip', error, city: j.city, countryCode: j.country_code, country: j.country };
    }
  } catch {}
  const e = new Error(error);
  e.code = error;
  throw e;
}

export function locationErrorText(code) {
  if (code === 'denied') {
    return 'Joylashuvga ruxsat berilmagan. Brauzerda manzil yonidagi 🔒 (yoki ⓘ) belgisini bosing → Ruxsatlar → Joylashuv → Ruxsat berish. Telefonda “Joylashuv / GPS” yoqilgan bo‘lsin. Telegram ichida ochilgan bo‘lsa, sahifani Chrome’da oching.';
  }
  if (code === 'timeout' || code === 'unavailable') {
    return 'Joylashuv aniqlanmadi. Telefonda GPS yoqilganini tekshiring yoki ochiq joyda qayta urinib ko‘ring. Yoki pastdan shahringizni qidiring.';
  }
  return 'Bu brauzer joylashuvni aniqlay olmadi. Pastdan shahringizni qidirib tanlang.';
}

export async function permissionGranted() {
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; }
  catch { return false; }
}

export function quietPosition() {
  return getPos({ enableHighAccuracy: false, timeout: 15000, maximumAge: 1800000 })
    .then((p) => ({ lat: p.coords.latitude, lng: p.coords.longitude }));
}

// Koordinatadan shahar va davlat nomi (internet bo'lsa). Bo'lmasa — koordinata.
export async function placeName(lat, lng) {
  try {
    const j = await fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    const city = j.city || j.locality || j.principalSubdivision || '';
    const label = [city, j.countryName].filter(Boolean).join(', ');
    if (label) return { label, countryCode: j.countryCode || '' };
  } catch {}
  const uz = nearestUzRegion(lat, lng);
  if (uz && uz.km < 40) return { label: uz.name, countryCode: 'UZ' };
  return { label: `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`, countryCode: '' };
}

// Dunyo bo'yicha shahar qidirish
export async function searchCity(q) {
  const j = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=${encodeURIComponent(q)}`);
  return (j.results || []).map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
    lat: r.latitude, lng: r.longitude, countryCode: r.country_code || '',
  }));
}
