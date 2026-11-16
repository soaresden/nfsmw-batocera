#!/bin/bash
# Assembles the installation page into a folder: the page, the nfsmw-nx shader builder, the Python tools and the
# encrypted packages (page/paquets/, made by batocera/make_paquet.py).
#   bash page/build_site.sh [out/site]
# Local test: python3 -m http.server -d out/site 8000, then http://localhost:8000/ in Chrome or Edge.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/out/site}"
rm -rf "$OUT"
mkdir -p "$OUT/shaders/release" "$OUT/outils" "$OUT/paquets"
cp "$ROOT/page/index.html" "$ROOT/page/app.js" "$ROOT/page/zip.js" "$ROOT/page/iso.js" "$ROOT/page/i18n.js" "$OUT/"
SB="$ROOT/batocera/shader-builder"
cp -r "$SB/lib" "$SB/wasm" "$SB/shader_common.h" "$SB/NOTICES.md" "$OUT/shaders/"
cp "$SB/release/manifest.json" "$OUT/shaders/release/"
PB="$ROOT/batocera/tools/ps_buttons"
cp "$PB"/{jdlz,tpk,huff,xenos,dxt,ps_buttons,gamelist_media}.py "$OUT/outils/"
mkdir -p "$OUT/vf" "$OUT/outils/french-dub" "$OUT/vendor"
cp "$ROOT"/page/vf/* "$OUT/vf/"
cp -r "$ROOT/page/vendor/browser_wasi_shim" "$OUT/vendor/"
cp "$ROOT"/batocera/tools/french-dub/*.py "$ROOT/batocera/tools/french-dub/README.md" "$OUT/outils/french-dub/"
cp "$ROOT/page/fonts/DejaVuSans-Bold.ttf" "$ROOT/page/fonts/LICENSE-DejaVu.txt" "$OUT/outils/"
if ls "$ROOT"/page/paquets/*.pak >/dev/null 2>&1; then cp "$ROOT"/page/paquets/*.pak "$ROOT/page/paquets/index.json" "$OUT/paquets/"; else echo "page/paquets/: no package to offer" >&2; fi
touch "$OUT/.nojekyll"
echo "$OUT"
