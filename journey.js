// "Qazo yo'li" — boshlanishdan yakungacha ilon izi yo'l xaritasi (SVG). Toza funksiyalar, UI'siz.
const STEPS = [100, 500, 1000, 2500, 5000, 10000, 20000, 50000];

// Yo'ldagi bosqichlar: 0 (boshlanish) … start (yakun)
export function milestones(start) {
  if (start <= 0) return [0];
  let ms = STEPS.filter((m) => m < start * 0.95);
  if (ms.length < 2 && start >= 8) ms = [0.25, 0.5, 0.75].map((f) => Math.round(start * f)).filter((m, i, a) => m > 0 && a.indexOf(m) === i && m < start);
  if (ms.length > 7) ms = [...ms.slice(0, 3), ...ms.slice(-4)];
  return [0, ...ms, start];
}

// Kubik Bezye egri chizig'ini t nuqtada bo'lish (de Casteljau) — birinchi yarmini qaytaradi
function splitCubic([p0, p1, p2, p3], t) {
  const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const a = L(p0, p1), b = L(p1, p2), c = L(p2, p3), d = L(a, b), e = L(b, c), f = L(d, e);
  return [p0, a, d, f];
}
const r1 = (n) => Math.round(n * 10) / 10;
const seg = (c) => `C${c[1].map(r1)} ${c[2].map(r1)} ${c[3].map(r1)}`;

// Joylashuv va yurilgan qism: { nodes:[{v,x,y,reached}], curves, here:{x,y,k,t}, width, height }
export function layout(start, done, { width = 320, gap = 64, pad = 34 } = {}) {
  const vals = milestones(start);
  const n = vals.length;
  const height = pad * 2 + gap * (n - 1);
  const xs = (i) => (i === 0 || i === n - 1 ? width / 2 : i % 2 ? width * 0.27 : width * 0.73);
  const nodes = vals.map((v, i) => ({ v, x: xs(i), y: height - pad - i * gap, reached: done >= v }));
  const curves = [];
  for (let i = 0; i + 1 < n; i++) {
    const a = nodes[i], b = nodes[i + 1];
    curves.push([[a.x, a.y], [a.x, a.y - gap * 0.6], [b.x, b.y + gap * 0.6], [b.x, b.y]]);
  }
  const d = Math.max(0, Math.min(done, start));
  let k = 0;
  while (k < curves.length - 1 && d >= vals[k + 1]) k++;
  const t = curves.length ? Math.max(0, Math.min(1, (d - vals[k]) / (vals[k + 1] - vals[k] || 1))) : 0;
  const part = curves.length ? splitCubic(curves[k], t) : null;
  const here = part ? { x: part[3][0], y: part[3][1], k, t } : { x: width / 2, y: height - pad, k: 0, t: 0 };
  return { nodes, curves, part, here, width, height };
}

export function journeySvg(start, done, fmt = String) {
  const L = layout(start, done);
  const { nodes, curves, part, here, width, height } = L;
  if (!curves.length) return '';
  const full = `M${curves[0][0].map(r1)} ${curves.map(seg).join(' ')}`;
  const walked = `M${curves[0][0].map(r1)} ${curves.slice(0, here.k).map(seg).join(' ')} ${seg(part)}`;
  const last = nodes.length - 1;
  const label = (nd, i) => {
    const right = nd.x <= width / 2;
    const x = i === 0 || i === last ? nd.x + 22 : right ? nd.x + 18 : nd.x - 18;
    const anchor = i === 0 || i === last || right ? 'start' : 'end';
    const title = i === 0 ? '🚩 Boshlanish' : i === last ? '🕌 Yakun' : `${fmt(nd.v)} ta`;
    const sub = i === last ? `${fmt(nd.v)} ta` : i === 0 ? '' : nd.reached ? 'yetildi ✓' : '';
    return `<text x="${r1(x)}" y="${r1(nd.y + (sub ? -2 : 5))}" text-anchor="${anchor}" class="j-t ${nd.reached && i ? 'on' : ''}">${title}</text>
      ${sub ? `<text x="${r1(x)}" y="${r1(nd.y + 13)}" text-anchor="${anchor}" class="j-s">${sub}</text>` : ''}`;
  };
  const hereRight = here.x <= width / 2;
  return `<svg class="jmap" viewBox="0 0 ${width} ${height}" role="img" aria-label="Qazo yo‘li: ${fmt(done)} / ${fmt(start)}">
    <path d="${full}" class="j-road"/>
    <path d="${full}" class="j-dash"/>
    <path d="${walked}" class="j-walk"/>
    ${nodes.map((nd, i) => `<circle cx="${r1(nd.x)}" cy="${r1(nd.y)}" r="${i === last ? 11 : 8}" class="j-node ${nd.reached ? 'on' : ''} ${i === last ? 'end' : ''}"/>
      ${nd.reached && i > 0 ? `<path d="M${r1(nd.x - 3.5)} ${r1(nd.y)} l2.5 2.5 l4.5 -5" class="j-chk"/>` : ''}
      ${label(nd, i)}`).join('')}
    ${done < start ? `<circle cx="${r1(here.x)}" cy="${r1(here.y)}" r="10" class="j-pulse"/>
    <circle cx="${r1(here.x)}" cy="${r1(here.y)}" r="7" class="j-here"/>
    <text x="${r1(here.x + (hereRight ? -14 : 14))}" y="${r1(here.y + 4)}" text-anchor="${hereRight ? 'end' : 'start'}" class="j-me">Siz · ${fmt(done)}</text>` : ''}
  </svg>`;
}
