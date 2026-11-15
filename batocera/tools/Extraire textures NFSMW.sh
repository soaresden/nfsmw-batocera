#!/bin/bash
# Copies three texture packs out of the game's NFS/ZZDATA archives, to look for the button icons (A/B/X/Y).
# Read-only: nothing of the game is changed. Positions from the PAL Spanish ZDIR.BIN with the PAL English data
# (the French dub of nfsmw-nx); a size check says if they do not match.
# As a Port: copy it to /userdata/roms/ports/ and launch it. Result: /userdata/roms/ports/nfsmw-extrait/
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/nfsmw-extrait"
mkdir -p "$OUT"
exec > "$OUT/extraction.txt" 2>&1
NFS=""
for d in "$HERE/NFS Most Wanted.sh/game_root/NFS" "$HERE/nfsmw/game_root/NFS"; do
    [ -f "$d/ZZDATA0.BIN" ] && NFS="$d" && break
done
[ -n "$NFS" ] || { echo "NFS/ZZDATA0.BIN introuvable"; exit 1; }
echo "archives: $NFS"
# name  ZZDATA  sector  size
while read -r name num sector size; do
    blocks=$(( (size + 2047) / 2048 ))
    dd if="$NFS/ZZDATA$num.BIN" bs=2048 skip="$sector" count="$blocks" 2>/dev/null | head -c "$size" > "$OUT/$name"
    echo "$name: $(stat -c %s "$OUT/$name") octets (attendu $size)"
done <<'LIST'
LANGUAGETEXTURES.BIN 0 79225 138048
GLOBALB.LZC 4 158699 5018060
INGAMEB.LZC 4 184788 602872
LIST
echo "fini"
