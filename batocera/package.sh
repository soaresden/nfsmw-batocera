#!/bin/bash
# Makes the Batocera "Ports" folder from an aarch64 build:
#
#   batocera/package.sh <build dir> <output dir>
#
# Output: one folder, "NFS Most Wanted.sh/", to copy into /userdata/roms/ports/ on the console. EmulationStation
# lists a folder with the .sh extension as a game; Batocera runs its run.sh and reads its padto.keys.
#   NFS Most Wanted.sh/run.sh           the launcher
#   NFS Most Wanted.sh/padto.keys       Hotkey + Start quits the game
#   NFS Most Wanted.sh/mods.py          applies mods/<name>/ (e.g. mods/mx5/) over game_root at each start
#   NFS Most Wanted.sh/nfsmw            the game, with librexruntime.so and librexgpu-xenos.so
#   NFS Most Wanted.sh/nfsmw.toml       settings
#   NFS Most Wanted.sh/lib/             libraries the console may not have
#   NFS Most Wanted.sh/game_root/       empty: your default.xex, NFS/ and Movies/ go here
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
BUILD=${1:?build dir}
DEST=${2:?output dir}
SDKOUT=${3:-$RAIZ/sdk/out/linux-arm64}   # librexruntime.so and the GPU plugin, which loads from the exe's folder
EXE=$(find "$BUILD" "$SDKOUT" -maxdepth 2 -type f -name nfsmw -perm -u+x 2>/dev/null | head -1)
[ -n "$EXE" ] || { echo "nfsmw not found in $BUILD" >&2; exit 1; }

rm -rf "$DEST"
PKG="$DEST/NFS Most Wanted.sh"
mkdir -p "$PKG/lib" "$PKG/game_root"
cp "$EXE" "$PKG/nfsmw"
llvm-strip-20 --strip-unneeded "$PKG/nfsmw" 2>/dev/null || llvm-strip --strip-unneeded "$PKG/nfsmw" 2>/dev/null || aarch64-linux-gnu-strip --strip-unneeded "$PKG/nfsmw"
cp "$RAIZ/batocera/nfsmw.toml" "$PKG/nfsmw.toml"
# Which build this is: the launcher writes it at the top of nfsmw-stdout.log.
echo "nfsmw-batocera $(git -C "$RAIZ" describe --always --dirty 2>/dev/null || echo unknown) $(date -u '+%F %H:%M UTC')" > "$PKG/VERSION"
# The NFS MOST WANTED submenu of EmulationStation's advanced game options (the launcher installs it).
cp "$RAIZ/batocera/port/es_features_nfsmw.cfg" "$PKG/es_features_nfsmw.cfg"
cp "$RAIZ/batocera/port/run.sh" "$RAIZ/batocera/port/padto.keys" "$RAIZ/batocera/port/mods.py" "$PKG/"
chmod +x "$PKG/run.sh" "$PKG/nfsmw"

# Shared libraries the binary needs and Batocera does not always carry (X11/XCB client libraries, used only
# when there is no Wayland), with their own dependencies. Vulkan, the C library, Wayland, DRM, audio and udev
# always come from the console: they must match its drivers and services.
SYSLIB=/usr/lib/aarch64-linux-gnu
system_lib() {
  case "$1" in
    libc.so*|libm.so*|libdl.so*|libpthread.so*|librt.so*|ld-linux*|libvulkan.so*|libwayland*|libdrm*|libgbm*|libEGL*|libGL*|libasound*|libpulse*|libudev*|libdbus*|libsystemd*) return 0 ;;
    # The C++ runtime goes to lib/cxx/, used only when the console's is older (see the launcher).
    libstdc++.so*|libgcc_s.so*) return 0 ;;
  esac
  return 1
}
pending=("$PKG/nfsmw")
# The SDK's own libraries go next to the executable (RUNPATH $ORIGIN; the GPU plugin is opened from there).
for so in "$SDKOUT"/librex*.so "$BUILD"/librex*.so; do
  [ -f "$so" ] || continue
  cp -L "$so" "$PKG/"
  llvm-strip-20 --strip-unneeded "$PKG/$(basename "$so")" 2>/dev/null || true
  pending+=("$PKG/$(basename "$so")")
done
while [ ${#pending[@]} -gt 0 ]; do
  elf=${pending[0]}; pending=("${pending[@]:1}")
  for lib in $(readelf -d "$elf" | sed -n 's/.*Shared library: \[\(.*\)\]/\1/p'); do
    system_lib "$lib" && continue
    [ -f "$PKG/lib/$lib" ] || [ -f "$PKG/$lib" ] && continue
    if [ -f "$SYSLIB/$lib" ]; then
      cp -L "$SYSLIB/$lib" "$PKG/lib/"
      pending+=("$PKG/lib/$lib")
    else
      echo "warning: $lib not bundled" >&2
    fi
  done
done

mkdir -p "$PKG/lib/cxx"
cp -L "$SYSLIB/libstdc++.so.6" "$SYSLIB/libgcc_s.so.1" "$PKG/lib/cxx/"

cat > "$PKG/game_root/LISEZMOI.txt" <<'TXT'
Copiez ici, depuis votre propre copie du jeu (Xbox 360, PAL Espagne) :
  default.xex
  NFS/
  Movies/
  nfsmw_shaders.nfsp   (celle que l'app Android a generee, dossier nsfmw-androidevolved/)
TXT
echo "Batocera package: $DEST"
readelf -d "$PKG/nfsmw" | grep NEEDED
ls "$PKG" "$PKG/lib" "$PKG/lib/cxx"
