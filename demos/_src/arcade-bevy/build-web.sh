#!/usr/bin/env bash
# Builds the web version into <repo>/arcade/, which the site serves at arcade.anthonybecker.me.
# Needs: rustup target add wasm32-unknown-unknown, and wasm-opt (brew install binaryen).
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../../arcade
WASM=target/wasm32-unknown-unknown/web/crt_arcade.wasm

cargo build --profile web --target wasm32-unknown-unknown

# wasm-bindgen's CLI must match the crate version in Cargo.lock exactly, so keep a private copy.
VER=$(awk '/^name = "wasm-bindgen"$/ {getline; gsub(/[^0-9.]/, ""); print; exit}' Cargo.lock)
BINDGEN=target/tools/bin/wasm-bindgen
if ! "$BINDGEN" --version 2>/dev/null | grep -q " $VER\$"; then
  cargo install -q wasm-bindgen-cli --version "$VER" --root target/tools
fi
"$BINDGEN" --target web --no-typescript --out-dir target/web-out "$WASM"

# Name the wasm features one by one. `-all` also turns on proposals browsers do not run yet
# (compact imports), and the page then fails to start.
wasm-opt -Oz --strip-debug --strip-producers \
  --enable-bulk-memory --enable-bulk-memory-opt --enable-nontrapping-float-to-int \
  --enable-sign-ext --enable-mutable-globals --enable-reference-types --enable-multivalue \
  -o "$OUT/crt_arcade_bg.wasm" target/web-out/crt_arcade_bg.wasm
cp target/web-out/crt_arcade.js "$OUT/"

# Cloudflare refuses any single asset over 25 MiB.
SIZE=$(wc -c < "$OUT/crt_arcade_bg.wasm")
echo "crt_arcade_bg.wasm: $SIZE bytes"
[ "$SIZE" -lt 26214400 ] || { echo "too large for a Workers asset" >&2; exit 1; }
