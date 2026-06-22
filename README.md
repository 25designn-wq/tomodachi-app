# おじ部 🍻

おじさん仲間で「気になるもの・行きたい所・観たい映画・遊びの予定」をゆるく共有するスマホ向けWebアプリ。
ビルド不要・CDN読み込みのみの静的SPA（Vanilla JS + Firebase Firestore）。

## できること
- **ひろば**：投稿をタイムライン表示。`✨気になる / 📍行きたい / 🎬映画 / 🍜食べたい / 📌その他` のカテゴリで色分け＆絞り込み。リンク・メモ・タグ付き。👍🔥😂👀 でリアクション、「行った/観た」済みチェック。
- **よてい**：候補日を出して ○△× で日程合わせ。今いちばん有力な日を自動表示。
- カテゴリは [js/ui.js](js/ui.js) の `CATEGORIES` に1行足すだけで増やせる。

## まず動かす（お試しモード）
Firebase 未設定でも **この端末内だけ** で動きます（データ共有はされません）。
```bash
cd /Users/baton/Desktop/claude/ojisan_app
python3 -m http.server 8765
# → http://localhost:8765/
```
※ JS変更後に古い挙動なら **Cmd + Shift + R**。

## 仲間と共有する（Firebase 設定）
1. [Firebase Console](https://console.firebase.google.com/) で **プロジェクト作成**（Spark=無料枠でOK。**Blazeにしない**）。
2. **Firestore Database** を作成（本番モード or テストモード）。
3. **Authentication → Sign-in method → 匿名 を有効化**（このアプリは匿名ログインで書き込みます）。
4. プロジェクト設定 → マイアプリ → **ウェブアプリを追加** して `firebaseConfig` を取得。
5. [js/config.js](js/config.js) の各値を貼り付ける（`apiKey` と `projectId` が埋まると自動で共有モードに切替）。
6. **Firestore セキュリティルール**（身内利用向け・ログイン必須の最小構成）:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /groups/{group}/{coll}/{doc} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   ※ ルール変更の反映に **約1分** かかる。
7. アプリで同じ **合言葉** を入れた人どうしで共有されます。設定画面の「コピー」で合言葉を仲間に共有。

> ⚠️ コスト注意：Firestore は無料枠(Spark)で小規模なら十分。**従量課金のBlazeに上げない**こと。

## GitHub Pages にデプロイ（Public のみ）
```bash
cd /Users/baton/Desktop/claude/ojisan_app
git init
git config http.postBuffer 524288000   # push HTTP400対策
git config http.version HTTP/1.1        #   〃
git add .
git commit -m "initial commit"
git remote add origin https://github.com/25designn-wq/ojibu.git
git push -u origin main   # 失敗したら master を試す
```
GitHub → Settings → Pages → Branch を選んで Save。数分後に `https://25designn-wq.github.io/ojibu/` で公開。
- push のパスワードは **Personal Access Token (PAT)**（スコープ `repo`）。
- `.nojekyll` を同梱済み（Jekyll回避）。

## ファイル構成
```
ojisan_app/
├── index.html
├── manifest.json / sw.js / icons/icon.svg   # PWA
├── css/style.css
└── js/
    ├── config.js     # Firebase公開設定（ここを埋める）
    ├── app.js        # 起動
    ├── router.js     # 画面遷移
    ├── state.js      # localStorage（名前・合言葉）
    ├── firebase.js   # データ層（Firestore / localStorage 両対応）
    ├── dom.js        # h() ほかDOMヘルパー
    ├── ui.js         # カテゴリ定義・下部ナビ・共通部品
    └── screens/      # setup / home / additem / events / addevent / eventdetail / settings
```

## データ構造（Firestore）
```
groups/{合言葉}/
├── items/{id}   { category, title, url, memo, tags[], createdBy, done, reactions{絵文字:[名前]}, createdAt }
└── events/{id}  { title, memo, dates[YYYY-MM-DD], votes{名前:{日付:'yes'|'maybe'|'no'}}, createdBy, createdAt }
```
