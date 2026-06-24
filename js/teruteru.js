// てるてる坊主ゲーム。ゲージを動画内にオーバーレイ表示。
import { h } from './dom.js';

const STEPS    = 7;
const GAUGE_MS = 1400;
const WIN_ZONE = 0.25;

const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

export function openTeruteruFlow({ group, onComplete }) {
  let step = 0, finished = false, rafId = null;
  let gaugePos = 0, direction = 1, lastT = null;

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

  // 動画内オーバーレイ（タップゾーン＋ゲージ）
  const tapZone = h('div', { class: 'teru-tap-zone' }, '✦ TAP ✦');
  const ovBar   = h('div', { class: 'teru-ov-bar' });
  const ovPin   = h('div', { class: 'teru-ov-pin' });
  const ovGauge = h('div', { class: 'teru-ov-gauge' }, ovBar, ovPin);
  const ovMsg   = h('div', { class: 'teru-ov-msg' }, 'タップして始める');
  const overlay = h('div', { class: 'teru-overlay' }, ovMsg, tapZone, ovGauge);

  const vwrap = h('div', { class: 'teru-vwrap' }, vid, overlay);

  // ドット＆フィードバック（動画下）
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

  const updateGauge = (ts) => {
    if (!lastT) lastT = ts;
    const dt = (ts - lastT) / GAUGE_MS;
    lastT = ts;
    gaugePos += direction * dt * 2;
    if (gaugePos >= 1) { gaugePos = 1; direction = -1; }
    if (gaugePos <= 0) { gaugePos = 0; direction =  1; }
    ovPin.style.left = `${gaugePos * 100}%`;
    const inZone = Math.abs(gaugePos - 0.5) < WIN_ZONE;
    tapZone.classList.toggle('in-zone', inZone);
    ovPin.classList.toggle('in-zone', inZone);
    ovBar.style.opacity = inZone ? '1' : '0.3';
    rafId = requestAnimationFrame(updateGauge);
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
      running = true;
      ovMsg.textContent = '今だ！ とタップ！';
      lastT = null; rafId = requestAnimationFrame(updateGauge);
      return;
    }
    const inZone = Math.abs(gaugePos - 0.5) < WIN_ZONE;
    if (inZone) {
      step++; drawDots(); showVideoStep(step);
      pop(step === STEPS ? '🌤 PERFECT！' : '✨ GOOD!', 'ok');
      if (step >= STEPS) setTimeout(complete, 750);
    } else {
      pop('💧 もう少し！', 'miss');
      direction = 1; gaugePos = 0; lastT = null;
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
