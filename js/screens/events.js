import { h } from '../dom.js';
import { getMe, getGroup } from '../state.js';
import { getStore } from '../firebase.js';
import { bottomNav, timeAgo, fmtDate, enableSwipeNav } from '../ui.js';
import { navigate } from '../router.js';
import { openEventFlow } from '../eventflow.js';
import { openTeruteruFlow } from '../teruteru.js';
import { checkWeather } from '../teruteru-weather.js';

// 確定予定の「ベスト候補日」を返す（YYYY-MM-DD）
function bestDate(ev) {
  const dates = ev.dates || [];
  if (!dates.length) return null;
  const votes = ev.votes || {};
  return dates
    .map(d => ({ d, yes: Object.values(votes).filter(v => v[d] === 'yes').length }))
    .sort((a, b) => b.yes - a.yes)[0]?.d ?? null;
}

// YYYY-MM-DD から今日起点の日数（正=未来、0=今日、負=過去）
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, mo, da] = dateStr.split('-').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, mo - 1, da) - today) / 86400000);
}

// 確定した予定のカウントダウン目標日をリセットチェック
function checkTeruReset(group, list) {
  const countKey  = `ojisan_${group}_teruteru`;
  const targetKey = `ojisan_${group}_teruteru_target`;
  const stored    = localStorage.getItem(targetKey);
  if (!stored) return;
  const [y, mo, da] = stored.split('-').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (new Date(y, mo - 1, da) < today) {
    localStorage.setItem(countKey, '0');
    localStorage.removeItem(targetKey);
  }
}

// ソート: 確定を近い順 → 非確定を投稿新しい順
function sortEvents(a, b) {
  const ac = !!a.confirmed, bc = !!b.confirmed;
  if (ac !== bc) return ac ? -1 : 1;
  if (ac) {
    const ad = bestDate(a), bd = bestDate(b);
    if (!ad && !bd) return 0;
    if (!ad) return 1; if (!bd) return -1;
    return ad.localeCompare(bd);
  }
  return (b.createdAt || 0) - (a.createdAt || 0);
}

