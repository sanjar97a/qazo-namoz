import {
  NAMES, activePrayers, currentPrayerDay, dayKey, dayWindows, estimatedFinish,
  fmtDate, fmtTime, initialQazo, parseDate, processMissed, togglePrayed, totalQazo,
} from './prayer.js';

const KEY = 'namoz-qazo-state-v1';
const EMPTY = { settings: null, qazo: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, vitr: 0 }, log: {}, lastProcessed: null };
const CITIES = [
  ['Namangan', 40.9983, 71.6726], ['Toshkent', 41.3111, 69.2797], ['Andijon', 40.7821, 72.3442],
  ['Farg‘ona', 40.3864, 71.7864], ['Samarqand', 39.6542, 66.9597], ['Buxoro', 39.7747, 64.4286],
];

const $app = document.getElementById('app');
let state = load();
let screen = 'home';
let form = null;

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

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// Ochilganda, qaytganda va har daqiqada: vaqti o'tgan belgilanmagan namozlar qazoga
function check() {
  if (!state.settings) return;
  const { state: next, added } = processMissed(state, new Date());
  const list = Object.entries(added).map(([p, n]) => `${NAMES[p]}: +${n}`);
  if (next !== state) save(next); else render();
  if (list.length) toast('Qazo hisobiga qo‘shildi\n' + list.join('\n'));
}

/* ---------------- Ekranlar ---------------- */
function render() {
  if (!state.settings) return renderSetup();
  if (screen === 'settings') return renderSettings();
  renderHome();
}

