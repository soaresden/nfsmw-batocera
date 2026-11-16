#!/bin/bash
# Builds nfsmw_shaders.nfsp (the precompiled shader library) from your own copy of the game, on a PC, exactly as
# the Android app's installer does. Only needed without the Android app: its file can be copied as is.
#
#   bash batocera/build_shaders.sh <game folder with default.xex and NFS/> [output.nfsp]
#
# Needs Node.js 18 or later. The builder (WebAssembly HLSL/DXC compilers) is in batocera/shader-builder/.
# Copy the result next to "NFS Most Wanted.sh/run.sh" or into its game_root/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${1:?usage: build_shaders.sh <game folder> [output.nfsp]}"
OUT="${2:-$GAME/nfsmw_shaders.nfsp}"
[ -f "$GAME/default.xex" ] || { echo "no default.xex in $GAME" >&2; exit 1; }
[ -d "$GAME/NFS" ] || { echo "no NFS/ folder in $GAME" >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js is required" >&2; exit 1; }
exec node "$ROOT/tools/biblioteca_shaders.mjs" "$ROOT/batocera/shader-builder" "$GAME" "$OUT"
