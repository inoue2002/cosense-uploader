// 画像からメタデータ（EXIF, XMP, コメント, 位置情報など）を取り除く。
// 画素データには触らないので画質は変わらない。
// 対応: PNG, JPEG。それ以外はそのまま返す。

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// PNG で捨てるチャンク（テキスト・時刻・EXIF）。
// pHYs / gAMA / iCCP / sRGB など表示に関わるものは残す。
const PNG_DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

// JPEG で捨てるセグメント: APP1 (EXIF/XMP), APP13 (Photoshop IPTC), COM
// APP0 (JFIF), APP2 (ICC), APP14 (Adobe) は色再現に関わるので残す。
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]);

export function stripMetadata(bytes, declaredType) {
  const sniffed = sniff(bytes) || declaredType;
  try {
    if (sniffed === "image/png") return { bytes: stripPng(bytes), type: sniffed };
    if (sniffed === "image/jpeg") return { bytes: stripJpeg(bytes), type: sniffed };
  } catch (_) {
    // 壊れたファイルは無理に触らず原本を保存する
  }
  return { bytes, type: sniffed };
}

export function extensionFor(type) {
  switch (type) {
    case "image/png": return ".png";
    case "image/jpeg": return ".jpg";
    case "image/gif": return ".gif";
    case "image/webp": return ".webp";
    case "image/avif": return ".avif";
    case "image/svg+xml": return ".svg";
    default: return "";
  }
}

function sniff(b) {
  if (b.length >= 8 && PNG_SIG.every((v, i) => b[i] === v)) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && ascii(b, 0, 6).startsWith("GIF8")) return "image/gif";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp" && ascii(b, 8, 12).startsWith("avif")) return "image/avif";
  return null;
}

function ascii(b, s, e) {
  let out = "";
  for (let i = s; i < e; i++) out += String.fromCharCode(b[i]);
  return out;
}

function u32(b, o) {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function stripPng(b) {
  const parts = [b.subarray(0, 8)];
  let off = 8;
  while (off + 8 <= b.length) {
    const len = u32(b, off);
    const type = ascii(b, off + 4, off + 8);
    const total = 12 + len; // length + type + data + crc
    if (off + total > b.length) throw new Error("truncated png chunk");
    if (!PNG_DROP.has(type)) parts.push(b.subarray(off, off + total));
    off += total;
    if (type === "IEND") return concat(parts);
  }
  throw new Error("png without IEND");
}

function stripJpeg(b) {
  const parts = [b.subarray(0, 2)]; // SOI
  let off = 2;
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) throw new Error("bad jpeg marker");
    const marker = b[off + 1];
    // 0xFF パディング
    if (marker === 0xff) { off += 1; continue; }
    // SOS 以降はエントロピー符号データなので丸ごとコピーして終了
    if (marker === 0xda) {
      parts.push(b.subarray(off));
      return concat(parts);
    }
    // スタンドアロン (RSTn, SOI, EOI, TEM)
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
      parts.push(b.subarray(off, off + 2));
      off += 2;
      continue;
    }
    const len = (b[off + 2] << 8) | b[off + 3];
    const total = 2 + len;
    if (off + total > b.length) throw new Error("truncated jpeg segment");
    if (!JPEG_DROP.has(marker)) parts.push(b.subarray(off, off + total));
    off += total;
  }
  throw new Error("jpeg without SOS");
}

function concat(parts) {
  const size = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}
