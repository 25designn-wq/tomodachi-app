// Firebase の公開設定。Firebase Console で作成したプロジェクトの値に置き換える。
// ※ これらは公開してよい値（Firestore のセキュリティルールで保護する前提）。
// ※ 空のままでも「お試しモード(localStorage)」で動く。値を入れると自動で
//    「共有モード(Firestore・リアルタイム同期)」に切り替わる。設定手順は README.md。
export const firebaseConfig = {
  apiKey:            "AIzaSyDGi5zAZXNsohhnlPtvK2mCwCNrLE7rnHQ",
  authDomain:        "ojisan-app.firebaseapp.com",
  projectId:         "ojisan-app",
  storageBucket:     "ojisan-app.firebasestorage.app",
  messagingSenderId: "883362463396",
  appId:             "1:883362463396:web:8b4ce2e0248049cf58b031",
};

// apiKey と projectId が両方埋まっていれば共有モード。
export const isFirebaseConfigured = () =>
  !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
