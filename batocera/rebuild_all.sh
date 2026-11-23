#!/bin/bash
# Rebuilds every build and the page's encrypted packages after a change in app/ or sdk/: PAL Spain (out/arm64,
# out/x86_64, out/win64), USA and PAL English (codegen of their edition trees, then aarch64, x86_64 and win64), then
# package.sh / package_windows.sh and make_paquet.py for the nine.
#
#   batocera/rebuild_all.sh            # needs assets/game_root/default.xex and assets/editions/<ed>/default.xex
#
# ARCHES="win64" (or "aarch64 x86_64"...) rebuilds only those machines; missing PAL Spain build folders are configured
# here. SKIP_CODEGEN=1 keeps the edition trees app_usa / app_pal_en as they are (no new hook since they were made).
# The Linux builds need Ubuntu 24.04 (Batocera's glibc): on a newer system, run this in batocera/docker/.
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
# PAL Spain: each build folder is configured here when missing (as batocera/build.sh does).
for a in $ARCHES; do
  case $a in
    aarch64) dir=out/arm64; tc=toolchain-aarch64-linux.cmake ;;
    x86_64) dir=out/x86_64; tc=toolchain-x86_64-linux.cmake ;;
    win64) dir=out/win64; tc=toolchain-x86_64-windows-mingw.cmake ;;
  esac
  step "PAL Spain $a"
  [ -f $dir/build.ninja ] || cmake -S app -B $dir -G Ninja -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE="$RAIZ/batocera/$tc" -DREXSDK_DIR="$RAIZ/sdk" \
    -DREXGLUE_ENABLE_TRACY=OFF -DNFSMW_BUILD_LAUNCHER=OFF > /dev/null
  cmake --build $dir -j"$JOBS"
done
for ed in usa pal_en; do
  cp "assets/editions/$ed/default.xex" "$TMP/$ed.xex"  # build_edition.sh copies it into assets/editions/<ed>/
  skip=${SKIP_CODEGEN:-0}  # the codegen once per edition, with the first machine (SKIP_CODEGEN=1: trees already made)
  for a in $ARCHES; do
    step "$ed $a$([ $skip = 0 ] && echo ' (codegen)')"
    ARCH=$a SKIP_CODEGEN=$skip JOBS=$JOBS NO_PAQUET=1 bash batocera/build_edition.sh "$ed" "$TMP/$ed.xex"
    skip=1
  done
done
step "packages"
# Every folder first, then the encrypted packages: make_paquet.py changes page/paquets/index.json, which would make
# the next VERSION read "-dirty".
pkgs=()
for a in $ARCHES; do
  for ed in pal_es usa pal_en; do
    sfx=$([ $ed = pal_es ] || echo "-$ed")
    case $a in
      aarch64) batocera/package.sh "out/arm64$sfx" "out/batocera$sfx" > /dev/null; pkgs+=("out/batocera$sfx $ed") ;;
      x86_64) batocera/package.sh "out/x86_64$sfx" "out/batocera-x86_64$sfx" > /dev/null; pkgs+=("out/batocera-x86_64$sfx $ed") ;;
      win64) batocera/package_windows.sh "out/win64$sfx" "out/windows$sfx" > /dev/null; pkgs+=("out/windows$sfx $ed") ;;
    esac
  done
done
for p in "${pkgs[@]}"; do
  set -- $p
  xex=assets/editions/$2/default.xex; [ $2 = pal_es ] && xex=assets/game_root/default.xex
  python3 batocera/make_paquet.py "$1/NFS Most Wanted.sh" "$xex" "$2" | tail -1
done
step "done"
