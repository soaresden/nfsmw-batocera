#!/bin/bash
# Need for Speed: Most Wanted (2005, Xbox 360 recompiled) - Batocera "Ports" launcher.
#
# Two layouts:
#   /userdata/roms/ports/NFS Most Wanted.sh/run.sh   one folder named like a port (EmulationStation lists a
#                                                    folder with the .sh extension as a game and Batocera runs its
#                                                    run.sh; the quit keys are its padto.keys). Default.
#   /userdata/roms/ports/NFS Most Wanted.sh          this script at the top of ports/, next to an nfsmw/ folder.
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -x "$HERE/nfsmw" ] && [ ! -d "$HERE/nfsmw" ]; then
    GAMEDIR="$HERE"
    ROMNAME="$(basename "$HERE")"
else
    GAMEDIR="$HERE/nfsmw"
    ROMNAME="$(basename "$0")"
fi
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
# Mouse pointer: Batocera's Ports launcher shows it for scripts (some need a mouse) and the game has none, so it
# stayed in the top left corner until the screen was touched. batocera-mouse hide asks the compositor to hide it
# for good (labwc: a key binding sent with wtype, Alt+Win+H; X11: unclutter); once now and once the game window is
# up, since a window that appears can bring it back. Batocera hides it again itself when the game ends.
if command -v batocera-mouse >/dev/null 2>&1; then
    batocera-mouse hide >/dev/null 2>&1
    ( sleep 4; batocera-mouse hide >/dev/null 2>&1; sleep 6; batocera-mouse hide >/dev/null 2>&1 ) &
    POINTER="hidden with batocera-mouse"
else
    POINTER="batocera-mouse not found"
fi
# Adreno: Mesa Turnip. Keep its pipeline cache on the SD card so later sessions start smoothly.
export MESA_SHADER_CACHE_DIR="$GAMEDIR/cache/mesa"
export MESA_SHADER_CACHE_MAX_SIZE=1G
mkdir -p "$MESA_SHADER_CACHE_DIR"

chmod +x "$GAMEDIR/nfsmw" 2>/dev/null
{
    echo "[batocera] $(date '+%F %T') $(cat /usr/share/batocera/batocera.version 2>/dev/null) $(uname -r)"
    echo "[batocera] port: $(cat "$GAMEDIR/VERSION" 2>/dev/null || echo 'no VERSION file (a build older than 2026-11-15 17:00)')"
    echo "[batocera] C++ runtime: system ${SYS_CXX:-none}, bundled ${OWN_CXX:-none}; LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
    echo "[batocera] WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-} DISPLAY=${DISPLAY:-} XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-} HOME=${HOME:-}"
    echo "[batocera] SDL_GAMECONTROLLERCONFIG: ${SDL_GAMECONTROLLERCONFIG:-(none)}"
    echo "[batocera] mouse pointer: $POINTER"
    ls /usr/share/vulkan/icd.d/ 2>/dev/null | sed 's/^/[batocera] vulkan icd: /'
} > "$GAMEDIR/nfsmw-stdout.log" 2>&1
# ---- Options from EmulationStation (ADVANCED GAME OPTIONS > NFS MOST WANTED) ----
# es_features_nfsmw.cfg adds the menu; it is copied where EmulationStation reads it (seen after its next restart).
# The installation page writes it as es_features_nfsmw.cfg.txt: Chrome refuses to create .cfg files on a disk
# (a "dangerous" extension on Windows); it is renamed here.
ES_CFG_DIR="${NFSMW_ES_CFG_DIR:-/userdata/system/configs/emulationstation}"
[ -f "$GAMEDIR/es_features_nfsmw.cfg.txt" ] && mv -f "$GAMEDIR/es_features_nfsmw.cfg.txt" "$GAMEDIR/es_features_nfsmw.cfg"
if [ -f "$GAMEDIR/es_features_nfsmw.cfg" ] && [ -d "$ES_CFG_DIR" ] && \
   ! cmp -s "$GAMEDIR/es_features_nfsmw.cfg" "$ES_CFG_DIR/es_features_nfsmw.cfg"; then
    cp "$GAMEDIR/es_features_nfsmw.cfg" "$ES_CFG_DIR/es_features_nfsmw.cfg"
fi
CONF="${NFSMW_BATOCERA_CONF:-/userdata/system/batocera.conf}"
# The game's own setting (ports["NFS Most Wanted.sh"].key), else the Ports system's (ports.key).
conf_get() {
    local v=""
    [ -f "$CONF" ] || return 0
    v=$(grep -F "ports[\"$ROMNAME\"].$1=" "$CONF" | tail -1 | cut -d= -f2-)
    [ -z "$v" ] && v=$(grep -E "^ports\.$1=" "$CONF" | tail -1 | cut -d= -f2-)
    echo "$v"
}
ARGS=()
add_arg() { [ -n "$2" ] && ARGS+=("--$1=$2"); }

# Language: auto (default) follows Batocera's system.language. The French dub of nfsmw-nx (tools/french-dub) puts
# the French text and speech in the English slot: with it, French means 0.
LANG_OPT="$(conf_get nfsmw_language)"
if [ -z "$LANG_OPT" ] || [ "$LANG_OPT" = auto ]; then
    SYS_LANG="$(grep -E '^system\.language=' "$CONF" 2>/dev/null | tail -1 | cut -d= -f2)"
    case "${SYS_LANG%%_*}" in
        en) LANG_OPT=0 ;; fr) LANG_OPT=1 ;; de) LANG_OPT=2 ;; it) LANG_OPT=3 ;; es) LANG_OPT=4 ;;
        nl) LANG_OPT=5 ;; sv) LANG_OPT=6 ;; da) LANG_OPT=7 ;; pl) LANG_OPT=12 ;; fi) LANG_OPT=13 ;;
        *) LANG_OPT=0 ;;
    esac
    if [ "$LANG_OPT" = 1 ] && { [ -f "$GAMEDIR/game_root/Movies/movies_report.txt" ] || [ -f "$GAMEDIR/game_root/Movies/rapport_films.txt" ]; }; then
        LANG_OPT=0
    fi
