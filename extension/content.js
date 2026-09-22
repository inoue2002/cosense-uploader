// Cosense (scrapbox.io) 上で画像の drop / paste を横取りし、
// 自前ストレージにアップロードして `[https://...png]` をカーソル位置に挿入する。
//
// document_start で capture フェーズに登録するので、Cosense 自身のハンドラ
// （Gyazo アップロード）より先に走り、stopImmediatePropagation で止められる。

(() => {
  const TEXTAREA_SELECTOR = "#text-input";
  let settings = { enabled: true };

  chrome.storage.sync.get(["enabled"], (v) => {
    if (typeof v.enabled === "boolean") settings.enabled = v.enabled;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) settings.enabled = changes.enabled.newValue;
  });

  // ---- イベント横取り ------------------------------------------------------

  window.addEventListener("dragover", (e) => {
    if (!settings.enabled) return;
    if (imageFilesFrom(e.dataTransfer).length === 0) return;
    if (!editorPresent()) return;
    // drop を受け付けるために必須。Cosense 側の処理は止めない（カーソル追従などに使っている可能性があるため）
    e.preventDefault();
  }, true);

  window.addEventListener("drop", (e) => {
    if (!settings.enabled) return;
    if (e.shiftKey) return; // Shift を押しながら drop で従来動作（Gyazo）にフォールバック
    const files = imageFilesFrom(e.dataTransfer);
    if (files.length === 0) return;
    if (!editorPresent()) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    moveCursorTo(e.clientX, e.clientY);
    void uploadAndInsert(files);
  }, true);

  window.addEventListener("paste", (e) => {
    if (!settings.enabled) return;
    const files = imageFilesFrom(e.clipboardData);
    if (files.length === 0) return;
    // ペーストはエディタにフォーカスがある時だけ
    if (document.activeElement !== textarea()) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    void uploadAndInsert(files);
  }, true);

  // ---- アップロード → 挿入 --------------------------------------------------

  async function uploadAndInsert(files) {
    const toast = showToast(`アップロード中… (${files.length})`);
    try {
      const payload = await Promise.all(files.map(async (f) => ({
        name: f.name || "image",
        type: f.type,
        data: await toBase64(f),
      })));

      const res = await chrome.runtime.sendMessage({ type: "upload", files: payload });
      if (!res || !res.ok) {
        throw new Error(res && res.error ? res.error : "unknown error");
      }

      const text = res.urls.map((u) => `[${u}]`).join("\n");
      await insertText(text);
      toast.done(`貼り付けました (${res.urls.length})`);
    } catch (err) {
      console.error("[cosense-uploader]", err);
      toast.fail(`アップロード失敗: ${err.message || err}`);
    }
  }

  // ---- Cosense エディタ操作 ------------------------------------------------

  function textarea() {
    return document.querySelector(TEXTAREA_SELECTOR);
  }

  function editorPresent() {
    return !!textarea() && !!document.getElementById("editor");
  }

  // Cosense は隠し textarea の input イベントを見てカーソル位置に value を挿入する
  // （scrapbox-userscript-std の insertText と同じ方式）
  async function insertText(text) {
    const ta = textarea();
    if (!ta) throw new Error("editor not found");
    ta.focus();
    ta.value = text;
    ta.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    await sleep(10);
  }

  // drop 位置の行にカーソルを移す。失敗しても現在のカーソル位置に挿入されるだけなので握りつぶす
  function moveCursorTo(x, y) {
    try {
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      const line = el.closest(".line");
      if (!line) return;
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window };
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 }));
    } catch (_) { /* noop */ }
  }

  // ---- utils ----------------------------------------------------------------

  function imageFilesFrom(dt) {
    if (!dt) return [];
    const out = [];
    if (dt.items && dt.items.length) {
      for (const item of dt.items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) out.push(f);
        }
      }
      if (out.length) return out;
    }
    if (dt.files) {
      for (const f of dt.files) if (f.type.startsWith("image/")) out.push(f);
    }
    return out;
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function showToast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position: "fixed", right: "16px", bottom: "16px", zIndex: 2147483647,
      padding: "8px 12px", borderRadius: "6px", fontSize: "13px",
      fontFamily: "system-ui, sans-serif", color: "#fff", background: "#3b6ea5",
      boxShadow: "0 2px 8px rgba(0,0,0,.25)", transition: "opacity .3s",
    });
    document.body.appendChild(el);
    const close = (delay) => setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, delay);
    return {
      done(m) { el.textContent = m; el.style.background = "#2e8b57"; close(1500); },
      fail(m) { el.textContent = m; el.style.background = "#b23a3a"; close(5000); },
    };
  }
})();
