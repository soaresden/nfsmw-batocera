#!/bin/bash
# Builds the Batocera package (Linux aarch64, or x86_64 for a PC with ARCH=x86_64; ARCH=win64 for Windows / RetroBat)
# from your own default.xex.
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
# x86-64-v2: the SDK's memory.cpp uses SSSE3 shuffles. The SDK writes its programs to sdk/out/<platform>/.
cmake -S "$RAIZ/sdk" -B "$OUT/host" -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER="${CC:-clang-20}" -DCMAKE_CXX_COMPILER="${CXX:-clang++-20}" -DREXGLUE_ENABLE_TRACY=OFF \
  -DCMAKE_C_FLAGS=-march=x86-64-v2 -DCMAKE_CXX_FLAGS=-march=x86-64-v2 >/dev/null
cmake --build "$OUT/host" --target rexglue -j "$JOBS"
REXGLUE_HOST="$RAIZ/sdk/out/linux-amd64/rexglue"

echo "== 2. translate the game"
mkdir -p "$RAIZ/assets/game_root"
if [ "$(realpath "$XEX")" != "$(realpath -m "$RAIZ/assets/game_root/default.xex")" ]; then
  cp "$XEX" "$RAIZ/assets/game_root/default.xex"
fi
if [ ! -f "$RAIZ/app/generated/default/nfsmw_init.h" ] || [ "$XEX" -nt "$RAIZ/app/generated/default/nfsmw_init.h" ]; then
  REXGLUE="$REXGLUE_HOST" PYTHON="$PY" bash "$RAIZ/tools/codegen.sh" app
fi

ARCH=${ARCH:-aarch64}
case "$ARCH" in
  aarch64) BUILD_DIR="$OUT/arm64"; PKG_DIR="$OUT/batocera" ;;
  x86_64) BUILD_DIR="$OUT/x86_64"; PKG_DIR="$OUT/batocera-x86_64" ;;
  win64) BUILD_DIR="$OUT/win64"; PKG_DIR="$OUT/windows" ;;
  *) echo "ARCH: aarch64, x86_64 or win64" >&2; exit 1 ;;
esac
echo "== 3. build ($ARCH)"
SYSROOT_ARG=()
[ -n "${NFSMW_SYSROOT:-}" ] && SYSROOT_ARG=(-DNFSMW_SYSROOT="$NFSMW_SYSROOT")
TOOLCHAIN="$RAIZ/batocera/toolchain-$ARCH-linux.cmake"
if [ "$ARCH" = win64 ]; then TOOLCHAIN="$RAIZ/batocera/toolchain-x86_64-windows-mingw.cmake"; SYSROOT_ARG=(); fi
cmake -S "$RAIZ/app" -B "$BUILD_DIR" -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" "${SYSROOT_ARG[@]}" \
  -DREXSDK_DIR="$RAIZ/sdk" -DREXGLUE_ENABLE_TRACY=OFF -DNFSMW_BUILD_LAUNCHER=OFF
cmake --build "$BUILD_DIR" -j "$JOBS"

echo "== 4. package"
if [ "$ARCH" = win64 ]; then "$RAIZ/batocera/package_windows.sh" "$BUILD_DIR" "$PKG_DIR"
else "$RAIZ/batocera/package.sh" "$BUILD_DIR" "$PKG_DIR"; fi
