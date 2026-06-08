# My Room Supabase v0.2

LINEの一人グループ運用を、自分専用Webアプリとして再現するプロトタイプ。

## v0.2で入れたもの

- Supabase Auth ログイン
- `my_rooms` / `my_room_messages`
- RLS前提
- PC/スマホ同期
- Inbox / Todo / URL / 日記ネタ の初回自動作成
- ルーム追加
- トーク投稿
- 画像投稿
- URLリンク化
- 全体検索 / ルーム内検索
- メッセージ削除（論理削除）
- メッセージ移動（Inbox → Todo / URL / 日記ネタなど）

## セットアップ

### 1. Supabase SQLを実行

`supabase-schema.sql` をSupabaseのSQL Editorで実行。

### 2. Authユーザーを作る

Supabase Dashboard → Authentication → Users  
自分用ユーザーを作成。

Public sign-upは無効推奨。

### 3. 設定値を入れる

`config.example.js` の以下を自分の値に変更。

```js
window.MY_ROOM_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
};
```

本番では `config.js` に変えて、`index.html` の読み込みも `config.js` に変えるのがおすすめ。

### 4. 起動

ローカルならVS CodeのLive Serverなどで開く。

GitHub Pagesに置く場合は、ログイン必須なのでURLを知られてもデータはRLSで守る構成。

## 注意

画像は現時点では `image_data` にbase64保存。  
小さいスクショならテスト可。大量画像や高画質画像はDB肥大化するので、将来はStorage化または画像なし運用を検討。

## 次の改善候補

- ルーム並び替え
- ルーム名編集
- ルーム削除
- メッセージ編集
- PWAアイコン作成
- 画像をSupabase Storageへ逃がす
- Discord風UI強化
- WhiteWhaleから開く導線追加


## v0.3変更

- メッセージ下の移動/削除ボタンを常時表示から `⋯` メニュー式に変更
- フォントをLINE PC寄せに変更
- 太すぎる文字を少し抑制


## v0.4変更

- 時刻をコメント本文のすぐ下に表示
- 時刻を本文カッコ内には入れない
- `⋯` メニューを廃止
- PCはダブルクリック、スマホは長押しで移動/削除ボタンを表示
