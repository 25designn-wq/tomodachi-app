// 投稿フロー（オーバーレイ演出）。ひろばのFABから呼ぶ。
//  背景dim → 丸ボタンのボトムシート → 中央モーダルで入力 → 確定で紙吹雪 → 閉じる
//  ※ ルーティングせず現在画面の上に重ねる（タイムラインを半調で残す）。
import { h } from './dom.js';
import { CATEGORIES, buildText, catBadge } from './ui.js';
import { compressImage } from './lib/image.js';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

export function openPostFlow({ store, group, me, prefill = null }) {
  let cat = null;
  const values = {};
  let url = '';
  const images = [];

  const scrim = h('div', { class: 'scrim' });
  const layer = h('div', { class: 'flow-layer' });
  document.body.append(scrim, layer);
  document.body.style.overflow = 'hidden';
  raf2(() => scrim.classList.add('is-open'));
  scrim.addEventListener('click', () => closeAll());

  function closeAll(after) {
    const panel = layer.querySelector('.sheet, .center-card');
    if (panel) panel.classList.remove('is-open');
    scrim.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { scrim.remove(); layer.remove(); after && after(); }, reduce() ? 0 : 240);
  }

  const showSheet = (node) => { layer.replaceChildren(node); raf2(() => node.classList.add('is-open')); };
  const showCenter = (card) => {
    const wrap = h('div', { class: 'center-wrap' }, card);
    layer.replaceChildren(wrap);
    raf2(() => card.classList.add('is-open'));
  };

  // ---- Step1: カテゴリ（ボトムシートに丸ボタンがせり上がる） ----
  const stepCat = () => h('div', { class: 'sheet' },
    h('h3', { class: 'sheet-title' }, 'なにを共有する？'),
    h('div', { class: 'orb-grid' },
      ...CATEGORIES.map((c, i) => h('button',
        { class: 'orb-pick', style: { '--c': c.color, '--i': i }, onclick: () => stepText(c) },
        h('span', { class: 'orb' }, c.icon),
        h('span', { class: 'orb-lbl' }, c.label),
      )),
    ),
  );

  // ---- Step2: 中央モーダルで入力（why主役） ----
  const stepText = (c) => {
    cat = c;
    const preview = h('div', { class: 'tmpl-preview' });
    const upd = () => {
      preview.textContent = buildText(c, values) || '…';
      preview.classList.remove('bump'); void preview.offsetWidth; preview.classList.add('bump');
    };
    const lineField = (key, ph, sub) => {
      const input = h('input', { class: 'line-input' + (sub ? ' sub' : ''), value: values[key] || '', placeholder: ph,
        oninput: e => { values[key] = e.target.value; upd(); } });
      return h('div', { class: 'line-wrap' }, input);
    };
    const xField = lineField(c.primary.key, c.primary.ph, false);
    const fields = [xField];
    if (c.why) fields.push(lineField(c.why.key, c.why.ph, true));
    if (c.extra) fields.push(lineField(c.extra.key, c.extra.ph, true));

    const next = h('button', { class: 'btn-primary big', onclick: () => {
      if (!(values[c.primary.key] || '').trim()) { xField.querySelector('input').focus(); return; }
      stepAttach();
    } }, '次へ');

    const card = h('div', { class: 'center-card' },
      h('div', { class: 'cc-head' }, catBadge(c.id, 'inline'), h('span', { class: 'cc-heading' }, c.heading)),
      ...fields,
      h('div', { class: 'pv-row' }, h('span', { class: 'pv-lbl' }, 'こんな感じ？'), preview),
      next,
    );
    upd();
    showCenter(card);
    setTimeout(() => xField.querySelector('input').focus(), reduce() ? 0 : 140);
  };

  // ---- Step3: URL / 画像 ----
  const stepAttach = () => {
    const c = cat;
    const urlInput = h('input', { class: 'input', type: 'url', value: url, placeholder: 'https://…（任意）', oninput: e => { url = e.target.value; } });
    const thumbs = h('div', { class: 'img-thumbs' });
    const draw = () => thumbs.replaceChildren(...images.map((src, i) =>
      h('div', { class: 'thumb' }, h('img', { src }), h('button', { type: 'button', onclick: () => { images.splice(i, 1); draw(); } }, '×'))));
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' },
      onchange: async e => {
        const picked = [...e.target.files].slice(0, 4 - images.length);
        for (const f of picked) { try { images.push(await compressImage(f)); } catch (err) { console.warn(err); } }
        draw(); file.value = '';
      } });
    const addBtn = h('button', { class: 'btn-sub', type: 'button', onclick: () => {
      if (images.length >= 4) { flash('画像は4枚まで'); return; }
      file.click();
    } }, '📷 画像を追加');

    const card = h('div', { class: 'center-card' },
      h('div', { class: 'pv-row final' }, h('span', { class: 'pv-lbl' }, 'こんな感じ？'), h('div', { class: 'tmpl-preview' }, buildText(c, values))),
      h('label', { class: 'field' }, h('span', { class: 'field-lbl' }, 'リンク（任意）'), urlInput),
      h('div', { class: 'field' }, h('span', { class: 'field-lbl' }, '画像（4枚まで・自動圧縮）'), addBtn, file, thumbs),
      h('div', { class: 'cc-actions' },
        h('button', { class: 'btn-sub', onclick: () => stepText(c) }, '← 戻る'),
        h('button', { class: 'btn-primary', onclick: doPost }, 'これを共有する'),
      ),
    );
    draw();
    showCenter(card);
  };

  const doPost = async () => {
    const text = buildText(cat, values).trim();
    if (!text) { stepText(cat); return; }
    try {
      await store.items.add(group, {
        category: cat.id, text, slots: { ...values },
        url: url.trim(), images: [...images],
        reactions: {}, done: [], createdBy: me,
      });
      burst();
      closeAll();
    } catch (e) {
      const msg = '投稿エラー: ' + e.message;
      console.error(e);
      // 長めに表示（デバッグ用）
      const t = document.createElement('div');
      t.style.cssText = 'position:fixed;top:20px;left:10px;right:10px;z-index:999;background:#ef4444;color:#fff;padding:14px;border-radius:12px;font-size:13px;word-break:break-all;';
      t.textContent = msg + ' [code:' + (e.code || '?') + ']';
      document.body.append(t);
      setTimeout(() => t.remove(), 8000);
    }
  };

  // 紙吹雪（DOM6片・1回・自動除去）
  const burst = () => {
    if (reduce()) return;
    const colors = ['#ff7a45', '#34d399', '#fbbf24', '#7c5cff'];
    for (let i = 0; i < 6; i++) {
      const p = h('i', { class: 'confetti', style: {
        background: colors[i % colors.length],
        '--dx': (Math.random() * 140 - 70) + 'px',
        '--dy': (-70 - Math.random() * 80) + 'px',
        '--rot': (Math.random() * 360) + 'deg',
      } });
      document.body.append(p);
      setTimeout(() => p.remove(), 760);
    }
  };
  // alertの代わりのミニトースト
  const flash = (msg) => {
    const t = h('div', { class: 'flash' }, msg);
    document.body.append(t);
    raf2(() => t.classList.add('is-open'));
    setTimeout(() => { t.classList.remove('is-open'); setTimeout(() => t.remove(), 200); }, 1400);
  };

  // 開始（空状態のゴースト投稿からはStep2にprefillで直行）
  if (prefill && prefill.catId) {
    const c = CATEGORIES.find(x => x.id === prefill.catId);
    if (c) { Object.assign(values, prefill.values || {}); stepText(c); return; }
  }
  showSheet(stepCat());
}
