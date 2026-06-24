import { h, topbar, setChildren } from '../dom.js';
import { getMe, setMe, getGroup, leave } from '../state.js';
import { getStore } from '../firebase.js';
import { navigate } from '../router.js';
import { collectMembers, avatarColor } from '../ui.js';

export default async function settings() {
  const store = await getStore();
  const me = getMe();
  const group = getGroup();
  const name = h('input', { class: 'input', type: 'text', value: me, maxlength: '12' });

  const save = () => {
    const n = name.value.trim();
    if (n) { setMe(n); navigate('home'); }
  };

  const copyBtn = h('button', { class: 'btn-sub', onclick: () => {
    navigator.clipboard?.writeText(group);
    copyBtn.textContent = 'コピーした！';
    setTimeout(() => { copyBtn.textContent = 'コピー'; }, 1500);
  } }, 'コピー');

  // ---- 参加メンバー（データから集計） ----
  let items = [], events = [];
  const memberList = h('div', { class: 'member-list' });
  const renderMembers = () => {
    const members = collectMembers(items, events, me);
    setChildren(memberList, ...members.map(mb =>
      h('div', { class: 'member' + (mb.isMe ? ' me' : '') },
        h('span', { class: 'member-av', style: { background: avatarColor(mb.name) } }, (mb.name || '?').slice(0, 1)),
        h('span', { class: 'member-name' }, mb.name, mb.isMe ? h('span', { class: 'member-you' }, 'あなた') : null),
      ),
    ));
  };
  const unsubI = store.items.watch(group, data => { items = data; renderMembers(); });
  const unsubE = store.events.watch(group, data => { events = data; renderMembers(); });

  const el = h('div', { class: 'screen form-screen' },
    topbar('設定', () => navigate('home')),
    h('div', { class: 'scroll pad' },
      h('div', { class: 'mode-badge' + (store.mode === 'firebase' ? ' live' : '') },
        store.mode === 'firebase'
          ? '🟢 共有モード（Firebase）— 仲間と同期中'
          : '🟡 お試しモード — この端末内だけ。共有するには Firebase 設定が必要（README参照）'),
      h('label', { class: 'field' }, h('span', { class: 'field-lbl' }, 'あなたの名前'), name),
      h('div', { class: 'field' },
        h('span', { class: 'field-lbl' }, 'グループの合言葉'),
        h('div', { class: 'copybox' }, h('code', {}, group), copyBtn),
        h('span', { class: 'field-hint' }, 'この合言葉を仲間に教えると、同じ部屋に入れます。'),
      ),
      h('button', { class: 'btn-primary', onclick: save }, '保存'),
      h('hr', {}),
      h('div', { class: 'field' },
        h('span', { class: 'field-lbl' }, '参加している仲間'),
        memberList,
        h('span', { class: 'field-hint' }, '投稿・投票・リアクションなどに参加した人を自動で表示しています。'),
      ),
      h('hr', {}),
      h('button', { class: 'btn-sub danger full', onclick: () => {
        if (confirm('このグループから抜ける？（この端末の設定だけ消えます）')) { leave(); navigate('setup'); }
      } }, 'グループから抜ける'),
    ),
  );
  el.__cleanup = () => { unsubI?.(); unsubE?.(); };
  renderMembers();
  return el;
}
