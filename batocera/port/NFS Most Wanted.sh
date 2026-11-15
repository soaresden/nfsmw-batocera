#!/bin/bash
# Need for Speed: Most Wanted (2005, Xbox 360 recompiled) - Batocera "Ports" launcher.
# Lives in /userdata/roms/ports/ next to the nfsmw/ folder.
HERE="$(cd "$(dirname "$0")" && pwd)"
GAMEDIR="$HERE/nfsmw"
cd "$GAMEDIR" || exit 1

if [ ! -f "$GAMEDIR/game_root/default.xex" ]; then
    echo "game_root/default.xex introuvable: copiez default.xex, NFS/ et Movies/ dans $GAMEDIR/game_root/" >&2
    exit 1
fi

export LD_LIBRARY_PATH="$GAMEDIR/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# SDL3 picks Wayland under Batocera's compositor, otherwise KMS/DRM or X11.
export SDL_VIDEO_DRIVER="${SDL_VIDEO_DRIVER:-wayland,kmsdrm,x11}"
# Adreno: Mesa Turnip. Keep its pipeline cache on the SD card so later sessions start smoothly.
export MESA_SHADER_CACHE_DIR="$GAMEDIR/cache/mesa"
export MESA_SHADER_CACHE_MAX_SIZE=1G
mkdir -p "$MESA_SHADER_CACHE_DIR"

./nfsmw "$@" > "$GAMEDIR/nfsmw-stdout.log" 2>&1
