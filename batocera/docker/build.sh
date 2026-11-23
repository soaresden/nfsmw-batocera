#!/bin/bash
# Runs batocera/rebuild_all.sh for the Linux machines inside the Ubuntu 24.04 image (Dockerfile next to this file),
# for a build PC whose own system is newer than Batocera's glibc allows. The repository is mounted at the same path,
# so the build folders (out/arm64*, out/x86_64*) stay usable from the host's scripts.
#
#   batocera/docker/build.sh                      # ARCHES="aarch64 x86_64" SKIP_CODEGEN=1 JOBS=4 by default
#
# The edition trees (app_usa, app_pal_en) must exist: the codegen runs on the host (rebuild_all.sh or
# build_edition.sh with ARCH=win64), its output does not depend on the system.
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
docker image inspect nfsmw-build:24.04 > /dev/null 2>&1 || docker build -t nfsmw-build:24.04 "$RAIZ/batocera/docker"
exec docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$RAIZ:$RAIZ" -w "$RAIZ" \
  -e ARCHES="${ARCHES:-aarch64 x86_64}" -e SKIP_CODEGEN="${SKIP_CODEGEN:-1}" -e JOBS="${JOBS:-4}" \
  nfsmw-build:24.04 bash batocera/rebuild_all.sh
