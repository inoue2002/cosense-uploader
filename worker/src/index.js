// cosense-uploader Worker
//
//   POST /upload            body = 画像バイナリ, Content-Type = image/*, Authorization: Bearer <UPLOAD_TOKEN>
//                           -> { "url": "https://i.example.com/AbCd....png", "key": "...", "bytes": 12345 }
//   GET  /<key>             PUBLIC_BASE_URL を Worker 自身に向けた場合のフォールバック配信
//   GET  /healthz           200 ok
//
// 保存前に EXIF / テキスト系メタデータを削ぎ落とす（PNG, JPEG）。

import { stripMetadata, extensionFor } from "./strip.js";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), request);
    }

    if (url.pathname === "/healthz") {
      return withCors(text("ok"), request);
    }

    if (url.pathname === "/upload") {
      if (request.method !== "POST") {
        return withCors(text("method not allowed", 405), request);
      }
      if (!authorized(request, env)) {
        return withCors(text("unauthorized", 401), request);
      }
      return withCors(await handleUpload(request, env, url), request);
    }

    // 配信フォールバック: GET /<key>
    if (request.method === "GET" || request.method === "HEAD") {
      const key = decodeURIComponent(url.pathname.slice(1));
      if (!key || key.includes("/") || key.includes("..")) {
        return text("not found", 404);
      }
      const obj = await env.BUCKET.get(key);
      if (!obj) return text("not found", 404);
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      // 画像として表示する以外の使われ方を封じる。SVG に script が入っていても実行させない。
      headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      headers.set("x-content-type-options", "nosniff");
      return new Response(request.method === "HEAD" ? null : obj.body, { headers });
    }

    return text("not found", 404);
  },
};

async function handleUpload(request, env, url) {
  const contentType = (request.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    return text(`unsupported content-type: ${contentType || "(none)"}`, 415);
  }

  const maxBytes = Number(env.MAX_BYTES || 26214400);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return text("payload too large", 413);

  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength === 0) return text("empty body", 400);
  if (raw.byteLength > maxBytes) return text("payload too large", 413);

  const { bytes, type } = stripMetadata(raw, contentType);
  const key = `${randomId()}${extensionFor(type)}`;

  await env.BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType: type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      originalName: (url.searchParams.get("name") || "").slice(0, 200),
    },
  });

  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  return json({ url: `${base}/${key}`, key, bytes: bytes.byteLength, type });
}

// --- helpers -------------------------------------------------------------

function authorized(request, env) {
  const expected = env.UPLOAD_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return false;
  return timingSafeEqual(m[1].trim(), expected);
}

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // 長さが違っても同じ回数ループして比較時間を揃える
  const n = Math.max(ab.byteLength, bb.byteLength);
  let diff = ab.byteLength ^ bb.byteLength;
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function randomId(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function withCors(res, request) {
  const origin = request.headers.get("origin");
  // 拡張の background から呼ぶ場合 CORS は不要だが、
  // UserScript から直接叩きたくなった時のために scrapbox.io だけ許可しておく
  if (origin && /^https:\/\/([a-z0-9-]+\.)?scrapbox\.io$/.test(origin)) {
    res.headers.set("access-control-allow-origin", origin);
    res.headers.set("access-control-allow-methods", "POST, GET, OPTIONS");
    res.headers.set("access-control-allow-headers", "authorization, content-type");
    res.headers.set("access-control-max-age", "86400");
    res.headers.set("vary", "origin");
  }
  return res;
}