export default async function events() {
  const me    = getMe();
  const group = getGroup();
  const store = await getStore();

  let list = [];
  const listEl = h('div', { class: 'feed' });

  // ---- てるてる坊主バッジ ----
  const countKey = `ojisan_${group}_teruteru`;

  const teruCountEl = h('span', { class: 'teru-count-badge' });
  const refreshTeruCount = () => {
    const n = parseInt(localStorage.getItem(countKey) || '0');
    if (n > 0) {
      teruCountEl.replaceChildren(
        h('img', { src: 'icons/teruteru.svg', class: 'teru-badge-icon', alt: '' }),
        ` ${n}体`,
      );
    } else {
      teruCountEl.replaceChildren();
    }
  };
  refreshTeruCount();

  const teruStrip = h('button', { class: 'teru-strip',
    onclick: () => openTeruteruFlow({ group, onComplete: (n) => {
      // 最寄りの確定予定日をリセット目標として記録
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const nearest = [...list]
        .filter(ev => ev.confirmed)
        .map(ev => bestDate(ev))
        .filter(Boolean)
        .sort()
        .find(d => {
          const [y, mo, da] = d.split('-').map(Number);
          return new Date(y, mo - 1, da) >= today;
        });
      if (nearest) localStorage.setItem(`ojisan_${group}_teruteru_target`, nearest);
      refreshTeruCount();
    }}),
  },
    h('div', { class: 'teru-strip-left' },
      h('img', { src: 'icons/teruteru.svg', class: 'teru-icon', alt: '' }),
      h('span', { class: 'teru-strip-label' }, 'てるてる坊主を作る'),
    ),
    teruCountEl,
  );

  const render = () => {
    checkTeruReset(group, list);
    refreshTeruCount();
    checkWeather({ group, list, onReset: refreshTeruCount });
    const sorted = [...list].sort(sortEvents);
    listEl.replaceChildren(...(sorted.length ? sorted.map(card) : [emptyState()]));
  };

  const emptyState = () => h('div', { class: 'empty' },
    h('div', { class: 'empty-emoji' }, '🗓'),
    h('p', {}, 'まだ予定がないよ。'),
    h('p', { class: 'muted' }, '＋ で「遊ぼう」の枠を立てて、みんなで空き日を出し合おう！'),
  );

  const card = (ev) => {
    const votes      = ev.votes      || {};
    const dates      = ev.dates      || [];
    const ideas      = ev.ideas      || [];
    const looseSlots = ev.looseSlots || [];

    // 未読バッジ: ev.updatedAt が自分の最終既読より新しければ表示
    const lastSeen = parseInt(localStorage.getItem(`ojisan_${group}_ev_seen_${ev.id}`) || '0');
    const hasUpdate = !!(ev.updatedAt && ev.updatedAt > lastSeen);

    // コメント数合計（やりたいことバッジ）
    const totalComments = ideas.reduce((n, idea) => n + (idea.comments || []).length, 0);

    const tally = dates.map(d => {
      let yes = 0, maybe = 0;
      Object.values(votes).forEach(v => { if (v[d] === 'yes') yes++; else if (v[d] === 'maybe') maybe++; });
      return { d, yes, maybe };
    });
    const best = tally.slice().sort((a, b) => (b.yes * 2 + b.maybe) - (a.yes * 2 + a.maybe))[0];

    let dateInfo;
    if (ev.confirmed) {
      const d    = bestDate(ev);
      const days = daysUntil(d);
      if (days !== null) {
        const numTxt = days > 0 ? `あと${days}日！` : days === 0 ? '今日！🎉' : `${Math.abs(days)}日前`;
        dateInfo = h('div', { class: 'ev-countdown' },
          d ? h('span', { class: 'ev-countdown-date' }, fmtDate(d)) : null,
          h('span', { class: 'ev-countdown-num' }, numTxt),
        );
      } else {
        dateInfo = h('p', { class: 'ev-confirmed-line' }, '✅ 決行確定！');
      }
    } else if (ev.kind === 'loose') {
      dateInfo = looseSlots.length
        ? h('p', { class: 'muted' }, looseSlots.join(' · '))
        : h('p', { class: 'muted' }, 'タップして詳細を見る');
    } else if (best && best.yes) {
      dateInfo = h('p', { class: 'best-date' }, `いまのところ ${fmtDate(best.d)} が有力（○${best.yes}${best.maybe ? ' △' + best.maybe : ''}）`);
    } else {
      dateInfo = h('p', { class: 'muted' }, `候補 ${dates.length} 日 · タップして空き日を出す`);
    }

    return h('div', {
      class: 'card event' + (ev.confirmed ? ' confirmed' : ''),
      onclick: () => navigate('eventdetail', { id: ev.id }),
    },
      h('div', { class: 'item-head' },
        h('div', { class: 'item-head-left' },
          h('span', {
            class: 'kind-badge' + (ev.confirmed ? ' confirmed-badge' : ev.kind === 'loose' ? ' loose' : ''),
          }, ev.confirmed ? '✅ 確定' : ev.kind === 'loose' ? '🍃 ゆる枠' : '🗓 予定'),
          hasUpdate ? h('div', { class: 'ev-update-dot' }) : null,
        ),
        h('span', { class: 'ago' }, timeAgo(ev.createdAt)),
      ),
      h('div', { class: 'card-text' }, ev.title),
      ev.memo ? h('p', { class: 'card-memo' }, ev.memo) : null,
      dateInfo,
      ideas.length ? h('p', { class: 'idea-count' },
        `💡 やりたいこと ${ideas.length}` + (totalComments > 0 ? `　💬 ${totalComments}` : ''),
      ) : null,
    );
  };

  const unsub = store.events.watch(group, data => { list = data; render(); });

  const el = h('div', { class: 'screen events' },
    h('header', { class: 'appbar' },
      h('div', { class: 'brand' }, h('span', { class: 'brand-ico' }, '🍻'), h('span', {}, 'あそ部活')),
      h('button', { class: 'me-chip', onclick: () => navigate('settings') }, me, ' ⚙'),
    ),
    h('div', { class: 'scroll' }, teruStrip, listEl),
    h('button', { class: 'fab', onclick: () => openEventFlow({ store, group, me }) }, '＋'),
    bottomNav('events'),
  );
  el.__cleanup = unsub;
  enableSwipeNav(el, 'events');
  render();
  return el;
}
