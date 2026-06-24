import { h } from '../dom.js';
import { setMe, setGroup } from '../state.js';
import { navigate } from '../router.js';

export default function setup() {
  const name = h('input', { class: 'input', type: 'text', placeholder: '例）たろう', maxlength: '12' });
  const group = h('input', { class: 'input', type: 'text', placeholder: '例）oji-camp', maxlength: '40' });
  const err = h('p', { class: 'form-err' });

  const submit = () => {
    const n = name.value.trim();
    const g = group.value.trim();
    if (!n) { err.textContent = '名前を入れてね'; return; }
    if (!g) { err.textContent = '合言葉を入れてね'; return; }
    setMe(n); setGroup(g);
    navigate('home');
  };
  group.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  return h('div', { class: 'screen setup' },
    h('div', { class: 'setup-hero' },
      h('div', { class: 'logo-badge' }, '🍻'),
      h('h1', {}, 'あそ部活'),
      h('p', { class: 'lead' }, '気になるもの・行きたい所・観たい映画・遊びの予定を、仲間とゆるく共有。'),
    ),
    h('div', { class: 'card form' },
      h('label', { class: 'field' },
        h('span', { class: 'field-lbl' }, 'あなたの名前'),
        name,
      ),
      h('label', { class: 'field' },
        h('span', { class: 'field-lbl' }, 'グループの合言葉'),
        group,
        h('span', { class: 'field-hint' }, '同じ合言葉を入れた人どうしで共有されます。仲間に教えてあげてね。'),
      ),
      err,
      h('button', { class: 'btn-primary big', onclick: submit }, 'はじめる'),
    ),
  );
}