function renderHome() {
  const s = state.settings;
  const now = new Date();
  const day = currentPrayerDay(now, s);
  const { windows } = dayWindows(day, s);
  const key = dayKey(day);
  const finish = estimatedFinish(state, now);

  const prayers = activePrayers(s).map((p) => {
    const w = windows[p];
    const mark = state.log[key]?.[p];
    const live = now >= w.start && now < w.end;
    let label = 'Kutilmoqda', style = 'color:var(--sub)';
    if (mark === 'prayed') { label = '✓ O‘qildi'; style = 'color:var(--green);border-color:var(--green)'; }
    else if (mark === 'qazo') { label = 'Qazo'; style = 'color:var(--red);border-color:var(--red)'; }
    else if (live) { label = 'O‘qidim'; style = 'background:var(--blue);border-color:var(--blue);color:#fff'; }
    else if (now >= w.end) { label = '—'; }
    return `
      <div class="prayer ${live ? 'live' : ''}">
        <div class="grow">
          <div class="pname">${NAMES[p]}${p === 'vitr' ? ' <span class="sub">(vojib)</span>' : ''}</div>
          <div class="sub">${fmtTime(w.start)} – ${fmtTime(w.end)}</div>
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
        <div class="sub">${esc(s.city)} · ${fmtDate(day)}</div>
      </div>
      <button class="icon" id="toSettings" aria-label="Sozlamalar">⚙︎</button>
    </div>

    <div class="section">Bugungi namozlar</div>
    ${prayers}
    <p class="hint">Vaqti tugaguncha “O‘qidim” bosilmasa, namoz avtomatik qazo hisobiga qo‘shiladi.</p>

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
    <p class="hint">“−” — qazo namozni ado qildingiz. Hisob faqat siz bosganda kamayadi.</p>`;

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

function renderSetup() {
  form ||= { name: '', birth: '', gender: 'erkak', bulughAge: '12', start: '', hayzDays: '7',
    dailyGoal: '3', includeVitr: true, city: '', lat: null, lng: null };
  const f = form;

  $app.innerHTML = `
    <h1>Xush kelibsiz</h1>
    <div class="sub">Ma’lumotlar faqat telefoningizda saqlanadi.</div>

    <div class="section">Joylashuv</div>
    <button class="btn" id="gps">📍 Joylashuvni aniqlash</button>
    <div class="chips">
      ${CITIES.map(([n]) => `<button class="chip ${f.city === n ? 'on' : ''}" data-city="${n}">${n}</button>`).join('')}
    </div>
    ${f.city ? `<p class="hint">Tanlandi: ${esc(f.city)}</p>` : ''}

    <div class="section">Shaxsiy</div>
    <label>Ismingiz</label><input type="text" data-f="name" value="${esc(f.name)}" />
    <div class="chips">
      ${['erkak', 'ayol'].map((g) => `<button class="chip ${f.gender === g ? 'on' : ''}" data-gender="${g}">${g === 'erkak' ? 'Erkak' : 'Ayol'}</button>`).join('')}
    </div>

    <div class="section">Eski qazolar (ixtiyoriy)</div>
    <p class="hint">Bo‘sh qoldirsangiz, hisob 0 dan boshlanadi. Keyin qo‘lda ham o‘zgartirsa bo‘ladi.</p>
    <label>Tug‘ilgan sana</label><input type="date" data-f="birth" value="${esc(f.birth)}" max="${isoToday()}" />
    <label>Balog‘at yoshi</label><input type="number" data-f="bulughAge" value="${esc(f.bulughAge)}" />
    <label>Namozni boshlagan sana</label><input type="date" data-f="start" value="${esc(f.start)}" max="${isoToday()}" />
    ${f.gender === 'ayol' ? `<label>Oyiga o‘rtacha hayz kunlari</label><input type="number" data-f="hayzDays" value="${esc(f.hayzDays)}" />` : ''}

    <div class="section">Sozlamalar</div>
    <label>Kunlik maqsad (nechta qazo)</label><input type="number" data-f="dailyGoal" value="${esc(f.dailyGoal)}" />
    <div class="switch"><span>Vitr namozini hisobga qo‘shish</span><input type="checkbox" id="vitr" ${f.includeVitr ? 'checked' : ''} /></div>

    <button class="btn primary" id="start" style="margin-top:24px">Boshlash</button>`;

  bindInputs(f);
  $app.querySelector('#vitr').onchange = (e) => { f.includeVitr = e.target.checked; };
  $app.querySelectorAll('[data-city]').forEach((b) => {
    b.onclick = () => { const c = CITIES.find(([n]) => n === b.dataset.city); Object.assign(f, { city: c[0], lat: c[1], lng: c[2] }); render(); };
  });
  $app.querySelectorAll('[data-gender]').forEach((b) => { b.onclick = () => { f.gender = b.dataset.gender; render(); }; });
  $app.querySelector('#gps').onclick = () => {
    if (!navigator.geolocation) return toast('Joylashuv qo‘llab-quvvatlanmaydi. Shaharni tanlang.');
    navigator.geolocation.getCurrentPosition(
      (pos) => { Object.assign(f, { city: 'Joriy joylashuv', lat: pos.coords.latitude, lng: pos.coords.longitude }); render(); },
      () => toast('Ruxsat berilmadi. Ro‘yxatdan shaharni tanlang.'),
      { enableHighAccuracy: false, timeout: 15000 },
    );
  };
  $app.querySelector('#start').onclick = () => {
    if (f.lat == null) return toast('Shahar yoki joylashuvni tanlang.');
    let qazo = { ...EMPTY.qazo };
    if (f.birth || f.start) {
      const birth = parseDate(f.birth), start = parseDate(f.start);
      if (!birth) return toast('Tug‘ilgan sanani tanlang.');
      if (!start) return toast('Namozni boshlagan sanani tanlang.');
      if (start < birth) return toast('Namozni boshlagan sana tug‘ilgan sanadan keyin bo‘lishi kerak.');
      qazo = initialQazo({ birth, startDate: start, bulughAge: f.bulughAge, includeVitr: f.includeVitr, gender: f.gender, hayzDays: f.hayzDays });
    }
    form = null;
    save({
      ...EMPTY, qazo, lastProcessed: Date.now(),
      settings: { name: f.name.trim(), city: f.city, lat: f.lat, lng: f.lng, includeVitr: f.includeVitr,
        dailyGoal: Number(f.dailyGoal) || 0, fajrAngle: 15, ishaAngle: 15, gender: f.gender },
    });
  };
}

function renderSettings() {
  const s = state.settings;
  form ||= { name: s.name, dailyGoal: String(s.dailyGoal), includeVitr: s.includeVitr,
    fajrAngle: String(s.fajrAngle), ishaAngle: String(s.ishaAngle), city: s.city, lat: s.lat, lng: s.lng, backup: '' };
  const f = form;

  $app.innerHTML = `
    <div class="row"><button class="icon" id="back" aria-label="Orqaga">←</button><h1>Sozlamalar</h1></div>

    <label>Ismingiz</label><input type="text" data-f="name" value="${esc(f.name)}" />
    <label>Kunlik maqsad</label><input type="number" data-f="dailyGoal" value="${esc(f.dailyGoal)}" />
    <div class="switch"><span>Vitr hisobga qo‘shilsin</span><input type="checkbox" id="vitr" ${f.includeVitr ? 'checked' : ''} /></div>

    <div class="section">Shahar</div>
    <div class="chips">
      ${CITIES.map(([n]) => `<button class="chip ${f.city === n ? 'on' : ''}" data-city="${n}">${n}</button>`).join('')}
    </div>

    <div class="section">Hisoblash burchaklari</div>
    <p class="hint">Mahalliy taqvim bilan farq qilsa, shu yerda moslang (asr — Hanafiy).</p>
    <label>Bomdod burchagi (°)</label><input type="number" step="0.5" data-f="fajrAngle" value="${esc(f.fajrAngle)}" />
    <label>Xufton burchagi (°)</label><input type="number" step="0.5" data-f="ishaAngle" value="${esc(f.ishaAngle)}" />
    <button class="btn primary" id="save">Saqlash</button>

    <div class="section">Zaxira</div>
    <button class="btn" id="export">Zaxira faylni yuklab olish</button>
    <label>Zaxira faylini tanlang</label><input type="file" id="importFile" accept=".json,application/json" />

    <button class="btn danger" id="reset" style="margin-top:24px">Profilni o‘chirish</button>`;

  bindInputs(f);
  $app.querySelector('#vitr').onchange = (e) => { f.includeVitr = e.target.checked; };
  $app.querySelectorAll('[data-city]').forEach((b) => {
    b.onclick = () => { const c = CITIES.find(([n]) => n === b.dataset.city); Object.assign(f, { city: c[0], lat: c[1], lng: c[2] }); render(); };
  });
  $app.querySelector('#back').onclick = () => { screen = 'home'; form = null; render(); };
  $app.querySelector('#save').onclick = () => {
    screen = 'home';
    const next = { ...state, settings: { ...s, name: f.name.trim(), dailyGoal: Number(f.dailyGoal) || 0, includeVitr: f.includeVitr,
      city: f.city, lat: f.lat, lng: f.lng, fajrAngle: Number(f.fajrAngle) || 15, ishaAngle: Number(f.ishaAngle) || 15 } };
    form = null;
    save(next);
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
      save({ ...EMPTY, ...data.state });
      toast('Zaxira tiklandi.');
    } catch { toast('Zaxira fayli noto‘g‘ri.'); }
  };
  $app.querySelector('#reset').onclick = () => {
    if (!confirm('Barcha ma’lumotlar o‘chadi. Davom etasizmi?')) return;
    localStorage.removeItem(KEY);
    state = { ...EMPTY }; screen = 'home'; form = null; render();
  };
}

function isoToday() { return dayKey(new Date()); }

function bindInputs(f) {
  $app.querySelectorAll('[data-f]').forEach((el) => { el.oninput = el.onchange = () => { f[el.dataset.f] = el.value; }; });
}

render();
check();
document.addEventListener('visibilitychange', () => { if (!document.hidden && screen === 'home') check(); });
setInterval(() => { if (screen === 'home' && !document.activeElement?.matches('input,textarea')) check(); }, 60000);
