console.log('[firebase.js] loaded');
// ============================================================
//  データ層（store）
//  「お試しモード(localStorage)」と「共有モード(Firestore)」を
//  同じ呼び出し方で使えるようにする。画面側は getStore() を await。
//
//    const store = await getStore();
//    store.items.watch(group, cb) / add / update / remove
//    store.events.watch(group, cb) / add / update / remove
//    store.mode === 'firebase' | 'local'
//
//  データはグループ（合言葉）配下にまとめる:
//    Firestore: groups/{合言葉}/items, groups/{合言葉}/events
// ============================================================
import { firebaseConfig, isFirebaseConfigured } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const byNew = (a) => [...a].sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));

// ---- お試しモード（localStorage） ----
function localStore() {
  const key = (g, kind) => `ojisan_${g}_${kind}`;
  const read = (g, kind) => {
    try { return JSON.parse(localStorage.getItem(key(g, kind)) || '[]'); }
    catch { return []; }
  };
  const write = (g, kind, v) => localStorage.setItem(key(g, kind), JSON.stringify(v));

  // groupId -> Set(cb)  画面内の即時再描画用
  const reg = { items: new Map(), events: new Map() };
  const subs = (kind, g) => {
    if (!reg[kind].has(g)) reg[kind].set(g, new Set());
    return reg[kind].get(g);
  };
  const emit = (kind, g) => { const d = byNew(read(g, kind)); subs(kind, g).forEach(cb => cb(d)); };

  const make = (kind) => ({
    watch(g, cb) { const s = subs(kind, g); s.add(cb); cb(byNew(read(g, kind))); return () => s.delete(cb); },
    async add(g, d) { const a = read(g, kind); a.push({ ...d, id: genId(), createdAt: Date.now() }); write(g, kind, a); emit(kind, g); },
    async update(g, id, patch) { write(g, kind, read(g, kind).map(x => x.id === id ? { ...x, ...patch } : x)); emit(kind, g); },
    async remove(g, id) { write(g, kind, read(g, kind).filter(x => x.id !== id)); emit(kind, g); },
  });

  return { mode: 'local', items: make('items'), events: make('events') };
}

// ---- 共有モード（Firestore） ----
async function firebaseStore() {
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const {
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
    onSnapshot, query, orderBy,
  } = await import(`${SDK}/firebase-firestore.js`);
  const { getAuth, signInAnonymously } = await import(`${SDK}/firebase-auth.js`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  // セキュリティルールで「ログイン済みのみ書込可」にできるよう匿名ログイン
  try {
    await signInAnonymously(getAuth(app));
    console.log('Firebase: 匿名ログイン成功');
  } catch (e) {
    console.warn('Firebase: 匿名ログイン失敗', e.code, e.message);
  }

  const col = (g, kind) => collection(db, 'groups', g, kind);
  const ref = (g, kind, id) => doc(db, 'groups', g, kind, id);
  const toArr = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const make = (kind) => ({
    watch(g, cb) { return onSnapshot(query(col(g, kind), orderBy('createdAt', 'desc')), s => cb(toArr(s))); },
    add(g, d) { return addDoc(col(g, kind), { ...d, createdAt: Date.now() }); },
    update(g, id, patch) { return updateDoc(ref(g, kind, id), patch); },
    remove(g, id) { return deleteDoc(ref(g, kind, id)); },
  });

  return { mode: 'firebase', items: make('items'), events: make('events') };
}

// ---- 公開: store を一度だけ初期化して使い回す ----
let _store = null;
export function getStore() {
  if (!_store) {
    _store = isFirebaseConfigured()
      ? firebaseStore().catch(e => { console.error('Firebase初期化失敗→お試しモードに切替:', e); return localStore(); })
      : Promise.resolve(localStore());
  }
  return _store;
}
