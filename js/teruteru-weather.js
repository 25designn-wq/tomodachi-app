// 予定当日に「晴れ／雨」を聞くポップアップ。
// 晴れ → てるてる坊主が画面に飛び跳ねるアニメーション
// 雨   → てるてる坊主が泣く SVG アニメーション
import { h } from './dom.js';

const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

// ---- 晴れアニメーション ----
function launchSunny(count) {
  const W = window.innerWidth, H = window.innerHeight;
  const overlay = h('div', { class: 'teru-sky-overlay' });
  document.body.append(overlay);

  const n = Math.min(count, 9);
  const items = Array.from({ length: n }, (_, i) => {
    const sz = 38 + Math.random() * 28;
    const img = h('img', {
      src: 'icons/teruteru.svg', alt: '',
    });
    img.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;left:${(W-sz)/2}px;top:${(H-sz)/2}px;opacity:1;`;
    overlay.append(img);
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 5 + Math.random() * 4;
    return { img, sz, x: (W-sz)/2, y: (H-sz)/2, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed };
  });

  let frame = 0;
  const MAX = 240;
  const tick = () => {
    frame++;
    items.forEach(t => {
      t.x += t.vx; t.y += t.vy;
      t.vy += 0.18; // 重力
      if (t.x <= 0)        { t.x = 0;        t.vx =  Math.abs(t.vx) * 0.72; }
      if (t.x >= W - t.sz) { t.x = W - t.sz; t.vx = -Math.abs(t.vx) * 0.72; }
      if (t.y <= 0)        { t.y = 0;        t.vy =  Math.abs(t.vy) * 0.72; }
      if (t.y >= H - t.sz) { t.y = H - t.sz; t.vy = -Math.abs(t.vy) * 0.72; }
      t.img.style.left = `${t.x}px`;
      t.img.style.top  = `${t.y}px`;
      if (frame > MAX - 40) t.img.style.opacity = ((MAX - frame) / 40).toFixed(2);
    });
    if (frame < MAX) requestAnimationFrame(tick);
    else overlay.remove();
  };
  requestAnimationFrame(tick);
}

// ---- 雨アニメーション ----
function showCrying(onDone) {
  const scrim = h('div', { class: 'scrim' });
  document.body.append(scrim);
  document.body.style.overflow = 'hidden';
  raf2(() => scrim.classList.add('is-open'));

  const close = () => {
    document.body.style.overflow = '';
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.remove(); onDone?.(); }, 240);
  };

  const card = h('div', { class: 'teru-cry-card' },
    h('p',   { class: 'teru-cry-ttl' }, '☔ 雨だったんだね…'),
    h('img', { src: 'icons/teruteru-sad.svg', class: 'teru-cry-img', alt: '' }),
    h('p',   { class: 'teru-cry-txt' }, 'また晴れを願ってね ☁️'),
    h('button', { class: 'btn primary', onclick: close }, 'ありがとう'),
  );
  const wrap = h('div', { class: 'teru-wrap' }, card);
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  scrim.appendChild(wrap);
  raf2(() => card.classList.add('open'));
}

// ---- 公開 API ----
// list = Firestore から来た events 配列
// onReset = カウントバッジ更新コールバック
export function checkWeather({ group, list, onReset }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // 今日が確定予定日のイベントを探す
  let todayDate = null;
  for (const ev of (list || [])) {
    if (!ev.confirmed) continue;
    const dates = (ev.dates || []);
    const votes = ev.votes  || {};
    const best  = dates
      .map(d => ({ d, yes: Object.values(votes).filter(v => v[d] === 'yes').length }))
      .sort((a, b) => b.yes - a.yes)[0];
    if (!best?.d) continue;
    const [y, mo, da] = best.d.split('-').map(Number);
    if (new Date(y, mo - 1, da).getTime() === today.getTime()) { todayDate = best.d; break; }
  }
  if (!todayDate) return;

  const count = parseInt(localStorage.getItem(`ojisan_${group}_teruteru`) || '0');
  if (count <= 0) return;

  // 同じ日には1回だけ
  const askedKey = `ojisan_${group}_teru_asked_${todayDate}`;
  if (localStorage.getItem(askedKey)) return;
  localStorage.setItem(askedKey, '1');

  // ポップアップ表示
  const scrim = h('div', { class: 'scrim' });
  document.body.append(scrim);
  document.body.style.overflow = 'hidden';
  raf2(() => scrim.classList.add('is-open'));

  const reset = () => {
    localStorage.setItem(`ojisan_${group}_teruteru`, '0');
    onReset?.();
  };
  const closeScrim = (cb) => {
    document.body.style.overflow = '';
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.remove(); cb?.(); }, 240);
  };

  const card = h('div', { class: 'teru-wx-card' },
    h('p', { class: 'teru-wx-ttl' }, '今日はお天気どうでしたか？'),
    h('p', { class: 'teru-wx-sub' }, `${count}体のてるてる坊主のおかげかも ✨`),
    h('img', { src: 'icons/teruteru.svg', class: 'teru-wx-img', alt: '' }),
    h('div', { class: 'teru-wx-btns' },
      h('button', { class: 'teru-wx-btn sunny',
        onclick: () => closeScrim(() => { reset(); launchSunny(count); }),
      }, '☀️ 晴れた！'),
      h('button', { class: 'teru-wx-btn rainy',
        onclick: () => closeScrim(() => { reset(); showCrying(() => {}); }),
      }, '🌧 雨だった'),
    ),
  );
  const wrap = h('div', { class: 'teru-wrap' }, card);
  wrap.addEventListener('click', e => { if (e.target === wrap) closeScrim(null); });
  scrim.appendChild(wrap);
  raf2(() => card.classList.add('open'));
}
