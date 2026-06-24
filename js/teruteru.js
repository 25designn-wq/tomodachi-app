// てるてる坊主ゲーム。収縮するリングのタイミングゲーム。
import { h } from './dom.js';

const STEPS       = 4;
const APPROACH_MS = 1800; // リングが外→内まで縮む時間

const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

export function openTeruteruFlow({ group, onComplete }) {
  let step = 0, finished = false, rafId = null;
  let approachT = 0, lastT = null;

  const scrim = h('div', { class: 'scrim' });
  document.body.append(scrim);
  document.body.style.overflow = 'hidden';
  raf2(() => scrim.classList.add('is-open'));

  function doClose(delay = 0) {
    cancelAnimationFrame(rafId);
    setTimeout(() => {
      scrim.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => scrim.remove(), 240);
    }, delay);
  }

  // 動画（WebM → MP4 フォールバック）
  const vid = h('video', { class: 'teru-video', muted: true, playsinline: true, preload: 'auto' },
    h('source', { src: 'teruteru_web.webm', type: 'video/webm' }),
    h('source', { src: 'teruteru_web.mp4',  type: 'video/mp4' }),
  );
  vid.setAttribute('webkit-playsinline', '');

  // プレースホルダー（動画の最初のフレームが出るまでの間、アイコンで埋める）
  const placeholder = h('img', { src: 'icons/teruteru.svg', class: 'teru-placeholder', alt: '' });
  vid.addEventListener('loadeddata', () => {
    vid.currentTime = 0.05; // 最初のフレームを描画させる
    placeholder.style.transition = 'opacity .4s';
    placeholder.style.opacity = '0';
    setTimeout(() => placeholder.remove(), 450);
  }, { once: true });

  // 動画内オーバーレイ（タップゾーン + アプローチリング）
  const tapZone     = h('div', { class: 'teru-tap-zone' }, '✦ TAP ✦');
  const approachRing = h('div', { class: 'teru-approach-ring' });
  const overlay     = h('div', { class: 'teru-overlay' }, approachRing, tapZone);

  const vwrap = h('div', { class: 'teru-vwrap' }, vid, placeholder, overlay);

  // ドット＆フィードバック
  const dotsEl = h('div', { class: 'teru-dots' });
  const feedEl = h('div', { class: 'teru-feed' });

  const drawDots = () => {
    dotsEl.replaceChildren(...Array.from({ length: STEPS }, (_, i) =>
      h('span', { class: 'teru-dot' + (i < step ? ' hit' : '') })
    ));
  };
  drawDots();

  const pop = (txt, cls) => {
    feedEl.textContent = txt;
    feedEl.className = 'teru-feed ' + cls;
    void feedEl.offsetWidth;
    feedEl.classList.add('show');
  };

  // 成功時のバーストリング（外側に広がって消える）
  const spawnBurst = () => {
    const b = h('div', { class: 'teru-hit-burst' });
    overlay.appendChild(b);
    b.addEventListener('animationend', () => b.remove(), { once: true });
  };

  // タップゾーンの一時的なポップアニメーション
  const popTapZone = () => {
    tapZone.classList.remove('pop');
    void tapZone.offsetWidth; // reflow
    tapZone.classList.add('pop');
    tapZone.addEventListener('animationend', () => tapZone.classList.remove('pop'), { once: true });
  };

  const updateApproach = (ts) => {
    if (!lastT) lastT = ts;
    const dt = ts - lastT; lastT = ts;

    approachT += dt / APPROACH_MS;
    if (approachT >= 1) approachT = 0;

    const scale  = 3.0 - 2.0 * approachT; // 3.0 → 1.0
    const inZone = approachT >= 0.62;       // 残り38%≒684ms

    approachRing.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(3)})`;
    approachRing.classList.toggle('in-zone', inZone);
    tapZone.classList.toggle('in-zone', inZone);

    rafId = requestAnimationFrame(updateApproach);
  };

  const showVideoStep = (s) => {
    if (!vid.duration) return;
    vid.currentTime = Math.min((s / STEPS) * vid.duration, vid.duration - 0.05);
    vid.play().then(() => setTimeout(() => vid.pause(), 700)).catch(() => {});
  };

  const complete = () => {
    finished = true; cancelAnimationFrame(rafId);
    overlay.style.transition = 'opacity .4s';
    overlay.style.opacity = '0';
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]); // 完成の振動
    const countKey = `ojisan_${group}_teruteru`;
    const n = parseInt(localStorage.getItem(countKey) || '0') + 1;
    localStorage.setItem(countKey, String(n));
    onComplete?.(n);
    setTimeout(() => doClose(), 2400);
  };

  let running = false;
  const onTap = (e) => {
    e.stopPropagation();
    if (finished) return;
    if (!running) {
      running = true; lastT = null; approachT = 0;
      // 初回タップ時に動画の最初のフレームを表示しようと試みる
      vid.play().then(() => setTimeout(() => vid.pause(), 100)).catch(() => {});
      rafId = requestAnimationFrame(updateApproach);
      return;
    }
    const inZone = approachT >= 0.62;
    if (inZone) {
      step++; drawDots(); showVideoStep(step);
      pop(step === STEPS ? '🌤 PERFECT！' : '✨ GOOD!', 'ok');
      spawnBurst();
      popTapZone();
      if (navigator.vibrate) navigator.vibrate(50);
      if (step >= STEPS) setTimeout(complete, 750);
    } else {
      pop('💧 もう少し！', 'miss');
      if (navigator.vibrate) navigator.vibrate(20);
      approachT = 0; lastT = null;
    }
  };

  const card = h('div', { class: 'teru-card', onclick: onTap },
    h('div', { class: 'teru-head' },
      h('span', {}, '☁️ てるてる坊主を作る'),
      h('button', { class: 'teru-x', onclick: e => { e.stopPropagation(); doClose(); } }, '×'),
    ),
    vwrap,
    dotsEl, feedEl,
  );

  const wrap = h('div', { class: 'teru-wrap' }, card);
  wrap.addEventListener('click', () => doClose());
  scrim.appendChild(wrap);
  raf2(() => card.classList.add('open'));
}
