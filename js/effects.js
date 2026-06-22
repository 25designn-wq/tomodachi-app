// 共感の演出（再利用）。ひろばの「俺も！」連打フィードバックと、
// 投稿者が開いたときの「全画面で浴びる→ガラス割れ→投稿別の結果」。
import { h } from './dom.js';
import { catMeta } from './ui.js';

const REDUCE = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CHARS = ['🤙', '🙌', '💥', '❤️', '🔥'];

// 「俺も！」タップ時の即時フィードバック（ボタンから絵文字がポンッと飛ぶ）
export function throwBurst(fromEl) {
  if (REDUCE() || !fromEl) return;
  const r = fromEl.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top;
  const e = h('span', { class: 'fly' }, CHARS[Math.floor(Math.random() * 5)]);
  e.style.left = x + 'px'; e.style.top = y + 'px';
  e.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
  e.style.setProperty('--dy', (-90 - Math.random() * 70) + 'px');
  e.style.setProperty('--rot', (Math.random() * 360) + 'deg');
  document.body.append(e);
  setTimeout(() => e.remove(), 720);
}

// ガラス割れSVG（放射状＋同心リングで三角/台形シャード）
function crackSVG() {
  const cx = 70, cy = 70, n = 8 + (Math.random() * 4 | 0);
  const jt = (m) => (Math.random() * 2 - 1) * m;
  const r1 = [], r2 = []; let radial = '';
  for (let k = 0; k < n; k++) {
    const a = (Math.PI * 2 / n) * k + jt(0.22);
    const d1 = 10 + Math.random() * 6, d2 = 24 + Math.random() * 10, d3 = 40 + Math.random() * 16;
    const p1 = [cx + Math.cos(a) * d1 + jt(3), cy + Math.sin(a) * d1 + jt(3)];
    const p2 = [cx + Math.cos(a) * d2 + jt(5), cy + Math.sin(a) * d2 + jt(5)];
    const p3 = [cx + Math.cos(a) * d3 + jt(7), cy + Math.sin(a) * d3 + jt(7)];
    r1.push(p1); r2.push(p2);
    radial += `M${cx} ${cy}L${p1[0] | 0} ${p1[1] | 0}L${p2[0] | 0} ${p2[1] | 0}L${p3[0] | 0} ${p3[1] | 0}`;
  }
  let ring = '', shards = '';
  for (let k = 0; k < n; k++) {
    const a1 = r1[k], b1 = r1[(k + 1) % n], a2 = r2[k], b2 = r2[(k + 1) % n];
    ring += `M${a1[0] | 0} ${a1[1] | 0}L${b1[0] | 0} ${b1[1] | 0}`;
    ring += `M${a2[0] | 0} ${a2[1] | 0}L${b2[0] | 0} ${b2[1] | 0}`;
    shards += `<polygon points="${cx},${cy} ${a1[0] | 0},${a1[1] | 0} ${b1[0] | 0},${b1[1] | 0}" fill="rgba(120,140,175,.08)"/>`;
    shards += `<polygon points="${a1[0] | 0},${a1[1] | 0} ${a2[0] | 0},${a2[1] | 0} ${b2[0] | 0},${b2[1] | 0} ${b1[0] | 0},${b1[1] | 0}" fill="rgba(120,140,175,.05)"/>`;
  }
  const lines = radial + ring;
  return `<svg width="100%" height="100%" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`
    + shards
    + `<path d="${lines}" stroke="rgba(20,30,50,.6)" stroke-width="1.6" fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
    + `<path d="${lines}" stroke="rgba(255,255,255,.75)" stroke-width="0.7" fill="none" vector-effect="non-scaling-stroke"/>`
    + `<circle cx="${cx}" cy="${cy}" r="2" fill="rgba(20,30,50,.55)"/></svg>`;
}

// 2つの割れをつなぐ亀裂（%座標・全画面）
function connectorSVG(x1, y1, x2, y2) {
  const segs = 5 + (Math.random() * 3 | 0); let d = `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
  for (let s = 1; s < segs; s++) {
    const t = s / segs;
    d += ` L${(x1 + (x2 - x1) * t + (Math.random() * 9 - 4.5)).toFixed(1)} ${(y1 + (y2 - y1) * t + (Math.random() * 9 - 4.5)).toFixed(1)}`;
  }
  d += ` L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`
    + `<path d="${d}" stroke="rgba(20,30,50,.6)" stroke-width="1.6" fill="none" vector-effect="non-scaling-stroke"/>`
    + `<path d="${d}" stroke="rgba(255,255,255,.7)" stroke-width="0.7" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
}

function ensureGlassFilter() {
  if (document.getElementById('glassfx')) return;
  const holder = document.createElement('div');
  holder.innerHTML = '<svg id="glassfx" width="0" height="0" style="position:absolute"><filter id="glass"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.025" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
  document.body.append(holder.firstChild);
}

// 投稿者が開いたとき：全画面で浴びる → ガラス割れ → 投稿別の結果
//   entries: [{ category, text, n }]（n = 今回届いた共感数）
export function playBarrage(entries) {
  entries = (entries || []).filter(e => e.n > 0);
  if (!entries.length) return;
  const total = entries.reduce((a, e) => a + e.n, 0);
  ensureGlassFilter();

  const screen = h('div', { class: 'recv-screen' });
  const close = () => { screen.classList.remove('on'); setTimeout(() => screen.remove(), 220); };
  const body = h('div', { class: 'recv-body' }, h('div', { class: 'recv-lead' }, '📣 みんなの「俺も！」が届いてます…'));
  const banner = h('div', { class: 'recv-banner' });
  screen.append(
    h('div', { class: 'recv-top' }, h('div', { class: 'recv-brand' }, '🍻 おじ部'), h('button', { class: 'recv-x', onclick: close }, '×')),
    body, banner,
  );
  document.body.append(screen);
  requestAnimationFrame(() => screen.classList.add('on'));

  const shots = Math.min(total, 80);
  const crackShots = total >= 30 ? [Math.floor(shots * 0.5), Math.floor(shots * 0.85)]
    : total >= 10 ? [Math.floor(shots * 0.65)] : [];
  const crackPos = crackShots.map((_, idx) => idx === 0
    ? { x: 20 + Math.random() * 12, y: 20 + Math.random() * 12 }
    : { x: 64 + Math.random() * 14, y: 62 + Math.random() * 14 });
  let glassBroken = false;

  if (!REDUCE()) for (let i = 0; i < shots; i++) {
    setTimeout(() => {
      const x = 8 + Math.random() * 84, y = 14 + Math.random() * 64;
      const e = h('span', { class: 'splat' + (glassBroken ? ' warp' : '') }, CHARS[Math.floor(Math.random() * 5)]);
      const pk = 3.5 + Math.random() * 3.8;
      const slide = Math.random() < 0.5;
      e.style.left = x + 'vw'; e.style.top = y + 'vh';
      e.style.setProperty('--fx', (50 - x).toFixed(1) + 'vw');
      e.style.setProperty('--fy', (46 - y).toFixed(1) + 'vh');
      e.style.setProperty('--pk', pk.toFixed(2));
      e.style.fontSize = (20 + Math.random() * 22) + 'px';
      e.style.animation = (slide ? 'splatSlide .8s' : 'splatZoom .6s') + ' cubic-bezier(.16,.7,.3,1) forwards';
      const ring = h('span', { class: 'impact' }); ring.style.left = x + 'vw'; ring.style.top = y + 'vh';
      document.body.append(ring, e);
      setTimeout(() => { e.remove(); ring.remove(); }, slide ? 820 : 620);
      screen.classList.remove('quake'); void screen.offsetWidth; screen.classList.add('quake');

      const ci = crackShots.indexOf(i);
      if (ci >= 0) {
        const pos = crackPos[ci];
        const cr = h('span', { class: 'crack', html: crackSVG() });
        cr.style.width = '72vmin'; cr.style.height = '72vmin';
        cr.style.left = pos.x + 'vw'; cr.style.top = pos.y + 'vh';
        cr.style.setProperty('--cr', (Math.random() * 360 | 0) + 'deg');
        const frame = h('span', { class: 'shatter-frame' });
        document.body.append(frame, cr);
        glassBroken = true;
        if (ci > 0) {
          const a = crackPos[ci - 1];
          const conn = h('span', { class: 'connector-wrap', html: connectorSVG(a.x, a.y, pos.x, pos.y) });
          document.body.append(conn); setTimeout(() => conn.remove(), 1500);
        }
        setTimeout(() => { cr.remove(); frame.remove(); glassBroken = false; }, 1500);
      }
    }, i * 42);
  }

  const showResults = () => {
    body.replaceChildren(
      h('div', { class: 'recv-lead' }, '今回そろった「俺も！」'),
      ...entries.slice().sort((a, b) => b.n - a.n).map(e => {
        const m = catMeta(e.category);
        return h('div', { class: 'recv-result' },
          h('span', { class: 'rorb', style: { background: m.color } }, m.icon),
          h('span', { class: 'rtxt' }, e.text),
          h('span', { class: 'rn' }, String(e.n), h('small', {}, ' 共感')),
        );
      }),
    );
    banner.innerHTML = '合計 <span class="big">' + total + '</span> の共感が届きました 🎉';
    banner.classList.add('on');
  };
  setTimeout(showResults, REDUCE() ? 0 : Math.min(shots * 42 + 700, 4000));
  screen.addEventListener('click', e => { if (e.target === screen) close(); });
}
