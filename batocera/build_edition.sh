#!/bin/bash
# Builds the Batocera port of another edition of the game from its default.xex, and its encrypted package for the
# installation page.
#
#   batocera/build_edition.sh <edition> /path/to/default.xex
#
# edition: a key of tools/editions/regional/ediciones.json (usa, pal_en, pal_fr, pal_de, pal_it...). The reference
# (PAL Spanish) must have been built once with batocera/build.sh: its default.xex in assets/game_root/ and its
# generated code in app/generated/ are the starting point.
#
# Steps (docs/editions.md, "Porting the hooks to another edition"):
#   1. the two executables' images (tools/editions/regional/imagen.py);
#   2. every address used by app/ translated to the other edition (tools/editions/emparejar.py);
#   3. the edition tree app_<edition> (tools/editions/crear_arbol.py, with the hand-fixed pairs of
#      tools/editions/<edition>/ and the shader fingerprints of ediciones.json);
#   4. the code generator on that tree (tools/codegen.sh);
#   5. cross build into out/arm64-<edition>, package into out/batocera-<edition>, encrypted package into
#      page/paquets/ (batocera/make_paquet.py).
# No PGO on Batocera, so unlike the Switch build the tree does not need to be swapped into app/.
# Set FORCE=1 to accept a default.xex that is not the one listed for that edition, NO_PAQUET=1 to skip the encrypted
# package (tests).
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
ED=${1:?usage: batocera/build_edition.sh <edition> /path/to/default.xex}
XEX=${2:?usage: batocera/build_edition.sh <edition> /path/to/default.xex}
JOBS=${JOBS:-$(nproc)}
PY=${PYTHON:-python3}
W="$RAIZ/out/editions/$ED"
REF="$RAIZ/assets/game_root/default.xex"
REXGLUE_HOST="$RAIZ/sdk/out/linux-amd64/rexglue"
cd "$RAIZ"

[ -f "$REF" ] && [ -f app/generated/default/codegen.partition.json ] && [ -x "$REXGLUE_HOST" ] || {
  echo "build the reference first: batocera/build.sh /path/to/the/PAL/Spanish/default.xex" >&2; exit 1; }

# The edition and its default.xex
"$PY" - "$ED" "$XEX" "${FORCE:-0}" <<'EOF'
import hashlib, json, sys
ed, xex, force = sys.argv[1:4]
eds = json.load(open('tools/editions/regional/ediciones.json', encoding='utf-8'))['ediciones']
if ed not in eds or ed == 'pal_es':
    sys.exit('unknown edition %r (one of: %s)' % (ed, ', '.join(k for k in eds if k != 'pal_es')))
sha = hashlib.sha256(open(xex, 'rb').read()).hexdigest()
if sha not in eds[ed]['sha256']:
    msg = '%s: SHA-256 %s is not the one of %s' % (xex, sha, eds[ed]['nombre'])
    if force != '1':
        sys.exit(msg)
    print('warning (FORCE=1):', msg)
print('edition:', eds[ed]['nombre'])
EOF

mkdir -p "$W" "assets/editions/$ED"
cp "$XEX" "assets/editions/$ED/default.xex"

echo "== 1. executable images"
[ -f out/editions/pal_es.img ] || "$PY" tools/editions/regional/imagen.py "$REF" out/editions/pal_es.img
"$PY" tools/editions/regional/imagen.py "assets/editions/$ED/default.xex" "$W/imagen.bin"

echo "== 2. address table"
grep -rhoE '(^|[^0-9A-Fa-f])82[0-9A-Fa-f]{6}([^0-9A-Fa-f]|$)' app/src app/*.toml app/orden_funciones.ld \
  app/orden_funciones_lld.txt app/generated/default/codegen.partition.json \
  | grep -oE '82[0-9A-Fa-f]{6}' | tr 'a-f' 'A-F' | sort -u > "$W/direcciones.txt"
echo "$(wc -l < "$W/direcciones.txt") addresses"
"$PY" tools/editions/emparejar.py out/editions/pal_es.img "$W/imagen.bin" "$W/tabla.tsv" < "$W/direcciones.txt" \
  | tee "$W/emparejar.log" | tail -5

echo "== 3. edition tree app_$ED"
ARGS=()
mapfile -t HUELLAS < <("$PY" -c "
import json, sys
e = json.load(open('tools/editions/regional/ediciones.json', encoding='utf-8'))['ediciones']['$ED']
for a, b in e.get('nativo', {}).get('huellas_shaders', {}).items(): print('%s=%s' % (a, b))")
[ ${#HUELLAS[@]} -gt 0 ] && ARGS+=("${HUELLAS[@]}")
[ -f "tools/editions/$ED/parejas_corregidas.json" ] && ARGS+=(--parejas "tools/editions/$ED/parejas_corregidas.json")
"$PY" tools/editions/crear_arbol.py "$ED" "$W/tabla.tsv" "../assets/editions/$ED/default.xex" "${ARGS[@]}" \
  | tee "$W/crear_arbol.log" | tail -8

echo "== 4. code generator"
REXGLUE="$REXGLUE_HOST" PYTHON="$PY" bash tools/codegen.sh "app_$ED" "app_$ED/enganchadas.txt" "out/editions/$ED/tabla.tsv"
grep -iE "falta|faltan|REVISAR|quitad" "$W/crear_arbol.log" | head -20 || true

echo "== 5. cross build, package"
SYSROOT_ARG=()
[ -n "${NFSMW_SYSROOT:-}" ] && SYSROOT_ARG=(-DNFSMW_SYSROOT="$NFSMW_SYSROOT")
cmake -S "app_$ED" -B "out/arm64-$ED" -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE="$RAIZ/batocera/toolchain-aarch64-linux.cmake" "${SYSROOT_ARG[@]}" \
  -DREXSDK_DIR="$RAIZ/sdk" -DREXGLUE_ENABLE_TRACY=OFF -DNFSMW_BUILD_LAUNCHER=OFF
cmake --build "out/arm64-$ED" -j "$JOBS"
batocera/package.sh "out/arm64-$ED" "out/batocera-$ED" "$RAIZ/sdk/out/linux-arm64"
if [ "${NO_PAQUET:-0}" = 1 ]; then echo "done: out/batocera-$ED/ (no package: NO_PAQUET=1)"; exit 0; fi
"$PY" batocera/make_paquet.py "out/batocera-$ED/NFS Most Wanted.sh" "assets/editions/$ED/default.xex" "$ED"
echo "done: out/batocera-$ED/ and page/paquets/nfsmw-$ED.pak (add it with git add -f)"
