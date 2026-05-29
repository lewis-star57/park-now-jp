# nginx 配信設定の手順書（GeoJSON の gzip 圧縮 & Content-Type 修正）

> 本番（park-now.tsk-estate.com / VPS + nginx）で、地図データ `13.geojson` が
> **無圧縮（約 680KB）** のまま配信されている問題を直すための手順書です。
>
> **この手順はこのチャットでは実行しません。** VPS への SSH 接続を伴う作業は、
> satei をデプロイするチャットでまとめて実施してください。ここでは「何を・なぜ・
> どう直すか」を記録しておくだけです。

---

## 結論（最小の修正・3 ステップ）

1. nginx に「`.geojson` は `application/geo+json` という種類のファイル」と教える
2. その種類を gzip 圧縮の対象リストに追加する
3. 設定を検査して反映する（`nginx -t` → `systemctl reload nginx`）

これだけで `13.geojson` の転送量が **約 680KB → 約 75KB（およそ 89% 削減）** になります。
アプリの表示自体は今でも動いていますが、初回読み込みが目に見えて軽くなります。

---

## 現状（本番の実測値・2026-05-29 確認）

`curl` で本番のレスポンスヘッダを確認した結果です。

| ファイル | Content-Type | gzip 圧縮 | 備考 |
|---|---|---|---|
| トップ HTML | `text/html` | ✅ あり | 問題なし |
| JS（`/_next/static/...js`） | `application/javascript` | ✅ あり | 問題なし |
| **`/data/13.geojson`** | **`application/octet-stream`** | **❌ なし** | **これが問題** |

実測コマンドと結果（GeoJSON のみ抜粋）:

```text
$ curl -s -H "Accept-Encoding: gzip" -I https://park-now.tsk-estate.com/data/13.geojson
Content-Type: application/octet-stream      ← 本来は application/geo+json
Content-Length: 696552                       ← 約 680KB。gzip が効いていれば ~75KB
（Content-Encoding: gzip のヘッダが付いていない＝無圧縮）
```

ローカルファイルで実際に圧縮した場合のサイズ:

| 状態 | サイズ | 削減率 |
|---|---|---|
| 無圧縮（現状） | 696,552 B（約 680KB） | — |
| gzip レベル6（通常） | 77,096 B（約 75KB） | 約 89% |
| gzip レベル9（最大） | 75,702 B（約 74KB） | 約 89% |

> レベル6と9の差はわずか約 1.4KB です。後述の「事前圧縮（gzip_static）」まで
> やり込む必要は薄く、**通常のオンザフライ圧縮で十分** と判断できます。

---

## 原因

- nginx は **gzip 自体は既に有効**（HTML も JS も圧縮されている）。
- ところが nginx の MIME 定義（`/etc/nginx/mime.types`）に `.geojson` の登録が無い。
  → 拡張子を判別できず、Content-Type が `application/octet-stream`（不明なバイナリ）に
  なってしまう。
- gzip の圧縮対象リスト（`gzip_types`）に `application/octet-stream` は入っていない
  （入れるべきでもない＝既に圧縮済みの画像等まで二重圧縮してしまうため）。
  → 結果として GeoJSON だけ圧縮対象から漏れる。

**つまり「`.geojson` の種類を正しく教える」ことが本質的な修正** で、Content-Type の
是正と gzip 有効化が同時に達成できます。

---

## 手順（VPS 上で実行）

> 実行は satei デプロイ用チャットで。すべて `sudo` 権限が必要です。
> 設定ファイルを編集する前に、必ずバックアップを取ってください。

### ステップ 0: 現在の設定箇所を特定する

`gzip_types` がどのファイルで定義されているかを探します（環境により場所が異なるため）。

```bash
grep -rn "gzip_types" /etc/nginx/
```

多くの場合 `/etc/nginx/nginx.conf` の `http { ... }` ブロック内にあります。

### ステップ 1: `.geojson` の Content-Type を登録する

`/etc/nginx/mime.types` を開き、`types { ... }` ブロックの中に 1 行追加します。

```bash
sudo cp /etc/nginx/mime.types /etc/nginx/mime.types.bak   # バックアップ
sudo nano /etc/nginx/mime.types
```

`types {` の中（既存の行に並べて）に追記:

```nginx
types {
    # ...既存の定義はそのまま...
    application/geo+json   geojson;
}
```

> ✅ ここは **追記のみ**。既存の行は絶対に消さないこと。

