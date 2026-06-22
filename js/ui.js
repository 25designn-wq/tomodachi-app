// 画面共通のUI部品・定数。
import { h } from './dom.js';
import { navigate } from './router.js';

// カテゴリ定義 + 穴埋めテンプレ（v3.1）
//  heading = 入力画面の見出し（カテゴリ別）
//  primary = 対象（x）/ why = 動機・理由（メイン入力・自由句で助詞は付けない）
//  extra   = カテゴリ固有の任意スロット（食べたい=where, その他=note）
//  verb    = 「済」チェックの動詞（行動は名前あり表示）/ eventLabel = 予定化ボタンの語
export const CATEGORIES = [
  { id: 'kininaru', label: '気になる', icon: '✨', color: '#f59e0b', verb: '見た', eventLabel: 'やってみる',
    heading: 'なにが気になる？',
    primary: { key: 'x', ph: '例）渋谷の新しいサウナ' },
    why: { key: 'why', ph: 'なんで？例）ととのいたすぎて' },
    extra: null,
    render: v => `${v.why || ''}${v.x || ''}が気になる` },

  { id: 'basho', label: '行きたい', icon: '📍', color: '#10b981', verb: '行った', eventLabel: '行く',
    heading: 'どこに行きたい？',
    primary: { key: 'x', ph: '例）河口湖' },
    why: { key: 'why', ph: 'なんで？例）ロケがよすぎて' },
    extra: null,
    render: v => `${v.why || ''}${v.x || ''}に行きたい` },

  { id: 'eiga', label: '映画', icon: '🎬', color: '#6366f1', verb: '観た', eventLabel: '観に行く',
    heading: 'なに観たい？',
    primary: { key: 'x', ph: '例）デューン3' },
    why: { key: 'why', ph: 'なんで？例）人がいっぱい死ぬから' },
    extra: null,
    render: v => `${v.why || ''}${v.x || ''}を観たい` },

  { id: 'tabemono', label: '食べたい', icon: '🍜', color: '#ef4444', verb: '食べた', eventLabel: '食べに行く',
    heading: 'なに食べたい？',
    primary: { key: 'x', ph: '例）二郎系ラーメン' },
    why: { key: 'why', ph: 'なんで？例）無性に' },
    extra: { key: 'where', ph: 'どこで？（任意）' },
    render: v => `${v.why || ''}${v.where ? v.where + 'で' : ''}${v.x || ''}を食べたい` },

  { id: 'kau', label: '買う', icon: '🛒', color: '#0ea5e9', verb: '買った', eventLabel: '買いに行く',
    heading: 'なに買いたい？',
    primary: { key: 'x', ph: '例）新しい財布' },
    why: { key: 'why', ph: 'なんで？例）沼にハマって' },
    extra: null,
    render: v => `${v.why || ''}${v.x || ''}を買いたい` },

  { id: 'sonota', label: 'その他', icon: '📌', color: '#64748b', verb: 'チェック', eventLabel: 'やる',
    heading: 'ひとことどうぞ',
    primary: { key: 'x', ph: '思いついたこと、なんでも' },
    why: null,
    extra: { key: 'note', ph: 'ひとこと（任意）' },
    render: v => `${v.x || ''}${v.note ? '（' + v.note + '）' : ''}` },
];
export const catMeta = (id) =>
  CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// テンプレから一文を生成
export const buildText = (cat, v) => ((cat.render ? cat.render(v) : (v.x || '')) || '').trim();

// リアクション絵文字
export const REACTIONS = ['👍', '🔥', '😂', '👀'];

// 相対時刻
export function timeAgo(ms) {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'たった今';
  const m = s / 60; if (m < 60) return `${m | 0}分前`;
  const hh = m / 60; if (hh < 24) return `${hh | 0}時間前`;
  const d = hh / 24; if (d < 7) return `${d | 0}日前`;
  return new Date(ms).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

// 日付（YYYY-MM-DD）を「6/20(土)」表記に
export function fmtDate(d) {
  const [y, mo, da] = d.split('-').map(Number);
  const dt = new Date(y, mo - 1, da);
  const w = '日月火水木金土'[dt.getDay()];
  return `${mo}/${da}(${w})`;
}

// 丸いカテゴリバッジ（カードからはみ出す / 見出し用）
export function catBadge(catId, extraClass = '') {
  const m = catMeta(catId);
  return h('span', { class: 'cat-orb ' + extraClass, style: { background: m.color } }, m.icon);
}

// ドメイン＋ファビコンの「URLカード」
export function urlCard(url) {
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* noop */ }
  return h('a', { class: 'url-card', href: url, target: '_blank', rel: 'noopener', onclick: e => e.stopPropagation() },
    h('img', { class: 'url-fav', src: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`, alt: '', loading: 'lazy' }),
    h('span', { class: 'url-host' }, host),
    h('span', { class: 'url-go' }, '🔗'),
  );
}

// 下部ナビ（よていが主役＝先頭）
export function bottomNav(active) {
  const tab = (id, icon, label) => h('button',
    { class: 'nav-tab' + (active === id ? ' on' : ''), onclick: () => { if (active !== id) navigate(id); } },
    h('span', { class: 'nav-ico' }, icon),
    h('span', { class: 'nav-lbl' }, label),
  );
  return h('nav', { class: 'bottomnav' },
    tab('events', '🗓', 'よてい'),
    tab('home', '✨', 'ひろば'),
    tab('activity', '🔔', 'お知らせ'),
  );
}
