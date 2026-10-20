import {
  METHODS, NAMES, TIME_KEYS, TIME_NAMES, activePrayers, baseTimes, currentPrayerDay, dayKey, dayWindows,
  estimatedFinish, fmtDate, fmtTime, initialQazo, parseDate, processMissed, suggestMethod, togglePrayed, totalQazo,
} from './prayer.js';
import {
  detectLocation, distanceKm, locationErrorText, permissionGranted, placeName, quietPosition, searchCity,
} from './location.js';
import { applyOfficial, refreshOfficial } from './official.js';

// ===== Qo'llab-quvvatlash sozlamalari: o'z ma'lumotlaringizni yozing (bo'sh qolsa ko'rinmaydi) =====
const SUPPORT = {
  payme: '',        // masalan: 'https://payme.uz/@sizning_nomingiz'
  click: '',        // Click to'lov havolasi
  card: '',         // karta raqami, masalan: '8600 1234 5678 9012'
  cardOwner: '',    // karta egasi: 'Sanjarbek X.'
  telegram: '',     // fikr va takliflar uchun: 'https://t.me/sizning_username'
};
const APP_URL = 'https://sanjar97a.github.io/qazo-namoz/';
const SHARE_TEXT = 'Namoz va Qazo — namoz vaqtlari (dunyoning istalgan joyida) va qazo namozlar hisobi. Bepul, internetsiz ishlaydi.';

// ===== Har yangi versiyada: shu raqamni, version.json va sw.js dagi VERSION ni bir xil oshiring =====
export const APP_VERSION = '6';
let newVersion = null;

const KEY = 'namoz-qazo-state-v1';
const EMPTY = { settings: null, qazo: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, vitr: 0 }, log: {}, lastProcessed: null };
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();

const $app = document.getElementById('app');
let state = load();
let screen = 'home';
let form = null;
let installEvt = null;

function load() {
  try { const r = localStorage.getItem(KEY); return r ? { ...EMPTY, ...JSON.parse(r) } : { ...EMPTY }; }
  catch { return { ...EMPTY }; }
}
function save(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  render();
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hm = (d) => fmtTime(d);
const minutesOf = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };

function toast(msg, ms = 4500) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ---------------- Ilova sifatida o'rnatish ---------------- */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Ilova o‘rnatildi. Endi bosh ekrandan oching.'); render(); });

