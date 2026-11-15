#!/bin/bash
# Makes the Batocera package of SpeedBreaker (Retroid Pocket 5, Batocera arm64):
#
#   speedbreaker/make_package.sh [SpeedBreaker version tag, default: latest] [output dir, default: out/]
#
# Output: out/nfsmw-speedbreaker-batocera.zip, to unzip into /userdata/roms/ports/:
#   SpeedBreaker.sh                 Ports launcher (installs the game on first launch)
#   SpeedBreaker.sh.keys            Hotkey + Start quits
#   Identifier NFSMW.sh             checks which edition the copy in speedbreaker/disc is (nfsmw-identification.txt)
#   speedbreaker/                   the official SpeedBreaker-steamos-arm64 download, unchanged, plus:
#     lib/cxx/                      GCC 15 libstdc++ and libgcc_s (arm64), used by speedbreaker.sh only if
#                                   the system's are older (SpeedBreaker arm64 needs GLIBCXX_3.4.34)
#     portable.txt                  saves, settings and caches stay in this folder
#     disc/                         put your extracted disc (default.xex, NFS/, Movies/) or your .iso here
# No game files are included.
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
TAG=${1:-latest}
OUT=${2:-$RAIZ/out}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if [ "$TAG" = latest ]; then
  URL=https://github.com/SpeedBreakerProject/speedbreaker/releases/latest/download/SpeedBreaker-steamos-arm64.tar.xz
else
  URL=https://github.com/SpeedBreakerProject/speedbreaker/releases/download/$TAG/SpeedBreaker-steamos-arm64.tar.xz
fi
echo "== SpeedBreaker arm64 ($TAG)"
curl -fsSL -o "$WORK/sb.tar.xz" "$URL"
curl -fsSL -o "$WORK/sb.tar.xz.sha256" "$URL.sha256" 2>/dev/null && \
  (cd "$WORK" && echo "$(cut -d' ' -f1 sb.tar.xz.sha256)  sb.tar.xz" | sha256sum -c -) || echo "(no .sha256 published for this download)"
mkdir -p "$WORK/pkg"
tar -xf "$WORK/sb.tar.xz" -C "$WORK/pkg"
mv "$WORK/pkg/SpeedBreaker" "$WORK/pkg/speedbreaker"
SB="$WORK/pkg/speedbreaker"

echo "== GCC 15 C++ runtime (Ubuntu 25.10 arm64)"
PORTS=http://ports.ubuntu.com/ubuntu-ports
curl -fsSL "$PORTS/dists/questing/main/binary-arm64/Packages.gz" | gunzip > "$WORK/Packages"
mkdir -p "$SB/lib/cxx" "$SB/licenses/gcc-runtime"
for p in gcc-15-base libstdc++6 libgcc-s1; do
  f=$(awk -v p="$p" '$0=="Package: "p{f=1} f&&/^Filename:/{print $2;exit}' "$WORK/Packages")
  sum=$(awk -v p="$p" '$0=="Package: "p{f=1} f&&/^SHA256:/{print $2;exit}' "$WORK/Packages")
  curl -fsSL -o "$WORK/$p.deb" "$PORTS/$f"
  echo "$sum  $WORK/$p.deb" | sha256sum -c - >/dev/null
  dpkg-deb -x "$WORK/$p.deb" "$WORK/ex"
done
cp "$WORK/ex/usr/share/doc/gcc-15-base/copyright" "$SB/licenses/gcc-runtime/copyright"
cp -L "$WORK/ex/usr/lib/aarch64-linux-gnu/libstdc++.so.6" "$WORK/ex/usr/lib/aarch64-linux-gnu/libgcc_s.so.1" "$SB/lib/cxx/"

echo "== Batocera launcher"
cp "$RAIZ/speedbreaker/SpeedBreaker.sh" "$RAIZ/speedbreaker/SpeedBreaker.sh.keys" "$RAIZ/batocera/tools/Identifier NFSMW.sh" "$WORK/pkg/"
chmod +x "$WORK/pkg/SpeedBreaker.sh"
: > "$SB/portable.txt"
mkdir -p "$SB/disc"
cat > "$SB/disc/LISEZMOI.txt" <<'TXT'
Mettez ici votre propre copie du jeu Xbox 360 (USA ou PAL Espagne) :
  - soit le disque extrait : default.xex, NFS/, Movies/ (ceux du dossier nsfmw-androidevolved/ de l'app Android)
  - soit l'image du disque : un fichier .iso
Au premier lancement de SpeedBreaker depuis Ports, le jeu est verifie puis installe dans speedbreaker/data/game.
Ce dossier disc/ peut ensuite etre vide pour gagner de la place.
TXT

mkdir -p "$OUT"
rm -f "$OUT/nfsmw-speedbreaker-batocera.zip"
(cd "$WORK/pkg" && zip -qr -y "$OUT/nfsmw-speedbreaker-batocera.zip" .)
echo "Package: $OUT/nfsmw-speedbreaker-batocera.zip ($(cat "$SB/VERSION"))"
