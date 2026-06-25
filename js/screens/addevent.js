import { h, topbar } from '../dom.js';
import { getMe, getGroup } from '../state.js';
import { getStore } from '../firebase.js';
import { fmtDate } from '../ui.js';
import { navigate } from '../router.js';

export default async function addevent(params = {}) {
  const me = getMe();
  const group = getGroup();
  const store = await getStore();

  let kind = 'concrete';
  const kindBtn = (val, label) => h('button', {
    type: 'button', class: 'chip' + (kind === val ? ' on' : ''),
    onclick: () => { kind = val; drawKind(); },
  }, label);
  const kindWrap = h('div', { class: 'chips' });
  const drawKind = () => kindWrap.replaceChildren(kindBtn('concrete', '🗓 具体的な予定'), kindBtn('loose', '🍃 ゆる枠（とりあえず遊ぼう）'));
  drawKind();

  const title = h('input', { class: 'input', type: 'text', value: params.prefillTitle || '', placeholder: '例）河口湖でキャンプ / 今度みんなで', maxlength: '60' });
  const memo = h('textarea', { class: 'input area', rows: '2', placeholder: 'メモ（任意）' });

  const dates = [];
  const dateList = h('div', { class: 'taglist' });
  const dateInput = h('input', { class: 'input', type: 'date' });
  const drawDates = () => dateList.replaceChildren(
    ...dates.map((d, i) => h('span', { class: 'tag' }, fmtDate(d),
      h('button', { type: 'button', onclick: () => { dates.splice(i, 1); drawDates(); } }, '×'))),
  );
  const addDate = () => {
    const v = dateInput.value;
    if (v && !dates.includes(v)) { dates.push(v); dates.sort(); drawDates(); dateInput.value = ''; }
  };

  const err = h('p', { class: 'form-err' });
  const save = () => {
    const t = title.value.trim();
    if (!t) { err.textContent = 'タイトルを入れてね'; return; }
    store.events.add(group, {
      title: t, kind, memo: memo.value.trim(),
      dates: [...dates], votes: {},
      ideas: params.idea ? [params.idea] : [],
      createdBy: me,
      updatedAt: Date.now(),
    });
    navigate('events');
  };

  return h('div', { class: 'screen form-screen' },
    topbar('予定をつくる', () => navigate(params.idea ? 'home' : 'events')),
    h('div', { class: 'scroll pad' },
      params.idea ? h('div', { class: 'mode-badge live' }, `💡「${params.idea.text}」を予定にします`) : null,
      h('div', { class: 'field' }, h('span', { class: 'field-lbl' }, 'タイプ'), kindWrap),
      h('label', { class: 'field' }, h('span', { class: 'field-lbl' }, 'タイトル'), title),
      h('label', { class: 'field' }, h('span', { class: 'field-lbl' }, 'メモ'), memo),
      h('div', { class: 'field' },
        h('span', { class: 'field-lbl' }, '候補日（あとから追加もできます）'),
        h('div', { class: 'date-add' }, dateInput, h('button', { class: 'btn-sub', type: 'button', onclick: addDate }, '追加')),
        dateList,
      ),
      err,
      h('button', { class: 'btn-primary big', onclick: save }, 'この予定をつくる'),
    ),
  );
}
