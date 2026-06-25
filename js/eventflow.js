// イベント作成フロー（オーバーレイ）。よていのFABから呼ぶ。
//  背景dim → ゆる枠/具体 2択カード → 入力フォーム → 保存 → 紙吹雪 → 閉じる
import { h } from './dom.js';

const LOOSE_SLOTS = ['今週末', '来週末', '連休中', '来月中', '未定'];
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

export function openEventFlow({ store, group, me, prefill = null }) {
  const scrim = h('div', { class: 'scrim' });
  const layer = h('div', { class: 'flow-layer' });
  document.body.append(scrim, layer);
  document.body.style.overflow = 'hidden';
  raf2(() => scrim.classList.add('is-open'));
  scrim.addEventListener('click', closeAll);

  function closeAll() {
    const panel = layer.querySelector('.sheet, .center-card');
    if (panel) panel.classList.remove('is-open');
    scrim.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { scrim.remove(); layer.remove(); }, reduce() ? 0 : 240);
  }

  const showSheet = (node) => { layer.replaceChildren(node); raf2(() => node.classList.add('is-open')); };
  const showCenter = (card) => {
    const wrap = h('div', { class: 'center-wrap' }, card);
    layer.replaceChildren(wrap);
    raf2(() => card.classList.add('is-open'));
  };

  // Step 1: ゆる枠 vs 具体 の2択
  const stepKind = () => {
    const sheet = h('div', { class: 'sheet' },
      h('h3', { class: 'sheet-title' }, '予定のタイプを選んで'),
      h('div', { class: 'kind-choice-grid' },
        h('button', { class: 'kind-choice-card', onclick: () => stepForm('concrete') },
          h('div', { class: 'kc-icon' }, '🗓'),
          h('div', { class: 'kc-label' }, '具体的な予定'),
          h('div', { class: 'kc-sub' }, '日にちを決めてみんなに確認'),
        ),
        h('button', { class: 'kind-choice-card loose', onclick: () => stepForm('loose') },
          h('div', { class: 'kc-icon' }, '🍃'),
          h('div', { class: 'kc-label' }, 'ゆる枠'),
          h('div', { class: 'kc-sub' }, 'とりあえず遊ぼう！な呼びかけ'),
        ),
      ),
    );
    return sheet;
  };

  // Step 2: 入力フォーム（kind別）
  const stepForm = (kind) => {
    const title = h('input', { class: 'line-input', type: 'text',
      value: prefill?.title || '',
      placeholder: kind === 'loose' ? '例）今度みんなで飲もう' : '例）河口湖でキャンプ',
      maxlength: '60' });
    const memo = h('input', { class: 'line-input sub', type: 'text', placeholder: 'メモ（任意）' });
    const err = h('p', { class: 'form-err' });

    let dates = [];
    let looseSlots = new Set();
    let extraSection;

    if (kind === 'concrete') {
      const dateList = h('div', { class: 'taglist' });
      const dateInput = h('input', { type: 'date', class: 'input',
        style: { marginTop: '8px' } });
      const drawDates = () => dateList.replaceChildren(
        ...dates.map((d, i) => h('span', { class: 'tag' },
          new Date(d + 'T00:00').toLocaleDateString('ja', { month: 'short', day: 'numeric', weekday: 'short' }),
          h('button', { type: 'button', onclick: () => { dates.splice(i, 1); drawDates(); } }, '×'))),
      );
      dateInput.addEventListener('change', () => {
        const v = dateInput.value;
        if (v && !dates.includes(v)) { dates.push(v); dates.sort(); drawDates(); dateInput.value = ''; }
      });
      extraSection = h('div', { class: 'line-wrap' },
        h('p', { style: { margin: '10px 0 4px', fontSize: '13px', color: 'var(--muted)', fontWeight: '700' } }, '候補日（複数でも）'),
        dateInput,
        dateList,
      );
    } else {
      const chipWrap = h('div', { class: 'chips', style: { marginTop: '8px' } });
      const drawChips = () => chipWrap.replaceChildren(
        ...LOOSE_SLOTS.map(s => h('button', {
          type: 'button', class: 'chip' + (looseSlots.has(s) ? ' on' : ''),
          onclick: () => { looseSlots.has(s) ? looseSlots.delete(s) : looseSlots.add(s); drawChips(); },
        }, s)),
      );
      drawChips();
      extraSection = h('div', { class: 'line-wrap' },
        h('p', { style: { margin: '10px 0 4px', fontSize: '13px', color: 'var(--muted)', fontWeight: '700' } }, 'いつ頃？（複数でも）'),
        chipWrap,
      );
    }

    const save = async () => {
      const t = title.value.trim();
      if (!t) { err.textContent = 'タイトルを入れてね'; title.focus(); return; }
      err.textContent = '';
      await store.events.add(group, {
        title: t, kind,
        memo: memo.value.trim(),
        dates: [...dates],
        looseSlots: [...looseSlots],
        votes: {}, ideas: [],
        createdBy: me,
        updatedAt: Date.now(),
      });
      burst();
      closeAll();
    };

    const card = h('div', { class: 'center-card' },
      h('div', { class: 'cc-head' },
        h('span', { class: 'kind-badge' + (kind === 'loose' ? ' loose' : '') },
          kind === 'loose' ? '🍃 ゆる枠' : '🗓 具体的な予定'),
      ),
      h('div', { class: 'line-wrap' }, title),
      extraSection,
      h('div', { class: 'line-wrap' }, memo),
      err,
      h('div', { class: 'cc-actions' },
        h('button', { class: 'btn-sub', onclick: () => showSheet(stepKind()) }, '← 戻る'),
        h('button', { class: 'btn-primary', onclick: save }, 'この予定をつくる'),
      ),
    );
    showCenter(card);
    setTimeout(() => title.focus(), reduce() ? 0 : 140);
  };

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

  showSheet(stepKind());
}
