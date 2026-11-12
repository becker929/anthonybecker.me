#!/usr/bin/env bash
# Builds the web version into ./dist (not in git). Deploy it with `npx wrangler deploy` from this directory.
# Needs: rustup target add wasm32-unknown-unknown, and wasm-opt (brew install binaryen).
set -euo pipefail
cd "$(dirname "$0")"
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
  -o target/web-out/crt_arcade_bg.opt.wasm target/web-out/crt_arcade_bg.wasm

# The binary and its glue go in a folder named by their hash, so a browser never pairs an old page
# with a new binary, and the folder can be cached for good.
H=$(cat target/web-out/crt_arcade_bg.opt.wasm target/web-out/crt_arcade.js | shasum | cut -c1-10)
rm -rf dist && mkdir -p "dist/pkg-$H"
cp target/web-out/crt_arcade_bg.opt.wasm "dist/pkg-$H/crt_arcade_bg.wasm"
cp target/web-out/crt_arcade.js "dist/pkg-$H/"
sed "s#'./pkg/#'./pkg-$H/#g" web/index.html > dist/index.html
# The model the game fetches at start (blender/build.py makes it). The game asks for assets/arcade.glb.
mkdir -p dist/assets && cp assets/arcade.glb assets/bertie.glb assets/nimrod.glb assets/whirlwind.glb assets/prinz.glb dist/assets/
# The sounds the page plays (sound/make.py builds them; audio is not in git). Without them the page is silent.
if [ -f sound/out/sounds.json ]; then
  mkdir -p dist/sounds && cp sound/out/* dist/sounds/
else
  echo "no sounds: run sound/make.py first (see sound/README.md)" >&2
fi
# The picture links to the site show.
cp web/card.jpg dist/
printf '/pkg-*/*\n  Cache-Control: public, max-age=31536000, immutable\n' > dist/_headers

# Cloudflare refuses any single asset over 25 MiB.
SIZE=$(wc -c < "dist/pkg-$H/crt_arcade_bg.wasm")
echo "dist/pkg-$H/crt_arcade_bg.wasm: $SIZE bytes"
[ "$SIZE" -lt 26214400 ] || { echo "too large for a Workers asset" >&2; exit 1; }
