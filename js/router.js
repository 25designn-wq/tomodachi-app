// 画面遷移。screens/<name>.js を動的importして #app に差し替える。
// 各画面は default export で render(params) → 要素 を返す。
// 要素に el.__cleanup があれば、離れる時に呼ぶ（Firestore購読解除など）。
let currentEl = null;

export async function navigate(name, params = {}) {
  const app = document.getElementById('app');
  try {
    const mod = await import(`./screens/${name}.js`);
    const el = await mod.default(params || {});
    if (currentEl && typeof currentEl.__cleanup === 'function') {
      try { currentEl.__cleanup(); } catch (e) { console.warn(e); }
    }
    app.replaceChildren(el);
    currentEl = el;
    window.scrollTo(0, 0);
  } catch (e) {
    console.error('画面の読み込みに失敗:', name, e);
  }
}