fi
add_arg nfsmw_idioma "$LANG_OPT"
add_arg nfsmw_resolucion_interna "$(conf_get nfsmw_resolution)"
add_arg nfsmw_limite_fps "$(conf_get nfsmw_fps)"
add_arg nfsmw_tratamiento_visual "$(conf_get nfsmw_visual_treatment)"
add_arg nfsmw_antialiasing "$(conf_get nfsmw_antialiasing)"
add_arg nfsmw_posproceso "$(conf_get nfsmw_postprocess)"
# Mods (mods.py): mods/<name>/ laid out as game_root/, e.g. mods/mx5/. What the last start applied is put back first,
# so a removed mod folder gives the base game again; they are applied after the icons, which they keep.
MODS_PY=0
if command -v python3 >/dev/null 2>&1 && [ -f "$GAMEDIR/mods.py" ]; then
    MODS_PY=1
    python3 "$GAMEDIR/mods.py" restore "$GAMEDIR" >> "$GAMEDIR/nfsmw-stdout.log" 2>&1
fi
# Button icons (batocera/tools/ps_buttons --icon-sets): mods/icones/<style>/ holds the GLOBAL/ files of each
# style; the one chosen in the menu (ICONES DES BOUTONS, PlayStation by default once the sets are installed) is put
# in game_root/GLOBAL/. A file the style does not have is removed there: the game reads it from its archives
# (xbox360/ only keeps the player's own GLOBALMEMORYFILE.BIN).
ICONS="$(conf_get nfsmw_icons)"
if [ -d "$GAMEDIR/mods/icones" ]; then
    [ -n "$ICONS" ] || ICONS=playstation
    SET="$GAMEDIR/mods/icones/$ICONS"
    if [ -d "$SET" ]; then
        mkdir -p "$GAMEDIR/game_root/GLOBAL"
        for f in GLOBALB.LZC GLOBALMEMORYFILE.BIN DYNTEX.BIN; do
            dst="$GAMEDIR/game_root/GLOBAL/$f"
            if [ -f "$SET/$f" ]; then
                cmp -s "$SET/$f" "$dst" || cp "$SET/$f" "$dst"
            else
                rm -f "$dst"
            fi
        done
        echo "[batocera] button icons: $ICONS" >> "$GAMEDIR/nfsmw-stdout.log"
    else
        echo "[batocera] button icons: no set '$ICONS' in mods/icones" >> "$GAMEDIR/nfsmw-stdout.log"
    fi
elif [ -d "$GAMEDIR/mods/boutons-playstation" ]; then
    ICONS=playstation  # the earlier single PlayStation mod
fi
[ "$MODS_PY" = 1 ] && python3 "$GAMEDIR/mods.py" apply "$GAMEDIR" "${ICONS:-}" >> "$GAMEDIR/nfsmw-stdout.log" 2>&1
# PlayStation icons are drawn by position, as on a PlayStation pad; Xbox 360 and GameCube ones by letter (the
# Retroid's labels). The menu (BOUTONS A/B X/Y) has the last word.
case "$(conf_get nfsmw_buttons)" in
    lettre) ARGS+=("--input_sdl_por_letra") ;;
    position) ARGS+=("--no-input_sdl_por_letra") ;;
    *) case "$ICONS" in
           playstation) ARGS+=("--no-input_sdl_por_letra") ;;
           xbox360|gamecube) ARGS+=("--input_sdl_por_letra") ;;
       esac ;;
esac
# Controller: Batocera passes SDL_GAMECONTROLLERCONFIG built with ITS SDL3's button numbers (3.4.x); the game
# carries its own SDL3 (3.5), which numbers the Retroid Pocket 5 pad one lower (seen in the log with
# input_sdl_diag: L1 arrived as x, Start as back, Home as start). The game's SDL maps the pad itself from the
# kernel's button codes; an older nfsmw_pad = batocera setting is ignored.
unset SDL_GAMECONTROLLERCONFIG SDL_GAMECONTROLLERCONFIG_FILE
echo "[batocera] controller: SDL's own mapping (Batocera's ignored: its button numbers are off by one here)" >> "$GAMEDIR/nfsmw-stdout.log"
case "$(conf_get nfsmw_rumble)" in
    on) ARGS+=("--input_vibracion") ;;
    off) ARGS+=("--no-input_vibracion") ;;
esac
# Black Edition content (tuhana's patch, src/nfsmw_black_edition.cpp): off unless asked for.
case "$(conf_get nfsmw_black_edition)" in
    on) ARGS+=("--nfsmw_black_edition") ;;
esac
echo "[batocera] options: ${ARGS[*]}" >> "$GAMEDIR/nfsmw-stdout.log"

# Saves, profiles and caches next to the game (ports/nfsmw/data) instead of /userdata/system/.local/share/nfsmw.
# user_data_root is read before nfsmw.toml, so it is given on the command line.
mkdir -p "$GAMEDIR/data"
"$GAMEDIR/nfsmw" --user_data_root="$GAMEDIR/data" "${ARGS[@]}" "$@" >> "$GAMEDIR/nfsmw-stdout.log" 2>&1
echo "[batocera] exit code $?" >> "$GAMEDIR/nfsmw-stdout.log"
