import { h, topbar } from '../dom.js';
import { getMe, setMe, getGroup, leave } from '../state.js';
import { getStore } from '../firebase.js';
import { navigate } from '../router.js';

export default async function settings() {
  const store = await getStore();
  const name = h('input', { class: 'input', type: 'text', value: getMe(), maxlength: '12' });

  const save = () => {
    const n = name.value.trim();
    if (n) { setMe(n); navigate('home'); }
  };

  const copyBtn = h('button', { class: 'btn-sub', onclick: () => {
    navigator.clipboard?.writeText(getGroup());
    copyBtn.textContent = 'コピーした！';
    setTimeout(() => { copyBtn.textContent = 'コピー'; }, 1500);
  } }, 'コピー');

  return h('div', { class: 'screen form-screen' },
    topbar('設定', () => navigate('home')),
    h('div', { class: 'scroll pad' },
      h('div', { class: 'mode-badge' + (store.mode === 'firebase' ? ' live' : '') },
        store.mode === 'firebase'
          ? '🟢 共有モード（Firebase）— 仲間と同期中'
          : '🟡 お試しモード — この端末内だけ。共有するには Firebase 設定が必要（README参照）'),
      h('label', { class: 'field' }, h('span', { class: 'field-lbl' }, 'あなたの名前'), name),
      h('div', { class: 'field' },
        h('span', { class: 'field-lbl' }, 'グループの合言葉'),
        h('div', { class: 'copybox' }, h('code', {}, getGroup()), copyBtn),
        h('span', { class: 'field-hint' }, 'この合言葉を仲間に教えると、同じ部屋に入れます。'),
      ),
      h('button', { class: 'btn-primary', onclick: save }, '保存'),
      h('hr', {}),
      h('button', { class: 'btn-sub danger full', onclick: () => {
        if (confirm('このグループから抜ける？（この端末の設定だけ消えます）')) { leave(); navigate('setup'); }
      } }, 'グループから抜ける'),
    ),
  );
}
