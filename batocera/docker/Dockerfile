# Build environment for the Batocera packages (aarch64 and x86_64): Ubuntu 24.04, as in README.md "Compilation".
# A newer Ubuntu links against a glibc newer than Batocera's, so the Linux builds stay on 24.04; the Windows build
# (MinGW) does not care. Used by batocera/docker/build.sh; the repository is mounted, nothing of the game is copied in.
#
#   docker build -t nfsmw-build:24.04 batocera/docker
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
# amd64 from the main archive, arm64 from ports.ubuntu.com (multiarch).
RUN sed -i '/^Components:/a Architectures: amd64' /etc/apt/sources.list.d/ubuntu.sources \
 && printf '%s\n' 'Types: deb' 'URIs: http://ports.ubuntu.com/ubuntu-ports' \
      'Suites: noble noble-updates noble-security' 'Components: main universe' 'Architectures: arm64' \
      'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg' > /etc/apt/sources.list.d/ports.sources \
 && dpkg --add-architecture arm64 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget gnupg cmake ninja-build python3 python3-numpy \
      binutils binutils-aarch64-linux-gnu git pkg-config
# clang 20 from apt.llvm.org when the archive does not have it.
RUN (apt-get install -y --no-install-recommends clang-20 lld-20 llvm-20) || ( \
      wget -qO- https://apt.llvm.org/llvm-snapshot.gpg.key > /etc/apt/trusted.gpg.d/apt.llvm.org.asc \
   && echo 'deb [arch=amd64] http://apt.llvm.org/noble/ llvm-toolchain-noble-20 main' > /etc/apt/sources.list.d/llvm.list \
   && apt-get update && apt-get install -y --no-install-recommends clang-20 lld-20 llvm-20)
RUN set -e; LIBS="libc6-dev libstdc++-13-dev libvulkan-dev libwayland-dev libxkbcommon-dev libx11-dev libx11-xcb-dev \
      libxext-dev libxtst-dev libxrandr-dev libxi-dev libxcursor-dev libxss-dev libxfixes-dev libasound2-dev \
      libpulse-dev libdrm-dev libgbm-dev libudev-dev libegl-dev libgles-dev libdbus-1-dev"; \
    apt-get install -y --no-install-recommends g++-aarch64-linux-gnu $LIBS $(for l in $LIBS; do echo $l:arm64; done) \
 && rm -rf /var/lib/apt/lists/*
