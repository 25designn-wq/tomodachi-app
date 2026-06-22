// エントリポイント。設定済みなら よてい（主役）、未設定なら セットアップ へ。
import { isReady } from './state.js';
import { navigate } from './router.js';

navigate(isReady() ? 'events' : 'setup');

// PWA（オフライン対応）。失敗しても致命的でないので握りつぶす。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
