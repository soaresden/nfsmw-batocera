#!/bin/bash
# Need for Speed: Most Wanted (2005, Xbox 360 recompiled) - Batocera "Ports" launcher.
# Lives in /userdata/roms/ports/ next to the nfsmw/ folder.
HERE="$(cd "$(dirname "$0")" && pwd)"
GAMEDIR="$HERE/nfsmw"
cd "$GAMEDIR" || exit 1

# The game reads default.xex from game_root/, next to NFS/ and Movies/. One left next to the executable is moved
# there (same folder tree, nothing is copied).
if [ ! -f "$GAMEDIR/game_root/default.xex" ] && [ -f "$GAMEDIR/default.xex" ] && [ -d "$GAMEDIR/game_root/NFS" ]; then
    mv "$GAMEDIR/default.xex" "$GAMEDIR/game_root/default.xex" && \
        echo "[batocera] default.xex moved into game_root/" >> "$GAMEDIR/nfsmw-launcher.log"
fi
if [ ! -f "$GAMEDIR/game_root/default.xex" ]; then
    echo "[batocera] $(date '+%F %T') game_root/default.xex introuvable: copiez default.xex, NFS/ et Movies/ dans $GAMEDIR/game_root/" \
        | tee "$GAMEDIR/nfsmw-stdout.log" >&2
    exit 1
fi

# The C++ runtime of the build (lib/cxx) only if the console's is older: the newer one wins, as the GPU driver
# (Mesa) also loads it.
cxx_version() { grep -ao 'GLIBCXX_3\.4\.[0-9]*' "$1" 2>/dev/null | sort -uV | tail -1; }
SYS_CXX=""
for f in /usr/lib/libstdc++.so.6 /usr/lib64/libstdc++.so.6 /lib/libstdc++.so.6 /usr/lib/aarch64-linux-gnu/libstdc++.so.6; do
    [ -e "$f" ] && SYS_CXX="$(cxx_version "$f")" && break
done
OWN_CXX="$(cxx_version "$GAMEDIR/lib/cxx/libstdc++.so.6")"
LIBS="$GAMEDIR:$GAMEDIR/lib"
if [ -z "$SYS_CXX" ] || [ "$(printf '%s\n%s\n' "$SYS_CXX" "$OWN_CXX" | sort -V | head -1)" != "$OWN_CXX" ]; then
    LIBS="$LIBS:$GAMEDIR/lib/cxx"
fi
export LD_LIBRARY_PATH="$LIBS${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# SDL3 picks Wayland under Batocera's compositor, otherwise KMS/DRM or X11.
export SDL_VIDEO_DRIVER="${SDL_VIDEO_DRIVER:-wayland,kmsdrm,x11}"
# Adreno: Mesa Turnip. Keep its pipeline cache on the SD card so later sessions start smoothly.
export MESA_SHADER_CACHE_DIR="$GAMEDIR/cache/mesa"
export MESA_SHADER_CACHE_MAX_SIZE=1G
mkdir -p "$MESA_SHADER_CACHE_DIR"

chmod +x ./nfsmw 2>/dev/null
{
    echo "[batocera] $(date '+%F %T') $(cat /usr/share/batocera/batocera.version 2>/dev/null) $(uname -r)"
    echo "[batocera] C++ runtime: system ${SYS_CXX:-none}, bundled ${OWN_CXX:-none}; LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
    echo "[batocera] WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-} DISPLAY=${DISPLAY:-} XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-}"
    ls /usr/share/vulkan/icd.d/ 2>/dev/null | sed 's/^/[batocera] vulkan icd: /'
} > "$GAMEDIR/nfsmw-stdout.log" 2>&1
./nfsmw "$@" >> "$GAMEDIR/nfsmw-stdout.log" 2>&1
echo "[batocera] exit code $?" >> "$GAMEDIR/nfsmw-stdout.log"
