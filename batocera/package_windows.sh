#!/bin/bash
# Makes the Windows (RetroBat, or any Windows PC) folder from a MinGW build (batocera/toolchain-x86_64-windows-mingw.cmake):
#
#   batocera/package_windows.sh <build dir> <output dir>
#
# Output: "NFS Most Wanted.sh/bin/x86_64-windows/", the same game folder as Batocera's (game_root/, mods/, data/,
# saves/ shared), so one folder can hold the Retroid, PC Linux and Windows builds side by side:
#   nfsmw.exe, librexruntime.dll, librexgpu-xenos.dll    the game (debug info stripped)
#   libstdc++-6.dll, libgcc_s_seh-1.dll                   the C++ runtime of MinGW's GCC "win32" thread model
#   python/                                               Python 3.12 for mods.py (Windows has none): the NuGet
#                                                         package "python" (its tools/ folder), tests and Tk left out
#   mods.py, jdlz.py, nfsmw.toml, NFS Most Wanted.bat     the launcher finds the game two folders up (..\..)
#   VERSION
# The page adds roms\windows\NFS Most Wanted.bat for RetroBat (a one-line call to the launcher above).
# PYTHON_EMBED=<folder with python.exe> uses that Python instead of downloading it (cached in out/python-nuget/).
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
BUILD=${1:?build dir}
DEST=${2:?output dir}
PYVER=${PYVER:-3.12.10}
MINGW_GCC=${MINGW_GCC:-/usr/lib/gcc/x86_64-w64-mingw32/13-win32}
STRIP=$(command -v llvm-strip-20 || command -v llvm-strip)
OBJDUMP=$(command -v llvm-objdump-20 || command -v llvm-objdump)

EXE=$(find "$BUILD" -maxdepth 2 -type f -name nfsmw.exe | head -1)
[ -n "$EXE" ] || { echo "nfsmw.exe not found in $BUILD" >&2; exit 1; }

rm -rf "$DEST"
PKG="$DEST/NFS Most Wanted.sh"
BIN="$PKG/bin/x86_64-windows"
mkdir -p "$BIN"
cp "$EXE" "$BIN/nfsmw.exe"
for name in librexruntime.dll librexgpu-xenos.dll; do
  dll=$(find "$BUILD" "$RAIZ/sdk/out" -type f -name "$name" -newer "$RAIZ/batocera/package_windows.sh" 2>/dev/null | head -1)
  [ -n "$dll" ] || dll=$(find "$BUILD" "$RAIZ/sdk/out" -type f -name "$name" 2>/dev/null | head -1)
  [ -n "$dll" ] || { echo "$name not found in $BUILD or sdk/out" >&2; exit 1; }
  cp "$dll" "$BIN/$name"
done
for f in "$BIN"/nfsmw.exe "$BIN"/*.dll; do "$STRIP" --strip-debug "$f"; done
cp "$MINGW_GCC/libstdc++-6.dll" "$MINGW_GCC/libgcc_s_seh-1.dll" "$BIN/"
# GCC's DLLs carry their debug info (libstdc++-6.dll: 27 MB, 4.6 MB without); llvm-strip cannot read them, binutils can.
for f in "$BIN/libstdc++-6.dll" "$BIN/libgcc_s_seh-1.dll"; do
  x86_64-w64-mingw32-strip --strip-debug "$f" 2>/dev/null || echo "warning: $(basename "$f") not stripped" >&2
done

# Python: the NuGet package (a zip; its tools/ folder is a whole Python with its standard library).
if [ -n "${PYTHON_EMBED:-}" ]; then
  cp -r "$PYTHON_EMBED" "$BIN/python"
else
  CACHE="$RAIZ/out/python-nuget/$PYVER"
  if [ ! -x "$CACHE/tools/python.exe" ] && [ ! -f "$CACHE/tools/python.exe" ]; then
    mkdir -p "$CACHE"
    curl -fsSL "https://www.nuget.org/api/v2/package/python/$PYVER" -o "$CACHE/python.nupkg"
    python3 -c "import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); [z.extract(n, sys.argv[2]) for n in z.namelist() if n.startswith('tools/')]" \
      "$CACHE/python.nupkg" "$CACHE"
  fi
  cp -r "$CACHE/tools" "$BIN/python"
fi
# What mods.py never needs: tests, Tk, IDLE, pip, docs (27 MB down to about 15).
( cd "$BIN/python" && rm -rf Lib/test Lib/idlelib Lib/tkinter Lib/turtledemo Lib/ensurepip Lib/lib2to3 Lib/pydoc_data \
    Lib/site-packages/* tcl Scripts include libs DLLs/_tkinter.pyd DLLs/tcl*.dll DLLs/tk*.dll Lib/turtle.py )
find "$BIN/python" -name __pycache__ -type d -prune -exec rm -rf {} +

cp "$RAIZ/batocera/port/mods.py" "$RAIZ/batocera/tools/ps_buttons/jdlz.py" "$BIN/"
cp "$RAIZ/batocera/nfsmw.toml" "$BIN/nfsmw.toml"
sed 's/\r*$/\r/' "$RAIZ/batocera/windows/NFS Most Wanted.bat" > "$BIN/NFS Most Wanted.bat"  # cmd.exe wants CRLF
echo "nfsmw-batocera $(git -C "$RAIZ" describe --always --dirty 2>/dev/null || echo unknown) $(date -u '+%F %H:%M UTC') win64" > "$BIN/VERSION"

# Every DLL the executables import must be next to them or be part of Windows (or the graphics driver: vulkan-1).
missing=0
for f in "$BIN"/nfsmw.exe "$BIN"/*.dll; do
  for dll in $("$OBJDUMP" -p "$f" | sed -n 's/^ *DLL Name: //p'); do
    [ -f "$BIN/$dll" ] && continue
    case "${dll,,}" in
      kernel32.dll|user32.dll|gdi32.dll|advapi32.dll|shell32.dll|ole32.dll|oleaut32.dll|ws2_32.dll|winmm.dll|imm32.dll|\
      version.dll|setupapi.dll|cfgmgr32.dll|hid.dll|dinput8.dll|xinput1_4.dll|dbghelp.dll|bcrypt.dll|bcryptprimitives.dll|\
      dwmapi.dll|shlwapi.dll|uxtheme.dll|ntdll.dll|msvcrt.dll|vulkan-1.dll|avrt.dll|mmdevapi.dll|propsys.dll|comdlg32.dll|\
      crypt32.dll|secur32.dll|iphlpapi.dll|userenv.dll|powrprof.dll|synchronization.dll|dxgi.dll|d3d11.dll|d3d12.dll|\
      api-ms-win-*) ;;
      *) echo "missing: $(basename "$f") imports $dll" >&2; missing=1 ;;
    esac
  done
done
[ "$missing" = 0 ] || { echo "some imports do not resolve (see above)" >&2; exit 1; }
echo "Windows package: $BIN"
du -sh "$BIN" "$BIN/python"
