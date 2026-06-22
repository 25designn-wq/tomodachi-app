// 端末ローカルの設定。誰として(me)、どのグループ(合言葉)に居るか。
const K_ME = 'ojisan_me';
const K_GROUP = 'ojisan_group';

export const getMe = () => localStorage.getItem(K_ME) || '';
export const setMe = (v) => localStorage.setItem(K_ME, v);
export const getGroup = () => localStorage.getItem(K_GROUP) || '';
export const setGroup = (v) => localStorage.setItem(K_GROUP, v);
export const isReady = () => !!getMe() && !!getGroup();
export const leave = () => { localStorage.removeItem(K_ME); localStorage.removeItem(K_GROUP); };
