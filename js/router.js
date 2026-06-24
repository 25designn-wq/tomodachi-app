// 画面遷移。screens/<name>.js を動的importして #app に差し替える。
// 各画面は default export で render(params) → 要素 を返す。
// 要素に el.__cleanup があれば、離れる時に呼ぶ（Firestore購読解除など）。
// dir='left'|'right' を渡すとスワイプ由来の横並び同時スライドになる。
let currentEl = null;

export async function navigate(name, params = {}, dir = null) {
  const app = document.getElementById('app');
  const prevEl = currentEl;
  try {
    const mod = await import(`./screens/${name}.js`);
    const el = await mod.default(params || {});
    currentEl = el;

    if (prevEl && typeof prevEl.__cleanup === 'function') {
      try { prevEl.__cleanup(); } catch (e) { console.warn(e); }
    }

    if (dir && prevEl && prevEl.parentNode === app) {
      // 両画面を横並びで同時スライド
      const inFrom = dir === 'left' ? '100vw' : '-100vw';
      const outTo  = dir === 'left' ? '-100vw' : '100vw';

      // 次画面を画面外に置いてappに追加（現在画面はそのまま）
      el.style.transform = `translateX(${inFrom})`;
      el.style.transition = 'none';
      el.style.position = 'absolute';
      el.style.inset = '0';
      app.style.position = 'relative';
      app.style.overflow = 'hidden';
      app.appendChild(el);

      // reflow を挟んで両方同時にアニメ開始
      void el.offsetWidth;
      const tr = 'transform .22s ease';
      prevEl.style.transition = tr;
      prevEl.style.transform = outTo;
      el.style.transition = tr;
      el.style.transform = '';

      setTimeout(() => {
        if (prevEl.parentNode === app) app.removeChild(prevEl);
        el.removeAttribute('style');
        app.removeAttribute('style');
        window.scrollTo(0, 0);
      }, 230);
    } else {
      app.replaceChildren(el);
      window.scrollTo(0, 0);
    }
  } catch (e) {
    console.error('画面の読み込みに失敗:', name, e);
  }
}
