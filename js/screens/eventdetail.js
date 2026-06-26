import { h, topbar, setChildren } from '../dom.js';
import { getMe, getGroup } from '../state.js';
import { getStore } from '../firebase.js';
import { fmtDate, catMeta, timeAgo } from '../ui.js';
import { navigate } from '../router.js';

const VOTE_BTNS = [
  { val: 'yes',   sym: '○', cls: 'yes'   },
  { val: 'maybe', sym: '△', cls: 'maybe' },
  { val: 'no',    sym: '×', cls: 'no'    },
];

export default async function eventdetail(params = {}) {
  const me = getMe();
  const group = getGroup();
  const id = params.id;
  const store = await getStore();

  // 既読タイムスタンプ管理（バッジ制御用）
  const seenKey = `ojisan_${group}_ev_seen_${id}`;
  const markSeen = () => localStorage.setItem(seenKey, String(Date.now()));
  markSeen();

  let ev = null;
  let items = [];
  let pickerOpen = false;
  let ideaInputOpen = false;
  let deleteConfirmOpen = false;
  let goConfirmOpen = false;
  let unconfirmOpen = false;
  let openCommentIdx = null; // コメント展開中の idea インデックス
  let pendingDelete = null;  // { idx, timer } — 削除保留中
  let undoToastEl = null;
  let deleteDateConfirm = null; // 候補日削除確認中の日付文字列
  const body = h('div', { class: 'scroll pad' });

  const flash = (msg) => {
    const t = h('div', { class: 'flash' }, msg);
    document.body.append(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('is-open')));
    setTimeout(() => { t.classList.remove('is-open'); setTimeout(() => t.remove(), 200); }, 1400);
  };

  const render = () => {
    if (!ev) { body.replaceChildren(h('p', { class: 'muted' }, '予定が見つからない…（削除されたかも）')); return; }
    const votes = ev.votes || {};
    const dates = ev.dates || [];
    const looseSlots = ev.looseSlots || [];
    const ideas = ev.ideas || [];
    const isCreator = ev.createdBy === me;

    // ---- 日程投票セクション（具体のみ）----
    let voteSection = [];
    if (ev.kind !== 'loose' && !ev.confirmed) {
      const dateRows = dates.map(d => {
        if (deleteDateConfirm === d) {
          return h('div', { class: 'card vote-row' },
            h('div', { class: 'inline-confirm' },
              h('p', {}, '他の人からも消えますが、本当に削除する？'),
              h('div', { class: 'inline-confirm-btns' },
                h('button', { class: 'btn-sub', onclick: () => { deleteDateConfirm = null; render(); } }, 'やめる'),
                h('button', { class: 'btn-sub danger', onclick: () => deleteDate(d) }, '削除する'),
              ),
            ),
          );
        }
        const counts = { yes: [], maybe: [], no: [] };
        Object.entries(votes).forEach(([name, v]) => { if (counts[v[d]]) counts[v[d]].push(name); });
        const mine = (votes[me] || {})[d];

        const btns = VOTE_BTNS.map(({ val, sym, cls }) =>
          h('button', { class: 'vote-big ' + cls + (mine === val ? ' on' : ''), onclick: () => vote(d, val) }, sym));

        return h('div', { class: 'card vote-row' },
          h('div', { class: 'vote-date-row' },
            h('div', { class: 'vote-date' }, fmtDate(d)),
            h('button', { class: 'vote-date-del',
              onclick: (e) => { e.stopPropagation(); deleteDateConfirm = d; render(); },
            }, '🗑'),
          ),
          h('div', { class: 'vote-big-row' }, ...btns),
          h('div', { class: 'vote-tally' },
            counts.yes.length  ? h('span', { class: 't yes'   }, '○ ' + counts.yes.join('  '))   : null,
            counts.maybe.length? h('span', { class: 't maybe' }, '△ ' + counts.maybe.join('  ')) : null,
            counts.no.length   ? h('span', { class: 't no'    }, '× ' + counts.no.join('  '))    : null,
          ),
        );
      });

      const newDate = h('input', { class: 'input', type: 'date' });
      const addDateBtn = h('button', { class: 'btn-sub', type: 'button', onclick: () => {
        const v = newDate.value;
        if (!v) { flash('日付を選んでね'); return; }
        if (dates.includes(v)) { flash('すでに追加済み'); return; }
        store.events.update(group, id, { dates: [...dates, v].sort(), updatedAt: Date.now() });
        markSeen();
        newDate.value = '';
      } }, '＋ 追加');

      voteSection = [
        h('h3', { class: 'sec' }, '📅 空き日を出す'),
        h('p', { class: 'muted small' }, '各日に ○ △ × をタップ。みんなの回答がリアルタイムで見えます。'),
        ...dateRows,
        h('div', { class: 'date-add', style: { marginTop: '8px' } }, newDate, addDateBtn),
      ];
    } else if (ev.kind === 'loose' && looseSlots.length) {
      voteSection = [
        h('div', { class: 'loose-slots' },
          ...looseSlots.map(s => h('span', { class: 'chip on' }, s)),
        ),
      ];
    }

    // ---- やりたいこと ----
    const linkedIds = new Set(ideas.map(i => i.itemId).filter(Boolean));
    const candidates = items.filter(it => !linkedIds.has(it.id));

    const picker = pickerOpen ? h('div', { class: 'picker' },
      candidates.length
        ? candidates.map(it => {
            const m = catMeta(it.category);
            return h('button', { class: 'picker-item', onclick: () => addIdeaFromItem(it) },
              h('span', { class: 'idea-ico sm', style: { background: m.color } }, m.icon),
              h('span', {}, it.text || it.title || ''));
          })
        : h('p', { class: 'muted small' }, 'ひろばに追加できるネタがありません'),
    ) : null;

    const ideaInputRow = ideaInputOpen ? (() => {
      const inp = h('input', { class: 'input', type: 'text', placeholder: 'やりたいことを入力', maxlength: '60' });
      setTimeout(() => inp.focus(), 40);
      return h('div', { class: 'idea-inline-add' },
        inp,
        h('div', { class: 'idea-inline-btns' },
          h('button', { class: 'btn-sub', onclick: () => { ideaInputOpen = false; render(); } }, 'キャンセル'),
          h('button', { class: 'btn-primary', style: { width: 'auto', padding: '10px 18px' }, onclick: () => {
            const t = inp.value.trim();
            if (!t) { inp.focus(); return; }
            store.events.update(group, id, { ideas: [...ideas, { category: 'sonota', text: t }], updatedAt: Date.now() });
            markSeen();
            ideaInputOpen = false;
          } }, '追加'),
        ),
      );
    })() : null;

    // やりたいこと行（コメント付き・削除保留中は非表示）
    const ideaRows = ideas.map((idea, i) => {
      if (pendingDelete && pendingDelete.idx === i) return null;
      const m = catMeta(idea.category);
      const comments = idea.comments || [];
      const isOpen = openCommentIdx === i;

      let commentSection = null;
      if (isOpen) {
        const inp = h('input', { class: 'idea-comment-input', placeholder: 'コメント…', maxlength: '100' });
        setTimeout(() => inp.focus(), 40);
        commentSection = h('div', { class: 'idea-comments' },
          ...comments.map(c => h('div', { class: 'idea-comment' },
            h('span', { class: 'idea-comment-av' }, (c.by || '?')[0]),
            h('div', { class: 'idea-comment-body' },
              h('span', { class: 'idea-comment-who' }, c.by),
              h('span', { class: 'idea-comment-text' }, c.text),
              h('span', { class: 'idea-comment-at' }, timeAgo(c.at)),
            ),
          )),
          h('div', { class: 'idea-comment-form' },
            inp,
            h('button', { class: 'idea-comment-send',
              onclick: (e) => { e.stopPropagation(); addComment(i, inp.value); },
            }, '送る'),
          ),
        );
      }

      return h('div', { class: 'idea-item' },
        h('div', { class: 'idea-row' },
          h('span', { class: 'idea-ico', style: { background: m.color } }, m.icon),
          h('span', { class: 'idea-text' }, idea.text),
          h('button', {
            class: 'idea-comment-btn' + (comments.length > 0 ? ' has-comments' : ''),
            onclick: (e) => { e.stopPropagation(); openCommentIdx = (isOpen ? null : i); render(); },
          }, comments.length > 0 ? `💬 ${comments.length}` : '💬'),
          h('button', { class: 'idea-del', onclick: () => removeIdea(i) }, '×'),
        ),
        commentSection,
      );
    });

    // ---- 決行ボタン ----
    const canConfirm = !ev.confirmed;

    let goSection = null;
    if (ev.confirmed) {
      goSection = unconfirmOpen
        ? h('div', { class: 'inline-confirm' },
            h('p', {}, '確定を取り消して候補日選択に戻す？'),
            h('div', { class: 'inline-confirm-btns' },
              h('button', { class: 'btn-sub', onclick: () => { unconfirmOpen = false; render(); } }, 'やめる'),
              h('button', { class: 'btn-sub', onclick: () => {
                store.events.update(group, id, { confirmed: false, updatedAt: Date.now() });
                markSeen();
                unconfirmOpen = false;
                render();
              } }, '取り消す'),
            ),
          )
        : h('button', { class: 'btn-sub', style: { marginTop: '4px' },
            onclick: () => { unconfirmOpen = true; render(); }
          }, '確定を取り消す（候補に戻す）');
    } else if (canConfirm) {
      goSection = goConfirmOpen
        ? h('div', { class: 'inline-confirm' },
            h('p', {}, '決行を確定する？ みんなに「確定」と表示されます。'),
            h('div', { class: 'inline-confirm-btns' },
              h('button', { class: 'btn-sub', onclick: () => { goConfirmOpen = false; render(); } }, 'やっぱりやめる'),
              h('button', { class: 'btn-primary', style: { width: 'auto', padding: '12px 24px' }, onclick: () => {
                store.events.update(group, id, { confirmed: true, updatedAt: Date.now() });
                markSeen();
                goConfirmOpen = false;
              } }, '🎉 決行！'),
            ),
          )
        : h('button', { class: 'btn-go full', onclick: () => { goConfirmOpen = true; render(); } },
            '🎉 決行を確定する！');
    }

    // ---- 削除 ----
    let deleteSection = null;
    if (isCreator && !ev.confirmed) {
      deleteSection = deleteConfirmOpen
        ? h('div', { class: 'inline-confirm danger' },
            h('p', {}, '本当にこの予定を削除する？'),
            h('div', { class: 'inline-confirm-btns' },
              h('button', { class: 'btn-sub', onclick: () => { deleteConfirmOpen = false; render(); } }, 'やっぱりやめる'),
              h('button', { class: 'btn-sub danger', onclick: () => { store.events.remove(group, id); navigate('events'); } }, '削除する'),
            ),
          )
        : h('button', { class: 'btn-sub danger full', style: { marginTop: '24px' }, onclick: () => { deleteConfirmOpen = true; render(); } },
            'この予定を削除');
    }

    setChildren(body,
      ev.confirmed ? h('div', { class: 'ev-confirmed-banner' }, '🎉 この予定は決行確定！') : null,
      h('div', { class: 'item-head' },
        h('span', { class: 'kind-badge' + (ev.kind === 'loose' ? ' loose' : '') },
          ev.kind === 'loose' ? '🍃 ゆる枠' : '🗓 予定'),
      ),
      h('h2', { class: 'ev-title' }, ev.title),
      ev.memo ? h('p', { class: 'card-memo' }, ev.memo) : null,

      ...voteSection,

      h('h3', { class: 'sec' }, '💡 やりたいこと'),
      ...ideaRows,
      ideaInputRow,
      !ideaInputOpen ? h('div', { class: 'idea-actions' },
        h('button', { class: 'btn-sub', onclick: () => { pickerOpen = !pickerOpen; ideaInputOpen = false; render(); } },
          pickerOpen ? '− 閉じる' : '＋ ひろばから追加'),
        h('button', { class: 'btn-sub', onclick: () => { ideaInputOpen = true; pickerOpen = false; render(); } }, '＋ じか書き'),
      ) : null,
      picker,

      goSection ? h('div', { style: { marginTop: '24px' } }, goSection) : null,
      deleteSection,
    );
  };

  const deleteDate = (d) => {
    const dates = ev.dates || [];
    const votes = ev.votes || {};
    const newDates = dates.filter(x => x !== d);
    const newVotes = {};
    Object.entries(votes).forEach(([name, v]) => {
      const updated = { ...v };
      delete updated[d];
      newVotes[name] = updated;
    });
    store.events.update(group, id, { dates: newDates, votes: newVotes, updatedAt: Date.now() });
    markSeen();
    deleteDateConfirm = null;
  };

  const vote = (d, val) => {
    const votes = { ...(ev.votes || {}) };
    const mine = { ...(votes[me] || {}) };
    if (mine[d] === val) delete mine[d]; else mine[d] = val;
    votes[me] = mine;
    store.events.update(group, id, { votes, updatedAt: Date.now() });
    markSeen();
  };

  const showUndoToast = (text) => {
    hideUndoToast();
    undoToastEl = h('div', { class: 'undo-toast' },
      h('span', { class: 'undo-toast-msg' }, `「${text}」を削除`),
      h('button', { class: 'undo-toast-btn', onclick: undoDelete }, '元に戻す'),
    );
    document.body.appendChild(undoToastEl);
    requestAnimationFrame(() => requestAnimationFrame(() => undoToastEl?.classList.add('is-open')));
    setTimeout(hideUndoToast, 5500);
  };

  const hideUndoToast = () => {
    if (!undoToastEl) return;
    undoToastEl.classList.remove('is-open');
    const el = undoToastEl; undoToastEl = null;
    setTimeout(() => el.remove(), 220);
  };

  const commitDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    const { idx } = pendingDelete;
    pendingDelete = null;
    const ideas = [...(ev.ideas || [])];
    if (idx < ideas.length) ideas.splice(idx, 1);
    store.events.update(group, id, { ideas, updatedAt: Date.now() });
    markSeen();
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    pendingDelete = null;
    hideUndoToast();
    render();
  };

  const removeIdea = (i) => {
    const idea = (ev.ideas || [])[i];
    if (!idea) return;
    if (pendingDelete) commitDelete(); // 保留中があれば先にコミット
    pendingDelete = { idx: i, timer: setTimeout(commitDelete, 5000) };
    render();
    showUndoToast(idea.text || 'やりたいこと');
  };

  const addIdeaFromItem = (it) => {
    const ideas = [...(ev.ideas || []), { itemId: it.id, category: it.category, text: it.text || it.title || '' }];
    pickerOpen = false;
    store.events.update(group, id, { ideas, updatedAt: Date.now() });
    markSeen();
  };

  const addComment = (ideaIdx, text) => {
    const t = text.trim();
    if (!t) return;
    const newIdeas = (ev.ideas || []).map((idea, i) => {
      if (i !== ideaIdx) return idea;
      const comments = [...(idea.comments || []), { by: me, text: t, at: Date.now() }];
      return { ...idea, comments };
    });
    store.events.update(group, id, { ideas: newIdeas, updatedAt: Date.now() });
    markSeen();
  };

  const unsubE = store.events.watch(group, list => { ev = list.find(e => e.id === id) || null; render(); });
  const unsubI = store.items.watch(group, list => { items = list; if (pickerOpen) render(); });

  const el = h('div', { class: 'screen detail' },
    topbar('予定の調整', () => navigate('events')),
    body,
  );
  el.__cleanup = () => { unsubE(); unsubI(); if (pendingDelete) commitDelete(); hideUndoToast(); };
  render();
  return el;
}
