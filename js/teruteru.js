// てるてる坊主ゲーム。収縮するリングのタイミングゲーム。
import { h } from './dom.js';

const STEPS       = 4;
const APPROACH_MS = 1400; // リングが外→内まで縮む時間

const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

export function openTeruteruFlow({ group, onComplete }) {
  let step = 0, finished = false, rafId = null, resetTimer = null;
  let approachT = 0, lastT = null;

  const scrim = h('div', { class: 'scrim' });
  document.body.append(scrim);
  document.body.style.overflow = 'hidden';
  raf2(() => scrim.classList.add('is-open'));

  function doClose(delay = 0) {
    cancelAnimationFrame(rafId);
    clearTimeout(resetTimer);
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

  // プレースホルダー（動画の最初のフレームが出るまでアイコンで埋める）
  const placeholder = h('img', { src: 'icons/teruteru.svg', class: 'teru-placeholder', alt: '' });
  vid.addEventListener('loadeddata', () => {
    vid.currentTime = 0.05;
    placeholder.style.transition = 'opacity .4s';
    placeholder.style.opacity = '0';
    setTimeout(() => placeholder.remove(), 450);
  }, { once: true });

  // 動画内オーバーレイ（タップゾーン + アプローチリング）
  const tapZone     = h('div', { class: 'teru-tap-zone' }, '✦ TAP ✦');
  const approachRing = h('div', { class: 'teru-approach-ring' });
  const overlay     = h('div', { class: 'teru-overlay' }, approachRing, tapZone);

  // vwrap は complete() 内でも参照
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

  // 成功時のバーストリング
  const spawnBurst = () => {
    const b = h('div', { class: 'teru-hit-burst' });
    overlay.appendChild(b);
    b.addEventListener('animationend', () => b.remove(), { once: true });
  };

  // タップゾーンのポップアニメーション
  const popTapZone = () => {
    tapZone.classList.remove('pop');
    void tapZone.offsetWidth;
    tapZone.classList.add('pop');
    tapZone.addEventListener('animationend', () => tapZone.classList.remove('pop'), { once: true });
  };

  const updateApproach = (ts) => {
    if (!lastT) lastT = ts;
    const dt = ts - lastT; lastT = ts;

    approachT += dt / APPROACH_MS;
    if (approachT >= 1) approachT = 0;

    const scale  = 3.0 - 2.0 * approachT;
    const inZone = approachT >= 0.62;

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

  const totalCountEl = h('span', { class: 'teru-total-count' });
  const refreshTotalCount = () => {
    const n = parseInt(localStorage.getItem(`ojisan_${group}_teruteru`) || '0');
    totalCountEl.textContent = n > 0 ? `${n}体` : '';
  };
  refreshTotalCount();

  const resetForNext = () => {
    vwrap.querySelectorAll('.teru-complete-flash').forEach(el => el.remove());
    step = 0; finished = false; running = true;
    approachT = 0; lastT = null;
    approachRing.style.display = '';
    tapZone.style.display = '';
    drawDots();
    feedEl.className = 'teru-feed';
    feedEl.textContent = '';
    vid.currentTime = 0;
    vid.play().then(() => setTimeout(() => vid.pause(), 100)).catch(() => {});
    rafId = requestAnimationFrame(updateApproach);
    refreshTotalCount();
  };

  const complete = () => {
    finished = true;
    const flash = h('div', { class: 'teru-complete-flash' },
      h('img', { src: 'icons/teruteru.svg', class: 'teru-complete-icon', alt: '' }),
      h('div', { class: 'teru-complete-text' }, '完成！'),
      h('div', { class: 'teru-complete-sub' }, '晴れますように ☀️'),
    );
    vwrap.appendChild(flash);

    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);

    const countKey = `ojisan_${group}_teruteru`;
    const n = parseInt(localStorage.getItem(countKey) || '0') + 1;
    localStorage.setItem(countKey, String(n));
    onComplete?.(n);

    // 1.2s後にフェードアウト→自動リセット（連続で作れる）
    resetTimer = setTimeout(() => {
      flash.style.transition = 'opacity .3s';
      flash.style.opacity = '0';
      resetTimer = setTimeout(resetForNext, 300);
    }, 1200);
  };

  let running = false;
  const onTap = (e) => {
    e.stopPropagation();
    if (finished) return;
    if (!running) {
      running = true; lastT = null; approachT = 0;
      vid.play().then(() => setTimeout(() => vid.pause(), 100)).catch(() => {});
      rafId = requestAnimationFrame(updateApproach);
      return;
    }
    const inZone = approachT >= 0.62;
    if (inZone) {
      step++; drawDots(); showVideoStep(step);
      spawnBurst(); popTapZone();
      if (navigator.vibrate) navigator.vibrate(50);

      if (step >= STEPS) {
        // 最終タップ：リングをすぐ止めてから完成フラッシュへ
        cancelAnimationFrame(rafId);
        approachRing.style.display = 'none';
        tapZone.style.display = 'none';
        pop('🌤 PERFECT！', 'ok');
        setTimeout(complete, 480); // バーストが消えてから完成フラッシュ
      } else {
        pop('✨ GOOD!', 'ok');
      }
    } else {
      pop('💧 もう少し！', 'miss');
      if (navigator.vibrate) navigator.vibrate(20);
      approachT = 0; lastT = null;
    }
  };

  const card = h('div', { class: 'teru-card', onclick: onTap },
    h('div', { class: 'teru-head' },
      h('span', {}, '☁️ てるてる坊主を作る'),
      totalCountEl,
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
