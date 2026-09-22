# プライバシーポリシー / Privacy Policy

**Cosense Image Uploader (self-hosted)** Chrome 拡張機能

最終更新: 2026-09-22

## 日本語

### 収集するデータ

この拡張機能は、開発者を含む第三者にユーザーのデータを送信しません。利用状況の計測、アクセス解析、クラッシュレポートの送信も行いません。

### 画像の送信先

Cosense（scrapbox.io）上でドラッグ&ドロップまたはペーストされた画像は、**ユーザー自身が設定画面に入力した Worker URL** にのみ送信されます。この送信先はユーザーが自分の Cloudflare アカウントにデプロイしたサーバーであり、開発者はアクセスできません。

### ブラウザ内に保存する情報

以下の設定値を `chrome.storage.sync` に保存します。これらは Chrome の同期機能の範囲でユーザーの Google アカウントに紐づいて同期されることがありますが、開発者には送信されません。

- Worker URL
- アップロード用トークン
- 拡張の有効 / 無効フラグ

### 権限について

- `storage`: 上記の設定値の保存に使用します。
- ホスト権限: ユーザーが設定画面で保存したとき、入力された Worker URL のオリジンに対してのみアクセス許可を要求します。それ以外のサイトへのアクセス権は要求しません。
- `https://scrapbox.io/*` 上のコンテンツスクリプト: 画像のドロップ / ペースト操作を検知し、アップロード後の URL をエディタに挿入するためだけに動作します。ページの内容を読み取って外部に送ることはありません。

### 変更

このポリシーを変更した場合は、このファイルを更新し、更新日を書き換えます。

### 連絡先

https://github.com/inoue2002/cosense-uploader/issues

## English

### Data collection

This extension does not send any user data to the developer or to any third party. It contains no analytics, telemetry, or crash reporting.

### Where images go

Images dropped or pasted on Cosense (scrapbox.io) are sent **only to the Worker URL the user entered in the extension's settings page**. That server is deployed by the user into their own Cloudflare account; the developer has no access to it.

### Data stored in the browser

The following settings are kept in `chrome.storage.sync`. Chrome may sync them with the user's Google account as part of its normal sync feature; they are never transmitted to the developer.

- Worker URL
- Upload token
- Enabled / disabled flag

### Permissions

- `storage`: stores the settings above.
- Host permission: when the user saves the settings page, the extension requests access to the origin of the entered Worker URL and nothing else.
- Content script on `https://scrapbox.io/*`: detects image drop / paste in the Cosense editor and inserts the resulting URL. It does not read page content for any other purpose or send it anywhere.

### Changes

Changes to this policy are made by updating this file and its date.

### Contact

https://github.com/inoue2002/cosense-uploader/issues
