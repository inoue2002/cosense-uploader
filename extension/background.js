// content script から受け取った画像を Worker にアップロードする。
// トークンはここ（拡張側）にしか渡らないので、ページ側の JS からは見えない。

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "upload") {
    handleUpload(msg.files)
      .then((urls) => sendResponse({ ok: true, urls }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true; // async
  }
  if (msg && msg.type === "test") {
    handleUpload([msg.file])
      .then((urls) => sendResponse({ ok: true, urls }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true;
  }
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

async function getSettings() {
  const s = await chrome.storage.sync.get(["endpoint", "token"]);
  if (!s.endpoint || !s.token) {
    throw new Error("拡張の設定（Worker URL / トークン）が未入力です");
  }
  return { endpoint: s.endpoint.replace(/\/+$/, ""), token: s.token };
}

async function handleUpload(files) {
  const { endpoint, token } = await getSettings();
  const origin = new URL(endpoint).origin + "/*";
  const granted = await chrome.permissions.contains({ origins: [origin] });
  if (!granted) {
    throw new Error(`${origin} へのアクセス許可がありません。設定画面で保存し直してください`);
  }

  const urls = [];
  for (const f of files) {
    const bytes = base64ToBytes(f.data);
    const res = await fetch(`${endpoint}/upload?name=${encodeURIComponent(f.name || "")}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": f.type || "application/octet-stream",
      },
      body: bytes,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${body}`.trim());
    }
    const json = await res.json();
    if (!json.url) throw new Error("Worker の応答に url がありません");
    urls.push(json.url);
  }
  return urls;
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
