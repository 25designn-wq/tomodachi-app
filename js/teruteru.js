// てるてる坊主ゲーム。ゲージが往復するのをいいタイミングで止める × 7回。
import { h } from './dom.js';

const STEPS      = 7;    // 7回成功で完成
const GAUGE_MS   = 1400; // ゲージ1往復にかかる時間（ms）
const GOOD_ZONE  = 0.25; // ゲージ中央±25% が「GOOD」ゾーン（全幅に対する割合）

const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

export function openTeruteruFlow({ group, onComplete }) {
  let step = 0, finished = false, rafId = null;
  let gaugePos = 0;   // 0.0 〜 1.0（左端 → 右端）
  let direction = 1;  // 1=右向き / -1=左向き
  let lastT = null;

  // ---- DOM ----
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

  const video = document.createElement('video');
  video.className = 'teru-video';
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'auto');
  video.muted = true;
  // webm が使える環境は軽い webm を、それ以外は mp4 を使う
  const srcWebm = document.createElement('source');
  srcWebm.src = './teruteru_web.webm'; srcWebm.type = 'video/webm';
  const srcMp4  = document.createElement('source');
  srcMp4.src  = './teruteru_web.mp4';  srcMp4.type  = 'video/mp4';
  video.append(srcWebm, srcMp4);
  video.load();

  const vwrap  = h('div', { class: 'teru-vwrap' }, video);
  const gaugeTrack = h('div', { class: 'teru-gauge-track' });
  const gaugeBar   = h('div', { class: 'teru-gauge-bar' });
  const gaugePin   = h('div', { class: 'teru-gauge-pin' });
  gaugeTrack.append(gaugeBar, gaugePin);

  const dotsEl = h('div', { class: 'teru-dots' });
  const feedEl = h('div', { class: 'teru-feed' });
  const msgEl  = h('div', { class: 'teru-msg' }, 'タップして始める');

  const drawDots = () => {
    dotsEl.replaceChildren(...Array.from({ length: STEPS }, (_, i) =>
      h('span', { class: 'teru-dot' + (i < step ? ' hit' : '') })
    ));
  };
  drawDots();

  // ---- ゲージ更新（rAF ループ） ----
  const updateGauge = (ts) => {
    if (!lastT) lastT = ts;
    const dt = (ts - lastT) / GAUGE_MS;
    lastT = ts;
    gaugePos += direction * dt * 2; // 0→1→0 で1往復
    if (gaugePos >= 1) { gaugePos = 1; direction = -1; }
    if (gaugePos <= 0) { gaugePos = 0; direction = 1;  }

    const pct = gaugePos * 100;
    gaugePin.style.left = `${pct}%`;

    // グッドゾーン（中央 ±GOOD_ZONE）にいる間はピンを強調
    const inZone = Math.abs(gaugePos - 0.5) < GOOD_ZONE;
    gaugePin.classList.toggle('in-zone', inZone);
    gaugeBar.style.opacity = inZone ? '1' : '0.35';

    rafId = requestAnimationFrame(updateGauge);
  };

  // ---- 動画を step 分まで再生してポーズ ----
  const advanceVideo = () => {
    if (!video.duration) return;
    video.currentTime = (step / STEPS) * video.duration;
    video.play().catch(() => {});
    setTimeout(() => video.pause(), 700);
  };

  // ---- フィードバック表示 ----
  const pop = (txt, cls) => {
    feedEl.textContent = txt;
    feedEl.className = 'teru-feed ' + cls;
    void feedEl.offsetWidth;
    feedEl.classList.add('show');
  };

  // ---- 完成 ----
  const complete = () => {
    finished = true;
    cancelAnimationFrame(rafId);
    gaugeTrack.style.display = 'none';
    msgEl.textContent = '☀️ できた！晴れますように…';
    video.muted = false;
    video.currentTime = 0;
    video.play().catch(() => {});

    const countKey = `ojisan_${group}_teruteru`;
    const n = parseInt(localStorage.getItem(countKey) || '0') + 1;
    localStorage.setItem(countKey, String(n));
    onComplete?.(n);

    video.addEventListener('ended', () => doClose(800), { once: true });
    setTimeout(() => doClose(), 14000);
  };

  // ---- タップ処理 ----
  let running = false;
  const onTap = (e) => {
    e.stopPropagation();
    if (finished) return;

    if (!running) {
      running = true;
      msgEl.textContent = '今だ！ とタップ！';
      lastT = null;
      rafId = requestAnimationFrame(updateGauge);
      return;
    }

    const inZone = Math.abs(gaugePos - 0.5) < GOOD_ZONE;
    if (inZone) {
      step++;
      drawDots();
      advanceVideo();
      pop(step === STEPS ? '🌤 PERFECT！' : '✨ GOOD!', 'ok');
      if (step >= STEPS) { setTimeout(complete, 300); return; }
    } else {
      // ゾーン外 → ゲージをリセットしてリトライ
      pop('💧 もう少し！', 'miss');
      direction = 1; gaugePos = 0; lastT = null;
    }
  };

  const card = h('div', { class: 'teru-card', onclick: onTap },
    h('div', { class: 'teru-head' },
      h('span', {}, '☁️ てるてる坊主を作る'),
      h('button', { class: 'teru-x',
        onclick: e => { e.stopPropagation(); doClose(); }
      }, '×'),
    ),
    vwrap,
    gaugeTrack,
    dotsEl,
    feedEl,
    msgEl,
  );

  const wrap = h('div', { class: 'teru-wrap' }, card);
  wrap.addEventListener('click', () => doClose()); // カード外タップで閉じる
  scrim.appendChild(wrap);
  raf2(() => card.classList.add('open'));
}
