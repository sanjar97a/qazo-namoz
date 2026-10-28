import {
  METHODS, NAMES, PRAYERS, TIME_KEYS, TIME_NAMES, activePrayers, addDays, baseTimes, currentPrayerDay, dayKey, dayWindows,
  estimateFromPeriods, estimatedFinish, fmtDate, fmtTime, initialQazo, parseDate, processMissed, suggestMethod, togglePrayed, totalQazo,
  undoQazo, UNDO_DAYS, setDayStatus,
} from './prayer.js';
import { CHANNEL } from './channel.js';
import {
  detectLocation, distanceKm, locationErrorText, permissionGranted, placeName, quietPosition, searchCity,
} from './location.js';
import { applyOfficial, refreshOfficial } from './official.js';
import {
  APK_URL, DEFAULT_NOTIFY, isNative, notifyStatus, onNotificationTap, openExactSetting, refreshStatus, requestPermission, reschedule, testNotification,
} from './notify.js';
import { QAZO as Q_QAZO, START as Q_START, fetchArabic, pick, quoteById, quranUrl } from './quotes.js';
import { LEARN_DISCLAIMER, LEARN_SECTIONS } from './learn.js';
import { diff as angDiff, distanceToKaaba, magDeclination, norm as angNorm, qiblaBearing, qiblaSunTimes, startCompass, sunPosition } from './qibla.js';
import {
  MONTHS, WEEKDAYS, achievements, dayDone, finishPlans, goalStreak, heatLevel, heatWeeks, insights, journey, monthGrid, perPrayer, periodStats,
  recentPace, recordDone, streak, summary, totalDone, unlockDates,
} from './stats.js';
import { journeySvg } from './journey.js';
import { pinWidget, syncWidget, widgetSupported } from './widget.js';
import { setStatsEnabled, statsEnabled, trackOpen, trackScreen, trackSetupDone } from './telemetry.js';

// ===== Qo'llab-quvvatlash sozlamalari: o'z ma'lumotlaringizni yozing (bo'sh qolsa ko'rinmaydi) =====
const SUPPORT = {
  payme: '',        // masalan: 'https://payme.uz/@sizning_nomingiz'
  click: '',        // Click to'lov havolasi
  card: '',         // karta raqami, masalan: '8600 1234 5678 9012'
  cardOwner: '',    // karta egasi: 'Sanjarbek X.'
  telegram: '',     // fikr va takliflar uchun: 'https://t.me/sizning_username'
};
const APP_URL = 'https://sanjar97a.github.io/qazo-namoz/';
// Play Market'da e'lon qilingach PLAY_LIVE = true qiling: sayt va ulashish havolalari Play'ga yo'naladi
const PLAY_LIVE = false;
const PLAY_URL = 'https://play.google.com/store/apps/details?id=uz.sanjar97a.namozqazo';
const IS_PLAY = CHANNEL === 'play';
const SHARE_URL = IS_PLAY || PLAY_LIVE ? PLAY_URL : APP_URL;
const SHARE_TEXT = 'Namoz va Qazo — namoz vaqtlari (dunyoning istalgan joyida) va qazo namozlar hisobi. Bepul, internetsiz ishlaydi.';

// ===== Har yangi versiyada: shu raqamni, version.json va sw.js dagi VERSION ni bir xil oshiring =====
export const APP_VERSION = '26';
let newVersion = null;

const KEY = 'namoz-qazo-state-v1';
const EMPTY = { settings: null, qazo: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, vitr: 0 }, log: {}, done: {}, lastProcessed: null };
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
const ICONS = { fajr: '🌅', dhuhr: '☀️', asr: '🌤', maghrib: '🌇', isha: '🌙', vitr: '✨' };
const DAY_NAMES = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

const $app = document.getElementById('app');
let state = load();
let screen = 'home';
let form = null;
let installEvt = null;
let cal = null; // { y, m, sel }

function load() {
  try {
    const r = localStorage.getItem(KEY);
    const s = r ? { ...EMPTY, ...JSON.parse(r) } : { ...EMPTY };
    s.done ||= {};
    return s;
  } catch { return { ...EMPTY }; }
}
// Android ilovada ma'lumot ikkinchi joyga ham yoziladi (Capacitor Preferences) — localStorage tozalansa tiklanadi
const Prefs = () => (isNative() ? window.Capacitor?.Plugins?.Preferences : null);
function mirror(json) { try { Prefs()?.set({ key: KEY, value: json }); } catch {} }
async function restoreFromMirror() {
  if (state.settings || !Prefs()) return;
  try {
    const { value } = await Prefs().get({ key: KEY });
    if (!value) return;
    const s = { ...EMPTY, ...JSON.parse(value) };
    if (!s.settings) return;
    s.done ||= {};
    state = s;
    try { localStorage.setItem(KEY, value); } catch {}
    applyOfficial(state.settings);
    render();
    check();
    toast('Ma’lumotlaringiz tiklandi.');
  } catch {}
}

let schedTimer = null;
function save(next) {
  state = next;
  const json = JSON.stringify(state);
  try { localStorage.setItem(KEY, json); } catch {}
  mirror(json);
  render();
  syncWidget(state);
  clearTimeout(schedTimer);
  schedTimer = setTimeout(() => reschedule(state, true), 1500);
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hm = (d) => fmtTime(d);
const minutesOf = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const num = (n) => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const dayTitle = (d) => `${d.getDate()}-${MONTHS[d.getMonth()].toLowerCase()}, ${DAY_NAMES[d.getDay()].toLowerCase()}`;

function toast(msg, ms = 4500) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ---------------- Mavzu (yorug' / qorong'i) ---------------- */
const THEME_KEY = 'namoz-theme';
const getTheme = () => { try { return localStorage.getItem(THEME_KEY) || 'emerald'; } catch { return 'emerald'; } };
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
// [kalit, belgi, nomi, [asosiy rang, fon]]
const THEMES = [
  ['auto', '📱', 'Avto'],
  ['emerald', '🌿', 'Zumrad'],
  ['dark', '🌙', 'Yarim tun'],
  ['sand', '🪔', 'Iliq qum'],
  ['kaaba', '🕋', 'Ka’ba'],
  ['ramadan', '✨', 'Ramazon'],
  ['light', '☁️', 'Minimal'],
];
const DARK_THEMES = ['emerald', 'dark', 'kaaba', 'ramadan'];
const resolvedTheme = () => {
  const t = getTheme();
  if (t === 'auto') return darkMQ.matches ? 'emerald' : 'light';
  return THEMES.some((x) => x[0] === t) ? t : 'emerald';
};
const isDark = () => DARK_THEMES.includes(resolvedTheme());

// Jonli osmon: bosh sahifa foni namoz vaqtiga qarab o'zgaradi
const SKY_KEY = 'namoz-sky';
const skyOn = () => { try { return localStorage.getItem(SKY_KEY) !== 'off'; } catch { return true; } };
const SKY_TOP = { night: '#0A1430', dawn: '#1E2A5A', morning: '#2A6DB3', day: '#1A64AB', golden: '#2D6AA6', dusk: '#2B1B4A' };
const SKY_NAME = { night: 'Xufton — yulduzli tun', dawn: 'Bomdod — tong', morning: 'Tong — quyosh chiqdi', day: 'Peshin — yorug‘ kun', golden: 'Asr — oltin soat', dusk: 'Shom — quyosh botishi' };
let skyNow = null;
function skyPhase(now, t) {
  if (now < t.fajr || now >= t.isha) return 'night';
  if (now < t.sunrise.getTime() + 20 * 60000) return 'dawn';
  if (now < t.dhuhr) return 'morning';
  if (now < t.asr) return 'day';
  if (now < t.maghrib) return 'golden';
  return 'dusk';
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', resolvedTheme());
  applyBars();
}
function setTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  applyTheme();
  render();
}
darkMQ.addEventListener?.('change', () => { if (getTheme() === 'auto') { applyTheme(); render(); } });

// Holat qatori: yashil bosh qismda va qorong'i mavzuda — oq belgilar, yorug' sahifada — qora belgilar
function applyBars() {
  const hero = state.settings && screen === 'home';
  const lightIcons = hero || isDark();
  const meta = document.querySelector('meta[name="theme-color"]');
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  if (meta) meta.content = hero ? (skyOn() && skyNow ? SKY_TOP[skyNow] : css('--hero1') || '#0E8A63') : css('--bg') || '#F4F2EA';
  try { window.Capacitor?.Plugins?.SystemBars?.setStyle({ style: lightIcons ? 'DARK' : 'LIGHT' }); } catch {}
}

/* ---------------- Ilova sifatida o'rnatish ---------------- */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Ilova o‘rnatildi. Endi bosh ekrandan oching.'); render(); });

const isAndroid = () => /android/i.test(navigator.userAgent);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const INSTALL_HIDE_KEY = 'install-card-hidden-until';

// Saytda (brauzerda) ochilganda: "Ilovani o'rnatish" kartasi. Android ilovaning ichida ko'rinmaydi.
function installHtml(force) {
  if (isNative()) return '';
  if (!force) {
    let until = 0;
    try { until = Number(localStorage.getItem(INSTALL_HIDE_KEY)) || 0; } catch {}
    if (Date.now() < until) return '';
  }
  const close = force ? '' : '<button class="x" id="hideInstall" aria-label="Yopish">×</button>';
  if (isAndroid()) {
    const pwaBtn = !isStandalone() && installEvt ? '<button class="btn" id="install">📲 Brauzer orqali o‘rnatish (bildirishnomasiz)</button>' : '';
    return `<div class="install-card">${close}
      <div class="ic-title">📲 Ilovani telefonga o‘rnating</div>
      <div class="ic-text">Android ilovada namoz vaqti kirganda va tugashidan oldin <b>bildirishnoma</b> keladi, internetsiz ishlaydi.</div>
      ${PLAY_LIVE ? `<a class="btn install" href="${PLAY_URL}">▶️ Google Play’dan o‘rnatish</a>`
        : `<a class="btn install" href="${APK_URL}" id="apkLink">⬇️ Android ilovani yuklab olish</a>`}
      ${pwaBtn}
      <div class="ic-hint">Yuklash 100% bo‘lib qotib qolsa — telefonda <b>Fayllar → Yuklanmalar</b> ga kirib, <b>namoz-qazo.apk</b> ni bosing → “O‘rnatish”.
        Birinchi marta “Noma’lum manbalarga ruxsat” so‘ralsa, ruxsat bering.
        ${isStandalone() ? '' : 'Telegram ichida ochilgan bo‘lsa, sahifani Chrome’da oching — yuklash ishonchliroq.'}</div>
    </div>`;
  }
  if (isStandalone()) return '';
  if (installEvt) {
    return `<div class="install-card">${close}
      <div class="ic-title">📲 Ilovani o‘rnating</div>
      <div class="ic-text">Bosh ekrandan bir bosishda ochiladi va internetsiz ishlaydi.</div>
      <button class="btn install" id="install">O‘rnatish</button></div>`;
  }
  if (isIOS()) {
    return `<div class="install-card">${close}
      <div class="ic-title">📲 iPhone’ga o‘rnatish</div>
      <div class="ic-text"><b>Safari</b>’da oching → pastdagi <b>“Ulashish” ⬆︎</b> tugmasi → <b>“На экран «Домой» / Add to Home Screen”</b> → “Qo‘shish”.</div></div>`;
  }
  return `<div class="install-card">${close}
    <div class="ic-title">📲 Ilovani o‘rnating</div>
    <div class="ic-text">Brauzer menyusidan (⋮) <b>“Ilovani o‘rnatish”</b> yoki <b>“Bosh ekranga qo‘shish”</b> ni tanlang.</div></div>`;
}
function bindInstall() {
  const b = $app.querySelector('#install');
  if (b) b.onclick = async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; render(); };
  const x = $app.querySelector('#hideInstall');
  if (x) x.onclick = () => { try { localStorage.setItem(INSTALL_HIDE_KEY, String(Date.now() + 3 * 86400000)); } catch {} render(); };
  const a = $app.querySelector('#apkLink');
  if (a) a.onclick = () => toast('Yuklab olinmoqda… Tugagach: Fayllar → Yuklanmalar → namoz-qazo.apk → “O‘rnatish”.', 9000);
}

/* ---------------- Qazo tekshiruvi ---------------- */
function check() {
  if (!state.settings) return;
  const { state: next, added } = processMissed(state, new Date());
  const list = Object.entries(added).map(([p, n]) => `${NAMES[p]}: +${n}`);
  if (next !== state) save(next); else render();
  if (list.length) toast('Qazo hisobiga qo‘shildi\n' + list.join('\n') + '\nO‘qigan bo‘lsangiz — “Qazo ↺” yoki Kalendar orqali tuzating.', 7000);
}

// Ruxsat oldin berilgan bo'lsa, har ochilganda joylashuvni jimgina yangilaydi (sayohatda kerak)
async function autoLocate() {
  const s = state.settings;
  if (!s || s.autoLocation === false || !(await permissionGranted())) return;
  try {
    const p = await quietPosition();
    if (distanceKm(s.lat, s.lng, p.lat, p.lng) < 5) return;
    const place = await placeName(p.lat, p.lng);
    const method = s.methodAuto === false ? s.method : suggestMethod(place.countryCode, TZ);
    const settings = { ...state.settings, lat: p.lat, lng: p.lng, city: place.label, countryCode: place.countryCode, method };
    applyOfficial(settings);
    save({ ...state, settings });
    toast(`Joylashuv yangilandi: ${place.label}`);
    refreshOfficial(settings).then((ch) => ch && screen === 'home' && render());
  } catch {}
}

/* ---------------- Ekranlar va pastki menyu ---------------- */
const TABS = [
  ['home', 'Bosh sahifa', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ['stats', 'Statistika', '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>'],
  ['calendar', 'Kalendar', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ['qibla', 'Qibla', '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>'],
  ['menu', 'Menyu', '<path d="M4 6h16M4 12h16M4 18h16"/>'],
];
const TAB_OF = { estimate: 'home', qazo: 'home', journey: 'home', quote: 'home', focus: 'home', achievements: 'stats', history: 'calendar',
  learn: 'menu', settings: 'menu', support: 'menu', themes: 'menu' };
function tabbarHtml() {
  const active = TAB_OF[screen] || screen;
  return `<nav class="tabbar" aria-label="Asosiy menyu"><div class="in">${TABS.map(([id, label, svg]) => `
    <button class="tab ${active === id ? 'on' : ''}" data-tab="${id}" aria-label="${label}" ${active === id ? 'aria-current="page"' : ''}>
      <span class="ti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>${label}
    </button>`).join('')}</div></nav>`;
}
function go(to) {
  if (screen === 'qibla' && to !== 'qibla') stopQibla();
  if (screen === 'home' && to !== 'home') stopHomeCompass();
  if (screen === 'focus' && to !== 'focus') { try { wakeLock?.release(); } catch {} wakeLock = null; }
  if (screen === 'settings' && to !== 'settings') applyOfficial(state.settings);
  if (to !== 'history') histEdit = false;
  screen = to; form = null; render();
}

let lastScreen = null;
function render() {
  const cur = state.settings ? screen : 'setup';
  const changed = cur !== lastScreen;
  if (changed) { lastScreen = cur; window.scrollTo(0, 0); trackScreen(cur); }
  $app.className = '';
  if (!state.settings) { renderSetup(); $app.classList.add('no-tabs'); }
  else if (screen === 'settings') renderSettings();
  else if (screen === 'support') renderSupport();
  else if (screen === 'qazo') renderQazo();
  else if (screen === 'stats') renderStats();
  else if (screen === 'calendar') renderCalendar();
  else if (screen === 'learn') renderLearn();
  else if (screen === 'quote') renderQuote();
  else if (screen === 'qibla') renderQibla();
  else if (screen === 'journey') renderJourney();
  else if (screen === 'estimate') renderEstimate();
  else if (screen === 'history') renderHistory();
  else if (screen === 'achievements') renderAchievements();
  else if (screen === 'menu') renderMenu();
  else if (screen === 'themes') renderThemes();
  else if (screen === 'focus') { renderFocus(); $app.classList.add('no-tabs', 'focus-mode'); }
  else { renderHome(); $app.classList.add('has-hero'); }
  if (changed) $app.classList.add('fade');
  if (newVersion && screen !== 'focus') {
    const html = `<div class="update"><span class="grow">🔄 Yangi versiya mavjud</span><button id="doUpdate">Yangilash</button></div>`;
    const hero = $app.querySelector('.hero');
    if (hero) hero.insertAdjacentHTML('afterend', html); else $app.insertAdjacentHTML('afterbegin', html);
    $app.querySelector('#doUpdate').onclick = applyUpdate;
  }
  if (state.settings && screen !== 'focus') {
    $app.insertAdjacentHTML('beforeend', tabbarHtml());
    $app.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => go(b.dataset.tab); });
  }
  animateValues();
  applyBars();
}

