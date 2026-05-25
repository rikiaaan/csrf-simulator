# CSRFシミュレーター

CSRFの概要は理解しているが、実践できる環境はそんなにないと感じ、サーバー構築等の練習にもいいので自作することにした。



# 起動手順
リポジトリのトップディレクトリにあるdocker-compose.ymlを使用し、
```bash
docker compose up
```
で起動する。
unboundのコンパイルが走るが、根気よく待つ。
その後、ネットワークの設定からDNSサーバーを127.0.0.1に向け、
hxxps[:]//general.csrf-s[.]internal/index.htmlにアクセスする
シミュレーターの使用が終了したら、
```bash
docker compose down
```
で終了し、DNSサーバーの設定も元に戻す


# 利用方法
1. `https://general.csrf-s.internal`にアクセスする。この際、安全ではない通信ですと出るが、無視して良い。
2. 新規登録ページに行き、アカウントを作成する。
3. /home.htmlにリダイレクトされたら、投稿機能が動作することを確認する。（なにか適当に投稿する）
4. ログイン状態を維持したまま、`https://evil.csrf-s.internal`にアクセスする。ここでも、安全ではない通信ですと出るが、無視して良い。
5. 「最強になる」ボタンを押す。



# 技術スタック

フロントエンド: nginx html css javascript
バックエンド: node.js typescript fastify sqlite argon2id
リバースプロキシ: nginx
DNSサーバー: unbound
インフラ: docker compose + nginx



## フロントエンド(掲示板) (front_general)
ドメイン: general.csrf-s[.]internal
簡易的な掲示板サイト
簡易的とはいいつつログイン認証機能は作る
CSRFのシミュレーターであってXSSのシミュレーターではないため、XSSの対策はしっかりする
モダンなフレームワーク(ReactやVue等)はオーバースペックなため使用しないことにした

アクセスできるページ:
(ログイン前)
/ : トップページ。現在投稿されているメッセージが一覧で表示される
/register : アカウント登録ページ
/login : ログインページ。

(ログイン後)
/home : トップページ。現在投稿されているメッセージが一覧で表示される。ログイン前と違い、投稿するためのフォームがある。
/logout : ログアウトできる。アクセス直後、cookieを削除し、リダイレクトでログイン前のトップページに飛ばされる


## バックエンド (backend)
fastifyやargon2を使ったモダンな構成
ただし、CSRF関連のセキュリティ対策は意図的に一切しない。
セッションIDにはUUID4を使う。


### エンドポイント一覧
GET /api/messages
`[{"content": string,"date": string, "author": string}, ...]`
現在投稿されているメッセージ一覧を取得する


POST /api/register
`username=...&password=...`
アカウントを新規登録する


POST /api/login
`username=...&password=...`
ログインできる


GET /api/user
`{"username": string}`
自身のユーザー名を取得する


POST /api/submit_message
`content=...`
掲示板にメッセージを書き込む

### sqlite テーブル構造

users
| column     | type                      |
| ---------- | ------------------------- |
| "id"       |  INTEGER NOT NULL UNIQUE  |
| "name"     |  TEXT NOT NULL            |
| "password" |  TEXT NOT NULL            |

messages
| column    | type                      |
| --------- | ------------------------- |
| "id"      |  INTEGER NOT NULL UNIQUE  |
| "author"  |  INTEGER NOT NULL         |
| "date"    |  TEXT NOT NULL            |
| "content" |  TEXT NOT NULL            |

sessions
| column    | type                      |
| --------- | ------------------------- |
| "id"      |  INTEGER NOT NULL UNIQUE  |
| "session" |  TEXT NOT NULL            |
| "user_id" |  INTEGER NOT NULL         |


## フロントエンド(攻撃用) (front_evil)
ドメイン: evil.csrf-s[.]internal
めっちゃ簡易的な攻撃用サイト
バックエンドもなく、nginxで静的に公開しているだけ
掲示板でログインをしている状態で
攻撃用サイトにあるボタンをクリックしたら掲示板のサイトに勝手に書き込みがされるよう設計する


## リバースプロキシ (reverse_proxy)
ドメイン名やパスによってバックエンドかフロントエンドかを振り分ける
例:
- hxxps[:]//general.csrf-s[.]internal/index.html -> hxxp[:]//frontend
- hxxps[:]//general.csrf-s[.]internal/api/login -> hxxp[:]//backend/api/login
- hxxps[:]//evil.csrf-s[.]internal/index.html -> hxxp[:]//frontend-evil


## DNSサーバ (unbound-dns)
general.csrf-s[.]internal, evil.csrf-s[.]internalを解決させるためだけに使用
それ以外のクエリは9.9.9.9に転送



# 注意事項
このシミュレーターは学習用に作られており、実際の攻撃には使用しないでください。
