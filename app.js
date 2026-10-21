import {
  METHODS, NAMES, PRAYERS, TIME_KEYS, TIME_NAMES, activePrayers, addDays, baseTimes, currentPrayerDay, dayKey, dayWindows,
  estimatedFinish, fmtDate, fmtTime, initialQazo, parseDate, processMissed, suggestMethod, togglePrayed, totalQazo,
  undoQazo, UNDO_DAYS,
} from './prayer.js';
import { CHANNEL } from './channel.js';
import {
  detectLocation, distanceKm, locationErrorText, permissionGranted, placeName, quietPosition, searchCity,
} from './location.js';
import { applyOfficial, refreshOfficial } from './official.js';
import {
  APK_URL, DEFAULT_NOTIFY, isNative, notifyStatus, openExactSetting, refreshStatus, requestPermission, reschedule, testNotification,
} from './notify.js';
import { LEARN_DISCLAIMER, LEARN_SECTIONS } from './learn.js';
import { MONTHS, WEEKDAYS, achievements, dayDone, monthGrid, recordDone, streak, summary, weekBars } from './stats.js';

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
export const APP_VERSION = '16';
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
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ---------------- Mavzu (yorug' / qorong'i) ---------------- */
const THEME_KEY = 'namoz-theme';
const getTheme = () => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } };
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => getTheme() === 'dark' || (getTheme() === 'auto' && darkMQ.matches);
function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark() ? 'dark' : 'light');
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
  if (meta) meta.content = hero ? '#0E8A63' : getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F4F2EA';
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
  if (list.length) toast('Qazo hisobiga qo‘shildi\n' + list.join('\n'));
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
  ['home', 'Asosiy', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ['qazo', 'Qazo', '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>'],
  ['stats', 'Statistika', '<path d="M4 20V11M10 20V5M16 20v-6M2 20h20"/>'],
  ['calendar', 'Kalendar', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ['learn', 'Qo‘llanma', '<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5c-3-.5-6 0-8 1.5z"/><path d="M12 6v14.5"/>'],
  ['settings', 'Sozlama', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'],
];
function tabbarHtml() {
  const active = screen === 'support' ? 'settings' : screen;
  return `<nav class="tabbar"><div class="in">${TABS.map(([id, label, svg]) => `
    <button class="tab ${active === id ? 'on' : ''}" data-tab="${id}" aria-label="${label}">
      <span class="ti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>${label}
    </button>`).join('')}</div></nav>`;
}
function go(to) {
  if (screen === 'settings' && to !== 'settings') applyOfficial(state.settings);
  screen = to; form = null; render();
}

let lastScreen = null;
function render() {
  const cur = state.settings ? screen : 'setup';
  const changed = cur !== lastScreen;
  if (changed) { lastScreen = cur; window.scrollTo(0, 0); }
  $app.className = '';
  if (!state.settings) { renderSetup(); $app.classList.add('no-tabs'); }
  else if (screen === 'settings') renderSettings();
  else if (screen === 'support') renderSupport();
  else if (screen === 'qazo') renderQazo();
  else if (screen === 'stats') renderStats();
  else if (screen === 'calendar') renderCalendar();
  else if (screen === 'learn') renderLearn();
  else { renderHome(); $app.classList.add('has-hero'); }
  if (changed) $app.classList.add('fade');
  if (newVersion) {
    const html = `<div class="update"><span class="grow">🔄 Yangi versiya mavjud</span><button id="doUpdate">Yangilash</button></div>`;
    const hero = $app.querySelector('.hero');
    if (hero) hero.insertAdjacentHTML('afterend', html); else $app.insertAdjacentHTML('afterbegin', html);
    $app.querySelector('#doUpdate').onclick = applyUpdate;
  }
  if (state.settings) {
    $app.insertAdjacentHTML('beforeend', tabbarHtml());
    $app.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => go(b.dataset.tab); });
  }
  applyBars();
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
function ringSvg(value, max, size = 108, stroke = 10) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${pct >= 1 ? 'var(--gold-bright)' : 'var(--accent)'}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>`;
}
const bar = (value, max, thin) => `<div class="bar${thin ? ' thin' : ''}"><i style="width:${max > 0 ? Math.min(100, (value / max) * 100) : 0}%"></i></div>`;

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
  const st = streak(state, now);
  const hour = now.getHours();
  const greet = hour < 11 ? 'Xayrli tong' : hour < 17 ? 'Assalomu alaykum' : 'Xayrli kech';

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

  $app.innerHTML = `
    <header class="hero">
      <div class="row">
        <div class="grow">
          <div class="sub">${greet}</div>
          <h1>${esc(s.name) || 'Do‘stim'}</h1>
          <div class="sub">📍 ${esc(s.city)} · ${fmtDate(day)}</div>
        </div>
        ${st.current ? `<div class="pill" style="background:rgba(255,255,255,.14);color:#fff">🔥 ${st.current} kun</div>` : ''}
      </div>
      ${nx ? `<div class="next">
        <div class="grow">
          <div class="label">${live ? `Hozir: ${NAMES[live]} · keyingisi` : 'Keyingi namoz'}</div>
          <div class="name">${ICONS[nx.p]} ${NAMES[nx.p]} <span style="font-weight:600;opacity:.85">${hm(nx.at)}</span></div>
        </div>
        <div class="count"><b>${untilText(nx.at - now)}</b><span>qoldi</span></div>
      </div>` : ''}
    </header>
    ${installHtml(false)}
    ${s.excused ? `<div class="install-card" style="border-color:var(--gold-bright)">
      <div class="ic-title">🌸 Uzrli kunlar rejimi yoqilgan</div>
      <div class="ic-text">Vaqti o‘tgan namozlar qazo hisobiga qo‘shilmaydi, eslatmalar yuborilmaydi.</div>
      <button class="btn gold" id="exOff">Tugadi — o‘chirish</button></div>` : ''}

    <div class="section">Bugungi namozlar</div>
    ${prayers}
    <p class="hint">${sourceText(times, s)}${edited ? ' · qo‘lda tuzatilgan' : ''}.
      Vaqti tugaguncha “O‘qidim” bosilmasa, namoz avtomatik qazo hisobiga qo‘shiladi.
      O‘qib, belgilashni unutgan bo‘lsangiz — “Qazo ↺” ni bosing.</p>

    <div class="card">
      <div class="card-head"><h2>Bugungi qazo rejasi</h2><span class="pill ${sm.goal && sm.today >= sm.goal ? 'green' : ''}">${sm.today} / ${sm.goal}</span></div>
      ${bar(sm.today, sm.goal)}
      <div class="row" style="margin-top:10px">
        <div class="grow sub">Jami qoldi: <b style="color:var(--text)">${num(sm.remaining)}</b></div>
        <div class="sub">${sm.pct}% ado qilindi</div>
      </div>
      <button class="btn primary" id="toQazo">Qazo ado qilish →</button>
    </div>

    <button class="learn-card" id="toLearn">
      <span class="lc-i">📚</span>
      <span class="grow"><b>Namoz va qazo qo‘llanmasi</b><br><span class="sub">O‘qish tartibi, qazo niyati, zikrlar — rasmiy manbalar asosida</span></span>
      <span class="lc-a">›</span>
    </button>

    ${shareCardHtml()}`;

  bindInstall();
  bindShareCard();
  $app.querySelector('#toLearn').onclick = () => go('learn');
  $app.querySelector('#toQazo').onclick = () => go('qazo');
  $app.querySelectorAll('[data-pray]').forEach((b) => {
    b.onclick = () => save(togglePrayed(state, day, b.dataset.pray, new Date()));
  });
  $app.querySelectorAll('[data-undo]').forEach((b) => { b.onclick = () => askUndo(key, b.dataset.undo); });
  const ex = $app.querySelector('#exOff');
  if (ex) ex.onclick = () => setExcused(false);
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
function doneAction(p, delta) {
  const now = new Date();
  const beforeAch = new Set(achievements(state, now).filter((a) => a.unlocked).map((a) => a.id));
  const goal = Number(state.settings.dailyGoal) || 0;
  const todayBefore = dayDone(state, dayKey(now));
  let next;
  if (delta > 0) {
    next = recordDone(state, p, 1, now);
    if (next === state) return toast(`${NAMES[p]} bo‘yicha qazo qolmagan.`);
  } else if ((state.done?.[dayKey(now)]?.[p] || 0) > 0) {
    next = recordDone(state, p, -1, now);
    toast(`Bekor qilindi: ${NAMES[p]} +1`);
  } else {
    next = { ...state, qazo: { ...state.qazo, [p]: (state.qazo[p] || 0) + 1 } };
    toast(`${NAMES[p]}: qazo hisobiga +1 qo‘shildi`);
  }
  save(next);
  if (delta > 0) {
    const fresh = achievements(next, now).filter((a) => a.unlocked && !beforeAch.has(a.id));
    if (fresh.length) toast(`${fresh[0].icon} Yangi yutuq: ${fresh[0].title}!`, 5000);
    else if (goal && todayBefore < goal && todayBefore + 1 >= goal) toast('🎉 Bugungi maqsad bajarildi! Alloh qabul qilsin.', 5000);
    else if (totalQazo(next) === 0) toast('🌙 Barcha qazolar ado qilindi! Alloh qabul qilsin.', 6000);
  }
}

function renderQazo() {
  const s = state.settings;
  const now = new Date();
  const sm = summary(state, now);
  const todayDone = state.done?.[dayKey(now)] || {};
  const finish = estimatedFinish(state, now);

  const rows = activePrayers(s).map((p) => `
    <div class="qrow">
      <div class="p-ico">${ICONS[p]}</div>
      <div class="grow">
        <div class="pname">${NAMES[p]}</div>
        <div class="row" style="gap:8px"><span class="qn">${num(state.qazo[p])}</span><span class="sub">qoldi</span>
          ${todayDone[p] ? `<span class="today">· bugun ${todayDone[p]} ✓</span>` : ''}</div>
      </div>
      <button class="ado" data-ado="${p}" ${(state.qazo[p] || 0) <= 0 ? 'disabled' : ''}>✓ Ado qildim</button>
      <button class="plus" data-plus="${p}" aria-label="${NAMES[p]}: bekor qilish yoki qo‘shish">＋</button>
    </div>`).join('');

  $app.innerHTML = `
    <div class="page-title">Qazo namozlar</div>

    <div class="card" style="margin-top:0">
      <div class="row" style="gap:16px">
        <div class="ring">${ringSvg(sm.today, sm.goal)}<div class="rt"><div><b>${sm.today}</b><span>/ ${sm.goal}</span></div></div></div>
        <div class="grow">
          <h2 style="margin:0">Bugungi reja</h2>
          <div class="sub" style="margin:4px 0 10px">Bugun nechta qazo ado qilasiz?</div>
          <div class="stepper"><button id="gMinus" aria-label="Kamaytirish">−</button><b>${sm.goal}</b><button id="gPlus" aria-label="Ko‘paytirish">＋</button></div>
        </div>
      </div>
      ${sm.goal && sm.today >= sm.goal ? '<div class="finish">🎉 Bugungi maqsad bajarildi</div>' : ''}
    </div>

    <div class="card">
      <div class="card-head"><h2>Jami qoldi</h2><span class="pill green">${sm.pct}% ado qilindi</span></div>
      <div class="big">${num(sm.remaining)}</div>
      ${bar(sm.total, sm.total + sm.remaining)}
      <div class="sub" style="margin-top:8px">Ado qilingan: <b style="color:var(--text)">${num(sm.total)}</b></div>
      ${finish ? `<div class="finish">Kuniga ${sm.goal} tadan — taxminiy tugash: ${fmtDate(finish)}</div>` : ''}
    </div>

    ${s.gender === 'ayol' || s.excused ? `<div class="card">
      <div class="switch" style="margin-top:0"><span><b>🌸 Uzrli kunlar (hayz/nifos)</b><br>
        <span class="sub">Yoqilganda vaqti o‘tgan namozlar qazoga qo‘shilmaydi</span></span>
        <input type="checkbox" id="exToggle" ${s.excused ? 'checked' : ''} /></div></div>` : ''}

    <div class="section">Namozlar bo‘yicha</div>
    ${rows}
    <button class="learn-card" id="toLearnQ" style="margin-top:16px">
      <span class="lc-i">💭</span>
      <span class="grow"><b>Qazo qanday o‘qiladi va niyat qilinadi?</b><br><span class="sub">Qo‘llanmani ochish</span></span>
      <span class="lc-a">›</span>
    </button>
    <p class="hint"><b>✓ Ado qildim</b> — bitta qazo o‘qildi, hisobdan ayriladi va bugungi natijangizga yoziladi.<br>
      <b>＋</b> — bugun xato bosgan bo‘lsangiz bekor qiladi, aks holda qazo hisobiga bitta qo‘shadi.</p>`;

  const setGoal = (v) => save({ ...state, settings: { ...s, dailyGoal: Math.max(0, Math.min(100, v)) } });
  $app.querySelector('#gMinus').onclick = () => setGoal((Number(s.dailyGoal) || 0) - 1);
  $app.querySelector('#gPlus').onclick = () => setGoal((Number(s.dailyGoal) || 0) + 1);
  $app.querySelectorAll('[data-ado]').forEach((b) => { b.onclick = () => doneAction(b.dataset.ado, 1); });
  $app.querySelector('#toLearnQ').onclick = () => { learnOpen = 'qazo'; go('learn'); };
  const ext = $app.querySelector('#exToggle');
  if (ext) ext.onchange = (e) => setExcused(e.target.checked);
  $app.querySelectorAll('[data-plus]').forEach((b) => { b.onclick = () => doneAction(b.dataset.plus, -1); });
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
function renderStats() {
  const now = new Date();
  const sm = summary(state, now);
  const st = streak(state, now);
  const bars = weekBars(state, now);
  const max = Math.max(sm.goal, ...bars.map((b) => b.n), 1);
  const ach = achievements(state, now);
  const unlocked = ach.filter((a) => a.unlocked).length;
  const finish = estimatedFinish(state, now);
  const H = '88px'; // grafik ustunining eng katta balandligi

  $app.innerHTML = `
    <div class="page-title">Statistika</div>
    <div class="tiles">
      <div class="tile"><div class="v">${sm.today}<span class="sub" style="font-size:15px"> / ${sm.goal}</span></div><div class="k">Bugun</div></div>
      <div class="tile"><div class="v">${num(sm.week)}</div><div class="k">Bu hafta</div></div>
      <div class="tile"><div class="v">${num(sm.month)}</div><div class="k">${MONTHS[now.getMonth()]} oyida</div></div>
      <div class="tile"><div class="v">${num(sm.total)}</div><div class="k">Jami ado qilingan</div></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Umumiy progress</h2><b style="color:var(--accent);font-size:20px">${sm.pct}%</b></div>
      ${bar(sm.total, sm.total + sm.remaining)}
      <div class="row" style="margin-top:10px"><div class="grow sub">Ado qilindi: <b style="color:var(--text)">${num(sm.total)}</b></div>
        <div class="sub">Qoldi: <b style="color:var(--text)">${num(sm.remaining)}</b></div></div>
      ${finish ? `<div class="finish">Taxminiy tugash: ${fmtDate(finish)}</div>` : ''}
    </div>

    <div class="card">
      <div class="card-head"><h2>Bu hafta</h2><span class="sub">${num(sm.week)} ta</span></div>
      <div class="chart">
        ${sm.goal ? `<div class="goal-line" style="bottom:calc(22px + ${H} * ${sm.goal / max})"><span>maqsad ${sm.goal}</span></div>` : ''}
        ${bars.map((b) => `<div class="col">
          <div class="n">${b.future ? '' : b.n}</div>
          <div class="b ${b.isToday ? 'today' : ''} ${b.n ? '' : 'zero'}" style="height:calc(${H} * ${b.n / max})"></div>
          <div class="d ${b.isToday ? 'today' : ''}">${b.label}</div></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="streak">
        <div class="fire">🔥</div>
        <div class="grow"><div class="v">${st.current} kun</div><div class="sub">ketma-ket qazo ado qilyapsiz</div></div>
        <div style="text-align:right"><div class="sub">Eng uzun</div><b style="font-size:20px">${st.best} kun</b></div>
      </div>
      <p class="hint">${st.current ? 'Davom eting — har kuni hech bo‘lmasa bitta qazo o‘qisangiz, zanjir uzilmaydi.' : 'Bugun bitta qazo o‘qing — zanjir boshlanadi.'}</p>
    </div>

    <div class="card goals">
      <h2>🎯 Maqsadlar</h2>
      ${[['Kunlik', sm.today, sm.goal], ['Haftalik', sm.week, sm.weekGoal], ['Oylik', sm.month, sm.monthGoal]].map(([l, v, g]) => `
        <div class="g"><div class="gl"><span>${l}</span><b>${num(v)} / ${num(g)}</b></div>${bar(v, g, true)}</div>`).join('')}
      <p class="hint">Maqsad kunlik reja asosida hisoblanadi (Qazo bo‘limida o‘zgartiriladi).</p>
    </div>

    <div class="section">Yutuqlar <span class="sub" style="font-weight:600">${unlocked} / ${ach.length}</span></div>
    <div class="ach">${ach.map((a) => `
      <div class="badge ${a.unlocked ? 'on' : 'off'}">
        <div class="bi">${a.icon}</div><div class="bt">${a.title}</div>
        <div class="bd">${a.unlocked ? a.desc : `${num(a.value)} / ${num(a.need)}`}</div>
      </div>`).join('')}</div>
    <p class="hint">Statistika ilovaning shu versiyasidan boshlab yuritiladi.</p>`;
}

/* ---------------- Kalendar ---------------- */
function renderCalendar() {
  const now = new Date();
  cal ||= { y: now.getFullYear(), m: now.getMonth(), sel: dayKey(now) };
  const goal = Number(state.settings.dailyGoal) || 0;
  const todayKey = dayKey(now);
  const cells = monthGrid(cal.y, cal.m);
  let monthTotal = 0, active = 0;
  const html = cells.map((d) => {
    if (!d) return '<div></div>';
    const k = dayKey(d);
    const n = dayDone(state, k);
    monthTotal += n; if (n) active++;
    const cls = [n && goal && n >= goal ? 'full' : n ? 'part' : '', k === todayKey ? 'today' : '', k === cal.sel ? 'sel' : '', k > todayKey ? 'future' : ''].join(' ');
    return `<button class="cell ${cls}" data-day="${k}">${d.getDate()}${n ? `<small>${n}</small>` : ''}</button>`;
  }).join('');

  const sel = new Date(`${cal.sel}T12:00:00`);
  const dd = state.done?.[cal.sel] || {};
  const lg = state.log?.[cal.sel] || {};
  const onTime = PRAYERS.slice(0, 5).filter((p) => lg[p] === 'prayed').length;
  const missed = PRAYERS.filter((p) => lg[p] === 'qazo').length;
  const n = dayDone(state, cal.sel);

  $app.innerHTML = `
    <div class="page-title">Kalendar</div>
    <div class="card" style="margin-top:0">
      <div class="cal-head">
        <button id="calPrev" aria-label="Oldingi oy">‹</button>
        <b>${MONTHS[cal.m]} ${cal.y}</b>
        <button id="calNext" aria-label="Keyingi oy">›</button>
      </div>
      <div class="cal">${WEEKDAYS.map((w) => `<div class="wd">${w}</div>`).join('')}${html}</div>
      <div class="legend">
        <span><i style="background:var(--accent)"></i>Maqsad bajarildi</span>
        <span><i style="background:var(--gold-soft);border:1px solid var(--gold-bright)"></i>Qisman</span>
        <span><i style="background:var(--card2)"></i>Ado qilinmagan</span>
      </div>
      <div class="row" style="margin-top:12px"><div class="grow sub">Bu oyda: <b style="color:var(--text)">${num(monthTotal)} ta</b> qazo</div>
        <div class="sub">${active} kun faol</div></div>
    </div>

    <div class="card">
      <h2>${dayTitle(sel)}</h2>
      <div class="dl"><span>Ado qilingan qazo</span><b>${n ? `${n} ta` : '—'}</b></div>
      ${PRAYERS.filter((p) => dd[p]).map((p) => `<div class="dl"><span class="sub">${ICONS[p]} ${NAMES[p]}</span><span>${dd[p]}</span></div>`).join('')}
      ${Object.keys(lg).length ? `
        <div class="dl"><span>O‘z vaqtida o‘qilgan</span><b>${onTime} / 5</b></div>
        <div class="dl"><span>Qazoga tushgan</span><b style="color:${missed ? 'var(--red)' : 'inherit'}">${missed}</b></div>
        ${PRAYERS.filter((p) => lg[p]).map((p) => {
          const st = lg[p];
          const canUndo = st === 'qazo' && cal.sel >= dayKey(addDays(now, -UNDO_DAYS));
          const txt = st === 'prayed' ? '<span style="color:var(--accent)">✓ o‘qilgan</span>'
            : st === 'excused' ? '<span class="sub">uzrli</span>'
            : canUndo ? `<button class="mini" data-cundo="${p}" style="color:var(--red)">Qazo ↺</button>` : '<span style="color:var(--red)">qazo</span>';
          return `<div class="dl"><span class="sub">${ICONS[p]} ${NAMES[p]}</span>${txt}</div>`;
        }).join('')}` : ''}
      ${goal && n >= goal ? '<div class="finish">🎯 Kunlik maqsad bajarilgan</div>' : ''}
    </div>`;

  const shift = (dm) => { const d = new Date(cal.y, cal.m + dm, 1); cal.y = d.getFullYear(); cal.m = d.getMonth(); render(); };
  $app.querySelector('#calPrev').onclick = () => shift(-1);
  $app.querySelector('#calNext').onclick = () => shift(1);
  $app.querySelectorAll('[data-day]').forEach((b) => { b.onclick = () => { cal.sel = b.dataset.day; render(); }; });
  $app.querySelectorAll('[data-cundo]').forEach((b) => { b.onclick = () => askUndo(cal.sel, b.dataset.cundo); });
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

/* ---------------- Boshlang'ich sozlash ---------------- */
function renderSetup() {
  form ||= { name: '', birth: '', gender: 'erkak', bulughAge: '12', start: '', hayzDays: '7', dailyGoal: '3',
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

    <div class="section">Eski qazolar (ixtiyoriy)</div>
    <p class="hint">Bo‘sh qoldirsangiz, hisob 0 dan boshlanadi. Keyin qo‘lda ham o‘zgartirsa bo‘ladi.</p>
    <label>Tug‘ilgan sana</label><input type="date" data-f="birth" value="${esc(f.birth)}" max="${dayKey(new Date())}" />
    <label>Balog‘at yoshi</label><input type="number" data-f="bulughAge" value="${esc(f.bulughAge)}" />
    <label>Namozni boshlagan sana</label><input type="date" data-f="start" value="${esc(f.start)}" max="${dayKey(new Date())}" />
    ${f.gender === 'ayol' ? `<label>Oyiga o‘rtacha hayz kunlari</label><input type="number" data-f="hayzDays" value="${esc(f.hayzDays)}" />` : ''}

    <div class="section">Sozlamalar</div>
    <label>Kunlik maqsad (nechta qazo)</label><input type="number" data-f="dailyGoal" value="${esc(f.dailyGoal)}" />
    <div class="switch"><span>Vitr namozini hisobga qo‘shish</span><input type="checkbox" id="vitr" ${f.includeVitr ? 'checked' : ''} /></div>

    <button class="btn primary" id="start" style="margin-top:24px">Boshlash</button>`;

  bindInstall();
  bindInputs(f);
  bindLocation(f);
  bindMethod(f);
  $app.querySelector('#vitr').onchange = (e) => { f.includeVitr = e.target.checked; };
  $app.querySelectorAll('[data-gender]').forEach((b) => { b.onclick = () => { f.gender = b.dataset.gender; render(); }; });
  $app.querySelector('#start').onclick = () => {
    if (f.lat == null) return toast('Avval joylashuvni aniqlang yoki shaharni tanlang.');
    let qazo = { ...EMPTY.qazo };
    if (f.birth || f.start) {
      const birth = parseDate(f.birth), start = parseDate(f.start);
      if (!birth) return toast('Tug‘ilgan sanani tanlang.');
      if (!start) return toast('Namozni boshlagan sanani tanlang.');
      if (start < birth) return toast('Namozni boshlagan sana tug‘ilgan sanadan keyin bo‘lishi kerak.');
      qazo = initialQazo({ birth, startDate: start, bulughAge: f.bulughAge, includeVitr: f.includeVitr, gender: f.gender, hayzDays: f.hayzDays });
    }
    const settings = {
      name: f.name.trim(), city: f.city, lat: f.lat, lng: f.lng, countryCode: f.countryCode || '',
      method: f.method, methodAuto: f.methodAuto, madhab: f.madhab, fajrAngle: Number(f.fajrAngle) || 15, ishaAngle: Number(f.ishaAngle) || 15,
      source: 'auto', autoLocation: true, offsets: {}, includeVitr: f.includeVitr, dailyGoal: Number(f.dailyGoal) || 0, gender: f.gender,
      notify: { ...DEFAULT_NOTIFY },
    };
    if (isNative()) requestPermission().then(() => reschedule(state, true));
    form = null;
    applyOfficial(settings);
    save({ ...EMPTY, qazo, lastProcessed: Date.now(), settings });
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
    <div class="seg">${[['auto', '📱 Avto'], ['light', '☀️ Yorug‘'], ['dark', '🌙 Qorong‘i']].map(([k, l]) =>
      `<button data-theme-set="${k}" class="${getTheme() === k ? 'on' : ''}">${l}</button>`).join('')}</div>
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
    <div class="switch"><span>Vitr hisobga qo‘shilsin</span><input type="checkbox" id="vitr" ${f.includeVitr ? 'checked' : ''} /></div>

    <button class="btn primary" id="save" style="margin-top:20px">Saqlash</button>

    <div class="section">Ilova haqida</div>
    ${IS_PLAY ? '' : '<button class="btn" id="checkUpd">🔄 Yangilanishni tekshirish</button>'}
    <button class="btn" id="shareBtn">📤 Do‘stlarga ulashish</button>
    <button class="btn" id="learnBtn">📚 Namoz va qazo qo‘llanmasi</button>
    <button class="btn" id="supportBtn">🤲 Loyihani qo‘llab-quvvatlash</button>
    <a class="btn" href="${APP_URL}privacy.html" target="_blank" rel="noopener">🔒 Maxfiylik siyosati</a>

    <div class="section">Zaxira</div>
    <button class="btn" id="export">Zaxira faylni yuklab olish</button>
    <label>Zaxira faylini tanlang</label><input type="file" id="importFile" accept=".json,application/json" />

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

  $app.querySelectorAll('[data-theme-set]').forEach((b) => { b.onclick = () => setTheme(b.dataset.themeSet); });
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
  $app.querySelector('#export').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'namoz-qazo', v: 1, state })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `namoz-qazo-zaxira-${dayKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $app.querySelector('#importFile').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (data?.app !== 'namoz-qazo' || !data.state?.qazo) throw new Error();
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
function onBack() {
  const sheet = document.querySelector('.sheet-bg');
  if (sheet) return sheet.remove();
  if (!state.settings) return window.Capacitor?.Plugins?.App?.minimizeApp?.();
  if (screen === 'support') return go('settings');
  if (screen !== 'home') return go('home');
  window.Capacitor?.Plugins?.App?.minimizeApp?.(); // bosh sahifada — ilovani yig'ish (yopmasdan)
}
try { if (isNative()) window.Capacitor?.Plugins?.App?.addListener('backButton', onBack); } catch {}

/* ---------------- Ishga tushirish ---------------- */
if (location.search.includes('v=')) history.replaceState(null, '', location.pathname);
applyTheme();
applyOfficial(state.settings);
render();
check();
restoreFromMirror();
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
  reschedule(state);
  if (screen !== 'home') return;
  check();
  autoLocate();
});
setInterval(() => { if (screen === 'home') check(); }, 60000);
