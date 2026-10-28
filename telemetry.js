// Anonim statistika (GoatCounter): faqat sonlar — necha qurilma ochdi, qaysi versiya, qaysi bo'lim.
// Ism, joylashuv, qazo soni va boshqa shaxsiy ma'lumot YUBORILMAYDI. Mamlakatni GoatCounter IP'dan aniqlaydi, IP saqlanmaydi.
// Sozlamalarda o'chirib qo'yish mumkin.
export const STATS_CODE = 'namozqazo';
const ENDPOINT = `https://${STATS_CODE}.goatcounter.com/count`;
const OFF = 'stats-off';

const native = () => Boolean(window.Capacitor?.isNativePlatform?.());
export const statsEnabled = () => { try { return localStorage.getItem(OFF) !== '1'; } catch { return true; } };
export function setStatsEnabled(on) { try { on ? localStorage.removeItem(OFF) : localStorage.setItem(OFF, '1'); } catch {} }

const platform = () => (native() ? 'android'
  : matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'pwa' : 'web');
const today = () => new Date().toISOString().slice(0, 10);
const once = (key) => { try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, '1'); return true; } catch { return false; } };
const oncePerDay = (key) => { try { if (localStorage.getItem(key) === today()) return false; localStorage.setItem(key, today()); return true; } catch { return false; } };

function send(path, title, event) {
  if (!statsEnabled() || !navigator.onLine) return;
  if (!native() && /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) return; // ishlab chiqishda yuborilmaydi
  const q = new URLSearchParams({ p: path, t: title || path, r: '', s: `${screen.width},${screen.height},${window.devicePixelRatio || 1}`,
    rnd: Math.random().toString(36).slice(2) });
  if (event) q.set('e', 'true');
  try { const img = new Image(); img.referrerPolicy = 'no-referrer'; img.src = `${ENDPOINT}?${q}`; } catch {}
}

// Ilova ochilganda: kuniga bir marta "ochildi", birinchi marta "o'rnatildi", yangi versiyada "versiya"
export function trackOpen(version, hasSetup) {
  const pf = platform();
  if (oncePerDay('stats-open')) send(`/ilova/${pf}`, `Ochildi · ${pf} · v${version}`);
  if (once('stats-install')) send(`o'rnatildi/${pf}${hasSetup ? ' (avvaldan)' : ''}`, `O‘rnatildi · ${pf}`, true);
  if (once(`stats-v${version}`)) send(`versiya/v${version}`, `Versiya ${version}`, true);
}
export function trackSetupDone(mode) { send(`sozlash/${mode}`, `Sozlash tugadi · ${mode}`, true); }
export function trackScreen(name) { if (oncePerDay(`stats-s-${name}`)) send(`bo'lim/${name}`, `Bo‘lim · ${name}`, true); }
