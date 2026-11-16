#!/bin/bash
# Builds page/vf/vgmstream-cli.wasm: vgmstream's command line player for WASI, with no external codec library
# (the French dub only needs EA MicroTalk, which vgmstream decodes itself). The page runs it with
# page/vendor/browser_wasi_shim.
#
#   bash batocera/tools/build_vgmstream_wasm.sh [work folder]
#
# Downloads wasi-sdk 25 and vgmstream (the commit below) into the work folder (default: out/vgmstream-wasm).
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
WORK=${1:-$RAIZ/out/vgmstream-wasm}
VGMSTREAM_COMMIT=24ffd6ce3e1f34fdebf9f5316d18ad2e162838ce
WASI_SDK=wasi-sdk-25.0-x86_64-linux
mkdir -p "$WORK"
cd "$WORK"
if [ ! -d "$WASI_SDK" ]; then
  curl -sSL "https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-25/$WASI_SDK.tar.gz" | tar xz
fi
if [ ! -d vgmstream ]; then
  git clone -q https://github.com/vgmstream/vgmstream.git
fi
cd vgmstream
git checkout -q "$VGMSTREAM_COMMIT"
# WASI has no dup(): keep the plain reopen path there.
grep -q '__wasi__' src/base/streamfile_stdio.c || \
  sed -i 's|^    #define USE_STDIO_FDUP 1|    #if !defined(__wasi__)\n    #define USE_STDIO_FDUP 1\n    #endif|' src/base/streamfile_stdio.c
mapfile -t FILES < <(find src -name '*.c' | sort)
"../$WASI_SDK/bin/clang" --sysroot="../$WASI_SDK/share/wasi-sysroot" --target=wasm32-wasip1 -O2 -w \
  -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_MMAN -Isrc -Iext_includes \
  "${FILES[@]}" cli/vgmstream_cli.c cli/vgmstream_cli_utils.c cli/wav_utils.c \
  -lwasi-emulated-signal -lwasi-emulated-process-clocks -lwasi-emulated-mman \
  -o "$RAIZ/page/vf/vgmstream-cli.wasm"
cp COPYING "$RAIZ/page/vf/vgmstream-COPYING.txt"
echo "$RAIZ/page/vf/vgmstream-cli.wasm ($(stat -c %s "$RAIZ/page/vf/vgmstream-cli.wasm") bytes, vgmstream $VGMSTREAM_COMMIT)"