/* ---------------- Mikro-animatsiyalar: raqam sanaladi, progress silliq to'ladi ---------------- */
const prevVals = {};
const an = (key, n) => `<span class="anum" data-a="${key}" data-v="${Number(n) || 0}">${num(n)}</span>`;
function animateValues() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $app.querySelectorAll('[data-a]').forEach((el) => {
    const k = el.dataset.a, v = Number(el.dataset.v), p = prevVals[k];
    prevVals[k] = v;
    if (reduce || p == null || p === v) return;
    if (el.classList.contains('anum')) {
      const t0 = performance.now(), dur = 650;
      const step = (t) => {
        const x = Math.min(1, (t - t0) / dur), e = 1 - (1 - x) ** 3;
        el.textContent = num(Math.round(p + (v - p) * e));
        if (x < 1) requestAnimationFrame(step);
      };
      el.textContent = num(p);
      requestAnimationFrame(step);
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    } else if (el.dataset.c) {
      const c = Number(el.dataset.c);
      el.style.transition = 'none'; el.style.strokeDashoffset = c * (1 - p / 100);
      el.getBoundingClientRect();
      el.style.transition = ''; el.style.strokeDashoffset = c * (1 - v / 100);
    } else {
      el.style.transition = 'none'; el.style.width = `${p}%`;
      void el.offsetWidth;
      el.style.transition = ''; el.style.width = `${v}%`;
    }
  });
}

/* ---------------- Yangilanish ---------------- */
// Android ilovada: yangi APK'ni qanday o'rnatish bo'yicha qisqa yo'riqnoma, keyin yuklab olish
function showApkSheet() {
  document.querySelector('.sheet-bg')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="sheet-bg"><div class="sheet">
      <div class="ic-title">🔄 Yangi versiya ${esc(newVersion || '')}</div>
      <ol class="steps">
        <li><b>Yuklab olish</b> tugmasini bosing — brauzer ochiladi.</li>
        <li>Yuklash 100% bo‘lgach, ochilmasa ham kutmang: telefonda <b>Fayllar → Yuklanmalar</b> (Downloads) ga kiring.</li>
        <li><b>namoz-qazo.apk</b> ni bosing → <b>Yangilash / O‘rnatish</b>.</li>
      </ol>
      <p class="hint">Ma’lumotlaringiz (qazo hisobi, sozlamalar) o‘chmaydi. Bir xil nomli eski fayl bo‘lsa, eng yangisini tanlang.</p>
      <a class="btn install" href="${APK_URL}" id="sheetGo">⬇️ Yuklab olish</a>
      <button class="btn" id="sheetClose">Keyinroq</button>
    </div></div>`);
  const bg = document.querySelector('.sheet-bg');
  bg.querySelector('#sheetClose').onclick = () => bg.remove();
  bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
  bg.querySelector('#sheetGo').onclick = () => setTimeout(() => bg.remove(), 500);
}

async function checkUpdate() {
  if (!navigator.onLine || IS_PLAY) return; // Play versiyasi faqat Google Play orqali yangilanadi
  try {
    const r = await fetch(`${isNative() ? APP_URL : ''}version.json?t=${Date.now()}`, { cache: 'no-store' });
    const v = String((await r.json()).version || '');
    if (v && v !== APP_VERSION && v !== newVersion) { newVersion = v; render(); }
  } catch {}
  try { (await navigator.serviceWorker?.getRegistration())?.update(); } catch {}
}

// Faqat ilova fayllari keshi tozalanadi — sizning ma'lumotlaringiz (qazo, sozlamalar) saqlanib qoladi
async function applyUpdate() {
  if (isNative()) return showApkSheet(); // yangi APK yuklab olinadi va ustidan o'rnatiladi
  const b = $app.querySelector('#doUpdate');
  if (b) { b.disabled = true; b.textContent = '⏳'; }
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
    if (reg?.waiting) reg.waiting.postMessage('skipWaiting');
  } catch {}
  try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
  location.replace(location.pathname + '?v=' + newVersion);
}

function sourceText(t, s) {
  if (t.source === 'official') return `Rasmiy taqvim (${esc(t.region)}) asosida, joyingizga moslangan`;
  return `GPS bo‘yicha hisoblandi · ${esc(METHODS[s.method]?.label || METHODS.uzbekistan.label)}`;
}

/* ---------------- Umumiy bloklar ---------------- */
function ringSvg(value, max, size = 108, stroke = 10, key = '') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const anim = key ? `class="prog" data-a="${key}" data-v="${Math.round(pct * 1000) / 10}" data-c="${c}"` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="${stroke}"/>
    <circle ${anim} cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${pct >= 1 ? 'var(--gold-bright)' : 'var(--accent)'}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>`;
}
const bar = (value, max, thin, key = '') => {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return `<div class="bar${thin ? ' thin' : ''}"><i ${key ? `data-a="${key}" data-v="${Math.round(w * 10) / 10}"` : ''} style="width:${w}%"></i></div>`;
};

// Keyingi namoz va hozirgi namoz
function nextPrayer(now, s) {
  const day = currentPrayerDay(now, s);
  for (let i = 0; i < 3; i++) {
    const d = addDays(day, i);
    const { windows } = dayWindows(d, s);
    for (const p of PRAYERS.slice(0, 5)) if (windows[p].start > now) return { p, at: windows[p].start };
  }
  return null;
}
function untilText(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h} soat ${m % 60} daq` : `${m} daqiqa`;
}

/* ---------------- Bosh sahifa ---------------- */
// Masjid siluetlari (minoralar va gumbazlar) — jonli osmon ostida
function skylineSvg() {
  const dome = (cx, base, w, h) => `M${cx - w / 2} ${base} C${cx - w / 2} ${base - h * 0.75} ${cx - w * 0.18} ${base - h * 0.9} ${cx} ${base - h}`
    + ` C${cx + w * 0.18} ${base - h * 0.9} ${cx + w / 2} ${base - h * 0.75} ${cx + w / 2} ${base}Z`
    + `M${cx - 0.8} ${base - h} v-${h * 0.22} h1.6 v${h * 0.22}Z`;
  const minaret = (x, h, w = 7) => `M${x} 110 V${110 - h} h${w} V110Z M${x - 1.5} ${110 - h * 0.72} h${w + 3} v3 h-${w + 3}Z`
    + ` M${x - 1} ${110 - h} L${x + w / 2} ${110 - h - w * 2.2} L${x + w + 1} ${110 - h}Z`;
  const far = [dome(48, 96, 40, 26), 'M28 96h40v14H28Z', minaret(82, 62, 6), dome(118, 100, 26, 16), 'M105 100h26v10h-26Z',
    dome(318, 98, 44, 28), 'M296 98h44v12h-44Z', minaret(286, 66, 6), minaret(352, 54, 6), dome(378, 100, 30, 18), 'M363 100h30v10h-30Z',
    'M0 104 h400 v6 H0Z'].join('');
  const near = [dome(200, 80, 74, 48), 'M156 80h88v30h-88Z', dome(161, 90, 30, 20), dome(239, 90, 30, 20), 'M144 90h112v20H144Z',
    minaret(126, 84), minaret(267, 84), 'M92 98h48v12H92Z', dome(116, 98, 24, 14), 'M262 98h48v12h-48Z', dome(286, 98, 24, 14), 'M0 106h400v4H0Z'].join('');
  return `<svg class="skyline" viewBox="0 0 400 110" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <path class="sk-far" d="${far}"/><path class="sk-near" d="${near}"/></svg>`;
}

// Kompas (bosh sahifa va Qibla bo'limi uchun bitta chizma)
function compassSvg(id, q, head) {
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = i * 5, long = a % 30 === 0;
    return `<line x1="120" y1="${long ? 19 : 22}" x2="120" y2="29" class="c-tick${long ? ' l' : ''}" transform="rotate(${a} 120 120)"/>`;
  }).join('');
  const letters = [['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([t, a]) =>
    `<text x="120" y="48" text-anchor="middle" class="c-let${t === 'N' ? ' n' : ''}" transform="rotate(${a} 120 120)">${t}</text>`).join('');
  return `<svg class="compass" viewBox="0 0 240 240" aria-hidden="true">
    <circle cx="120" cy="120" r="117" class="c-outer"/>
    <g id="${id}" class="c-dial" style="transform:rotate(${head == null ? 0 : -head}deg)">
      <circle cx="120" cy="120" r="106" class="c-face"/>
      ${ticks}${letters}
      <g transform="rotate(${q} 120 120)">
        <path d="M120 36 L129 84 L120 79 L111 84Z" class="c-needle"/>
        <path d="M120 204 L126 158 L120 162 L114 158Z" class="c-tail"/>
      </g>
    </g>
    <circle cx="120" cy="120" r="33" class="c-hub"/>
    <g class="c-kaaba">
      <path d="M103 107 L110 100 H143 L136 107Z" fill="#2a2a2a"/>
      <path d="M136 107 L143 100 V129 L136 137Z" fill="#141414"/>
      <rect x="103" y="107" width="33" height="30" fill="#0b0b0b"/>
      <rect x="103" y="113" width="33" height="4" fill="#D9B25A"/>
      <path d="M136 113 L143 106 V110 L136 117Z" fill="#a8853a"/>
      <rect x="123" y="124" width="7" height="13" fill="#C9A24A"/>
    </g>
    <path d="M120 3 l7 11 h-14z" class="c-phone"/>
  </svg>`;
}

function renderHome() {
  const s = state.settings;
  const now = new Date();
  const day = currentPrayerDay(now, s);
  const { windows, times } = dayWindows(day, s);
  const key = dayKey(day);
  const edited = TIME_KEYS.some((k) => Number(s.offsets?.[k]));
  const nx = nextPrayer(now, s);
  const live = PRAYERS.slice(0, 5).find((p) => now >= windows[p].start && now < windows[p].end);
  const sm = summary(state, now);
  const j = journey(state);
  const hour = now.getHours();
  const greet = hour < 11 ? 'Xayrli tong' : hour < 17 ? 'Assalomu alaykum' : 'Xayrli kech';
  skyNow = skyPhase(now, times);
  const sky = skyOn() ? `sky sky-${skyNow}` : '';
  const lat = Number(s.lat), lng = Number(s.lng);
  const q = qiblaBearing(lat, lng);
  const dec = magDeclination(lat, lng);
  const km = Math.round(distanceToKaaba(lat, lng));
  const aligned = hcHead != null && Math.abs(angDiff(q, hcHead)) <= 5;

  const prayers = activePrayers(s).map((p) => {
    const w = windows[p];
    const mark = state.log[key]?.[p];
    const isLive = now >= w.start && now < w.end;
    let label = 'Kutilmoqda', cls = 'wait';
    if (mark === 'prayed') { label = '✓ O‘qildi'; cls = 'ok'; }
    else if (mark === 'qazo') { label = 'Qazo ↺'; cls = 'bad'; }
    else if (mark === 'excused') { label = 'Uzrli'; cls = 'wait'; }
    else if (isLive) { label = 'O‘qidim'; cls = 'go'; }
    else if (now >= w.end) { label = '—'; }
    const sunrise = p === 'fajr' ? ` · quyosh ${hm(times.sunrise)}` : '';
    return `
      <div class="prayer ${isLive ? 'live' : ''}">
        <div class="p-ico">${ICONS[p]}</div>
        <div class="grow">
          <div class="pname">${NAMES[p]}${p === 'vitr' ? ' <span class="sub">(vojib)</span>' : ''}</div>
          <div class="sub ptime">${hm(w.start)} – ${hm(w.end)}${sunrise}</div>
        </div>
        <button class="mark ${cls}" ${mark === 'qazo' ? `data-undo="${p}"` : `data-pray="${p}"`}
          ${mark === 'qazo' ? '' : !isLive || mark === 'excused' ? 'disabled' : ''}>${label}</button>
      </div>`;
  }).join('');

  // "Bugungi namoz": hozirgi (vaqti kirgan) yoki keyingi namoz
  const cur = live || nx?.p;
  const curDay = live ? day : nx ? currentPrayerDay(nx.at, s) : day;
  const cw = cur ? dayWindows(curDay, s).windows[cur] : null;
  const curMark = live ? state.log[key]?.[live] : null;
  const curBtn = !cur ? '' : live
    ? (curMark === 'prayed' ? '<span class="tn-st ok">✓ O‘qildi</span>'
      : curMark === 'excused' ? '<span class="tn-st">Uzrli</span>'
        : `<button class="tn-btn" data-pray="${live}">O‘qidim ✓</button>`)
    : `<span class="tn-st">${untilText(nx.at - now)}<small>qoldi</small></span>`;

  $app.innerHTML = `
    <header class="hero home-hero ${sky}" ${sky ? `title="${SKY_NAME[skyNow]}"` : ''}>
      ${sky ? '<span class="celest" aria-hidden="true"></span>' : ''}
      ${skylineSvg()}
      <div class="hh-top">
        <div class="grow">
          <div class="hh-loc">📍 ${esc(s.city)}</div>
          <div class="hh-date">${fmtDate(day)} · ${greet}${s.name ? `, ${esc(s.name)}` : ''}</div>
        </div>
        <button class="hh-gear" id="toSettings" aria-label="Sozlamalar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>
        </button>
      </div>
      <button class="hh-compass ${aligned ? 'ok' : ''}" id="toQibla" aria-label="Qibla ${Math.round(q)} daraja, Ka’bagacha ${num(km)} km. Qibla bo‘limini ochish">
        ${compassSvg('hqDial', q, hcHead)}
      </button>
      <div class="hh-q"><b>Qibla ${Math.round(q)}°</b><span>${num(km)} km</span></div>
    </header>

    ${cur ? `<div class="card tn">
      <div class="tn-l">🕌 ${live ? 'Bugungi namoz' : 'Keyingi namoz'}</div>
      <div class="row">
        <div class="tn-ico">${ICONS[cur]}</div>
        <div class="grow">
          <div class="tn-name">${NAMES[cur]}</div>
          <div class="tn-time">${hm(cw.start)}</div><div class="sub">${hm(cw.end)} gacha</div>
        </div>
        ${curBtn}
      </div>
    </div>` : ''}

    <div class="duo">
      <button class="card hq-card" id="toJourney" aria-label="Qazo: ${num(j.left)} ta qoldi. Qazo yo‘lini ochish">
        <div class="grow" style="text-align:left">
          <div class="tn-l">🕌 Qazo</div>
          <div class="hq-n">${j.left || !j.start ? an('left', j.left) : '🌙'}</div>
          <div class="sub">${j.start ? (j.left ? 'qoldi · yo‘lni ko‘rish ›' : 'Alhamdulillah, tugadi') : 'qazo kiritilmagan'}</div>
        </div>
        <div class="ring sm">${ringSvg(j.done, j.start, 74, 7, 'j-ring')}<div class="rt"><b class="pct">${j.pct}%</b></div></div>
      </button>
    </div>

    <div class="card plan">
      <button class="plan-main" id="toPlan" aria-label="Bugungi reja: ${sm.today} / ${sm.goal}">
        <div class="row"><div class="grow tn-l" style="margin:0">📿 Bugungi reja</div><b class="plan-n">${an('today', sm.today)} / ${sm.goal}</b></div>
        ${bar(sm.today, sm.goal, false, 'today-bar')}
      </button>
      ${sm.remaining ? `<button class="btn primary" id="startFocus">▶ Qazoni boshlash</button>` : ''}
    </div>

    ${installHtml(false)}
    ${widgetHintHtml()}
    ${s.excused ? `<div class="install-card" style="border-color:var(--gold-bright)">
      <div class="ic-title">🌸 Uzrli kunlar rejimi yoqilgan</div>
      <div class="ic-text">Vaqti o‘tgan namozlar qazo hisobiga qo‘shilmaydi, eslatmalar yuborilmaydi.</div>
      <button class="btn gold" id="exOff">Tugadi — o‘chirish</button></div>` : ''}
    ${backupDue() ? `<div class="install-card">
      <div class="ic-title">💾 Zaxira nusxa oling</div>
      <div class="ic-text">${state.lastBackup ? `Oxirgi zaxira: ${fmtDate(new Date(state.lastBackup))}.` : 'Hali zaxira olinmagan.'}
        Telefon almashsa yoki ilova o‘chsa, qazo hisobingiz yo‘qolmasligi uchun faylni Telegram yoki Drive’ga saqlab qo‘ying.</div>
      <div class="row" style="gap:8px"><button class="btn primary" id="bkNow" style="flex:2">Zaxira olish</button>
        <button class="btn" id="bkLater" style="flex:1">Keyinroq</button></div></div>` : ''}

    <div class="section">Namoz vaqtlari</div>
    ${prayers}
    <p class="hint">${sourceText(times, s)}${edited ? ' · qo‘lda tuzatilgan' : ''}.
      Vaqti tugaguncha “O‘qidim” bosilmasa, namoz avtomatik qazo hisobiga qo‘shiladi.
      O‘qib, belgilashni unutgan bo‘lsangiz — “Qazo ↺” ni bosing.</p>

    ${(() => { const dq = todayQuote(); return `<button class="quote-card" id="toQuote">
      <div class="qc-l">${dq.ayah ? '📖 Kun oyati' : '🌿 Kun hadisi'}</div>
      <div class="qc-t">«${esc(dq.text)}»</div>
      <div class="qc-r">${esc(dq.ref)} · <span>to‘liq o‘qish ›</span></div></button>`; })()}
    `;

  bindInstall();
  $app.querySelector('#wgAdd')?.addEventListener('click', addWidget);
  $app.querySelector('#wgX')?.addEventListener('click', () => { try { localStorage.setItem(WIDGET_HINT, '1'); } catch {} render(); });
  $app.querySelector('#toQibla').onclick = () => go('qibla');
  $app.querySelector('#toSettings').onclick = () => go('settings');
  $app.querySelector('#toQuote').onclick = () => openQuote(todayQuote().id);
  $app.querySelector('#toJourney').onclick = () => go('journey');
  $app.querySelector('#toPlan').onclick = () => go('qazo');
  $app.querySelector('#startFocus')?.addEventListener('click', openFocus);
  startHomeCompass(q, dec);
  $app.querySelectorAll('[data-pray]').forEach((b) => {
    b.onclick = () => save(togglePrayed(state, day, b.dataset.pray, new Date()));
  });
  $app.querySelectorAll('[data-undo]').forEach((b) => { b.onclick = () => askUndo(key, b.dataset.undo); });
  const bk = $app.querySelector('#bkNow');
  if (bk) {
    bk.onclick = exportBackup;
    $app.querySelector('#bkLater').onclick = () => save({ ...state, backupSnooze: Date.now() + 7 * 86400000 });
  }
  const ex = $app.querySelector('#exOff');
  if (ex) ex.onclick = () => setExcused(false);
}

// Sahifa sarlavhasi (orqaga tugmasi bilan)
const topbar = (title, sub, back) => `<div class="topbar">
  ${back ? `<button class="icon back" id="tbBack" aria-label="Orqaga">‹</button>` : ''}
  <div class="grow"><div class="page-title">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>`;
const bindBack = (to) => { const b = $app.querySelector('#tbBack'); if (b) b.onclick = () => go(to); };

// Bosh sahifadagi jonli Qibla kompasi
let hcStop = null, hcHead = null, hcState = 'wait';
function stopHomeCompass() { hcStop?.(); hcStop = null; }
function startHomeCompass(q, dec) {
  if (hcStop || hcState === 'none') return;
  const iosAsk = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  if (!isNative() && (iosAsk || !('ondeviceorientation' in window))) { hcState = 'none'; return; } // iOS: ruxsat faqat bosilganda so'raladi
  hcStop = startCompass((h) => {
    hcHead = angNorm(h + dec); hcState = 'ok';
    const dial = document.getElementById('hqDial');
    if (!dial) return;
    dial.style.transform = `rotate(${-hcHead}deg)`;
    document.getElementById('toQibla')?.classList.toggle('ok', Math.abs(angDiff(q, hcHead)) <= 5);
  }, () => { hcState = 'none'; const st = hcStop; hcStop = null; st?.(); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopHomeCompass(); });

/* ---------------- Focus rejimi: faqat qazo o'qish ---------------- */
let focusP = null, wakeLock = null;
function pickFocus(after) {
  const order = activePrayers(state.settings);
  const q = order.filter((p) => (state.qazo[p] || 0) > 0);
  if (!q.length) return null;
  if (after) {
    const i = order.indexOf(after);
    for (let k = 1; k <= order.length; k++) { const p = order[(i + k) % order.length]; if (q.includes(p)) return p; }
  }
  const td = state.done?.[dayKey(new Date())] || {};
  return q.reduce((b, p) => ((td[p] || 0) < (td[b] || 0) ? p : b), q[0]);
}
function openFocus() {
  focusP = pickFocus();
  go('focus');
  try { navigator.wakeLock?.request('screen').then((l) => { wakeLock = l; }).catch(() => {}); } catch {}
}
function renderFocus() {
  const now = new Date();
  const sm = summary(state, now);
  const td = state.done?.[dayKey(now)] || {};
  if (!focusP || !((state.qazo[focusP] || 0) > 0)) focusP = pickFocus(focusP);
  const list = activePrayers(state.settings).filter((p) => (state.qazo[p] || 0) > 0 || td[p]);
  const met = sm.goal && sm.today >= sm.goal;
  const pct = sm.goal ? Math.min(100, Math.round((sm.today / sm.goal) * 100)) : 0;
  $app.innerHTML = `<div class="focus">
    <button class="fx" id="fxExit" aria-label="Focus rejimidan chiqish">✕</button>
    <div class="f-ico">🌿</div>
    <div class="f-title">Focus rejimi</div>
    <div class="sub">Endi faqat maqsadingiz muhim</div>
    <div class="ring big f-ring">${ringSvg(sm.today, sm.goal, 184, 12, 'today-ring')}
      <div class="rt"><div><b>${an('today', sm.today)} / ${sm.goal}</b><span>bajarildi · ${pct}%</span></div></div></div>
    ${met ? '<div class="finish">🎉 Bugungi reja bajarildi. Alloh qabul qilsin! Xohlasangiz davom eting.</div>' : ''}
    <div class="f-l">Bugungi qazo</div>
    <div class="f-list">${list.map((p) => `<div class="f-row ${p === focusP ? 'cur' : ''}">
      <span>${ICONS[p]} ${NAMES[p]}</span><b class="${td[p] ? 'on' : ''}">${td[p] ? `✓${td[p] > 1 ? ` ${td[p]}` : ''}` : '○'}</b></div>`).join('')}</div>
    ${focusP ? `<div class="f-cur"><div class="f-n">Navbatdagi</div>
        <div class="f-cn">${ICONS[focusP]} ${NAMES[focusP]} qazosi</div>
        <div class="sub">qoldi: ${an(`q-${focusP}`, state.qazo[focusP])}</div></div>
      <button class="btn primary f-do" id="fxDone">✓ Ado qildim</button>
      <button class="btn f-next" id="fxNext">Keyingisi →</button>`
      : '<div class="finish">Qazo qolmagan — Alhamdulillah 🌙</div>'}
    <p class="hint" style="text-align:center;margin-top:16px">Boshqa tugmalar yashirildi, ekran o‘chmaydi.<br>Namozni o‘qib bo‘lgach “Ado qildim”ni bosing.</p>
  </div>`;
  $app.querySelector('#fxExit').onclick = () => go('home');
  const d = $app.querySelector('#fxDone');
  if (d) d.onclick = () => { const p = focusP; focusP = pickFocus(p); doneAction(p, 1); try { navigator.vibrate?.(25); } catch {} };
  const n = $app.querySelector('#fxNext');
  if (n) n.onclick = () => { focusP = pickFocus(focusP); render(); };
}

// Xato qazoga tushgan namozni tuzatish
function askUndo(key, p) {
  if (!confirm(`${NAMES[p]} namozini o‘z vaqtida o‘qigan edingizmi?\nQazo hisobidan 1 ta ayiriladi.`)) return;
  const next = undoQazo(state, key, p, new Date());
  if (next === state) return toast(`Faqat oxirgi ${UNDO_DAYS} kun ichidagi namozni tuzatish mumkin.`);
  save(next);
  toast(`✓ ${NAMES[p]}: o‘qilgan deb belgilandi`);
}

// Uzrli kunlar (hayz/nifos) — yoqish/o'chirishdan oldin shu paytgacha bo'lgan namozlar hisoblab olinadi
function setExcused(on) {
  const settled = processMissed(state, new Date()).state;
  save({ ...settled, settings: { ...settled.settings, excused: on } });
  toast(on ? '🌸 Uzrli kunlar: vaqti o‘tgan namozlar qazoga qo‘shilmaydi' : 'Uzrli kunlar rejimi o‘chirildi');
}

/* ---------------- Qazo bo'limi ---------------- */
// n > 0 — n ta qazo ado qilindi; n < 0 — bugungi xatoni bekor qilish; mode 'add' — qazo hisobiga qo'shish (tuzatish)
function doneAction(p, n, mode) {
  const now = new Date();
  const beforeAch = new Set(achievements(state, now).filter((a) => a.unlocked).map((a) => a.id));
  const goal = Number(state.settings.dailyGoal) || 0;
  const todayBefore = dayDone(state, dayKey(now));
  const leftBefore = totalQazo(state);
  let next;
  if (mode === 'add') {
    next = { ...state, qazo: { ...state.qazo, [p]: (state.qazo[p] || 0) + n } };
    save(next);
    return toast(`${NAMES[p]}: qazo hisobiga +${n} qo‘shildi`);
  }
  next = recordDone(state, p, n, now);
  if (next !== state && leftBefore > 0 && totalQazo(next) === 0) next = { ...next, clearedAt: Date.now() };
  if (next === state) return toast(n > 0 ? `${NAMES[p]} bo‘yicha qazo qolmagan.` : `Bugun ${NAMES[p]} bo‘yicha bekor qiladigan narsa yo‘q.`);
  save(next);
  if (n < 0) return toast(`Bekor qilindi: ${NAMES[p]} ${-n} ta`);
  const added = dayDone(next, dayKey(now)) - todayBefore;
  if (leftBefore > 0 && totalQazo(next) === 0) return showCelebration();
  const fresh = achievements(next, now).filter((a) => a.unlocked && !beforeAch.has(a.id));
  if (fresh.length) toast(`${fresh[0].icon} Yangi yutuq: ${fresh[0].title}!`, 5000);
  else if (goal && todayBefore < goal && todayBefore + added >= goal) toast('🎉 Bugungi maqsad bajarildi! Alloh qabul qilsin.', 5000);
  else if (added > 1) toast(`✓ ${NAMES[p]}: ${added} ta ado qilindi`);
}

// Namoz bo'yicha tezkor kiritish oynasi
function openQazoSheet(p) {
  document.querySelector('.sheet-bg')?.remove();
  const left = state.qazo[p] || 0;
  const today = state.done?.[dayKey(new Date())]?.[p] || 0;
  const btn = (n, attr) => `<button class="chipbtn" ${attr}="${n}" ${attr === 'data-do' && n > left ? 'disabled' : ''}>${n}</button>`;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="sheet-bg"><div class="sheet">
      <div class="row"><div class="p-ico">${ICONS[p]}</div><div class="grow"><div class="ic-title" style="padding:0">${NAMES[p]}</div>
        <div class="sub">Qoldi: <b>${num(left)}</b>${today ? ` · bugun ${today} ta ado qilingan` : ''}</div></div></div>
      <div class="sheet-l">✓ Necha ta ado qildingiz?</div>
      <div class="chips">${[1, 2, 3, 5, 10].map((n) => btn(n, 'data-do')).join('')}</div>
      <div class="row" style="margin-top:8px"><input type="number" id="shN" min="1" placeholder="Boshqa son" style="flex:1" />
        <button class="primary" id="shDo" style="padding:12px 16px">Ado qildim</button></div>
      ${today ? `<div class="sheet-l">↩️ Xato bosdimmi? (faqat bugungisi)</div>
        <div class="chips">${[1, 2, 5].filter((n) => n <= today).map((n) => `<button class="chipbtn" data-undo="${n}">−${n}</button>`).join('')}</div>` : ''}
      <div class="sheet-l">＋ Qazo hisobiga qo‘shish (tuzatish)</div>
      <div class="chips">${[1, 5, 10].map((n) => `<button class="chipbtn" data-add="${n}">+${n}</button>`).join('')}</div>
      <button class="btn" id="shClose" style="margin-top:16px">Yopish</button>
    </div></div>`);
  const bg = document.querySelector('.sheet-bg');
  const close = () => bg.remove();
  bg.onclick = (e) => { if (e.target === bg) close(); };
  bg.querySelector('#shClose').onclick = close;
  bg.querySelectorAll('[data-do]').forEach((b) => { b.onclick = () => { close(); doneAction(p, Number(b.dataset.do)); }; });
  bg.querySelectorAll('[data-undo]').forEach((b) => { b.onclick = () => { close(); doneAction(p, -Number(b.dataset.undo)); }; });
  bg.querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => {
    if (!confirm(`${NAMES[p]} qazo hisobiga ${b.dataset.add} ta qo‘shilsinmi?`)) return;
    close(); doneAction(p, Number(b.dataset.add), 'add'); }; });
  bg.querySelector('#shDo').onclick = () => {
    const n = Math.floor(Number(bg.querySelector('#shN').value));
    if (!(n > 0)) return toast('Sonni kiriting');
    close(); doneAction(p, n);
  };
}

