#!/bin/bash
# Makes the Batocera "Ports" folder from an aarch64 build:
#
#   batocera/package.sh <build dir> <output dir>
#
# Output (copy its contents to /userdata/roms/ports/ on the console):
#   NFS Most Wanted.sh        launcher shown in Ports
#   NFS Most Wanted.sh.keys   Hotkey + Start quits the game
#   nfsmw/nfsmw               the game
#   nfsmw/nfsmw.toml          settings
#   nfsmw/lib/                libraries the console may not have
#   nfsmw/game_root/          empty: your default.xex, NFS/ and Movies/ go here
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
BUILD=${1:?build dir}
DEST=${2:?output dir}
SDKOUT=${3:-$RAIZ/sdk/out/linux-arm64}   # librexruntime.so and the GPU plugin, which loads from the exe's folder
EXE=$(find "$BUILD" "$SDKOUT" -maxdepth 2 -type f -name nfsmw -perm -u+x 2>/dev/null | head -1)
[ -n "$EXE" ] || { echo "nfsmw not found in $BUILD" >&2; exit 1; }

rm -rf "$DEST"
mkdir -p "$DEST/nfsmw/lib" "$DEST/nfsmw/game_root"
cp "$EXE" "$DEST/nfsmw/nfsmw"
llvm-strip-20 --strip-unneeded "$DEST/nfsmw/nfsmw" 2>/dev/null || llvm-strip --strip-unneeded "$DEST/nfsmw/nfsmw" 2>/dev/null || aarch64-linux-gnu-strip --strip-unneeded "$DEST/nfsmw/nfsmw"
cp "$RAIZ/batocera/nfsmw.toml" "$DEST/nfsmw/nfsmw.toml"
# The NFS MOST WANTED submenu of EmulationStation's advanced game options (the launcher installs it).
cp "$RAIZ/batocera/port/es_features_nfsmw.cfg" "$DEST/nfsmw/es_features_nfsmw.cfg"
cp "$RAIZ/batocera/port/NFS Most Wanted.sh" "$RAIZ/batocera/port/NFS Most Wanted.sh.keys" "$DEST/"
chmod +x "$DEST/NFS Most Wanted.sh" "$DEST/nfsmw/nfsmw"

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
pending=("$DEST/nfsmw/nfsmw")
# The SDK's own libraries go next to the executable (RUNPATH $ORIGIN; the GPU plugin is opened from there).
for so in "$SDKOUT"/librex*.so "$BUILD"/librex*.so; do
  [ -f "$so" ] || continue
  cp -L "$so" "$DEST/nfsmw/"
  llvm-strip-20 --strip-unneeded "$DEST/nfsmw/$(basename "$so")" 2>/dev/null || true
  pending+=("$DEST/nfsmw/$(basename "$so")")
done
while [ ${#pending[@]} -gt 0 ]; do
  elf=${pending[0]}; pending=("${pending[@]:1}")
  for lib in $(readelf -d "$elf" | sed -n 's/.*Shared library: \[\(.*\)\]/\1/p'); do
    system_lib "$lib" && continue
    [ -f "$DEST/nfsmw/lib/$lib" ] || [ -f "$DEST/nfsmw/$lib" ] && continue
    if [ -f "$SYSLIB/$lib" ]; then
      cp -L "$SYSLIB/$lib" "$DEST/nfsmw/lib/"
      pending+=("$DEST/nfsmw/lib/$lib")
    else
      echo "warning: $lib not bundled" >&2
    fi
  done
done

mkdir -p "$DEST/nfsmw/lib/cxx"
cp -L "$SYSLIB/libstdc++.so.6" "$SYSLIB/libgcc_s.so.1" "$DEST/nfsmw/lib/cxx/"

cat > "$DEST/nfsmw/game_root/LISEZMOI.txt" <<'TXT'
Copiez ici, depuis votre propre copie du jeu (Xbox 360, PAL Espagne) :
  default.xex
  NFS/
  Movies/
  nfsmw_shaders.nfsp   (celle que l'app Android a generee, dossier nsfmw-androidevolved/)
TXT
echo "Batocera package: $DEST"
readelf -d "$DEST/nfsmw/nfsmw" | grep NEEDED
ls "$DEST/nfsmw" "$DEST/nfsmw/lib" "$DEST/nfsmw/lib/cxx"