### ステップ 2: gzip の対象に `application/geo+json` を追加する

ステップ 0 で見つけた `gzip_types` の行を編集します（通常 `/etc/nginx/nginx.conf`）。

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak   # バックアップ
sudo nano /etc/nginx/nginx.conf
```

**既存の `gzip_types` の一覧に `application/geo+json` を“足す”** だけです。
（`gzip_types` は書き換えると既存リストを上書きしてしまうので、消さずに末尾へ追加）

修正前の例:

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

修正後（末尾に `application/geo+json` を追加）:

```nginx
gzip on;
gzip_min_length 1024;   # 任意: 1KB 未満は圧縮しない（無くても可）
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/geo+json;
```

> `gzip on;` は既に有効なはずなので、実質の追加は `application/geo+json` の 1 語だけです。

### ステップ 3: 設定を検査して反映する

```bash
sudo nginx -t          # 文法チェック（"syntax is ok" / "test is successful" を確認）
sudo systemctl reload nginx   # 無停止で再読み込み（restart ではなく reload）
```

> `reload` はリクエストを切らずに設定だけ入れ替えるため、ダウンタイムはありません。
> `nginx -t` が失敗したら reload せず、編集内容（特にカッコ・セミコロン）を見直してください。

---

## 確認方法（反映後）

### 1) gzip が効いているか

```bash
curl -s -H "Accept-Encoding: gzip" -D - -o /dev/null https://park-now.tsk-estate.com/data/13.geojson \
  | grep -iE "content-encoding|content-type"
```

期待する出力:

```text
Content-Type: application/geo+json
Content-Encoding: gzip
```

### 2) 実際の転送サイズが小さくなったか

```bash
# 圧縮ありの転送サイズ（~75KB 程度になるはず）
curl -s -H "Accept-Encoding: gzip" -o /dev/null -w "gzip:   %{size_download} bytes\n" https://park-now.tsk-estate.com/data/13.geojson
# 圧縮なし（従来通り ~680KB）
curl -s -o /dev/null -w "plain:  %{size_download} bytes\n" https://park-now.tsk-estate.com/data/13.geojson
```

> 注意: `-I`（HEAD リクエスト）だとオンザフライ gzip では `Content-Length` が出ず
> `Transfer-Encoding: chunked` になることがあります。サイズ確認は上記の GET +
> `%{size_download}` が確実です。

### 3) ブラウザでの確認

DevTools → Network タブで `13.geojson` を選び、
- Response Headers に `content-encoding: gzip`
- Size 列が「転送 ~75KB / 実体 ~680KB」のように表示される

---

## （任意）さらに最適化したい場合: 事前圧縮 gzip_static

GeoJSON は更新頻度が低い（月次）ため、**事前に `.gz` を作って置いておく**方法も
あります。リクエストごとの圧縮 CPU がゼロになり、最大圧縮（レベル9）で配信できます。

ただし前述の通り、本ファイルでは **レベル6と9の差が約 1.4KB しかない** ため、
費用対効果は小さめです。やる場合のみ:

```bash
# デプロイ時、13.geojson の隣に .gz を生成（元ファイルも残す -k）
gzip -9 -k /var/www/park-now/data/13.geojson   # → 13.geojson.gz が出来る
```

nginx 側（`http` か `server` ブロック）:

```nginx
gzip_static on;   # .gz があればそれを優先配信。無ければ通常 gzip にフォールバック
```

> ⚠️ 注意: `gzip_static` は **`.gz` を自動生成しません**。`13.geojson` を更新するたびに
> `.gz` も作り直す必要があります（デプロイ手順に組み込むこと）。作り忘れると古い
> データが配信され続けます。Content-Type を決めるのは元の拡張子なので、**ステップ1の
> `.geojson` MIME 登録は gzip_static でも必須** です。

---

## 補足

- **アプリは現状でも正常に動作します。** フロントは `fetch(...).json()` で読み込んで
  おり、Content-Type が `octet-stream` でもパースできるためです。本修正は
  「バグ修正」ではなく **転送量の最適化（約 89% 削減）と Content-Type の正常化** です。
- 影響範囲は配信レイヤ（nginx）のみ。アプリのコード・ビルド・静的エクスポート内容は
  一切変更しません。
- 将来 13.geojson 以外の `.geojson` を増やしても、本設定（拡張子ベース）で同様に
  圧縮・正しい Content-Type が適用されます。
