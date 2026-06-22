import { h } from '../dom.js';
import { getMe, getGroup } from '../state.js';
import { getStore } from '../firebase.js';
import { catMeta, timeAgo, bottomNav } from '../ui.js';
import { navigate } from '../router.js';

const COLORS = ['#ff7a45', '#10b981', '#6366f1', '#ef4444', '#0ea5e9', '#f59e0b', '#7c5cff'];
const colorFor = s => COLORS[[...(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const sumEmp = o => Object.values(o || {}).reduce((a, b) => a + (b || 0), 0);
const fmtShort = d => { if (!d) return ''; const [, mo, da] = d.split('-').map(Number); return `${mo}/${da}`; };

export default async function activity(params = {}) {
  const me = getMe();
  const group = getGroup();
  const store = await getStore();

  let items = [], events = [];
  const listEl = h('div', { class: 'act-list' });

  const buildActs = () => {
    const acts = [];

    items.forEach(it => {
      // 感想（コメント）がついた
      (Array.isArray(it.reviews) ? it.reviews : []).forEach((r, idx) => {
        acts.push({ type: 'review', item: it, review: r, revIdx: idx, at: r.at });
      });

      // 済・見た・行った etc.
      const done = Array.isArray(it.done) ? it.done : [];
      if (done.length) acts.push({ type: 'done', item: it, who: done, at: it.createdAt - 1 });

      // 自分の投稿への共感
      if (it.createdBy === me && sumEmp(it.empathy) > 0) {
        acts.push({ type: 'empathy', item: it, at: it.createdAt - 2 });
      }

      // 自分の投稿へのリアクション絵文字
      if (it.createdBy === me) {
        const reacts = it.reactions || {};
        const hasReact = Object.values(reacts).some(a => a.length > 0);
        if (hasReact) acts.push({ type: 'react', item: it, reactions: reacts, at: it.createdAt - 3 });
      }
    });

    events.forEach(ev => {
      // 日程への投票
      if (Object.keys(ev.votes || {}).length > 0) {
        acts.push({ type: 'vote', event: ev, at: ev.createdAt - 1 });
      }
      // 予定へのネタ追加
      (ev.ideas || []).filter(idea => idea.itemId || idea.text).forEach(idea => {
        acts.push({ type: 'idea', event: ev, idea, at: ev.createdAt - 2 });
      });
    });

    return acts.sort((a, b) => (b.at || 0) - (a.at || 0));
  };

  const render = () => {
    const acts = buildActs();
    listEl.replaceChildren(...(acts.length ? acts.map(actCard).filter(Boolean) : [emptyState()]));
  };

  const emptyState = () => h('div', { class: 'empty' },
    h('div', { class: 'empty-emoji' }, '🔔'),
    h('p', {}, 'まだアクティビティはないよ'),
    h('p', { class: 'muted' }, 'みんながリアクションすると、ここに届くよ'),
  );

  const actCard = (act) => {
    try {
      switch (act.type) {
        case 'review': return reviewCard(act);
        case 'done': return doneCard(act);
        case 'empathy': return empathyCard(act);
        case 'react': return reactCard(act);
        case 'vote': return voteCard(act);
        case 'idea': return ideaCard(act);
      }
    } catch (e) { console.warn(e); return null; }
  };

  const catTag = (catId, override = null) => {
    if (override) return h('span', { class: 'act-cat', style: { background: override.color } }, override.label);
    const m = catMeta(catId);
    return h('span', { class: 'act-cat', style: { background: m.color } }, `${m.icon} ${m.label}`);
  };
  const myBadge = (label = '自分の投稿') => h('span', { class: 'act-badge' }, label);
  const agoEl = (t) => h('span', { class: 'act-ago' }, timeAgo(t));
  const av = (name, sm = false) =>
    h('span', { class: 'act-av' + (sm ? ' sm' : ''), style: { background: colorFor(name) } }, (name || '?').slice(0, 1));

  // ── 感想カード ──
  const reviewCard = ({ item, review: r, revIdx }) => {
    const m = catMeta(item.category);
    const likes = Array.isArray(r.likes) ? r.likes : [];
    const liked = likes.includes(me);
    const mine = item.createdBy === me;

    const likeBtn = h('button', {
      class: 'act-like' + (liked ? ' on' : ''),
      onclick: () => { doLikeReview(item, revIdx); },
    }, liked ? '❤️ 返した' : '🤍 返す', likes.length ? h('small', {}, ` ${likes.length}`) : null);

    return h('div', { class: 'act-card' + (mine ? ' mine' : '') },
      h('div', { class: 'act-meta' }, catTag(item.category), mine ? myBadge() : null, agoEl(r.at)),
      h('div', { class: 'act-title' }, item.text || ''),
      h('div', { class: 'act-review-row' },
        av(r.by),
        h('div', { class: 'act-review-body' },
          h('div', { class: 'act-who' }, `${r.by}（${m.verb}）`),
          h('div', { class: 'act-msg' }, r.msg),
          likeBtn,
        ),
      ),
    );
  };

  // ── 済（行った・観た etc.）カード ──
  const doneCard = ({ item, who }) => {
    const m = catMeta(item.category);
    const iDone = who.includes(me);
    const alreadyReviewed = Array.isArray(item.reviews) && item.reviews.some(r => r.by === me);
    const canReview = iDone && !alreadyReviewed;

    const taEl = h('textarea', { class: 'kanso-ta', rows: 2, placeholder: `${m.verb}感想は？` });
    const formEl = h('div', { class: 'act-rev-form' }, taEl,
      h('button', { class: 'kanso-send', onclick: () => {
        const v = taEl.value.trim();
        if (v) doAddReview(item, v);
      }}, '感想を共有'),
    );

    return h('div', { class: 'act-card' },
      h('div', { class: 'act-meta' }, catTag(item.category), agoEl(item.createdAt)),
      h('div', { class: 'act-title' }, item.text || ''),
      h('div', { class: 'act-done-line' }, `✅ ${who.join('・')}が${m.verb}`),
      canReview ? h('button', { class: 'act-btn', onclick: (e) => {
        formEl.classList.add('open');
        e.currentTarget.remove();
      }}, `💬 ${m.verb}感想を書く`) : null,
      formEl,
      !iDone ? h('button', { class: 'act-btn secondary', onclick: () => doToggleDone(item) }, `俺も${m.verb}`) : null,
    );
  };

  // ── 共感カード（自分の投稿への）──
  const empathyCard = ({ item }) => {
    const m = catMeta(item.category);
    const emp = item.empathy || {};
    const total = sumEmp(emp);
    const names = Object.keys(emp);
    return h('div', { class: 'act-card mine' },
      h('div', { class: 'act-meta' }, catTag(item.category), myBadge(), agoEl(item.createdAt)),
      h('div', { class: 'act-title' }, item.text || ''),
      h('div', { class: 'act-empathy-line' },
        '🤙 ', names.join('・'), ' が共感（', h('strong', {}, String(total)), ' 件）',
      ),
      h('button', { class: 'act-btn accent', onclick: () => navigate('addevent', {
        prefillTitle: (item.slots && item.slots.x) || item.text || '',
        idea: { itemId: item.id, category: item.category, text: item.text || '', url: item.url || '', images: item.images || [] },
      })}, '🗓 予定にする'),
    );
  };

  // ── 絵文字リアクションカード（自分の投稿への）──
  const reactCard = ({ item, reactions }) => {
    const summaries = Object.entries(reactions)
      .filter(([, who]) => who.length > 0)
      .map(([emo, who]) => h('span', { class: 'act-react-item' }, `${emo} `, h('small', {}, who.join('・'))));
    return h('div', { class: 'act-card mine' },
      h('div', { class: 'act-meta' }, catTag(item.category), myBadge(), agoEl(item.createdAt)),
      h('div', { class: 'act-title' }, item.text || ''),
      h('div', { class: 'act-react-line' }, ...summaries),
    );
  };

  // ── 予定 投票カード ──
  const voteCard = ({ event: ev }) => {
    const votes = ev.votes || {};
    const voterNames = Object.keys(votes);
    const myVote = votes[me] || {};
    const hasVoted = Object.keys(myVote).length > 0;
    const mine = ev.createdBy === me;

    const voteRows = voterNames.slice(0, 3).map(name => {
      const v = votes[name];
      const marks = (ev.dates || []).filter(d => v[d]).map(d => {
        const sym = v[d] === 'yes' ? '○' : v[d] === 'maybe' ? '△' : '×';
        return `${fmtShort(d)}${sym}`;
      }).join(' ');
      return h('div', { class: 'act-vote-row' }, av(name, true), h('span', { class: 'act-vote-marks' }, marks || '—'));
    });

    return h('div', { class: 'act-card' + (mine ? ' mine' : '') },
      h('div', { class: 'act-meta' },
        catTag(null, { color: '#6366f1', label: '🗓 よてい' }),
        mine ? myBadge('自分の予定') : null,
        agoEl(ev.createdAt),
      ),
      h('div', { class: 'act-title' }, ev.title || ''),
      h('div', { class: 'act-vote-list' }, ...voteRows,
        voterNames.length > 3 ? h('div', { class: 'act-more' }, `…他 ${voterNames.length - 3} 人`) : null,
      ),
      hasVoted
        ? h('button', { class: 'act-btn', onclick: () => navigate('eventdetail', { id: ev.id }) }, '詳細を見る')
        : h('button', { class: 'act-btn accent', onclick: () => navigate('eventdetail', { id: ev.id }) }, '○△× 投票する'),
    );
  };

  // ── 予定 ネタ追加カード ──
  const ideaCard = ({ event: ev, idea }) => {
    const m = idea.category ? catMeta(idea.category) : null;
    return h('div', { class: 'act-card' },
      h('div', { class: 'act-meta' },
        catTag(null, { color: '#6366f1', label: '🗓 よてい' }),
        agoEl(ev.createdAt),
      ),
      h('div', { class: 'act-title' }, ev.title || ''),
      h('div', { class: 'act-idea-line' },
        m ? h('span', { class: 'act-cat sm', style: { background: m.color } }, m.icon) : null,
        ` 「${idea.text || ''}」がネタに追加された`,
      ),
      h('button', { class: 'act-btn', onclick: () => navigate('eventdetail', { id: ev.id }) }, '予定を見る'),
    );
  };

  // ── アクション ──
  const doLikeReview = (it, idx) => {
    const reviews = (Array.isArray(it.reviews) ? it.reviews : []).map((r, i) => {
      if (i !== idx) return r;
      const likes = new Set(Array.isArray(r.likes) ? r.likes : []);
      likes.has(me) ? likes.delete(me) : likes.add(me);
      return { ...r, likes: [...likes] };
    });
    it.reviews = reviews;
    store.items.update(group, it.id, { reviews });
    render();
  };

  const doAddReview = (it, msg) => {
    const reviews = [...(Array.isArray(it.reviews) ? it.reviews : []), { by: me, msg, at: Date.now(), likes: [] }];
    it.reviews = reviews;
    store.items.update(group, it.id, { reviews });
    render();
  };

  const doToggleDone = (it) => {
    const set = new Set(Array.isArray(it.done) ? it.done : []);
    set.has(me) ? set.delete(me) : set.add(me);
    it.done = [...set];
    store.items.update(group, it.id, { done: it.done });
    render();
  };

  // ── ウォッチ ──
  let unsub1, unsub2;
  unsub1 = store.items.watch(group, data => { items = data; render(); });
  unsub2 = store.events.watch(group, data => { events = data; render(); });

  const el = h('div', { class: 'screen activity' },
    h('header', { class: 'appbar' },
      h('div', { class: 'brand' }, h('span', { class: 'brand-ico' }, '🔔'), h('span', {}, 'お知らせ')),
      h('button', { class: 'me-chip', onclick: () => navigate('settings') }, me, ' ⚙'),
    ),
    h('div', { class: 'scroll' }, listEl),
    bottomNav('activity'),
  );
  el.__cleanup = () => { unsub1?.(); unsub2?.(); };
  render();
  return el;
}