function installHtml(force) {
  if (isStandalone()) return '';
  if (installEvt) return '<button class="btn install" id="install">📲 Telefonga ilova qilib o‘rnatish</button>';
  let hidden = false;
  try { hidden = localStorage.getItem('install-note-hidden') === '1'; } catch {}
  if (hidden && !force) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="note">
    ${force ? '' : '<button class="x" id="hideInstall" aria-label="Yopish">×</button>'}
    📲 <b>Ilova qilib o‘rnatish:</b> ${ios
      ? 'Safari’da oching → “Ulashish” ⬆︎ → <b>“На экран Домой / Add to Home Screen”</b>.'
      : 'sahifani <b>Chrome</b>’da oching (Telegram ichida emas) → ⋮ menyu → <b>“Ilovani o‘rnatish”</b> yoki <b>“Bosh ekranga qo‘shish”</b>.'}
  </div>`;
}
function bindInstall() {
  const b = $app.querySelector('#install');
  if (b) b.onclick = async () => { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; render(); };
  const x = $app.querySelector('#hideInstall');
  if (x) x.onclick = () => { try { localStorage.setItem('install-note-hidden', '1'); } catch {} render(); };
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

/* ---------------- Ekranlar ---------------- */
function render() {
  if (!state.settings) renderSetup();
  else if (screen === 'settings') renderSettings();
  else if (screen === 'support') renderSupport();
  else renderHome();
  if (newVersion) {
    $app.insertAdjacentHTML('afterbegin', `<div class="update"><span class="grow">🔄 Yangi versiya mavjud</span><button id="doUpdate">Yangilash</button></div>`);
    $app.querySelector('#doUpdate').onclick = applyUpdate;
  }
}

/* ---------------- Yangilanish ---------------- */
async function checkUpdate() {
  if (!navigator.onLine) return;
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const v = String((await r.json()).version || '');
    if (v && v !== APP_VERSION && v !== newVersion) { newVersion = v; render(); }
  } catch {}
  try { (await navigator.serviceWorker?.getRegistration())?.update(); } catch {}
}

// Faqat ilova fayllari keshi tozalanadi — sizning ma'lumotlaringiz (qazo, sozlamalar) saqlanib qoladi
async function applyUpdate() {
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

function renderHome() {
  const s = state.settings;
  const now = new Date();
  const day = currentPrayerDay(now, s);
  const { windows, times } = dayWindows(day, s);
  const key = dayKey(day);
  const finish = estimatedFinish(state, now);
  const edited = TIME_KEYS.some((k) => Number(s.offsets?.[k]));

  const prayers = activePrayers(s).map((p) => {
    const w = windows[p];
    const mark = state.log[key]?.[p];
    const live = now >= w.start && now < w.end;
    let label = 'Kutilmoqda', style = 'color:var(--sub)';
    if (mark === 'prayed') { label = '✓ O‘qildi'; style = 'color:var(--green);border-color:var(--green)'; }
    else if (mark === 'qazo') { label = 'Qazo'; style = 'color:var(--red);border-color:var(--red)'; }
    else if (live) { label = 'O‘qidim'; style = 'background:var(--blue);border-color:var(--blue);color:#fff'; }
    else if (now >= w.end) { label = '—'; }
    const sunrise = p === 'fajr' ? `<div class="sub">Quyosh chiqishi: ${hm(times.sunrise)}</div>` : '';
    return `
      <div class="prayer ${live ? 'live' : ''}">
        <div class="grow">
          <div class="pname">${NAMES[p]}${p === 'vitr' ? ' <span class="sub">(vojib)</span>' : ''}</div>
          <div class="sub">${hm(w.start)} – ${hm(w.end)}</div>${sunrise}
        </div>
        <button class="mark" style="${style}" data-pray="${p}" ${!live || mark === 'qazo' ? 'disabled' : ''}>${label}</button>
      </div>`;
  }).join('');

  const counters = activePrayers(s).map((p) => `
    <div class="q">
      <b>${NAMES[p]}</b>
      <div class="num">${state.qazo[p] || 0}</div>
      <button style="color:var(--orange);border-color:var(--orange)" data-q="${p}" data-d="-1">−</button>
      <button style="color:var(--blue);border-color:var(--blue)" data-q="${p}" data-d="1">+</button>
    </div>`).join('');

  $app.innerHTML = `
    <div class="row">
      <div class="grow">
        <div class="sub">Assalomu alaykum</div>
        <h1>${esc(s.name) || 'Do‘stim'}</h1>
        <div class="sub">📍 ${esc(s.city)} · ${fmtDate(day)}</div>
      </div>
      <button class="icon" id="toSettings" aria-label="Sozlamalar">⚙︎</button>
    </div>
    ${installHtml(false)}

    <div class="section">Bugungi namozlar</div>
    ${prayers}
    <p class="hint">${sourceText(times, s)}${edited ? ' · qo‘lda tuzatilgan' : ''}.<br>
      Vaqti tugaguncha “O‘qidim” bosilmasa, namoz avtomatik qazo hisobiga qo‘shiladi.</p>

    <div class="card">
      <h2>Qazo namozlar</h2>
      <div class="row">
        <div class="stat"><div class="big" style="color:var(--blue)">${totalQazo(state)}</div><div class="sub">jami qoldi</div></div>
        <div class="divider"></div>
        <div class="stat"><div class="big" style="color:var(--orange)">${s.dailyGoal}</div><div class="sub">kunlik maqsad</div></div>
      </div>
      ${finish ? `<div class="finish">Taxminiy tugash: ${fmtDate(finish)}</div>` : ''}
    </div>
    <div class="grid">${counters}</div>
    <p class="hint">“−” — qazo namozni ado qildingiz. Hisob faqat siz bosganda kamayadi.</p>
    ${shareCardHtml()}`;

  bindInstall();
  bindShareCard();
  $app.querySelector('#toSettings').onclick = () => { screen = 'settings'; form = null; render(); };
  $app.querySelectorAll('[data-pray]').forEach((b) => {
    b.onclick = () => save(togglePrayed(state, day, b.dataset.pray, new Date()));
  });
  $app.querySelectorAll('[data-q]').forEach((b) => {
    b.onclick = () => {
      const p = b.dataset.q;
      save({ ...state, qazo: { ...state.qazo, [p]: Math.max(0, (state.qazo[p] || 0) + Number(b.dataset.d)) } });
    };
  });
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
    <h1>Xush kelibsiz</h1>
    <div class="sub">Dunyoning istalgan joyida ishlaydi. Ma’lumotlar faqat telefoningizda saqlanadi.</div>
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
    };
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
    <div class="row"><button class="icon" id="back" aria-label="Orqaga">←</button><h1>Sozlamalar</h1></div>
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

    <div class="section">Boshqa</div>
    <label>Ismingiz</label><input type="text" data-f="name" value="${esc(f.name)}" />
    <label>Kunlik maqsad</label><input type="number" data-f="dailyGoal" value="${esc(f.dailyGoal)}" />
    <div class="switch"><span>Vitr hisobga qo‘shilsin</span><input type="checkbox" id="vitr" ${f.includeVitr ? 'checked' : ''} /></div>

    <button class="btn primary" id="save" style="margin-top:20px">Saqlash</button>

    <div class="section">Ilova haqida</div>
    <button class="btn" id="checkUpd">🔄 Yangilanishni tekshirish</button>
    <button class="btn" id="shareBtn">📤 Do‘stlarga ulashish</button>
    <button class="btn" id="supportBtn">🤲 Loyihani qo‘llab-quvvatlash</button>

    <div class="section">Zaxira</div>
    <button class="btn" id="export">Zaxira faylni yuklab olish</button>
    <label>Zaxira faylini tanlang</label><input type="file" id="importFile" accept=".json,application/json" />

    <button class="btn danger" id="reset" style="margin-top:24px">Profilni o‘chirish</button>
    <div class="ver">Namoz va Qazo · versiya ${APP_VERSION}</div>`;

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

  $app.querySelector('#back').onclick = () => { screen = 'home'; form = null; applyOfficial(state.settings); render(); };
  $app.querySelector('#shareBtn').onclick = shareApp;
  $app.querySelector('#checkUpd').onclick = async () => {
    await checkUpdate();
    if (!newVersion) toast(navigator.onLine ? `Sizda eng yangi versiya (v${APP_VERSION})` : 'Tekshirish uchun internet kerak.');
  };
  $app.querySelector('#supportBtn').onclick = () => { screen = 'support'; form = null; applyOfficial(state.settings); render(); };
  $app.querySelector('#save').onclick = () => {
    const settings = { ...s, name: f.name.trim(), dailyGoal: Number(f.dailyGoal) || 0, includeVitr: f.includeVitr,
      city: f.city, lat: f.lat, lng: f.lng, countryCode: f.countryCode, method: f.method, methodAuto: f.methodAuto,
      madhab: f.madhab, fajrAngle: Number(f.fajrAngle) || 15, ishaAngle: Number(f.ishaAngle) || 15,
      source: f.source, autoLocation: f.autoLocation, offsets: { ...f.offsets } };
    screen = 'home'; form = null;
    applyOfficial(settings);
    save({ ...state, settings });
    toast('Saqlandi');
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
      const next = { ...EMPTY, ...data.state };
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

/* ---------------- Ulashish va qo'llab-quvvatlash ---------------- */
async function shareApp() {
  const data = { title: 'Namoz va Qazo', text: SHARE_TEXT, url: APP_URL };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  window.open(`https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`, '_blank');
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
  $app.querySelector('#supportHome').onclick = () => { screen = 'support'; render(); };
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
    <div class="row"><button class="icon" id="back" aria-label="Orqaga">←</button><h1>Qo‘llab-quvvatlash</h1></div>
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

  $app.querySelector('#back').onclick = () => { screen = 'home'; render(); };
  $app.querySelector('#shareSup').onclick = shareApp;
  $app.querySelector('#copyLink').onclick = () => copyText(APP_URL, 'Havola nusxalandi');
  const cc = $app.querySelector('#copyCard');
  if (cc) cc.onclick = () => copyText(SUPPORT.card.replace(/\s/g, ''), 'Karta raqami nusxalandi');
}

function bindInputs(f) {
  $app.querySelectorAll('[data-f]').forEach((el) => { el.oninput = el.onchange = () => { f[el.dataset.f] = el.value; }; });
}

/* ---------------- Ishga tushirish ---------------- */
if (location.search.includes('v=')) history.replaceState(null, '', location.pathname);
applyOfficial(state.settings);
render();
check();
if (state.settings) {
  refreshOfficial(state.settings).then((ch) => ch && screen === 'home' && render());
  autoLocate();
}
checkUpdate();
setInterval(checkUpdate, 30 * 60000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  checkUpdate();
  if (screen !== 'home') return;
  check();
  autoLocate();
});
setInterval(() => { if (screen === 'home') check(); }, 60000);