// Barcha qazolar tugaganda
function showCelebration() {
  const sm = summary(state, new Date());
  const st = streak(state, new Date());
  document.querySelector('.sheet-bg')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="sheet-bg celebrate"><div class="sheet" style="text-align:center">
      <div style="font-size:64px">🌙</div>
      <div class="ic-title" style="font-size:26px;padding:0">Alhamdulillah!</div>
      <p style="line-height:1.6">Siz belgilagan barcha qazo namozlar ado qilindi. Alloh qabul qilsin!</p>
      <div class="q-nums"><div><b>${num(sm.total)}</b><span>ado qilingan</span></div>
        <div><b>${st.best}</b><span>eng uzun streak</span></div><div><b>0</b><span>qoldi</span></div></div>
      <p class="hint" style="text-align:center">Endi ham namozlarni o‘z vaqtida o‘qishda davom eting — ilova vaqti o‘tgan namozlarni kuzatib boradi.</p>
      <button class="btn primary" id="ceStats">📊 Statistikani ko‘rish</button>
      <button class="btn" id="ceClose">Yopish</button>
    </div></div>`);
  const bg = document.querySelector('.sheet-bg');
  bg.querySelector('#ceClose').onclick = () => bg.remove();
  bg.querySelector('#ceStats').onclick = () => { bg.remove(); go('stats'); };
  try { navigator.vibrate?.([80, 60, 80]); } catch {}
}

// "Qachon tugaydi?" kalkulyatori
function calcHtml(sm) {
  const goal = sm.goal || 5;
  const opts = [...new Set([goal, 5, 10, 20].filter((n) => n > 0))].sort((a, b) => a - b);
  const pace = recentPace(state, new Date(), 14);
  const plans = finishPlans(sm.remaining, opts);
  const yrs = (d) => (d >= 365 ? `${(d / 365).toFixed(1)} yil` : `${num(d)} kun`);
  return `<div class="card">
    <div class="card-head"><h2>⏳ Qachon tugaydi?</h2><span class="sub">${num(sm.remaining)} ta qoldi</span></div>
    ${plans.map((x) => `<div class="calc ${x.perDay === sm.goal ? 'on' : ''}"><span>Kuniga <b>${x.perDay}</b> ta</span>
      <span>${yrs(x.days)}</span><b>${fmtDate(x.date)}</b></div>`).join('')}
    ${pace >= 0.5 ? (() => { const f = finishPlans(sm.remaining, [pace])[0];
      return `<div class="finish" style="text-align:left">📈 Oxirgi 14 kundagi tempingiz: kuniga <b>${pace.toFixed(1)}</b> ta → taxminan <b>${fmtDate(f.date)}</b></div>`; })() : ''}
    <p class="hint">Kuniga ${activePrayers(state.settings).length} ta (bir kunlik namozlar${state.settings.includeVitr ? ', vitr bilan' : ''}) o‘qisangiz — har kuni bir kunlik qazo yopiladi.</p>
  </div>`;
}

// Qaysi namoz ortda qolmoqda?
function progressHtml() {
  const list = perPrayer(state, activePrayers(state.settings));
  if (!list.some((x) => x.done + x.left > 0)) return '';
  const minPct = Math.min(...list.filter((x) => x.left > 0).map((x) => x.pct));
  const lag = list.find((x) => x.left > 0 && x.pct === minPct);
  return `<div class="card">
    <h2>📊 Qaysi namoz ortda qolmoqda?</h2>
    ${list.map((x) => `<div class="pp"><span class="pp-n">${ICONS[x.p]} ${NAMES[x.p]}</span>
      <div class="bar thin" style="flex:1;margin:0"><i style="width:${x.pct}%"></i></div><b>${x.pct}%</b></div>`).join('')}
    ${lag && list.some((x) => x.pct !== minPct) ? `<p class="hint">💡 <b>${NAMES[lag.p]}</b> qazosi boshqalardan ortda — unga ko‘proq e’tibor bering.</p>` : ''}
  </div>`;
}

function renderQazo() {
  const s = state.settings;
  const now = new Date();
  const sm = summary(state, now);
  const td = state.done?.[dayKey(now)] || {};
  const pct = sm.goal ? Math.min(100, Math.round((sm.today / sm.goal) * 100)) : 0;

  const rows = activePrayers(s).map((p) => `
    <div class="prow">
      <div class="p-ico">${ICONS[p]}</div>
      <div class="grow">
        <div class="pname">${NAMES[p]}</div>
        <div class="sub"><span class="qn-s">${an(`q-${p}`, state.qazo[p])}</span> qoldi${td[p] ? ` · <span class="today">bugun ${td[p]} ✓</span>` : ''}</div>
      </div>
      <button class="chk ${td[p] ? 'on' : ''}" data-ado="${p}" ${(state.qazo[p] || 0) <= 0 ? 'disabled' : ''}
        aria-label="${NAMES[p]}: 1 ta qazo ado qildim">✓</button>
      <button class="plus" data-more="${p}" aria-label="${NAMES[p]}: bir nechta, bekor qilish, tuzatish">⋯</button>
    </div>`).join('');

  $app.innerHTML = `
    ${topbar('Bugungi reja', fmtDate(now), true)}
    <div class="card plan-card">
      <div class="ring big">${ringSvg(sm.today, sm.goal, 196, 13, 'today-ring')}
        <div class="rt"><div><b>${an('today', sm.today)} / ${sm.goal}</b><span>bajarildi</span><em>${pct}%</em></div></div></div>
      <div class="goal-step"><span class="sub">Kunlik reja</span>
        <div class="stepper"><button id="gMinus" aria-label="Kamaytirish">−</button><b>${sm.goal}</b><button id="gPlus" aria-label="Ko‘paytirish">＋</button></div></div>
      ${sm.goal && sm.today >= sm.goal ? '<div class="finish">🎉 Bugungi reja bajarildi. Alloh qabul qilsin!</div>' : ''}
    </div>

    ${rows}
    <button class="btn primary big" id="addQazo">＋ Qazo qo‘shish</button>
    <button class="btn" id="toEst">🧮 Qazo kalkulyatori — eski qazolarni hisoblash</button>
    ${sm.remaining ? '<button class="btn" id="toFocus">🌿 Focus rejimida o‘qish</button>' : ''}

    ${sm.remaining === 0 && sm.total > 0 ? `<div class="card" style="text-align:center"><div style="font-size:40px">🌙</div>
      <h2 style="margin:6px 0">Alhamdulillah! Qazolar tugadi</h2><p class="sub">Endi namozlarni o‘z vaqtida o‘qishda davom eting.</p></div>` : ''}
    ${sm.remaining > 0 ? calcHtml(sm) : ''}

    ${s.gender === 'ayol' || s.excused ? `<div class="card">
      <div class="switch" style="margin-top:0"><span><b>🌸 Uzrli kunlar (hayz/nifos)</b><br>
        <span class="sub">Yoqilganda vaqti o‘tgan namozlar qazoga qo‘shilmaydi</span></span>
        <input type="checkbox" id="exToggle" ${s.excused ? 'checked' : ''} /></div></div>` : ''}
    ${progressHtml()}
    <button class="learn-card" id="toLearnQ" style="margin-top:16px">
      <span class="lc-i">💭</span>
      <span class="grow"><b>Qazo qanday o‘qiladi va niyat qilinadi?</b><br><span class="sub">Qo‘llanmani ochish</span></span>
      <span class="lc-a">›</span>
    </button>
    <p class="hint"><b>✓</b> — bitta qazo o‘qildi: hisobdan ayriladi va bugungi natijangizga yoziladi.<br>
      <b>⋯</b> — bir nechtasini birdan kiritish (2, 5, 10…), bugungi xatoni bekor qilish yoki qazo hisobini tuzatish.<br>
      <b>＋ Qazo qo‘shish</b> — eski qazolaringizni hisobga kiritish.</p>`;

  bindBack('home');
  const setGoal = (v) => save({ ...state, settings: { ...s, dailyGoal: Math.max(0, Math.min(100, v)) } });
  $app.querySelector('#gMinus').onclick = () => setGoal((Number(s.dailyGoal) || 0) - 1);
  $app.querySelector('#gPlus').onclick = () => setGoal((Number(s.dailyGoal) || 0) + 1);
  $app.querySelectorAll('[data-ado]').forEach((b) => { b.onclick = () => doneAction(b.dataset.ado, 1); });
  $app.querySelector('#toLearnQ').onclick = () => { learnOpen = 'qazo'; go('learn'); };
  $app.querySelector('#addQazo').onclick = openAddSheet;
  $app.querySelector('#toEst').onclick = () => go('estimate');
  $app.querySelector('#toFocus')?.addEventListener('click', openFocus);
  const ext = $app.querySelector('#exToggle');
  if (ext) ext.onchange = (e) => setExcused(e.target.checked);
  $app.querySelectorAll('[data-more]').forEach((b) => { b.onclick = () => openQazoSheet(b.dataset.more); });
}

// "＋ Qazo qo'shish": qaysi namoz va nechta
function openAddSheet() {
  document.querySelector('.sheet-bg')?.remove();
  let p = activePrayers(state.settings)[0];
  document.body.insertAdjacentHTML('beforeend', `
    <div class="sheet-bg"><div class="sheet">
      <div class="ic-title">＋ Qazo qo‘shish</div>
      <p class="sub" style="margin:6px 0 0">Eski (o‘qilmagan) namozlaringizni hisobga kiriting.</p>
      <div class="sheet-l">Qaysi namoz?</div>
      <div class="chips">${activePrayers(state.settings).map((x) => `<button class="chip ${x === p ? 'on' : ''}" data-ap="${x}">${ICONS[x]} ${NAMES[x]}</button>`).join('')}</div>
      <div class="sheet-l">Nechta?</div>
      <div class="chips">${[1, 5, 10, 30, 100].map((n) => `<button class="chipbtn" data-an="${n}">+${n}</button>`).join('')}</div>
      <div class="row" style="margin-top:8px"><input type="number" id="anN" min="1" placeholder="Boshqa son" style="flex:1" />
        <button class="primary" id="anDo" style="padding:12px 16px">Qo‘shish</button></div>
      <button class="btn" id="anClose" style="margin-top:16px">Yopish</button>
    </div></div>`);
  const bg = document.querySelector('.sheet-bg');
  const close = () => bg.remove();
  bg.onclick = (e) => { if (e.target === bg) close(); };
  bg.querySelector('#anClose').onclick = close;
  bg.querySelectorAll('[data-ap]').forEach((b) => { b.onclick = () => {
    p = b.dataset.ap; bg.querySelectorAll('[data-ap]').forEach((o) => o.classList.toggle('on', o === b)); }; });
  const add = (n) => { if (!(n > 0)) return toast('Sonni kiriting'); close(); doneAction(p, n, 'add'); };
  bg.querySelectorAll('[data-an]').forEach((b) => { b.onclick = () => add(Number(b.dataset.an)); });
  bg.querySelector('#anDo').onclick = () => add(Math.floor(Number(bg.querySelector('#anN').value)));
}

/* ---------------- Qazo yo'li ---------------- */
function renderJourney() {
  const now = new Date();
  const j = journey(state);
  const sm = summary(state, now);
  const finish = estimatedFinish(state, now);
  const pace = recentPace(state, now, 14);
  $app.innerHTML = `
    ${topbar('Qazo yo‘li', 'Har bir qazo — Allohga yaqinlashish uchun yana bir imkon', true)}
    <div class="jr">
      <div class="jr-sky" aria-hidden="true">
        <svg viewBox="0 0 400 300" preserveAspectRatio="none">
          <path d="M0 210 L60 150 L110 190 L170 120 L230 185 L290 135 L350 175 L400 140 V300 H0Z" class="mt1"/>
          <path d="M0 250 L70 205 L130 240 L200 195 L270 245 L330 210 L400 235 V300 H0Z" class="mt2"/>
        </svg>
      </div>
      <div class="jr-top">
        <div class="ring big">${ringSvg(j.done, j.start, 164, 10, 'j-ring')}
          <div class="rt"><div><span class="jr-ic">🕌</span><b>${an('left', j.left)}</b><span>qoldi</span></div></div></div>
      </div>
      ${j.start ? `<div class="jmap-wrap">${journeySvg(j.start, j.done, num)}</div>`
        : '<p class="sub" style="text-align:center;position:relative">Qazo hisobingiz bo‘sh — “Bugungi reja” bo‘limida “＋ Qazo qo‘shish” orqali kiriting.</p>'}
    </div>
    <div class="q-nums">
      <div><b>${num(j.start)}</b><span>boshlanishda</span></div>
      <div><b style="color:var(--accent)">${an('done', j.done)}</b><span>ado qilindi</span></div>
      <div><b>${j.pct}%</b><span>yo‘l bosildi</span></div>
    </div>
    ${finish && j.left ? `<div class="finish">Kuniga ${sm.goal} tadan — taxminiy yakun: ${fmtDate(finish)}</div>` : ''}
    ${pace >= 0.5 && j.left ? `<p class="hint">📈 Oxirgi 14 kundagi sur’atingiz: kuniga ${pace.toFixed(1)} ta.</p>` : ''}
    <p class="hint">Yo‘ldagi bosqichlar: 100 → 500 → 1 000 → 2 500 → 5 000… Har biriga yetganda oltin belgi yonadi.
      “Boshlanish” — ilovaga kiritilgan va keyin qo‘shilgan barcha qazolar.</p>
    ${j.left ? '<button class="btn primary big" id="jrGo">▶ Qazoni boshlash</button>' : ''}`;
  bindBack('home');
  $app.querySelector('#jrGo')?.addEventListener('click', openFocus);
}

/* ---------------- Qibla ---------------- */
let compassStop = null, heading = null, compassState = 'wait', aligned = false;
function stopQibla() { compassStop?.(); compassStop = null; heading = null; compassState = 'wait'; aligned = false; }
function renderQibla() {
  const s = state.settings;
  const lat = Number(s.lat), lng = Number(s.lng);
  const q = qiblaBearing(lat, lng);
  const dec = magDeclination(lat, lng);
  const km = Math.round(distanceToKaaba(lat, lng));
  const now = new Date();
  const sun = sunPosition(now, lat, lng);
  const times = qiblaSunTimes(lat, lng, now);
  const sunRel = angDiff(q, sun.azimuth);
  const dir = (d) => (d > 0 ? `${Math.abs(d).toFixed(0)}° o‘ngda` : `${Math.abs(d).toFixed(0)}° chapda`);

  $app.innerHTML = `
    ${topbar('Qibla', `📍 ${esc(s.city)}`, false)}
    <div class="qb-stage">
      <div class="qb-glow" aria-hidden="true"></div>
      <div class="qb-compass">${compassSvg('dial', q, heading == null ? null : angNorm(heading + dec))}</div>
      <div class="qb-deg">${q.toFixed(0)}°</div>
      <div class="sub" style="text-align:center">Ka’baga yo‘nalish (shimoldan)</div>
      <div id="qStatus" class="q-status">${compassState === 'nosensor' ? 'Bu qurilmada kompas topilmadi' : compassState === 'denied' ? 'Kompasga ruxsat berilmadi' : 'Kompas ishga tushmoqda…'}</div>
      <div id="qAcc" class="q-acc"></div>
    </div>
    <div class="duo2">
      <div class="card mini-card"><span class="sub">Masofa</span><b>${num(km)} km</b></div>
      <div class="card mini-card"><span class="sub">Magnit og‘ishi</span><b>${dec >= 0 ? '+' : ''}${dec.toFixed(1)}°</b></div>
      <div class="card mini-card"><span class="sub">Telefon</span><b id="qHead">—</b></div>
    </div>
    <p class="hint">Telefonni <b>tekis, gorizontal</b> ushlang. Raqamlar sakrasa — telefonni havoda <b>“8” shaklida</b> bir necha marta aylantiring
      va temir, magnit, kompyuter, mashinadan uzoqlashing. Magnit og‘ish avtomatik hisobga olinadi.</p>

    <details class="card sun-card" open>
      <summary><span class="sun-i">☀️</span><span class="grow"><b>Quyosh orqali tekshirish</b><br>
        <span class="sub">Kompasga bog‘liq emas — eng ishonchli usul</span></span><span class="ls-a">⌄</span></summary>
      ${times.length ? times.map((t) => `<div class="sun-row">
        <b>${hm(t.at)}</b><span>${t.kind === 'face' ? 'quyosh aynan qibla tomonda bo‘ladi — <b>quyoshga yuzlansangiz, qiblaga qaragan bo‘lasiz</b>'
          : 'quyosh qiblaning teskarisida bo‘ladi — <b>soyangiz qiblani ko‘rsatadi</b>'}</span></div>`).join('')
        : '<p class="sub">Bugun quyosh qibla chizig‘idan o‘tmaydi — quyidagi joriy holatdan foydalaning.</p>'}
      ${sun.altitude > 3 ? `<div class="finish" style="text-align:left">Hozir: qibla quyoshdan <b>${dir(sunRel)}</b>
        (quyosh ${sun.azimuth.toFixed(0)}° da, balandligi ${sun.altitude.toFixed(0)}°).</div>`
        : '<p class="hint">Hozir quyosh ufqdan past — kunduzi tekshiring.</p>'}
    </details>
    <p class="hint">Qibla yo‘nalishi Ka’ba koordinatalari (21.4225° N, 39.8262° E) bo‘yicha katta doira formulasi bilan hisoblanadi.
      Magnit og‘ish — Jahon magnit modeli WMM2025 (NOAA), quyosh holati — NOAA astronomik algoritmi.</p>`;

  if (!compassStop && compassState === 'wait') {
    compassStop = startCompass((h, acc, flat) => {
      heading = h; compassState = 'ok';
      const qa = document.getElementById('qAcc');
      if (qa) qa.innerHTML = acc >= 0 && acc < 2
        ? '⚠️ Kompas kalibrlanmagan — telefonni havoda <b>“8” shaklida</b> 3–4 marta aylantiring'
        : !flat ? 'ℹ️ Telefon tik ushlangan — yo‘nalish orqa kamera tomonga qarab ko‘rsatiladi' : '';
      const t = angNorm(h + dec);
      const d = angDiff(q, t);
      const dial = document.getElementById('dial');
      if (!dial) return;
      dial.style.transform = `rotate(${-t}deg)`;
      document.getElementById('qHead').textContent = `${t.toFixed(0)}°`;
      const st = document.getElementById('qStatus');
      const ok = Math.abs(d) <= 3;
      st.className = `q-status ${ok ? 'ok' : ''}`;
      st.innerHTML = ok ? '✅ Qibla tomonga qaradingiz' : `${d > 0 ? '↻ O‘ngga' : '↺ Chapga'} buriling: <b>${Math.abs(d).toFixed(0)}°</b>`;
      document.querySelector('.qb-stage')?.classList.toggle('ok', ok);
      if (ok && !aligned) { aligned = true; try { navigator.vibrate?.(60); } catch {} }
      if (Math.abs(d) > 6) aligned = false;
    }, (why) => { compassState = why; if (screen === 'qibla') render(); });
  }
}

/* ---------------- Oyat / hadis sahifasi ---------------- */
let quoteId = null, quoteFrom = 'home';
const arabicCache = {};
function todayQuote() {
  const d = new Date();
  const dayNo = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() / 86400000);
  return pick([...Q_START, ...Q_QAZO], dayNo);
}
function openQuote(id) {
  if (!id || !quoteById(id) || !state.settings) return;
  quoteId = id;
  if (screen !== 'quote') quoteFrom = screen === 'support' || screen === 'learn' ? 'home' : screen;
  screen = 'quote'; form = null;
  render();
}
function renderQuote() {
  const q = quoteById(quoteId);
  if (!q) { screen = 'home'; return renderHome(); }
  const ar = q.ayah ? arabicCache[q.id] : null;
  $app.innerHTML = `
    <div class="row" style="margin:6px 0 10px"><button class="icon" id="qback" aria-label="Orqaga">←</button>
      <div class="page-title" style="margin:0">${q.ayah ? 'Qur’oni karim' : 'Hadisi sharif'}</div></div>
    <div class="card quote-full" style="margin-top:0">
      ${q.ayah ? `<div class="arabic" dir="rtl" lang="ar">${ar === undefined ? '<span class="sub">Arabcha matn yuklanmoqda…</span>'
        : ar === 'err' ? '<span class="sub" dir="ltr">Arabcha matnni ko‘rish uchun bir marta internetga ulaning.</span>'
        : ar.map((v) => `${esc(v.t)} <span class="ayn">﴿${v.n}﴾</span>`).join(' ')}</div>` : ''}
      <div class="qf-label">Ma’nosi</div>
      <div class="qf-text">«${esc(q.text)}»</div>
      <div class="qf-ref">${esc(q.ref)}</div>
    </div>
    ${q.ayah ? `<a class="btn primary" href="${quranUrl(q.ayah)}" target="_blank" rel="noopener">📖 Oyatni to‘liq tarjimasi bilan o‘qish (Quran.com)</a>` : ''}
    ${q.hadith ? q.hadith.map((h) => `<a class="btn" href="${h.url}" target="_blank" rel="noopener">📚 ${esc(h.name)} — to‘liq matn (sunnah.com)</a>`).join('') : ''}
    <p class="hint">Yuqoridagi matn — ${q.ayah ? 'oyat' : 'hadis'} ma’nosining qisqa bayoni, so‘zma-so‘z tarjima emas.
      ${q.ayah ? 'Arabcha asl matn Quran.com ochiq bazasidan olingan.' : ''} To‘liq tarjima va sharh uchun yuqoridagi manbaga qarang.</p>
    <button class="btn" id="qShare">📤 Ulashish</button>`;
  $app.querySelector('#qback').onclick = () => go(quoteFrom);
  $app.querySelector('#qShare').onclick = async () => {
    const text = `«${q.text}» (${q.ref})\n\n${SHARE_URL}`;
    const NS = window.Capacitor?.Plugins?.Share;
    try {
      if (isNative() && NS) await NS.share({ text, dialogTitle: 'Ulashish' });
      else if (navigator.share) await navigator.share({ text });
      else window.open(`https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(`«${q.text}» (${q.ref})`)}`, '_blank');
    } catch {}
  };
  if (q.ayah && arabicCache[q.id] === undefined) {
    fetchArabic(q.ayah).then((v) => { arabicCache[q.id] = v; }).catch(() => { arabicCache[q.id] = 'err'; })
      .finally(() => { if (screen === 'quote' && quoteId === q.id) render(); });
  }
}

/* ---------------- Bilim (qo'llanma) ---------------- */
let learnOpen = null;
function renderLearn() {
  $app.innerHTML = `
    <div class="page-title">Qo‘llanma</div>
    <p class="sub" style="line-height:1.55">Namoz o‘qish tartibi va qazo namozlari — O‘zbekiston musulmonlari idorasi va islom.uz materiallari asosida.</p>
    ${LEARN_SECTIONS.map((x) => `
      <details class="lsec" ${learnOpen === x.id ? 'open' : ''} data-sec="${x.id}">
        <summary><span class="ls-i">${x.icon}</span><span class="grow">${x.title}</span><span class="ls-a">⌄</span></summary>
        <div class="lbody">${x.html}</div>
      </details>`).join('')}
    <div class="note" style="padding-right:14px;margin-top:20px">ℹ️ ${LEARN_DISCLAIMER}</div>`;
  $app.querySelectorAll('details.lsec').forEach((d) => {
    d.addEventListener('toggle', () => { if (d.open) { learnOpen = d.dataset.sec; $app.querySelectorAll('details.lsec').forEach((o) => { if (o !== d) o.open = false; }); } });
  });
  if (learnOpen) setTimeout(() => $app.querySelector(`[data-sec="${learnOpen}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
}

