import { h, setChildren } from '../dom.js';
import { getMe, getGroup } from '../state.js';
import { getStore } from '../firebase.js';
import { CATEGORIES, catMeta, urlCard, REACTIONS, timeAgo, bottomNav, enableSwipeNav } from '../ui.js';
import { navigate } from '../router.js';
import { openPostFlow } from '../postflow.js';
import { openEventFlow } from '../eventflow.js';
import { throwBurst, playBarrage } from '../effects.js';

const COLORS = ['#ff7a45', '#10b981', '#6366f1', '#ef4444', '#0ea5e9', '#f59e0b', '#7c5cff'];
const colorFor = s => COLORS[[...(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const sumEmp = o => Object.values(o || {}).reduce((a, b) => a + (b || 0), 0);

export default async function home(params = {}) {
  const me = getMe();
  const group = getGroup();
  const store = await getStore();

  let filter = params.filter || 'all';
  let items = [];
  const empTimers = {};

  const chipsEl = h('div', { class: 'catbar' });
  const listEl = h('div', { class: 'feed chat' });

  const chip = (id, label, icon) => h('button',
    { class: 'cat-chip' + (filter === id ? ' on' : ''), onclick: () => { filter = id; render(); } },
    `${icon} ${label}`);

  const render = () => {
    chipsEl.replaceChildren(chip('all', 'すべて', '🌀'), ...CATEGORIES.map(c => chip(c.id, c.label, c.icon)));
    const shown = filter === 'all' ? items : items.filter(i => i.category === filter);
    listEl.replaceChildren(...(shown.length ? shown.map(card) : [emptyState()]));
  };

  const ghost = (catId, label, vals) => h('button', { class: 'ghost-ex', onclick: () => openPostFlow({ store, group, me, prefill: { catId, values: vals } }) }, label);
  const emptyState = () => h('div', { class: 'empty' },
    h('div', { class: 'empty-emoji' }, '🫙'),
    h('p', {}, 'まだ何もないよ。'),
    h('p', { class: 'muted' }, '思いついたものを ＋ から放り込もう！'),
    h('p', { class: 'muted small' }, 'たとえば、こんなの↓'),
    h('div', { class: 'ghosts' },
      ghost('eiga', '🎬 人がいっぱい死ぬからデューン3が観たい', { why: '人がいっぱい死ぬから', x: 'デューン3' }),
      ghost('tabemono', '🍜 無性に二郎系ラーメンが食べたい', { why: '無性に', x: '二郎系ラーメン' }),
      ghost('basho', '📍 ロケがよすぎて河口湖に行きたい', { why: 'ロケがよすぎて', x: '河口湖' }),
    ),
  );

  const drawPile = (el, emp) => {
    const names = Object.keys(emp || {});
    setChildren(el,
      ...names.slice(0, 5).map(n => h('span', { class: 'dot', style: { background: colorFor(n) } }, n.slice(0, 1))),
      names.length > 5 ? h('span', { class: 'more' }, '+' + (names.length - 5)) : null,
    );
  };

  const card = (it) => {
    const m = catMeta(it.category);
    const reacts = it.reactions || {};
    const doneNames = Array.isArray(it.done) ? it.done : [];
    const iDone = doneNames.includes(me);
    const reviews = Array.isArray(it.reviews) ? it.reviews : [];
    const text = it.text || it.title || '';

    // 「俺も！」共感（連打で投げる）
    const emp = it.empathy || {};
    const cntEl = h('span', { class: 'cnt' }, String(sumEmp(emp)));
    const pileEl = h('div', { class: 'pile' }); drawPile(pileEl, emp);
    const oreBtn = h('button', { class: 'ore', onclick: () => tapOre(it, cntEl, pileEl, oreBtn) }, '🤙 俺も！', cntEl);

    const emojiReacts = REACTIONS.map(emo => {
      const who = reacts[emo] || [];
      const btn = h('button', { class: 'react' + (who.includes(me) ? ' on' : ''), onclick: () => toggleReact(it, emo, btn) },
        h('span', { class: 'react-emo' }, emo), who.length ? h('span', { class: 'react-n' }, String(who.length)) : null);
      if (who.length) btn.title = who.join('、');
      return btn;
    });

    const imgs = (it.images && it.images.length)
      ? h('div', { class: 'img-grid n' + Math.min(it.images.length, 4) }, ...it.images.slice(0, 4).map(src => h('img', { class: 'post-img', src, loading: 'lazy' })))
      : null;

    // 感想ループ
    const reviewList = reviews.map((r, i) => {
      const likes = Array.isArray(r.likes) ? r.likes : [];
      const likeBtn = h('button', { class: 'kanso-back' + (likes.includes(me) ? ' on' : ''), onclick: () => likeReview(it, i) },
        (likes.includes(me) ? '❤️' : '🤍') + (likes.length ? ' ' + likes.length : ' 返す'));
      return h('div', { class: 'kanso-item' },
        h('span', { class: 'av', style: { background: colorFor(r.by) } }, (r.by || '?').slice(0, 1)),
        h('div', { class: 'kbody' },
          h('div', { class: 'kwho' }, `${r.by}（${m.verb}）`),
          h('div', { class: 'kmsg' }, r.msg),
          likeBtn,
        ),
      );
    });
    let reviewForm = null;
    if (iDone) {
      const ta = h('textarea', { class: 'kanso-ta', rows: '2', placeholder: `${m.verb}感想は？（例：最高だった）` });
      reviewForm = h('div', { class: 'kanso-form open' }, ta,
        h('button', { class: 'kanso-send', onclick: () => { const v = ta.value.trim(); if (v) addReview(it, v); } }, '感想を共有'));
    }
    const reviewSection = (reviewList.length || reviewForm)
      ? h('div', { class: 'kanso' }, ...reviewList, reviewForm)
      : null;

    return h('div', { class: 'bubble' + (iDone ? ' done-b' : '') },
      h('div', { class: 'b-head' },
        h('span', { class: 'b-cat', style: { background: m.color } }, `${m.icon} ${m.label}`),
        h('span', { class: 'ago' }, timeAgo(it.createdAt)),
      ),
      h('div', { class: 'b-text' }, text),
      it.url ? urlCard(it.url) : null,
      imgs,
      doneNames.length ? h('div', { class: 'done-names' }, `✅ ${doneNames.join('・')}が${m.verb}`) : null,
      h('div', { class: 'b-foot' }, oreBtn, pileEl, ...emojiReacts),
      h('div', { class: 'b-actions' },
        h('button', { class: 'mini-btn' + (iDone ? ' on' : ''), onclick: () => toggleDone(it) }, iDone ? `↩︎ 戻す` : `✅ ${m.verb}`),
        h('button', { class: 'mini-btn', onclick: () => toEvent(it) }, `🗓 ${m.eventLabel}`),
        it.createdBy === me ? h('button', { class: 'mini-btn danger', onclick: () => del(it) }, '🗑') : null,
      ),
      reviewSection,
    );
  };

  // ---- 操作 ----
  const tapOre = (it, cntEl, pileEl, btn) => {
    it.empathy = { ...(it.empathy || {}) };
    it.empathy[me] = (it.empathy[me] || 0) + 1;
    cntEl.textContent = String(sumEmp(it.empathy));
    drawPile(pileEl, it.empathy);
    btn.classList.remove('combo'); void btn.offsetWidth; btn.classList.add('combo');
    throwBurst(btn);
    clearTimeout(empTimers[it.id]);
    empTimers[it.id] = setTimeout(() => store.items.update(group, it.id, { empathy: it.empathy }), 600);
  };
  const toggleReact = (it, emo, btn) => {
    const reacts = { ...(it.reactions || {}) };
    const who = new Set(reacts[emo] || []);
    if (who.has(me)) who.delete(me); else { who.add(me); btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 320); }
    if (who.size) reacts[emo] = [...who]; else delete reacts[emo];
    store.items.update(group, it.id, { reactions: reacts });
  };
  const toggleDone = (it) => {
    const set = new Set(Array.isArray(it.done) ? it.done : []);
    set.has(me) ? set.delete(me) : set.add(me);
    store.items.update(group, it.id, { done: [...set] });
  };
  const addReview = (it, msg) => {
    const reviews = [...(Array.isArray(it.reviews) ? it.reviews : []), { by: me, msg, at: Date.now(), likes: [] }];
    store.items.update(group, it.id, { reviews });
  };
  const likeReview = (it, idx) => {
    const reviews = (Array.isArray(it.reviews) ? it.reviews : []).map((r, i) => {
      if (i !== idx) return r;
      const likes = new Set(Array.isArray(r.likes) ? r.likes : []);
      likes.has(me) ? likes.delete(me) : likes.add(me);
      return { ...r, likes: [...likes] };
    });
    store.items.update(group, it.id, { reviews });
  };
  const toEvent = (it) => openEventFlow({ store, group, me,
    idea: { itemId: it.id, category: it.category, text: it.text || it.title || '', url: it.url || '', images: it.images || [] },
  });
  const del = (it) => { if (confirm('この投稿を消す？')) store.items.remove(group, it.id); };

  // ---- 開いたとき：自分の投稿に届いた新しい共感を浴びる ----
  const seenKey = 'ojisan_' + group + '_seen';
  let played = false;
  const maybeBarrage = (data) => {
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(seenKey) || '{}'); } catch { /* noop */ }
    const entries = [];
    data.forEach(it => {
      if (it.createdBy === me) {
        const tot = sumEmp(it.empathy);
        const d = tot - (seen[it.id] || 0);
        if (d > 0) entries.push({ category: it.category, text: it.text || '', n: d });
        seen[it.id] = tot;
      }
    });
    localStorage.setItem(seenKey, JSON.stringify(seen));
    if (entries.length) playBarrage(entries);
  };

  const unsub = store.items.watch(group, data => {
    items = data; render();
    if (!played) { played = true; setTimeout(() => maybeBarrage(data), 450); }
  });

  const el = h('div', { class: 'screen home' },
    h('header', { class: 'appbar' },
      h('div', { class: 'brand' }, h('span', { class: 'brand-ico' }, '✨'), h('span', {}, 'ひろば')),
      h('button', { class: 'me-chip', onclick: () => navigate('settings') }, me, ' ⚙'),
    ),
    chipsEl,
    h('div', { class: 'scroll' }, listEl),
    h('button', { class: 'fab', onclick: () => openPostFlow({ store, group, me }) }, '＋'),
    bottomNav('home'),
  );
  el.__cleanup = unsub;
  enableSwipeNav(el, 'home');
  render();
  return el;
}
