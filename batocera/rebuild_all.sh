#!/bin/bash
# Rebuilds every Batocera build and the page's encrypted packages after a change in app/ or sdk/:
# PAL Spain (out/arm64, out/x86_64), USA and PAL English (codegen of their edition trees, then aarch64 and x86_64),
# the Windows PAL English build (out/win64-pal_en, if configured), then package.sh and make_paquet.py for the six.
#
#   batocera/rebuild_all.sh            # needs assets/game_root/default.xex and assets/editions/<ed>/default.xex
#
# After a new REX_HOOK on a game function, the edition trees must go through the codegen (this script does it): the
# direct calls are rewritten so that the game calls the hook (tools/llamadas_directas.py). For app/ itself, run
# `python3 tools/llamadas_directas.py --deshacer && python3 tools/llamadas_directas.py` before building.
# Commit before packaging: VERSION carries `git describe`. Then: git add -f page/paquets/*.pak page/paquets/index.json
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
cd "$RAIZ"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
step() { echo "== $1 $(date +%T)"; }
step "PAL Spain aarch64"; cmake --build out/arm64 -j"${JOBS:-4}"
step "PAL Spain x86_64"; cmake --build out/x86_64 -j"${JOBS:-4}"
for ed in usa pal_en; do
  cp "assets/editions/$ed/default.xex" "$TMP/$ed.xex"  # build_edition.sh copies it into assets/editions/<ed>/
  step "$ed aarch64 (codegen)"; JOBS=${JOBS:-4} NO_PAQUET=1 bash batocera/build_edition.sh "$ed" "$TMP/$ed.xex"
  step "$ed x86_64"; ARCH=x86_64 SKIP_CODEGEN=1 JOBS=${JOBS:-4} NO_PAQUET=1 bash batocera/build_edition.sh "$ed" "$TMP/$ed.xex"
done
if [ -d out/win64-pal_en ]; then step "Windows PAL English"; cmake --build out/win64-pal_en -j"${JOBS:-4}"; fi
step "packages"
for spec in "arm64 batocera" "arm64-usa batocera-usa" "arm64-pal_en batocera-pal_en" "x86_64 batocera-x86_64" \
            "x86_64-usa batocera-x86_64-usa" "x86_64-pal_en batocera-x86_64-pal_en"; do
  set -- $spec; batocera/package.sh "out/$1" "out/$2" > /dev/null
done
for spec in "batocera pal_es assets/game_root/default.xex" "batocera-usa usa assets/editions/usa/default.xex" \
            "batocera-pal_en pal_en assets/editions/pal_en/default.xex" "batocera-x86_64 pal_es assets/game_root/default.xex" \
            "batocera-x86_64-usa usa assets/editions/usa/default.xex" "batocera-x86_64-pal_en pal_en assets/editions/pal_en/default.xex"; do
  set -- $spec; python3 batocera/make_paquet.py "out/$1/NFS Most Wanted.sh" "$3" "$2" | tail -1
done
step "done"
