# Cross compilation for Batocera (Linux aarch64, glibc) with clang 20 + lld.
# Sysroot: by default the host's multiarch arm64 libraries (/usr/lib/aarch64-linux-gnu),
# or any Debian/Ubuntu arm64 root given with -DNFSMW_SYSROOT=/path.
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)

set(NFSMW_TRIPLE aarch64-linux-gnu)
# Clang 19 or newer: with clang 18, libstdc++'s <expected> stays disabled (its __cpp_concepts check).
set(NFSMW_CLANG_SUFFIX "-20" CACHE STRING "Suffix of the clang executables (-20 -> clang-20); empty for plain clang")
set(CMAKE_C_COMPILER clang${NFSMW_CLANG_SUFFIX})
set(CMAKE_CXX_COMPILER clang++${NFSMW_CLANG_SUFFIX})
set(CMAKE_ASM_COMPILER clang${NFSMW_CLANG_SUFFIX})
set(CMAKE_C_COMPILER_TARGET ${NFSMW_TRIPLE})
set(CMAKE_CXX_COMPILER_TARGET ${NFSMW_TRIPLE})
set(CMAKE_ASM_COMPILER_TARGET ${NFSMW_TRIPLE})

if(NFSMW_SYSROOT)
    set(CMAKE_SYSROOT ${NFSMW_SYSROOT})
endif()

# Snapdragon 865 (Retroid Pocket 5 / Mini): Cortex-A77 + A55, ARMv8.2-A with dotprod, fp16 and crc.
set(NFSMW_CPU_FLAGS "-mcpu=cortex-a77" CACHE STRING "CPU tuning flags")
set(CMAKE_C_FLAGS_INIT "${NFSMW_CPU_FLAGS}")
set(CMAKE_CXX_FLAGS_INIT "${NFSMW_CPU_FLAGS}")
# libstdc++ stays shared: the executable and librexruntime.so must use the same one. package.sh puts the build's
# copy in nfsmw/lib/cxx/ and the launcher uses it only when the console's is older.
set(CMAKE_EXE_LINKER_FLAGS_INIT "-fuse-ld=lld")
set(CMAKE_SHARED_LINKER_FLAGS_INIT "-fuse-ld=lld")
set(CMAKE_MODULE_LINKER_FLAGS_INIT "-fuse-ld=lld")

set(PKG_CONFIG_EXECUTABLE pkg-config CACHE FILEPATH "")
set(ENV{PKG_CONFIG_LIBDIR} "/usr/lib/aarch64-linux-gnu/pkgconfig:/usr/share/pkgconfig")
set(ENV{PKG_CONFIG_PATH} "")

set(CMAKE_LIBRARY_ARCHITECTURE aarch64-linux-gnu)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
