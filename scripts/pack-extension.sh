#!/usr/bin/env sh
# Chrome Web Store にアップロードする zip を dist/ に作る。
#   sh scripts/pack-extension.sh   →  dist/cosense-uploader-<version>.zip
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/extension"
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$SRC/manifest.json")
OUT_DIR="$ROOT/dist"
OUT="$OUT_DIR/cosense-uploader-$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT"

# manifest.json が zip のルート直下に来るように extension/ の中で固める。
# .DS_Store や隠しファイルは除外する。
(cd "$SRC" && zip -q -r -X "$OUT" . -x '.*' '*/.*' '*.DS_Store')

echo "$OUT"
unzip -l "$OUT"
