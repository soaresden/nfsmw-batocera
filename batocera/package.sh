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
EXE=$(find "$BUILD" -maxdepth 2 -type f -name nfsmw -perm -u+x | head -1)
[ -n "$EXE" ] || { echo "nfsmw not found in $BUILD" >&2; exit 1; }

rm -rf "$DEST"
mkdir -p "$DEST/nfsmw/lib" "$DEST/nfsmw/game_root"
cp "$EXE" "$DEST/nfsmw/nfsmw"
llvm-strip-20 --strip-unneeded "$DEST/nfsmw/nfsmw" 2>/dev/null || llvm-strip --strip-unneeded "$DEST/nfsmw/nfsmw" 2>/dev/null || aarch64-linux-gnu-strip --strip-unneeded "$DEST/nfsmw/nfsmw"
cp "$RAIZ/batocera/nfsmw.toml" "$DEST/nfsmw/nfsmw.toml"
cp "$RAIZ/batocera/port/NFS Most Wanted.sh" "$RAIZ/batocera/port/NFS Most Wanted.sh.keys" "$DEST/"
chmod +x "$DEST/NFS Most Wanted.sh" "$DEST/nfsmw/nfsmw"

# Shared libraries the binary needs and Batocera does not always carry (X11/XCB client libraries, used only
# when there is no Wayland), with their own dependencies. Vulkan, the C library, Wayland, DRM, audio and udev
# always come from the console: they must match its drivers and services.
SYSLIB=/usr/lib/aarch64-linux-gnu
system_lib() {
  case "$1" in
    libc.so*|libm.so*|libdl.so*|libpthread.so*|librt.so*|ld-linux*|libvulkan.so*|libwayland*|libdrm*|libgbm*|libEGL*|libGL*|libasound*|libpulse*|libudev*|libdbus*|libsystemd*) return 0 ;;
  esac
  return 1
}
pending=("$DEST/nfsmw/nfsmw")
for so in "$BUILD"/*.so "$BUILD"/*/*.so; do
  [ -f "$so" ] && cp -L "$so" "$DEST/nfsmw/lib/" && pending+=("$DEST/nfsmw/lib/$(basename "$so")")
done
while [ ${#pending[@]} -gt 0 ]; do
  elf=${pending[0]}; pending=("${pending[@]:1}")
  for lib in $(readelf -d "$elf" | sed -n 's/.*Shared library: \[\(.*\)\]/\1/p'); do
    system_lib "$lib" && continue
    [ -f "$DEST/nfsmw/lib/$lib" ] && continue
    if [ -f "$SYSLIB/$lib" ]; then
      cp -L "$SYSLIB/$lib" "$DEST/nfsmw/lib/"
      pending+=("$DEST/nfsmw/lib/$lib")
    else
      echo "warning: $lib not bundled" >&2
    fi
  done
done

cat > "$DEST/nfsmw/game_root/LISEZMOI.txt" <<'TXT'
Copiez ici, depuis votre propre copie du jeu (Xbox 360, PAL Espagne) :
  default.xex
  NFS/
  Movies/
  nfsmw_shaders.nfsp   (celle que l'app Android a generee, dossier nsfmw-androidevolved/)
TXT
echo "Batocera package: $DEST"
readelf -d "$DEST/nfsmw/nfsmw" | grep NEEDED
ls "$DEST/nfsmw/lib"
