import { h } from '../dom.js';
import { getMe, getGroup } from '../state.js';
import { getStore } from '../firebase.js';
import { bottomNav, timeAgo, fmtDate } from '../ui.js';
import { navigate } from '../router.js';
import { openEventFlow } from '../eventflow.js';

export default async function events() {
  const me = getMe();
  const group = getGroup();
  const store = await getStore();

  let list = [];
  const listEl = h('div', { class: 'feed' });

  const render = () => {
    listEl.replaceChildren(...(list.length ? list.map(card) : [emptyState()]));
  };

  const emptyState = () => h('div', { class: 'empty' },
    h('div', { class: 'empty-emoji' }, '🗓'),
    h('p', {}, 'まだ予定がないよ。'),
    h('p', { class: 'muted' }, '＋ で「遊ぼう」の枠を立てて、みんなで空き日を出し合おう！'),
  );

  const card = (ev) => {
    const votes = ev.votes || {};
    const dates = ev.dates || [];
    const ideas = ev.ideas || [];
    const looseSlots = ev.looseSlots || [];

    const tally = dates.map(d => {
      let yes = 0, maybe = 0;
      Object.values(votes).forEach(v => { if (v[d] === 'yes') yes++; else if (v[d] === 'maybe') maybe++; });
      return { d, yes, maybe };
    });
    const best = tally.slice().sort((a, b) => (b.yes * 2 + b.maybe) - (a.yes * 2 + a.maybe))[0];

    let dateInfo;
    if (ev.confirmed) {
      dateInfo = h('p', { class: 'ev-confirmed-line' }, '✅ 決行確定！');
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
        h('span', {
          class: 'kind-badge' + (ev.confirmed ? ' confirmed-badge' : ev.kind === 'loose' ? ' loose' : ''),
        }, ev.confirmed ? '✅ 確定' : ev.kind === 'loose' ? '🍃 ゆる枠' : '🗓 予定'),
        h('span', { class: 'ago' }, timeAgo(ev.createdAt)),
      ),
      h('div', { class: 'card-text' }, ev.title),
      ev.memo ? h('p', { class: 'card-memo' }, ev.memo) : null,
      dateInfo,
      ideas.length ? h('p', { class: 'idea-count' }, `💡 やりたいこと ${ideas.length}`) : null,
    );
  };

  const unsub = store.events.watch(group, data => { list = data; render(); });

  const el = h('div', { class: 'screen events' },
    h('header', { class: 'appbar' },
      h('div', { class: 'brand' }, h('span', { class: 'brand-ico' }, '🍻'), h('span', {}, 'おじ部')),
      h('button', { class: 'me-chip', onclick: () => navigate('settings') }, me, ' ⚙'),
    ),
    h('div', { class: 'scroll' }, listEl),
    h('button', { class: 'fab', onclick: () => openEventFlow({ store, group, me }) }, '＋'),
    bottomNav('events'),
  );
  el.__cleanup = unsub;
  render();
  return el;
}
