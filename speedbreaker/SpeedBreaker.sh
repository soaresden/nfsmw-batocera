#!/bin/bash
# NFS Most Wanted (Xbox 360) via SpeedBreaker - Batocera "Ports" launcher (Retroid Pocket 5).
# Lives in /userdata/roms/ports/ next to the speedbreaker/ folder (the SpeedBreaker arm64 download).
#
# First launch: if the game is not installed yet, it is installed from
#   speedbreaker/disc/            the extracted disc (default.xex, NFS/, Movies/), or
#   speedbreaker/disc/*.iso       a disc image
# into speedbreaker/data/game (portable mode: saves, settings and caches stay in speedbreaker/).
HERE="$(cd "$(dirname "$0")" && pwd)"
SB="$HERE/speedbreaker"
LOG="$SB/batocera-launch.log"
cd "$SB" || exit 1
exec >"$LOG" 2>&1
echo "[batocera] $(date '+%F %T') $(cat /usr/share/batocera/batocera.version 2>/dev/null)"

# Everything inside the folder, not in /userdata/system.
[ -f "$SB/portable.txt" ] || : > "$SB/portable.txt"
chmod +x "$SB/speedbreaker.sh" "$SB/lib/SpeedBreaker" 2>/dev/null

# Adreno 650 with Mesa Turnip; SDL3 (bundled) picks Wayland, X11 or KMS/DRM.
export SDL_VIDEO_DRIVER="${SDL_VIDEO_DRIVER:-wayland,x11,kmsdrm}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/var/run}"

if [ ! -f "$SB/data/game/default.xex" ] && [ ! -f "$SB/data/game/files/default.xex" ] && [ ! -f "$SB/.installed" ]; then
    SRC=""
    if [ -f "$SB/disc/default.xex" ]; then
        SRC="$SB/disc"
    else
        SRC="$(ls "$SB"/disc/*.iso 2>/dev/null | head -1)"
    fi
    if [ -n "$SRC" ]; then
        echo "[batocera] installing the game from $SRC"
        if "$SB/speedbreaker.sh" --install "$SRC"; then
            : > "$SB/.installed"
        else
            echo "[batocera] install failed: see last-run.log"
        fi
    else
        echo "[batocera] nothing in $SB/disc: the in-game installer will ask for the disc"
    fi
fi

"$SB/speedbreaker.sh" "$@"
echo "[batocera] exit code $?"