/* ---------------- Statistika ---------------- */
let statPeriod = '7';
const PERIODS = [['7', 'Hafta'], ['30', '30 kun'], ['180', '6 oy'], ['365', '1 yil'], ['all', 'Umumiy']];
function renderStats() {
  const now = new Date();
  const sm = summary(state, now);
  const st = streak(state, now);
  const ps = periodStats(state, statPeriod, now);
  const bars = ps.bars;
  const dayBuckets = statPeriod === '7' || statPeriod === '30';
  const max = Math.max(dayBuckets ? sm.goal : 0, ...bars.map((b) => b.n), 1);
  const ach = achievements(state, now);
  const unlocked = ach.filter((a) => a.unlocked);
  const finish = estimatedFinish(state, now);
  const H = '104px';
  const gs = goalStreak(state, now);
  const kv = (ic, k, v, cls = '') => `<div class="kv"><span class="kv-i">${ic}</span><span class="grow">${k}</span><b class="${cls}">${v}</b></div>`;

  $app.innerHTML = `
    ${topbar('Statistika', '', false)}
    <div class="seg seg5">${PERIODS.map(([k, l]) => `<button data-period="${k}" class="${statPeriod === k ? 'on' : ''}">${l}</button>`).join('')}</div>

    <div class="card">
      <div class="card-head"><h2>${statPeriod === '7' ? 'Kunlik qazo (hafta)' : PERIODS.find((x) => x[0] === statPeriod)[1]}</h2><span class="sub">${num(ps.total)} ta</span></div>
      <div class="chart ${bars.length > 14 ? 'dense' : ''}">
        ${dayBuckets && sm.goal ? `<div class="goal-line" style="bottom:calc(22px + ${H} * ${sm.goal / max})"><span>reja ${sm.goal}</span></div>` : ''}
        ${bars.map((b) => `<div class="col">
          <div class="n">${b.future || bars.length > 14 ? '' : b.n}</div>
          <div class="b ${b.isToday ? 'today' : ''} ${b.n ? '' : 'zero'}" style="height:calc(${H} * ${b.n / max})"></div>
          <div class="d ${b.isToday ? 'today' : ''}">${bars.length > 14 && statPeriod === '30' ? (bars.indexOf(b) % 5 === 0 ? b.label : '') : b.label}</div></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Umumiy ko‘rsatkichlar</h2>
      ${kv('🕌', 'Qolgan qazo', an('left', sm.remaining))}
      ${kv('✅', 'Jami ado qilingan', an('done', sm.total))}
      ${kv('📿', 'Bugun', `${an('today', sm.today)} / ${sm.goal}`)}
      ${kv('📈', 'O‘rtacha (kuniga)', ps.avg)}
      ${kv('📅', 'Eng faol kun', ps.bestWeekday || '—')}
      ${kv('🏅', 'Eng yaxshi hafta', `${num(ps.bestWeek)} ta`)}
      ${kv('⭐', 'Eng yaxshi kun', ps.best ? `${ps.best.n} ta · ${fmtDate(ps.best.date).slice(0, 5)}` : '—')}
      ${kv('↕️', 'Oldingi davrga nisbatan', ps.change == null ? '—' : `${ps.change > 0 ? '+' : ''}${ps.change}%`, ps.change > 0 ? 'up' : ps.change < 0 ? 'down' : '')}
    </div>

    <div class="card">
      <div class="card-head"><h2>Qazo bo‘yicha progress</h2><b style="color:var(--accent)">${sm.pct}%</b></div>
      ${bar(sm.total, sm.total + sm.remaining, false, 'all-bar')}
      ${finish ? `<div class="finish">Taxminiy tugash: ${fmtDate(finish)}</div>` : ''}
    </div>

    <div class="card insight">
      <h2>🧠 Tahlil</h2>
      ${insights(state, now).map((x) => `<div class="ins"><span>${x.icon}</span><div>${x.text}</div></div>`).join('')}
    </div>

    ${heatHtml(now)}

    <div class="card">
      <div class="streak">
        <div class="fire">🔥</div>
        <div class="grow"><div class="v">${st.current} kun</div><div class="sub">ketma-ket qazo ado qilyapsiz</div></div>
        <div style="text-align:right"><div class="sub">Eng uzun</div><b style="font-size:20px">${st.best} kun</b></div>
      </div>
      ${sm.goal ? `<div class="streak" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">
        <div class="fire">🎯</div>
        <div class="grow"><div class="v">${gs.current} kun</div><div class="sub">ketma-ket kunlik reja (${sm.goal} ta) to‘liq bajarildi</div></div>
        <div style="text-align:right"><div class="sub">Eng uzun</div><b style="font-size:20px">${gs.best} kun</b></div></div>` : ''}
    </div>

    <div class="card goals">
      <h2>🎯 Maqsadlar</h2>
      ${[['Kunlik', sm.today, sm.goal], ['Haftalik', sm.week, sm.weekGoal], ['Oylik', sm.month, sm.monthGoal]].map(([l, v, g]) => `
        <div class="g"><div class="gl"><span>${l}</span><b>${num(v)} / ${num(g)}</b></div>${bar(v, g, true)}</div>`).join('')}
    </div>

    <button class="card ach-link" id="toAch">
      <div class="row"><h2 class="grow" style="margin:0;text-align:left">🏆 Yutuqlar</h2><span class="sub">${unlocked.length} / ${ach.length} ›</span></div>
      <div class="ach-prev">${(unlocked.length ? unlocked.slice(-4) : ach.slice(0, 4)).map((a) =>
        `<span class="medal t-${a.tier} ${a.unlocked ? '' : 'off'}"><span class="m-ic">${a.icon}</span></span>`).join('')}</div>
    </button>
    <p class="hint">Statistika ilovaning 10-versiyasidan boshlab yuritiladi.</p>`;
  $app.querySelectorAll('[data-period]').forEach((b) => { b.onclick = () => { statPeriod = b.dataset.period; render(); }; });
  $app.querySelector('#toAch').onclick = () => go('achievements');
  bindHeat();
}

/* ---------------- Yutuqlar (medallar) ---------------- */
function renderAchievements() {
  const now = new Date();
  const ach = achievements(state, now);
  const ud = unlockDates(state, now);
  $app.innerHTML = `
    ${topbar('Yutuqlar', `${ach.filter((a) => a.unlocked).length} / ${ach.length} medal`, true)}
    <div class="ach">${ach.map((a) => {
      const k = a.id === 'clear' ? (state.clearedAt ? dayKey(new Date(state.clearedAt)) : null) : ud[a.id];
      return `<button class="medal-c ${a.unlocked ? 'on' : 'off'} t-${a.tier}" data-medal aria-label="${esc(a.title)}: ${a.unlocked ? 'qo‘lga kiritildi' : 'hali yopiq'}. Orqa tomonini ko‘rish">
        <span class="m-in">
          <span class="m-face"><span class="medal"><span class="m-ic">${a.icon}</span></span>
            <span class="bt">${a.title}</span><span class="bd">${a.unlocked ? TIER[a.tier] : `${num(a.value)} / ${num(a.need)}`}</span></span>
          <span class="m-face m-back"><span class="bt">${a.desc}</span>
            <span class="bd">${a.unlocked ? (k ? longDate(k) : 'Qo‘lga kiritildi') : `Yana ${num(a.need - a.value)} — ${TIER[a.tier]} medal`}</span></span>
        </span></button>`; }).join('')}</div>
    <p class="hint">Medalni bossangiz — orqa tomonida qachon olinganini ko‘rasiz.</p>`;
  bindBack('stats');
  $app.querySelectorAll('[data-medal]').forEach((b) => { b.onclick = () => b.classList.toggle('flip'); });
}

const TIER = { bronze: 'bronza', silver: 'kumush', gold: 'oltin', platinum: 'platina', diamond: 'olmos', emerald: 'zumrad' };
const longDate = (k) => { const d = new Date(`${k}T12:00:00`); return `${d.getFullYear()}-yil ${d.getDate()}-${MONTHS[d.getMonth()].toLowerCase()}`; };
const heatLegend = () => `<div class="heat-leg">${[['l0', '0 ta'], ['l1', '1–5'], ['l2', '6–10'], ['l3', '11+']].map(([c, t]) =>
  `<span><i class="${c}"></i>${t}</span>`).join('')}</div>`;

// GitHub uslubidagi muntazamlik xaritasi
function heatHtml(now) {
  const hw = heatWeeks(state, now, 12);
  const days = hw.flat().filter((x) => x.n != null);
  const active = days.filter((x) => x.n > 0).length;
  return `<div class="card">
    <div class="card-head"><h2>🗓 Muntazamlik</h2><span class="sub">12 hafta · ${active}/${days.length} kun</span></div>
    <div class="heat">${WEEKDAYS.map((w, i) => `<span class="hw">${i % 2 ? '' : w}</span>${hw.map((wk) => {
      const c = wk[i];
      return c.n == null ? '<i class="hc fut"></i>'
        : `<button class="hc l${heatLevel(c.n)}" data-hday="${c.key}" aria-label="${c.key}: ${c.n} ta"></button>`; }).join('')}`).join('')}</div>
    ${heatLegend()}
  </div>`;
}
function bindHeat() {
  $app.querySelectorAll('[data-hday]').forEach((b) => { b.onclick = () => {
    const d = new Date(`${b.dataset.hday}T12:00:00`); cal = { y: d.getFullYear(), m: d.getMonth(), sel: b.dataset.hday }; go('history'); }; });
}

/* ---------------- Kalendar ---------------- */
function renderCalendar() {
  const now = new Date();
  cal ||= { y: now.getFullYear(), m: now.getMonth(), sel: dayKey(now) };
  const goal = Number(state.settings.dailyGoal) || 0;
  const todayKey = dayKey(now);
  const cells = monthGrid(cal.y, cal.m);
  let monthTotal = 0, active = 0, daysPast = 0;
  const html = cells.map((d) => {
    if (!d) return '<div></div>';
    const k = dayKey(d);
    const n = dayDone(state, k);
    monthTotal += n; if (n) active++; if (k <= todayKey) daysPast++;
    const cls = [`l${heatLevel(n)}`, k === todayKey ? 'today' : '', k === cal.sel ? 'sel' : '', k > todayKey ? 'future' : ''].join(' ');
    return `<button class="cell ${cls}" data-day="${k}" aria-label="${d.getDate()}: ${n} ta">${d.getDate()}</button>`;
  }).join('');
  const prevM = new Date(cal.y, cal.m - 1, 1, 12);
  const prevDays = new Date(cal.y, cal.m, 0).getDate();
  let prevTotal = 0, prevActive = 0;
  for (let i = 0; i < prevDays; i++) { const n = dayDone(state, dayKey(addDays(prevM, i))); prevTotal += n; if (n) prevActive++; }

  const sel = new Date(`${cal.sel}T12:00:00`);
  const lg = state.log?.[cal.sel] || {};
  const n = dayDone(state, cal.sel);
  const onTime = PRAYERS.slice(0, 5).filter((p) => lg[p] === 'prayed').length;

  $app.innerHTML = `
    ${topbar('Kalendar', '', false)}
    <div class="card" style="margin-top:0">
      <div class="cal-head">
        <button id="calPrev" aria-label="Oldingi oy">‹</button>
        <b>${MONTHS[cal.m]} ${cal.y}</b>
        <button id="calNext" aria-label="Keyingi oy">›</button>
      </div>
      <div class="cal">${WEEKDAYS.map((w) => `<div class="wd">${w}</div>`).join('')}${html}</div>
      ${heatLegend()}
    </div>

    <button class="card day-card" id="toHistory">
      <div class="row"><div class="grow" style="text-align:left"><b>${dayTitle(sel)}</b>
        <div class="sub">${n ? `${n} ta qazo ado qilingan` : 'Qazo ado qilinmagan'}${Object.keys(lg).length ? ` · o‘z vaqtida ${onTime}/5` : ''}${goal && n >= goal ? ' · 🎯 reja bajarilgan' : ''}</div></div>
        <span class="pill green">Qazo tarixi ›</span></div>
    </button>

    <div class="card">
      <div class="kv"><span class="kv-i">📅</span><span class="grow">${MONTHS[cal.m]}: jami</span><b>${num(monthTotal)} ta</b></div>
      <div class="kv"><span class="kv-i">🔥</span><span class="grow">Faol kunlar</span><b>${active} kun</b></div>
      <div class="kv"><span class="kv-i">📈</span><span class="grow">O‘rtacha (kuniga)</span><b>${daysPast ? (monthTotal / daysPast).toFixed(1) : '0'}</b></div>
      <div class="kv"><span class="kv-i">↩️</span><span class="grow">O‘tgan oy (${MONTHS[prevM.getMonth()]})</span><b>${num(prevTotal)} ta · ${prevActive} kun</b></div>
    </div>`;

  const shift = (dm) => { const d = new Date(cal.y, cal.m + dm, 1); cal.y = d.getFullYear(); cal.m = d.getMonth(); render(); };
  $app.querySelector('#calPrev').onclick = () => shift(-1);
  $app.querySelector('#calNext').onclick = () => shift(1);
  $app.querySelectorAll('[data-day]').forEach((b) => { b.onclick = () => {
    if (cal.sel === b.dataset.day) return go('history');
    cal.sel = b.dataset.day; render(); }; });
  $app.querySelector('#toHistory').onclick = () => go('history');
}

/* ---------------- Qazo tarixi (kun bo'yicha tahrirlash) ---------------- */
let histEdit = false;
function renderHistory() {
  const now = new Date();
  cal ||= { y: now.getFullYear(), m: now.getMonth(), sel: dayKey(now) };
  const sel = new Date(`${cal.sel}T12:00:00`);
  const lg = state.log?.[cal.sel] || {};
  const dd = state.done?.[cal.sel] || {};
  const n = dayDone(state, cal.sel);
  const list = PRAYERS.filter((p) => p !== 'vitr' || lg[p] || dd[p] || state.settings.includeVitr);
  const pillOf = (st) => st === 'prayed' ? '<span class="spill ok">O‘qildi</span>' : st === 'qazo' ? '<span class="spill bad">Qazo</span>'
    : st === 'excused' ? '<span class="spill">Uzrli</span>' : '<span class="spill none">—</span>';
  $app.innerHTML = `
    ${topbar('Qazo tarixi', '', true)}
    <div class="datenav">
      <button id="hPrev" aria-label="Oldingi kun">‹</button>
      <b>📅 ${sel.getDate()} ${MONTHS[sel.getMonth()]} ${sel.getFullYear()}</b>
      <button id="hNext" aria-label="Keyingi kun" ${cal.sel >= dayKey(now) ? 'disabled' : ''}>›</button>
    </div>
    ${list.map((p) => {
      const st = lg[p];
      const opt = (v, t) => `<button class="stbtn ${st === v ? `on ${v}` : ''}" data-st="${p}" data-v="${v}" aria-pressed="${st === v}">${t}</button>`;
      return `<div class="prow">
        <div class="p-ico">${ICONS[p]}</div>
        <div class="grow"><div class="pname">${NAMES[p]}</div><div class="sub">${dd[p] ? `${dd[p]} ta qazo ado qilingan` : 'qazo o‘qilmagan'}</div></div>
        ${histEdit && st ? `<span class="st-group">${opt('prayed', '✓')}${opt('qazo', 'Qazo')}${opt('excused', 'Uzrli')}</span>` : pillOf(st)}
      </div>`; }).join('')}
    <div class="card hist-foot">
      <div class="grow"><span class="sub">Jami ado qilingan</span><br><b>${n} ta</b></div>
      ${Object.keys(lg).length ? `<button class="${histEdit ? 'primary' : ''}" id="hEdit">${histEdit ? '✓ Tayyor' : '✏️ Tahrirlash'}</button>` : ''}
    </div>
    <p class="hint">${histEdit ? '“Qazo” tanlansa — qazo hisobiga 1 qo‘shiladi, “✓ O‘qildi” yoki “Uzrli” tanlansa — ayriladi.'
      : 'Namoz noto‘g‘ri belgilangan bo‘lsa (masalan, o‘qigan edingiz, lekin qazoga tushgan) — “Tahrirlash”ni bosing.'}
      “—” — bu kun ilova hali kuzatmagan yoki vaqti kirmagan.</p>`;

  bindBack('calendar');
  const step = (dd2) => { const d = addDays(sel, dd2); if (dayKey(d) > dayKey(now)) return; cal.sel = dayKey(d); cal.y = d.getFullYear(); cal.m = d.getMonth(); render(); };
  $app.querySelector('#hPrev').onclick = () => step(-1);
  $app.querySelector('#hNext').onclick = () => step(1);
  const e = $app.querySelector('#hEdit');
  if (e) e.onclick = () => { histEdit = !histEdit; render(); };
  $app.querySelectorAll('[data-st]').forEach((b) => {
    b.onclick = () => {
      const p = b.dataset.st, v = b.dataset.v;
      const next = setDayStatus(state, cal.sel, p, v, new Date());
      if (next === state) return;
      save(next);
      toast(`${NAMES[p]}: ${v === 'prayed' ? 'o‘qilgan' : v === 'qazo' ? 'qazo (+1)' : 'uzrli'} deb belgilandi`);
    };
  });
}

/* ---------------- Menyu ---------------- */
function renderMenu() {
  const ach = achievements(state, new Date());
  const items = [
    ['journey', '🗺', 'Qazo yo‘li', `${journey(state).pct}% yo‘l bosildi`],
    ['qazo', '📿', 'Bugungi reja', 'Qazolarni belgilash va qo‘shish'],
    ['focus', '🌿', 'Focus rejimi', 'Faqat qazo o‘qish uchun'],
    ['estimate', '🧮', 'Qazo kalkulyatori', 'Boshlagan sanani bilmasangiz ham hisoblash'],
    ['history', '🗓', 'Qazo tarixi', 'Kunlar bo‘yicha ko‘rish va tahrirlash'],
    ['achievements', '🏆', 'Yutuqlar', `${ach.filter((a) => a.unlocked).length} / ${ach.length} medal`],
    ['learn', '📖', 'Qo‘llanma', 'Namoz va qazo o‘qish tartibi'],
    ['widget', '📲', 'Bosh ekran vidjeti', 'Namoz vaqtlari telefon ekranida'],
    ['themes', '🎨', 'Mavzular', THEMES.find((t) => t[0] === resolvedTheme())?.[2] || ''],
    ['settings', '⚙️', 'Sozlamalar', 'Joylashuv, vaqtlar, bildirishnomalar, zaxira'],
    ['share', '💚', 'Ilovani ulashish', 'Do‘stlaringizga yuboring — savobiga sherik bo‘ling'],
  ];
  if (hasSupport()) items.push(['support', '🤝', 'Qo‘llab-quvvatlash', 'Loyihaga yordam']);
  $app.innerHTML = `
    ${topbar('Menyu', '', false)}
    <div class="menu">${items.map(([k, ic, t, sub]) => `<button class="mi" data-mi="${k}">
      <span class="mi-i">${ic}</span><span class="grow"><b>${t}</b><span class="sub">${sub}</span></span><span class="mi-a">›</span></button>`).join('')}</div>
    <div class="ver">Namoz va Qazo · ${APP_VERSION}-versiya</div>`;
  $app.querySelectorAll('[data-mi]').forEach((b) => { b.onclick = () => {
    const k = b.dataset.mi;
    if (k === 'focus') return openFocus();
    if (k === 'share') return shareApp();
    if (k === 'widget') return addWidget();
    if (k === 'history') { const d = new Date(); cal ||= { y: d.getFullYear(), m: d.getMonth(), sel: dayKey(d) }; }
    go(k);
  }; });
}

/* ---------------- Bosh ekran vidjeti ---------------- */
const WIDGET_HINT = 'widget-hint-done';
async function addWidget() {
  try { localStorage.setItem(WIDGET_HINT, '1'); } catch {}
  if (!widgetSupported()) {
    return toast('Vidjet faqat Android ilovada ishlaydi. Ilovani o‘rnatgach: bosh ekranni bosib turing → Vidjetlar → “Namoz va Qazo”.', 8000);
  }
  await syncWidget(state, true);
  const r = await pinWidget();
  if (!r.ok) toast('Bosh ekranning bo‘sh joyini bosib turing → “Vidjetlar” → “Namoz va Qazo” → “Namoz vaqtlari”ni ekranga torting.', 9000);
  render();
}
function widgetHintHtml() {
  let done = false;
  try { done = Boolean(localStorage.getItem(WIDGET_HINT)); } catch {}
  if (done || !widgetSupported()) return '';
  return `<div class="install-card">
    <button class="x" id="wgX" aria-label="Yopish">×</button>
    <div class="ic-title">📲 Namoz vaqtlari — bosh ekranda</div>
    <div class="ic-text">Ilovani ochmasdan, telefon ekranida bugungi vaqtlarni ko‘ring. Hozirgi namoz oltin rangda ajralib turadi.</div>
    <button class="btn primary" id="wgAdd">Vidjetni qo‘shish</button></div>`;
}

/* ---------------- Mavzular ---------------- */
function themeScene(k) {
  const sc = {
    emerald: ['#0F3B30', '#2E7D5B', '#E9C46A'], dark: ['#0A1430', '#2B3D78', '#F6E7B0'], sand: ['#8A4A2A', '#E8A867', '#FFE2A8'],
    kaaba: ['#141414', '#4A3A1E', '#E6C35C'], ramadan: ['#2A1C5E', '#7A4FB0', '#F2C964'], light: ['#DAD7CC', '#F4F2EA', '#B9B4A4'],
  }[k] || ['#333', '#666', '#fff'];
  const fg = k === 'light' ? '#9A9585' : '#050B09';
  return `<svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="tg-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc[0]}"/><stop offset="1" stop-color="${sc[1]}"/></linearGradient></defs>
    <rect width="120" height="80" fill="url(#tg-${k})"/>
    ${k === 'kaaba' ? `<path d="M44 46 L50 40 H82 L76 46Z" fill="#2a2a2a"/><path d="M76 46 L82 40 V64 L76 70Z" fill="#161616"/><rect x="44" y="46" width="32" height="24" fill="#0b0b0b"/><rect x="44" y="51" width="32" height="3.5" fill="${sc[2]}"/>`
      : `<circle cx="${k === 'sand' ? 60 : 92}" cy="${k === 'sand' ? 52 : 18}" r="${k === 'sand' ? 16 : 6}" fill="${sc[2]}" opacity=".9"/>
      <path d="M38 80 V56 C38 44 50 38 60 34 C70 38 82 44 82 56 V80Z M59.3 34 v-6 h1.4 v6Z M26 80 V44 h5 V80Z M24.5 44 L28.5 34 L32.5 44Z M89 80 V44 h5 V80Z M87.5 44 L91.5 34 L95.5 44Z M0 74 H120 V80 H0Z" fill="${fg}"/>`}
    ${k === 'ramadan' ? '<path d="M18 8 v10" stroke="#F2C964" stroke-width="1"/><rect x="14.5" y="18" width="7" height="10" rx="2" fill="#F2C964"/>' : ''}
  </svg>`;
}
function renderThemes() {
  const cur = getTheme();
  const tiles = THEMES.filter((t) => t[0] !== 'auto');
  $app.innerHTML = `
    ${topbar('Mavzular', 'Ilova ko‘rinishini tanlang', true)}
    <div class="theme-grid">${tiles.map(([k, ic, l]) => `<button class="tt ${cur === k ? 'on' : ''}" data-theme-set="${k}" aria-pressed="${cur === k}">
      ${themeScene(k)}<span class="tt-l">${ic} ${l}</span>${cur === k ? '<span class="tt-ok">✓</span>' : ''}</button>`).join('')}</div>
    <div class="card">
      <div class="switch" style="margin-top:0"><span>📱 Telefon mavzusiga moslash<br><span class="sub">Kunduzi — Minimal, kechasi — Zumrad</span></span>
        <input type="checkbox" id="autoT" ${cur === 'auto' ? 'checked' : ''} /></div>
      <div class="switch"><span>🌌 Jonli osmon<br><span class="sub">Bosh sahifa foni namoz vaqtiga qarab o‘zgaradi: tong, kun, oltin soat, shom, yulduzli tun</span></span>
        <input type="checkbox" id="skyT" ${skyOn() ? 'checked' : ''} /></div>
    </div>`;
  bindBack('menu');
  $app.querySelectorAll('[data-theme-set]').forEach((b) => { b.onclick = () => setTheme(b.dataset.themeSet); });
  $app.querySelector('#autoT').onchange = (e) => setTheme(e.target.checked ? 'auto' : 'emerald');
  $app.querySelector('#skyT').onchange = (e) => { try { localStorage.setItem(SKY_KEY, e.target.checked ? 'on' : 'off'); } catch {} };
}

/* ---------------- Joylashuv bloki (sozlash va sozlamalarda) ---------------- */
function locationHtml(f) {
  const results = (f.results || []).map((r, i) => `<button class="result" data-res="${i}">${esc(r.label)}</button>`).join('');
  return `
    <button class="btn primary" id="gps" ${f.locBusy ? 'disabled' : ''}>${f.locBusy ? '⏳ Aniqlanmoqda…' : '📍 Joylashuvimni aniqlash'}</button>
    ${f.lat != null ? `<div class="loc">✅ <b>${esc(f.city)}</b><br><span class="sub">${Number(f.lat).toFixed(4)}°, ${Number(f.lng).toFixed(4)}°${f.accuracy ? ` · ±${f.accuracy} m` : ''}</span></div>` : ''}
    ${f.locMsg ? `<p class="hint warn">${esc(f.locMsg)}</p>` : ''}
    <label>Yoki shaharni qidiring (dunyo bo‘yicha)</label>
    <div class="row">
      <input type="text" id="cityQ" value="${esc(f.searchQ || '')}" placeholder="Masalan: Moskva, Seoul, Istanbul" />
      <button id="citySearch" style="padding:12px 16px">🔍</button>
    </div>
    <div class="results">${results}</div>`;
}

function setPlace(f, p) {
  Object.assign(f, { lat: p.lat, lng: p.lng, city: p.label, countryCode: p.countryCode || '', accuracy: p.accuracy || null });
  if (f.methodAuto !== false) f.method = suggestMethod(f.countryCode, TZ);
}

function bindLocation(f) {
  $app.querySelector('#gps').onclick = async () => {
    f.locBusy = true; f.locMsg = ''; render();
    try {
      const loc = await detectLocation();
      const place = loc.how === 'ip' && loc.city
        ? { label: [loc.city, loc.country].filter(Boolean).join(', '), countryCode: loc.countryCode }
        : await placeName(loc.lat, loc.lng);
      setPlace(f, { ...loc, ...place });
      f.locMsg = loc.how === 'ip'
        ? 'GPS ishlamadi, joylashuv internet orqali taxminan aniqlandi. Noto‘g‘ri bo‘lsa, shaharni qidirib tanlang. ' + locationErrorText(loc.error)
        : '';
    } catch (e) {
      f.locMsg = locationErrorText(e.code);
    }
    f.locBusy = false;
    render();
  };
  const doSearch = async () => {
    f.searchQ = $app.querySelector('#cityQ').value.trim();
    if (f.searchQ.length < 2) return;
    try {
      f.results = await searchCity(f.searchQ);
      if (!f.results.length) toast('Hech narsa topilmadi. Lotin yoki ingliz harflarida yozib ko‘ring.');
    } catch { toast('Qidirish uchun internet kerak.'); }
    render();
  };
  $app.querySelector('#citySearch').onclick = doSearch;
  $app.querySelector('#cityQ').onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };
  $app.querySelector('#cityQ').oninput = (e) => { f.searchQ = e.target.value; };
  $app.querySelectorAll('[data-res]').forEach((b) => {
    b.onclick = () => { setPlace(f, f.results[Number(b.dataset.res)]); f.results = []; f.locMsg = ''; render(); };
  });
}

function methodHtml(f) {
  return `
    <label>Hisoblash usuli</label>
    <select id="method">${Object.entries(METHODS).map(([k, m]) => `<option value="${k}" ${f.method === k ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
    ${f.method === 'custom' ? `
      <div class="row"><div class="grow"><label>Bomdod burchagi (°)</label><input type="number" step="0.5" data-f="fajrAngle" value="${esc(f.fajrAngle)}" /></div>
      <div class="grow"><label>Xufton burchagi (°)</label><input type="number" step="0.5" data-f="ishaAngle" value="${esc(f.ishaAngle)}" /></div></div>` : ''}
    <label>Asr vaqti (mazhab)</label>
    <select id="madhab">
      <option value="hanafi" ${f.madhab !== 'shafi' ? 'selected' : ''}>Hanafiy (O‘zbekiston, Turkiya…)</option>
      <option value="shafi" ${f.madhab === 'shafi' ? 'selected' : ''}>Shofe’iy, Molikiy, Hanbaliy</option>
    </select>
    <p class="hint">Usul joylashuvga qarab avtomatik tanlanadi. Mahalliy masjid taqvimiga to‘g‘ri kelmasa, usulni o‘zgartiring yoki pastda vaqtni qo‘lda to‘g‘rilang.</p>`;
}
function bindMethod(f) {
  $app.querySelector('#method').onchange = (e) => { f.method = e.target.value; f.methodAuto = false; render(); };
  $app.querySelector('#madhab').onchange = (e) => { f.madhab = e.target.value; render(); };
}

/* ---------------- Qazo kalkulyatori (sana noma'lum bo'lganlar uchun ham) ---------------- */
const PCTS = [[0, 'o‘qimagan'], [25, 'kam'], [50, 'yarmi'], [75, 'ko‘pi'], [100, 'to‘liq']];
const newEst = () => ({ mode: 'periods', age: '', bulugh: '12', periods: [{ to: null, pct: 0 }], birth: '', start: '', hayzDays: '7', exact: {} });
const yrs = (n) => `${Math.round(n * 10) / 10}`.replace('.', ',');

// Natija: { q, total, days, err }
function estResult(c, includeVitr, gender) {
  const act = includeVitr ? PRAYERS : PRAYERS.slice(0, 5);
  const sumQ = (q) => act.reduce((a, p) => a + (q[p] || 0), 0);
  if (c.mode === 'none') return { q: { ...EMPTY.qazo }, total: 0, days: 0 };
  if (c.mode === 'exact') {
    const q = { ...EMPTY.qazo };
    for (const p of act) q[p] = Math.max(0, Math.floor(Number(c.exact[p]) || 0));
    return { q, total: sumQ(q), days: 0 };
  }
  if (c.mode === 'date') {
    if (!c.birth && !c.start) return { err: 'Tug‘ilgan sana va namozni boshlagan sanani kiriting.' };
    const birth = parseDate(c.birth), start = parseDate(c.start);
    if (!birth) return { err: 'Tug‘ilgan sanani tanlang.' };
    if (!start) return { err: 'Namozni boshlagan sanani tanlang.' };
    if (start < birth) return { err: 'Namozni boshlagan sana tug‘ilgan sanadan keyin bo‘lishi kerak.' };
    const q = initialQazo({ birth, startDate: start, bulughAge: c.bulugh, includeVitr, gender, hayzDays: c.hayzDays });
    return { q, total: sumQ(q), days: q.fajr };
  }
  const r = estimateFromPeriods({ age: c.age, bulughAge: c.bulugh, periods: c.periods, includeVitr, gender, hayzDays: c.hayzDays });
  if (!c.age) return { err: 'Hozirgi yoshingizni kiriting.', rows: r.rows };
  if (!r.ok) return { err: 'Hozirgi yosh balog‘at yoshidan katta bo‘lishi kerak.', rows: r.rows };
  return { q: r.q, total: sumQ(r.q), days: r.days, rows: r.rows };
}

function estOutHtml(r, includeVitr) {
  if (r.err) return `<span class="sub">${r.err}</span>`;
  if (!r.total) return '<b>0</b> <span class="sub">— hisob 0 dan boshlanadi, keyingi qazolarni ilova o‘zi kuzatadi</span>';
  const per = includeVitr ? 6 : 5;
  return `<div class="est-big">≈ ${num(r.total)} ta qazo</div>
    <div class="sub">${r.days ? `≈ ${num(r.days)} kun (${yrs(r.days / 365.2425)} yil) × ${per} namoz${includeVitr ? ' (vitr bilan)' : ''}` : 'kiritilgan sonlar bo‘yicha'}</div>
    ${r.days ? '<div class="sub" style="margin-top:4px">Bu <b>taxminiy</b> hisob — keyin istalgan payt tuzatish mumkin.</div>' : ''}`;
}

function estimatorHtml(c, includeVitr, gender) {
  const r = estResult(c, includeVitr, gender);
  const modes = [['periods', '🧮 Yosh bo‘yicha'], ['date', '📅 Sana bo‘yicha'], ['exact', '✍️ Sonini bilaman'], ['none', '⏭ Bilmayman']];
  let body = '';
  if (c.mode === 'periods') {
    const n = c.periods.length;
    body = `
      <div class="row" style="gap:10px">
        <div class="grow"><label>Hozirgi yoshingiz</label><input type="number" inputmode="numeric" data-c="age" value="${esc(c.age)}" placeholder="masalan, 30" /></div>
        <div class="grow"><label>Balog‘atga yetgan yosh</label><input type="number" inputmode="numeric" data-c="bulugh" value="${esc(c.bulugh)}" /></div>
      </div>
      <p class="hint">Balog‘at yoshini bilmasangiz: Hanafiy mazhabida belgilar bo‘lmasa, eng kech chegara — <b>15 yosh</b>. Ikkilansangiz, ertaroq yoshni tanlang (ehtiyot).</p>
      <div class="sheet-l">Hayot davrlaringiz — har birida namozni qancha o‘qigansiz?</div>
      ${c.periods.map((pr, i) => {
        const row = r.rows?.[i];
        const last = i === n - 1;
        return `<div class="per">
          <div class="per-h"><b><span data-from="${i}">${row ? row.from : esc(c.bulugh)}</span> – ${last ? 'hozirgacha' : `<input type="number" inputmode="numeric" class="per-to" data-to="${i}" value="${esc(pr.to ?? '')}" />`} yosh</b>
            ${n > 1 ? `<button class="per-x" data-del="${i}" aria-label="Davrni o‘chirish">×</button>` : ''}</div>
          <div class="pctseg">${PCTS.map(([v, t]) => `<button class="${Number(pr.pct) === v ? 'on' : ''}" data-pct="${i}" data-v="${v}" aria-pressed="${Number(pr.pct) === v}"><b>${v}%</b><span>${t}</span></button>`).join('')}</div>
          <div class="sub per-o" data-pout="${i}">${row ? `≈ ${yrs(row.days / 365.2425)} yil qazo` : ''}</div>
        </div>`; }).join('')}
      <button class="btn" id="perAdd">＋ Davr qo‘shish</button>
      <p class="hint">Masalan: 13–20 yosh — umuman o‘qimagan (0%), 20–26 — ba’zan (50%), 26 dan hozirgacha — deyarli to‘liq (100%).
        Ikkilansangiz, <b>kamroq foizni</b> tanlang — ehtiyot uchun.</p>`;
  } else if (c.mode === 'date') {
    body = `
      <label>Tug‘ilgan sana</label><input type="date" data-c="birth" value="${esc(c.birth)}" max="${dayKey(new Date())}" />
      <label>Balog‘at yoshi</label><input type="number" data-c="bulugh" value="${esc(c.bulugh)}" />
      <label>Namozni (muntazam) boshlagan sana</label><input type="date" data-c="start" value="${esc(c.start)}" max="${dayKey(new Date())}" />`;
  } else if (c.mode === 'exact') {
    body = `<p class="hint">Har bir namozdan nechta qazo borligini aniq bilsangiz — shu yerga yozing.</p>
      ${(includeVitr ? PRAYERS : PRAYERS.slice(0, 5)).map((p) => `<div class="row" style="margin-top:8px"><span class="grow">${ICONS[p]} ${NAMES[p]}</span>
        <input type="number" inputmode="numeric" data-ex="${p}" value="${esc(c.exact[p] ?? '')}" placeholder="0" style="width:130px" /></div>`).join('')}`;
  } else {
    body = `<p class="hint">Hisob 0 dan boshlanadi. Bundan keyin vaqtida o‘qilmagan namozlarni ilova o‘zi qazoga qo‘shadi.
      Eski qazolaringizni keyin <b>Bugungi reja → 🧮 Qazo kalkulyatori</b> orqali istalgan payt hisoblab qo‘shishingiz mumkin.</p>`;
  }
  return `<div class="chips est-modes">${modes.map(([k, l]) => `<button class="chip ${c.mode === k ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('')}</div>
    ${body}
    ${gender === 'ayol' && (c.mode === 'periods' || c.mode === 'date') ? `<label>Oyiga o‘rtacha hayz kunlari</label><input type="number" data-c="hayzDays" value="${esc(c.hayzDays)}" />
      <p class="hint">Har oy shuncha kun hisobdan ayiriladi (taxminiy).</p>` : ''}
    ${c.mode === 'none' ? '' : `<div class="est-out" id="estOut" aria-live="polite">${estOutHtml(r, includeVitr)}</div>`}
    <p class="hint">Qazo soni aniq bilinmasa, ko‘proq ishongan taxminingiz bo‘yicha hisoblang, ikkilansangiz — ko‘prog‘ini oling.
      Aniq hukm uchun imomga yoki <a href="https://fatvo.uz/uz/ask" target="_blank" rel="noopener">fatvo.uz</a> ga murojaat qiling.</p>`;
}

// Kiritishlar: raqamlar yozilganda natija joyida yangilanadi (fokus yo'qolmaydi)
function bindEstimator(c, getOpts) {
  const refresh = () => {
    const { includeVitr, gender } = getOpts();
    const r = estResult(c, includeVitr, gender);
    const out = $app.querySelector('#estOut');
    if (out) out.innerHTML = estOutHtml(r, includeVitr);
    (r.rows || []).forEach((row, i) => {
      const f = $app.querySelector(`[data-from="${i}"]`); if (f) f.textContent = row.from;
      const o = $app.querySelector(`[data-pout="${i}"]`); if (o) o.textContent = `≈ ${yrs(row.days / 365.2425)} yil qazo`;
    });
  };
  $app.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { c.mode = b.dataset.mode; render(); }; });
  $app.querySelectorAll('[data-c]').forEach((el) => { el.oninput = () => { c[el.dataset.c] = el.value; refresh(); }; });
  $app.querySelectorAll('[data-to]').forEach((el) => { el.oninput = () => { c.periods[Number(el.dataset.to)].to = el.value; refresh(); }; });
  $app.querySelectorAll('[data-ex]').forEach((el) => { el.oninput = () => { c.exact[el.dataset.ex] = el.value; refresh(); }; });
  $app.querySelectorAll('[data-pct]').forEach((b) => { b.onclick = () => { c.periods[Number(b.dataset.pct)].pct = Number(b.dataset.v); render(); }; });
  $app.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { c.periods.splice(Number(b.dataset.del), 1); render(); }; });
  const add = $app.querySelector('#perAdd');
  if (add) add.onclick = () => {
    const { includeVitr, gender } = getOpts();
    const r = estResult(c, includeVitr, gender);
    const last = r.rows?.at(-1);
    const mid = last ? Math.round((last.from + last.to) / 2) : '';
    c.periods.splice(c.periods.length - 1, 0, { to: mid === last?.from ? '' : mid, pct: c.periods.at(-1).pct });
    c.periods.at(-1).pct = 100;
    render();
  };
}

// Mavjud foydalanuvchilar uchun alohida sahifa
let est = null;
function renderEstimate() {
  const s = state.settings;
  est ||= { ...newEst(), bulugh: '12' };
  const r = estResult(est, s.includeVitr, s.gender);
  const cur = totalQazo(state);
  $app.innerHTML = `
    ${topbar('Qazo kalkulyatori', 'Namozni qachon boshlaganingizni aniq bilmasangiz ham', true)}
    <div class="card" style="margin-top:0">${estimatorHtml(est, s.includeVitr, s.gender)}</div>
    ${est.mode !== 'none' ? `<div class="card">
      <div class="kv"><span class="kv-i">🕌</span><span class="grow">Hozirgi qazo hisobingiz</span><b>${num(cur)} ta</b></div>
      <button class="btn primary" id="estAdd">＋ Hisobga qo‘shish</button>
      <button class="btn" id="estReplace">↺ Hisobni shu bilan almashtirish</button>
      <p class="hint">“Qo‘shish” — hozirgi hisob ustiga qo‘shiladi (masalan, ilova kuzatgan qazolar ustiga eski yillar).
        “Almashtirish” — hozirgi qazo hisobi o‘rniga shu natija yoziladi. Ado qilingan qazolar tarixi o‘chmaydi.</p>
    </div>` : ''}`;
  bindBack('qazo');
  bindEstimator(est, () => ({ includeVitr: s.includeVitr, gender: s.gender }));
  const apply = (replace) => {
    const res = estResult(est, s.includeVitr, s.gender);
    if (res.err) return toast(res.err);
    if (!res.total) return toast('Natija 0 — qo‘shiladigan qazo yo‘q.');
    const done = totalDone(state);
    let qazo;
    if (replace) {
      if (!confirm(`Qazo hisobingiz ${num(cur)} ta o‘rniga ${num(res.total)} ta bo‘ladi. Davom etasizmi?`)) return;
      qazo = { ...EMPTY.qazo, ...res.q };
    } else {
      qazo = { ...state.qazo };
      for (const p of PRAYERS) qazo[p] = (qazo[p] || 0) + (res.q[p] || 0);
    }
    const left = activePrayers(s).reduce((a, p) => a + (qazo[p] || 0), 0);
    save({ ...state, qazo, startTotal: replace ? left + done : Math.max(Number(state.startTotal) || 0, cur + done) + res.total });
    est = null;
    toast(replace ? `Qazo hisobi yangilandi: ${num(left)} ta` : `Qazo hisobiga ${num(res.total)} ta qo‘shildi`);
    go('qazo');
  };
  $app.querySelector('#estAdd')?.addEventListener('click', () => apply(false));
  $app.querySelector('#estReplace')?.addEventListener('click', () => apply(true));
}

/* ---------------- Boshlang'ich sozlash ---------------- */
function renderSetup() {
  form ||= { name: '', gender: 'erkak', est: newEst(), dailyGoal: '3',
    includeVitr: true, city: '', lat: null, lng: null, method: suggestMethod('', TZ), methodAuto: true, madhab: 'hanafi',
    fajrAngle: '15', ishaAngle: '15' };
  const f = form;

  $app.innerHTML = `
    <div style="text-align:center;margin:18px 0 6px;font-size:44px">🕌</div>
    <h1 style="text-align:center">Assalomu alaykum!</h1>
    <div class="sub" style="text-align:center;margin-top:6px">Namoz vaqtlari va qazo hisobi. Dunyoning istalgan joyida ishlaydi,<br>ma’lumotlar faqat telefoningizda saqlanadi.</div>
    ${installHtml(true)}

    <div class="section">Joylashuv</div>
    ${locationHtml(f)}
    ${methodHtml(f)}

    <div class="section">Shaxsiy</div>
    <label>Ismingiz</label><input type="text" data-f="name" value="${esc(f.name)}" />
    <div class="chips">
      ${['erkak', 'ayol'].map((g) => `<button class="chip ${f.gender === g ? 'on' : ''}" data-gender="${g}">${g === 'erkak' ? 'Erkak' : 'Ayol'}</button>`).join('')}
    </div>

    <div class="section">Eski qazolar</div>
    <p class="hint">Namozni qachon boshlaganingizni aniq bilmasangiz yoki o‘qib-o‘qimay yurgan bo‘lsangiz — <b>“Yosh bo‘yicha”</b> hisoblang.
      Bo‘sh qoldirsangiz, hisob 0 dan boshlanadi — keyin <b>Menyu → 🧮 Qazo kalkulyatori</b> orqali hisoblaysiz.</p>
    ${estimatorHtml(f.est, f.includeVitr, f.gender)}

    <div class="section">Sozlamalar</div>
    <label>Kunlik maqsad (nechta qazo)</label><input type="number" data-f="dailyGoal" value="${esc(f.dailyGoal)}" />
    <div class="switch"><span>Vitrni qazo hisobiga qo‘shish<br><span class="sub">Hanafiy mazhabida vitr vojib va qazosi o‘qiladi</span></span><input type="checkbox" id="vitr" ${f.includeVitr ? 'checked' : ''} /></div>

    <button class="btn primary" id="start" style="margin-top:24px">Boshlash</button>`;

  bindInstall();
  bindInputs(f);
  bindLocation(f);
  bindMethod(f);
  bindEstimator(f.est, () => ({ includeVitr: f.includeVitr, gender: f.gender }));
  $app.querySelector('#vitr').onchange = (e) => { f.includeVitr = e.target.checked; render(); };
  $app.querySelectorAll('[data-gender]').forEach((b) => { b.onclick = () => { f.gender = b.dataset.gender; render(); }; });
  $app.querySelector('#start').onclick = () => {
    if (f.lat == null) return toast('Avval joylashuvni aniqlang yoki shaharni tanlang.');
    const skip = f.est.mode === 'periods' && !String(f.est.age).trim(); // to'ldirilmagan — keyinga qoldirildi
    const res = skip ? estResult({ mode: 'none' }, f.includeVitr, f.gender) : estResult(f.est, f.includeVitr, f.gender);
    if (res.err) return toast(`${res.err} Yoki “⏭ Bilmayman” ni tanlang.`);
    const qazo = { ...EMPTY.qazo, ...res.q };
    trackSetupDone(skip ? 'none' : f.est.mode);
    const settings = {
      name: f.name.trim(), city: f.city, lat: f.lat, lng: f.lng, countryCode: f.countryCode || '',
      method: f.method, methodAuto: f.methodAuto, madhab: f.madhab, fajrAngle: Number(f.fajrAngle) || 15, ishaAngle: Number(f.ishaAngle) || 15,
      source: 'auto', autoLocation: true, offsets: {}, includeVitr: f.includeVitr, dailyGoal: Number(f.dailyGoal) || 0, gender: f.gender,
      notify: { ...DEFAULT_NOTIFY },
    };
    if (isNative()) requestPermission().then(() => reschedule(state, true));
    form = null;
    applyOfficial(settings);
    save({ ...EMPTY, qazo, lastProcessed: Date.now(), settings, startTotal: Object.values(qazo).reduce((a, n) => a + n, 0) });
    refreshOfficial(settings).then((ch) => ch && render());
  };
  if (!f.autoTried) { f.autoTried = true; setTimeout(() => $app.querySelector('#gps')?.click(), 400); }
}

/* ---------------- Sozlamalar ---------------- */
function renderSettings() {
  const s = state.settings;
  form ||= {
    name: s.name, dailyGoal: String(s.dailyGoal), includeVitr: s.includeVitr, city: s.city, lat: s.lat, lng: s.lng,
    countryCode: s.countryCode || '', method: s.method || 'uzbekistan', methodAuto: s.methodAuto, madhab: s.madhab || 'hanafi',
    fajrAngle: String(s.fajrAngle ?? 15), ishaAngle: String(s.ishaAngle ?? 15), source: s.source || 'auto',
    autoLocation: s.autoLocation !== false, offsets: { ...(s.offsets || {}) },
    notify: { ...DEFAULT_NOTIFY, ...(s.notify || {}) },
  };
  const f = form;
  const temp = { ...s, ...f, fajrAngle: Number(f.fajrAngle) || 15, ishaAngle: Number(f.ishaAngle) || 15 };
  applyOfficial(temp);
  const day = currentPrayerDay(new Date(), temp);
  const raw = baseTimes(day, temp, false);
  const timeRows = TIME_KEYS.map((k) => {
    const o = Number(f.offsets[k]) || 0;
    const shown = new Date(raw[k].getTime() + o * 60000);
    return `
      <div class="trow">
        <span class="grow">${TIME_NAMES[k]}</span>
        ${o ? `<span class="off">${o > 0 ? '+' : ''}${o} daq</span><button class="mini" data-reset="${k}" aria-label="Tiklash">↺</button>` : ''}
        <input type="time" data-time="${k}" value="${hm(shown)}" />
      </div>`;
  }).join('');

  $app.innerHTML = `
    <div class="page-title">Sozlamalar</div>

    <div class="section" style="margin-top:4px">Ko‘rinish</div>
    <button class="mi" id="toThemes"><span class="mi-i">🎨</span><span class="grow"><b>Mavzular</b><span class="sub">${THEMES.find((t) => t[0] === getTheme())?.[2] || ''} · jonli osmon</span></span><span class="mi-a">›</span></button>
    <div class="switch"><span>📊 Anonim statistikani yuborish<br><span class="sub">Faqat sonlar: nechta qurilma ochgani, versiya, mamlakat. Ism, joylashuv, qazo soni yuborilmaydi.</span></span>
      <input type="checkbox" id="statsT" ${statsEnabled() ? 'checked' : ''} /></div>
    ${installHtml(true)}

    <div class="section">Joylashuv</div>
    ${locationHtml(f)}
    <div class="switch"><span>Har ochilganda joylashuvni yangilash<br><span class="sub">Safarda vaqtlar o‘zi moslanadi</span></span>
      <input type="checkbox" id="autoLoc" ${f.autoLocation ? 'checked' : ''} /></div>
    ${f.countryCode === 'UZ' || raw.source === 'official' ? `
      <div class="switch"><span>O‘zbekiston rasmiy taqvimidan foydalanish<br><span class="sub">islomapi.uz, internet bo‘lganda yangilanadi</span></span>
        <input type="checkbox" id="official" ${f.source !== 'gps' ? 'checked' : ''} /></div>` : ''}

    <div class="section">Namoz vaqtlari</div>
    ${methodHtml(f)}
    <p class="hint"><b>${fmtDate(day)}</b> uchun vaqtlar. Masjidingiz taqvimidan farq qilsa, soatni bosib to‘g‘ri vaqtni qo‘ying —
      farq eslab qolinadi va har kuni qo‘llanadi.</p>
    <div class="times">${timeRows}</div>
    ${TIME_KEYS.some((k) => Number(f.offsets[k])) ? '<button class="btn" id="resetAll">↺ Qo‘lda tuzatishlarni bekor qilish</button>' : ''}

    <div class="section">Bildirishnomalar</div>
    ${notifyHtml(f)}

    <div class="section">Boshqa</div>
    <label>Ismingiz</label><input type="text" data-f="name" value="${esc(f.name)}" />
    <label>Kunlik maqsad</label><input type="number" data-f="dailyGoal" value="${esc(f.dailyGoal)}" />
    <div class="switch"><span>Vitrni qazo hisobiga qo‘shish<br><span class="sub">Hanafiy mazhabida vitr vojib va qazosi o‘qiladi</span></span><input type="checkbox" id="vitr" ${f.includeVitr ? 'checked' : ''} /></div>

    <button class="btn primary" id="save" style="margin-top:20px">Saqlash</button>

    <div class="section">Ilova haqida</div>
    ${IS_PLAY ? '' : '<button class="btn" id="checkUpd">🔄 Yangilanishni tekshirish</button>'}
    <button class="btn" id="shareBtn">📤 Do‘stlarga ulashish</button>
    <button class="btn" id="learnBtn">📚 Namoz va qazo qo‘llanmasi</button>
    <button class="btn" id="supportBtn">🤲 Loyihani qo‘llab-quvvatlash</button>
    <a class="btn" href="${APP_URL}privacy.html" target="_blank" rel="noopener">🔒 Maxfiylik siyosati</a>

    <div class="section">Zaxira</div>
    <p class="sub" style="margin:0">Oxirgi zaxira: <b>${state.lastBackup ? fmtDate(new Date(state.lastBackup)) : 'hali olinmagan'}</b></p>
    <button class="btn primary" id="export">💾 Zaxira nusxa olish va saqlash</button>
    <p class="hint">Faylni o‘zingizga Telegram’ga (“Saqlangan xabarlar”), Google Drive yoki pochtaga yuboring. Telefon almashsa yoki ilova o‘chsa — shu fayldan tiklanadi.</p>
    <label>Zaxiradan tiklash — faylni tanlang</label><input type="file" id="importFile" accept=".json,application/json,text/plain" />

    <button class="btn danger" id="reset" style="margin-top:24px">Profilni o‘chirish</button>
    <div class="ver">Namoz va Qazo · versiya ${APP_VERSION}${CHANNEL === 'web' ? '' : ` · ${CHANNEL}`}</div>`;

  bindInstall();
  bindInputs(f);
  bindLocation(f);
  bindMethod(f);
  $app.querySelector('#vitr').onchange = (e) => { f.includeVitr = e.target.checked; };
  $app.querySelector('#autoLoc').onchange = (e) => { f.autoLocation = e.target.checked; };
  const off = $app.querySelector('#official');
  if (off) off.onchange = (e) => { f.source = e.target.checked ? 'auto' : 'gps'; render(); };
  $app.querySelectorAll('[data-time]').forEach((el) => {
    el.onchange = () => {
      if (!el.value) return;
      const k = el.dataset.time;
      let diff = minutesOf(el.value) - minutesOf(hm(raw[k]));
      if (diff > 720) diff -= 1440;
      if (diff < -720) diff += 1440;
      f.offsets[k] = diff;
      render();
    };
  });
  $app.querySelectorAll('[data-reset]').forEach((b) => { b.onclick = () => { delete f.offsets[b.dataset.reset]; render(); }; });
  const ra = $app.querySelector('#resetAll');
  if (ra) ra.onclick = () => { f.offsets = {}; render(); };

  $app.querySelector('#toThemes').onclick = () => go('themes');
  $app.querySelector('#statsT').onchange = (e) => { setStatsEnabled(e.target.checked); toast(e.target.checked ? 'Anonim statistika yoqildi' : 'Statistika yuborilmaydi'); };
  bindNotify(f);
  $app.querySelector('#shareBtn').onclick = shareApp;
  const cu = $app.querySelector('#checkUpd');
  if (cu) cu.onclick = async () => {
    await checkUpdate();
    if (!newVersion) toast(navigator.onLine ? `Sizda eng yangi versiya (v${APP_VERSION})` : 'Tekshirish uchun internet kerak.');
  };
  $app.querySelector('#supportBtn').onclick = () => go('support');
  $app.querySelector('#learnBtn').onclick = () => go('learn');
  $app.querySelector('#save').onclick = () => {
    const settings = { ...s, name: f.name.trim(), dailyGoal: Number(f.dailyGoal) || 0, includeVitr: f.includeVitr,
      city: f.city, lat: f.lat, lng: f.lng, countryCode: f.countryCode, method: f.method, methodAuto: f.methodAuto,
      madhab: f.madhab, fajrAngle: Number(f.fajrAngle) || 15, ishaAngle: Number(f.ishaAngle) || 15,
      source: f.source, autoLocation: f.autoLocation, offsets: { ...f.offsets }, notify: { ...f.notify } };
    form = null;
    applyOfficial(settings);
    save({ ...state, settings });
    toast('✓ Saqlandi');
    refreshOfficial(settings).then((ch) => ch && render());
  };
  $app.querySelector('#export').onclick = exportBackup;
  $app.querySelector('#importFile').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (data?.app !== 'namoz-qazo' || !data.state?.qazo) throw new Error();
      const when = data.at ? fmtDate(new Date(data.at)) : 'noma’lum sana';
      if (!confirm(`${when} dagi zaxira tiklansinmi?\nHozirgi ma’lumotlar shu zaxira bilan almashtiriladi.`)) { e.target.value = ''; return; }
      screen = 'home'; form = null;
      const next = { ...EMPTY, ...data.state, done: data.state.done || {} };
      applyOfficial(next.settings);
      save(next);
      toast('Zaxira tiklandi.');
    } catch { toast('Zaxira fayli noto‘g‘ri.'); }
  };
  $app.querySelector('#reset').onclick = () => {
    if (!confirm('Barcha ma’lumotlar o‘chadi. Davom etasizmi?')) return;
    try { localStorage.removeItem(KEY); } catch {}
    state = { ...EMPTY }; screen = 'home'; form = null; render();
  };
}

/* ---------------- Zaxira ---------------- */
async function exportBackup() {
  const now = new Date();
  const json = JSON.stringify({ app: 'namoz-qazo', v: 1, at: now.getTime(), state: { ...state, lastBackup: now.getTime() } });
  const name = `namoz-qazo-zaxira-${dayKey(now)}.json`;
  const text = `Namoz va Qazo — zaxira nusxa (${fmtDate(now)}). Qazo qoldi: ${totalQazo(state)} ta.`;
  let ok = false;
  try {
    if (isNative()) {
      const FS = window.Capacitor?.Plugins?.Filesystem, SH = window.Capacitor?.Plugins?.Share;
      const { uri } = await FS.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
      await SH.share({ title: 'Zaxira nusxa', text, files: [uri], dialogTitle: 'Zaxirani qayerga saqlaysiz?' });
      ok = true;
    } else {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Zaxira nusxa', text }); ok = true; }
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        ok = true;
      }
    }
  } catch (e) {
    if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return;
    return toast('Zaxira saqlanmadi. Qayta urinib ko‘ring.');
  }
  if (ok) { save({ ...state, lastBackup: now.getTime(), backupSnooze: 0 }); toast('✓ Zaxira tayyor. Faylni xavfsiz joyda saqlang.'); }
}

// 14 kundan beri zaxira olinmagan bo'lsa — bosh sahifada eslatma
function backupDue() {
  const used = totalDone(state) > 0 || Object.keys(state.log || {}).length >= 7;
  if (!used) return false;
  if ((state.backupSnooze || 0) > Date.now()) return false;
  return !state.lastBackup || Date.now() - state.lastBackup > 14 * 86400000;
}

/* ---------------- Bildirishnoma sozlamalari ---------------- */
function notifyHtml(f) {
  if (!isNative()) {
    return `<p class="hint">Namoz vaqti kirganda va tugashidan oldin eslatma faqat <b>Android ilovada</b> ishlaydi
      (brauzer yopiq ilovaga bildirishnoma yubora olmaydi). Qazo hisobi va sozlamalaringizni “Zaxira” orqali o‘tkazishingiz mumkin.</p>
      ${PLAY_LIVE ? `<a class="btn primary" href="${PLAY_URL}">▶️ Google Play’dan o‘rnatish</a>`
        : `<a class="btn primary" href="${APK_URL}">📥 Android ilovani yuklab olish (APK)</a>`}`;
  }
  const n = f.notify;
  const perm = notifyStatus.permission;
  const befores = [0, 10, 15, 20, 30, 45, 60];
  return `
    ${perm !== 'granted' ? `<div class="note" style="padding-right:14px">🔕 Bildirishnomalarga ruxsat berilmagan.
      <button class="btn primary" id="askPerm">Ruxsat berish</button></div>` : ''}
    ${perm === 'granted' && notifyStatus.exact === 'denied' ? `<div class="note" style="padding-right:14px">⏱ Eslatmalar bir necha daqiqa kechikishi mumkin.
      Aniq vaqtda kelishi uchun “Signal va eslatmalar” ruxsatini yoqing.<button class="btn" id="askExact">Ruxsatni yoqish</button></div>` : ''}
    <div class="switch"><span>Bildirishnomalar</span><input type="checkbox" id="nEnabled" ${n.enabled ? 'checked' : ''} /></div>
    ${n.enabled ? `
      <div class="switch"><span>Namoz vaqti kirganda</span><input type="checkbox" id="nStart" ${n.start ? 'checked' : ''} /></div>
      <label>Vaqt tugashidan oldin eslatish<br><span class="sub">“O‘qidim” belgilangan bo‘lsa, kelmaydi</span></label>
      <select id="nBefore">${befores.map((m) => `<option value="${m}" ${Number(n.before) === m ? 'selected' : ''}>${m ? `${m} daqiqa oldin` : 'Eslatmasin'}</option>`).join('')}</select>
      <label>Har kuni qazo o‘qish eslatmasi</label>
      <div class="row"><input type="time" id="nDaily" value="${esc(n.daily)}" />
        ${n.daily ? '<button id="nDailyOff" style="padding:12px 14px">O‘chirish</button>' : ''}</div>
      <button class="btn" id="nTest">🔔 Sinab ko‘rish (5 soniyadan keyin)</button>` : ''}`;
}

function bindNotify(f) {
  if (!isNative()) return;
  const before = `${notifyStatus.permission}|${notifyStatus.exact}`;
  refreshStatus().then((st) => { if (screen === 'settings' && `${st.permission}|${st.exact}` !== before) render(); });
  const on = (id, ev, fn) => { const el = $app.querySelector(id); if (el) el[ev] = fn; };
  on('#askPerm', 'onclick', async () => { await requestPermission(); render(); });
  on('#askExact', 'onclick', async () => { await openExactSetting(); render(); });
  on('#nEnabled', 'onchange', (e) => { f.notify.enabled = e.target.checked; render(); });
  on('#nStart', 'onchange', (e) => { f.notify.start = e.target.checked; });
  on('#nBefore', 'onchange', (e) => { f.notify.before = Number(e.target.value); });
  on('#nDaily', 'onchange', (e) => { f.notify.daily = e.target.value; render(); });
  on('#nDailyOff', 'onclick', () => { f.notify.daily = ''; render(); });
  on('#nTest', 'onclick', async () => {
    if (notifyStatus.permission !== 'granted' && !(await requestPermission())) return toast('Avval bildirishnomaga ruxsat bering.');
    await testNotification();
    toast('5 soniyadan keyin sinov bildirishnomasi keladi. Ilovani yopib ko‘rishingiz mumkin.');
  });
}

/* ---------------- Ulashish va qo'llab-quvvatlash ---------------- */
async function shareApp() {
  const data = { title: 'Namoz va Qazo', text: SHARE_TEXT, url: SHARE_URL };
  const NS = window.Capacitor?.Plugins?.Share;
  if (isNative() && NS) {
    try { await NS.share({ ...data, dialogTitle: 'Ulashish' }); return; } catch { return; }
  }
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  window.open(`https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`, '_blank');
}

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { prompt('Nusxa oling:', text); }
}

const hasSupport = () => Boolean(SUPPORT.payme || SUPPORT.click || SUPPORT.card);

function shareCardHtml() {
  return `
    <div class="card share">
      <h2>Ilova foydali bo‘lsa</h2>
      <p class="sub" style="margin:0 0 12px">Yaqinlaringizga ulashing. “Yaxshilikka yo‘l ko‘rsatgan kishiga uni qilgan kishining savobi kabi savob bor” (Muslim rivoyati).</p>
      <button class="btn primary" id="shareHome">📤 Do‘stlarga ulashish</button>
      <button class="btn" id="supportHome">🤲 Loyihani qo‘llab-quvvatlash</button>
    </div>`;
}
function bindShareCard() {
  $app.querySelector('#shareHome').onclick = shareApp;
  $app.querySelector('#supportHome').onclick = () => go('support');
}

function renderSupport() {
  const pay = [];
  if (SUPPORT.payme) pay.push(`<a class="btn pay" href="${esc(SUPPORT.payme)}" target="_blank" rel="noopener">Payme orqali</a>`);
  if (SUPPORT.click) pay.push(`<a class="btn pay" href="${esc(SUPPORT.click)}" target="_blank" rel="noopener">Click orqali</a>`);
  if (SUPPORT.card) pay.push(`
    <div class="cardno">
      <div class="grow"><div class="sub">Karta raqami${SUPPORT.cardOwner ? ` · ${esc(SUPPORT.cardOwner)}` : ''}</div>
        <div class="num">${esc(SUPPORT.card)}</div></div>
      <button id="copyCard">Nusxa</button>
    </div>`);

  $app.innerHTML = `
    <div class="row" style="margin:6px 0 4px"><button class="icon" id="back" aria-label="Orqaga">←</button><h1>Qo‘llab-quvvatlash</h1></div>
    <p class="sub" style="line-height:1.6;margin-top:16px">
      Bu ilova bepul va reklamasiz. Uning asosiy imkoniyatlari — namoz vaqtlari va qazo hisobi — doim bepul qoladi.
      Loyihani rivojlantirishga (azon bildirishnomalari, Play Market versiyasi, yangi tillar) yordam bermoqchi bo‘lsangiz:
    </p>

    <div class="section">Ehson</div>
    ${pay.length ? pay.join('') : '<p class="hint">Ehson qilish usullari tez orada qo‘shiladi.</p>'}
    <p class="hint">Har qanday miqdor ixtiyoriy. Ilovadan foydalanish uchun to‘lov shart emas.</p>

    <div class="section">Pulsiz yordam</div>
    <button class="btn primary" id="shareSup">📤 Do‘stlarga ulashish</button>
    <button class="btn" id="copyLink">🔗 Havolani nusxalash</button>
    ${SUPPORT.telegram ? `<a class="btn pay" href="${esc(SUPPORT.telegram)}" target="_blank" rel="noopener">💬 Fikr va taklif yuborish</a>` : ''}
    <p class="hint">Ilovani ishlatib, xato yoki noto‘g‘ri vaqtni ko‘rsangiz, xabar bering — bu ham katta yordam.</p>`;

  $app.querySelector('#back').onclick = () => go('settings');
  $app.querySelector('#shareSup').onclick = shareApp;
  $app.querySelector('#copyLink').onclick = () => copyText(SHARE_URL, 'Havola nusxalandi');
  const cc = $app.querySelector('#copyCard');
  if (cc) cc.onclick = () => copyText(SUPPORT.card.replace(/\s/g, ''), 'Karta raqami nusxalandi');
}

function bindInputs(f) {
  $app.querySelectorAll('[data-f]').forEach((el) => { el.oninput = el.onchange = () => { f[el.dataset.f] = el.value; }; });
}

/* ---------------- Android "Orqaga" tugmasi ---------------- */
const BACK_TO = { estimate: 'qazo', support: 'settings', history: 'calendar', achievements: 'stats', themes: 'menu', learn: 'menu', settings: 'menu' };
function onBack() {
  const sheet = document.querySelector('.sheet-bg');
  if (sheet) return sheet.remove();
  if (!state.settings) return window.Capacitor?.Plugins?.App?.minimizeApp?.();
  if (screen === 'quote') return go(quoteFrom);
  if (BACK_TO[screen]) return go(BACK_TO[screen]);
  if (screen !== 'home') return go('home');
  window.Capacitor?.Plugins?.App?.minimizeApp?.(); // bosh sahifada — ilovani yig'ish (yopmasdan)
}
try { if (isNative()) window.Capacitor?.Plugins?.App?.addListener('backButton', onBack); } catch {}
onNotificationTap((id) => openQuote(id));

/* ---------------- Ishga tushirish ---------------- */
if (location.search.includes('v=')) history.replaceState(null, '', location.pathname);
applyTheme();
applyOfficial(state.settings);
render();
check();
restoreFromMirror();
syncWidget(state, true);
trackOpen(APP_VERSION, Boolean(state.settings));
if (state.settings) mirror(JSON.stringify(state));
if (state.settings) {
  refreshOfficial(state.settings).then((ch) => { if (ch && screen === 'home') render(); reschedule(state, true); });
  autoLocate();
}
checkUpdate();
setInterval(checkUpdate, 30 * 60000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  checkUpdate();
  syncWidget(state);
  reschedule(state);
  if (screen !== 'home') return;
  check();
  autoLocate();
});
setInterval(() => { if (screen === 'home') check(); }, 60000);
