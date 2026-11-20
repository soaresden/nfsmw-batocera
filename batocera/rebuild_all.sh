#!/bin/bash
# Rebuilds every build and the page's encrypted packages after a change in app/ or sdk/: PAL Spain (out/arm64,
# out/x86_64, out/win64), USA and PAL English (codegen of their edition trees, then aarch64, x86_64 and win64), then
# package.sh / package_windows.sh and make_paquet.py for the nine.
#
#   batocera/rebuild_all.sh            # needs assets/game_root/default.xex and assets/editions/<ed>/default.xex
#
# ARCHES="win64" (or "aarch64 x86_64"...) rebuilds only those machines; the build folders out/arm64 and out/x86_64
# must have been configured once by batocera/build.sh, out/win64 is configured here when missing.
# After a new REX_HOOK on a game function, the edition trees must go through the codegen (this script does it): the
# direct calls are rewritten so that the game calls the hook (tools/llamadas_directas.py). For app/ itself, run
# `python3 tools/llamadas_directas.py --deshacer && python3 tools/llamadas_directas.py` before building.
# Commit before packaging: VERSION carries `git describe`. Then: git add -f page/paquets/*.pak page/paquets/index.json
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
cd "$RAIZ"
ARCHES=${ARCHES:-aarch64 x86_64 win64}
JOBS=${JOBS:-4}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
step() { echo "== $1 $(date +%T)"; }
has() { [[ " $ARCHES " == *" $1 "* ]]; }
has aarch64 && { step "PAL Spain aarch64"; cmake --build out/arm64 -j"$JOBS"; }
has x86_64 && { step "PAL Spain x86_64"; cmake --build out/x86_64 -j"$JOBS"; }
if has win64; then
  step "PAL Spain win64"
  [ -f out/win64/build.ninja ] || cmake -S app -B out/win64 -G Ninja -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE="$RAIZ/batocera/toolchain-x86_64-windows-mingw.cmake" -DREXSDK_DIR="$RAIZ/sdk" \
    -DREXGLUE_ENABLE_TRACY=OFF -DNFSMW_BUILD_LAUNCHER=OFF
  cmake --build out/win64 -j"$JOBS"
fi
for ed in usa pal_en; do
  cp "assets/editions/$ed/default.xex" "$TMP/$ed.xex"  # build_edition.sh copies it into assets/editions/<ed>/
  skip=0  # the codegen once per edition, with the first machine
  for a in $ARCHES; do
    step "$ed $a$([ $skip = 0 ] && echo ' (codegen)')"
    ARCH=$a SKIP_CODEGEN=$skip JOBS=$JOBS NO_PAQUET=1 bash batocera/build_edition.sh "$ed" "$TMP/$ed.xex"
    skip=1
  done
done
step "packages"
for a in $ARCHES; do
  for ed in pal_es usa pal_en; do
    xex=assets/editions/$ed/default.xex; [ $ed = pal_es ] && xex=assets/game_root/default.xex
    sfx=$([ $ed = pal_es ] || echo "-$ed")
    case $a in
      aarch64) batocera/package.sh "out/arm64$sfx" "out/batocera$sfx" > /dev/null; pkg="out/batocera$sfx" ;;
      x86_64) batocera/package.sh "out/x86_64$sfx" "out/batocera-x86_64$sfx" > /dev/null; pkg="out/batocera-x86_64$sfx" ;;
      win64) batocera/package_windows.sh "out/win64$sfx" "out/windows$sfx" > /dev/null; pkg="out/windows$sfx" ;;
    esac
    python3 batocera/make_paquet.py "$pkg/NFS Most Wanted.sh" "$xex" "$ed" | tail -1
  done
done
step "done"
