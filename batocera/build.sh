#!/bin/bash
# Builds the Batocera package (Linux aarch64) from your own default.xex.
#
#   batocera/build.sh /path/to/default.xex
#
# Steps:
#   1. host code generator (rexglue) for this PC
#   2. the game translated to C++ (app/generated, never committed)
#   3. cross build of the game for aarch64 Linux with clang + lld
#   4. the Ports folder in out/batocera/ (no game files inside)
#
# Needs: clang/clang++ 20 (19+), lld, cmake 3.25+, ninja, python 3.10+, and the arm64 development libraries (see
# batocera/README.md, "Build"). Set NFSMW_SYSROOT to use a separate arm64 root instead of the multiarch one.
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
XEX=${1:?usage: batocera/build.sh /path/to/default.xex}
JOBS=${JOBS:-$(nproc)}
OUT=${OUT:-$RAIZ/out}
PY=${PYTHON:-python3}

[ -f "$RAIZ/sdk/thirdparty/sdl3/CMakeLists.txt" ] || {
  echo "sdk/thirdparty is incomplete: run 'python3 tools/fetch_thirdparty.py' first" >&2; exit 1; }

echo "== 1. host code generator"
cmake -S "$RAIZ/sdk" -B "$OUT/host" -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER="${CC:-clang-20}" -DCMAKE_CXX_COMPILER="${CXX:-clang++-20}" -DREXGLUE_ENABLE_TRACY=OFF >/dev/null
cmake --build "$OUT/host" --target rexglue -j "$JOBS"

echo "== 2. translate the game"
mkdir -p "$RAIZ/assets/game_root"
if [ "$(realpath "$XEX")" != "$(realpath -m "$RAIZ/assets/game_root/default.xex")" ]; then
  cp "$XEX" "$RAIZ/assets/game_root/default.xex"
fi
if [ ! -f "$RAIZ/app/generated/default/nfsmw_init.h" ] || [ "$XEX" -nt "$RAIZ/app/generated/default/nfsmw_init.h" ]; then
  REXGLUE="$OUT/host/rexglue" PYTHON="$PY" "$RAIZ/tools/codegen.sh" app
fi

echo "== 3. cross build (aarch64 Linux)"
SYSROOT_ARG=()
[ -n "${NFSMW_SYSROOT:-}" ] && SYSROOT_ARG=(-DNFSMW_SYSROOT="$NFSMW_SYSROOT")
cmake -S "$RAIZ/app" -B "$OUT/arm64" -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE="$RAIZ/batocera/toolchain-aarch64-linux.cmake" "${SYSROOT_ARG[@]}" \
  -DREXSDK_DIR="$RAIZ/sdk" -DREXGLUE_ENABLE_TRACY=OFF -DNFSMW_BUILD_LAUNCHER=OFF
cmake --build "$OUT/arm64" -j "$JOBS"

echo "== 4. package"
"$RAIZ/batocera/package.sh" "$OUT/arm64" "$OUT/batocera"
