# Chrome Web Store 提出メモ

Developer Dashboard に貼る内容と、審査で聞かれる権限の正当化をここで管理する。
`manifest.json` の権限を変えたら、このファイルも必ず更新する。

## ストア掲載情報

| 項目 | 値 |
| --- | --- |
| 名前 | Cosense Image Uploader (self-hosted) |
| 概要（132 文字以内） | Cosense に画像をドラッグ&ドロップ / ペーストしたとき、Gyazo ではなく自前の Cloudflare R2 にアップロードして Cosense 記法で貼り付ける |
| カテゴリ | 仕事効率化 (Productivity) |
| 言語 | 日本語 |
| 公式 URL | https://github.com/inoue2002/cosense-uploader |
| サポート URL | https://github.com/inoue2002/cosense-uploader/issues |
| プライバシーポリシー URL | https://github.com/inoue2002/cosense-uploader/blob/main/PRIVACY.md |
| ライセンス | MIT |

### 詳細説明（ストアの「説明」欄）

```
Cosense（旧 Scrapbox）に画像をドラッグ&ドロップ、または Cmd+V でペーストしたとき、
Gyazo の代わりに「自分で用意した」Cloudflare Worker + R2 にアップロードし、
[https://.../xxx.png] の形でカーソル位置に貼り付ける拡張機能です。

■ 使うには自分のアップロード先が必要です
この拡張は画像の保存先サーバーを提供しません。付属の Cloudflare Worker を
自分の Cloudflare アカウントにデプロイし、その URL とトークンを設定画面に入れて使います。
手順は GitHub リポジトリの README にあります。
https://github.com/inoue2002/cosense-uploader

■ 機能
・scrapbox.io 上での画像の D&D / ペーストを横取りして自前の Worker に送信
・保存前に EXIF / XMP / PNG テキストチャンクなどのメタデータを除去（Worker 側）
・Shift を押しながらドロップすると、その 1 回だけ従来の Gyazo アップロードに戻る
・設定画面のチェックを外すと拡張は何もしなくなる

■ データの扱い
画像はユーザー自身が設定した Worker URL にだけ送信されます。
開発者のサーバーには一切送られず、利用状況の収集もしません。
```

### 単一目的（Single purpose）

Cosense 上で画像を貼り付ける操作を、ユーザー自身が用意したアップロード先に差し替えること。

## 権限の正当化（Permission justifications）

| 権限 | 用途 | Dashboard に貼る説明 |
| --- | --- | --- |
| `storage` | 設定（Worker URL、アップロードトークン、有効/無効）を `chrome.storage.sync` に保存する | Stores the user's own upload endpoint URL, its bearer token, and an on/off flag. Nothing else is stored. |
| `optional_host_permissions: https://*/*` | ユーザーが設定画面で入力した Worker URL の **オリジンだけ** を、保存時に `chrome.permissions.request` で要求する。アップロード先はユーザーごとに異なる（workers.dev やカスタムドメイン）ため、事前に特定のホストに絞れない。実際に付与されるのは 1 オリジンのみ | The upload destination is a server the user deploys themselves, so its hostname is not known in advance. When the user saves the settings page, the extension requests access to exactly that one origin (e.g. https://xxx.workers.dev/*). No other host is ever requested, and the request happens only after an explicit click on "保存". |
| content script `https://scrapbox.io/*` | Cosense のページで drop / paste イベントを横取りし、アップロード後の URL をエディタに挿入する | Runs only on scrapbox.io to intercept image drop/paste in the Cosense editor and insert the resulting URL. |

リモートコードの実行: **なし**（すべてパッケージ内のスクリプト。外部スクリプトの読み込み・eval は無い）。

## プライバシー申告（Privacy practices タブ）

- 収集するユーザーデータ: **なし**
  - 画像はユーザーが設定した自分のサーバーにのみ送られる。開発者は受け取らない
  - 認証情報（トークン）は `chrome.storage.sync` にのみ保存され、ページ側 JS からは見えない
  - 閲覧履歴、個人情報、位置情報などは扱わない
- 「ユーザーデータを第三者に販売しない」「承認された用途以外に使用しない」「信用度判定に使用しない」の 3 つの証明にチェック
- プライバシーポリシー URL: 上表のとおり `PRIVACY.md`

## 提出物

| 種類 | 要件 | 状態 |
| --- | --- | --- |
| zip | `sh scripts/pack-extension.sh` で `dist/cosense-uploader-<version>.zip` を生成 | スクリプトあり |
| ストアアイコン | 128×128 PNG | `extension/icons/128.png` を流用 |
| スクリーンショット | 1280×800 または 640×400、1〜5 枚 | **未作成**（設定画面と、Cosense に貼り付いた様子の 2 枚を推奨） |
| プロモタイル（小） | 440×280、任意 | 未作成 |

## 提出手順

1. Chrome Web Store Developer Dashboard（https://chrome.google.com/webstore/devconsole）で開発者登録（初回のみ、登録料 US$5）
2. 「新しいアイテム」→ zip をアップロード
3. 「ストアの掲載情報」に上記の説明・カテゴリ・URL・画像を入力
4. 「プライバシーへの取り組み」に単一目的・権限の正当化・データ収集申告を入力
5. 「配布」で公開範囲を選ぶ（まずは「限定公開（リンクを知っている人のみ）」で様子を見るのも可）
6. 審査に提出。`optional_host_permissions` が広いため、審査に数日かかることがある

## バージョン履歴

| version | 変更 |
| --- | --- |
| 0.1.3 | Worker から返った URL を https かつ Cosense 記法を壊さない文字列に限定して挿入するようにした（設定した Worker 以外を信用しないための防御） |
| 0.1.2 | Cosense のドロップ用オーバーレイが drop 後に残る問題を修正。content script のバージョンを `<html data-cosense-uploader>` に出す |
| 0.1.1 | オーバーレイ対策の初版（dataTransfer の扱いが未検証だったため 0.1.2 で修正） |
| 0.1.0 | 初版 |
