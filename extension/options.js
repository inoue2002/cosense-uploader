const $ = (id) => document.getElementById(id);
const status = (msg, cls = "") => { $("status").textContent = msg; $("status").className = cls; };

chrome.storage.sync.get(["endpoint", "token", "enabled"], (s) => {
  $("endpoint").value = s.endpoint || "";
  $("token").value = s.token || "";
  $("enabled").checked = s.enabled !== false;
});

$("save").addEventListener("click", async () => {
  const endpoint = $("endpoint").value.trim().replace(/\/+$/, "");
  const token = $("token").value.trim();
  const enabled = $("enabled").checked;

  let origin;
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:") throw new Error();
    origin = u.origin + "/*";
  } catch {
    status("Worker URL は https:// で始まる URL を入れてください", "ng");
    return;
  }

  // Worker のホストへの fetch 許可を取る（optional_host_permissions）
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    status(`${origin} へのアクセスが許可されませんでした`, "ng");
    return;
  }

  await chrome.storage.sync.set({ endpoint, token, enabled });
  status("保存しました", "ok");
});

$("test").addEventListener("click", async () => {
  status("テスト中…");
  $("preview").style.display = "none";
  try {
    const file = await makeTestPng();
    const res = await chrome.runtime.sendMessage({ type: "test", file });
    if (!res.ok) throw new Error(res.error);
    status(`OK: ${res.urls[0]}\n（この URL を Cosense に [ ] で囲って貼ると表示されます）`, "ok");
    $("preview").src = res.urls[0];
    $("preview").style.display = "block";
  } catch (err) {
    status(`失敗: ${err.message || err}`, "ng");
  }
});

// 64x64 のテスト画像を canvas で作る
async function makeTestPng() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3b6ea5"; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#fff"; ctx.font = "bold 28px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("OK", 32, 34);
  const dataUrl = c.toDataURL("image/png");
  return { name: "test.png", type: "image/png", data: dataUrl.split(",")[1] };
}
