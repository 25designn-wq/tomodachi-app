// 画面遷移。screens/<name>.js を動的importして #app に差し替える。
// 各画面は default export で render(params) → 要素 を返す。
// 要素に el.__cleanup があれば、離れる時に呼ぶ（Firestore購読解除など）。
// dir='left'|'right' を渡すとスワイプ由来の横並び同時スライドになる。
let currentEl = null;

export async function navigate(name, params = {}, dir = null) {
  const app = document.getElementById('app');
  // 各画面のbottomNav()が必要に応じて表示する。ここでは一度隠す。
  document.getElementById('bottomnav-host')?.setAttribute('hidden', '');
  const prevEl = currentEl;
  try {
    const mod = await import(`./screens/${name}.js`);
    const el = await mod.default(params || {});
    currentEl = el;

    if (prevEl && typeof prevEl.__cleanup === 'function') {
      try { prevEl.__cleanup(); } catch (e) { console.warn(e); }
    }

    if (dir && prevEl && prevEl.parentNode === app) {
      // 両画面をflexで横並びにしてコンテナごとスライド（重なりゼロ）
      const goLeft = dir === 'left';

      prevEl.style.cssText = 'width:100vw;min-width:100vw;flex-shrink:0;overflow:hidden;';
      el.style.cssText    = 'width:100vw;min-width:100vw;flex-shrink:0;overflow:hidden;';

      const wrap = document.createElement('div');
      // goLeft: [prev][next]、右端(next)へスライド → translateX(-100vw)
      // goRight:[next][prev]、左端(next)が見える位置へ初期translateX(-100vw)→0
      wrap.style.cssText = `display:flex;width:200vw;will-change:transform;transform:${goLeft ? 'translateX(0)' : 'translateX(-100vw)'};`;
      goLeft ? wrap.append(prevEl, el) : wrap.append(el, prevEl);

      app.style.cssText = 'overflow:hidden;';
      app.replaceChildren(wrap);

      void wrap.offsetWidth; // reflow で初期位置を確定
      wrap.style.transition = 'transform .25s ease';
      wrap.style.transform = goLeft ? 'translateX(-100vw)' : 'translateX(0)';

      setTimeout(() => {
        prevEl.removeAttribute('style');
        el.removeAttribute('style');
        app.removeAttribute('style');
        app.replaceChildren(el);
        window.scrollTo(0, 0);
      }, 260);
    } else {
      app.replaceChildren(el);
      window.scrollTo(0, 0);
    }
  } catch (e) {
    console.error('画面の読み込みに失敗:', name, e);
  }
}
