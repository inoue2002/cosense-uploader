import { readFileSync } from "node:fs";
import { stripMetadata } from "../src/strip.js";
import assert from "node:assert/strict";

const dec = new TextDecoder("latin1");
for (const [f, type] of [["test/meta.png","image/png"],["test/meta.jpg","image/jpeg"]]) {
  const raw = new Uint8Array(readFileSync(f));
  const before = dec.decode(raw);
  assert.ok(before.includes("secret"), `${f}: fixture has metadata`);
  assert.ok(before.includes("Apple"), `${f}: fixture has exif`);
  const { bytes, type: t } = stripMetadata(raw, "application/octet-stream");
  const after = dec.decode(bytes);
  assert.equal(t, type);
  assert.ok(!after.includes("secret"), `${f}: comment stripped`);
  assert.ok(!after.includes("Apple"), `${f}: exif stripped`);
  assert.ok(!after.includes("位置"), `${f}: itxt stripped`);
  assert.ok(bytes.length < raw.length);
  console.log(`${f}: ${raw.length} -> ${bytes.length} bytes, ${t}`);
}
// 壊れたデータは原本のまま
const junk = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0xff,0xff]);
assert.equal(stripMetadata(junk, "image/png").bytes, junk);
console.log("all ok");
