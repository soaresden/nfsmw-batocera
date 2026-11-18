# Batocera on PC (Linux x86_64, glibc) with clang 20 + lld, built on an x86_64 Debian/Ubuntu with the amd64
# development libraries (the same ones as the host build).
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR x86_64)

set(NFSMW_TRIPLE x86_64-linux-gnu)
set(NFSMW_CLANG_SUFFIX "-20" CACHE STRING "Suffix of the clang executables (-20 -> clang-20); empty for plain clang")
set(CMAKE_C_COMPILER clang${NFSMW_CLANG_SUFFIX})
set(CMAKE_CXX_COMPILER clang++${NFSMW_CLANG_SUFFIX})
set(CMAKE_ASM_COMPILER clang${NFSMW_CLANG_SUFFIX})
set(CMAKE_C_COMPILER_TARGET ${NFSMW_TRIPLE})
set(CMAKE_CXX_COMPILER_TARGET ${NFSMW_TRIPLE})
set(CMAKE_ASM_COMPILER_TARGET ${NFSMW_TRIPLE})

# x86-64-v3 (AVX2, BMI2, FMA: Intel Haswell 2013+, AMD Zen, Steam Deck). A PC without it could not run the game at
# speed anyway (its GPU needs Vulkan 1.2); the launcher says so instead of crashing on an illegal instruction.
set(NFSMW_CPU_FLAGS "-march=x86-64-v3 -mtune=generic" CACHE STRING "CPU tuning flags")
set(CMAKE_C_FLAGS_INIT "${NFSMW_CPU_FLAGS}")
set(CMAKE_CXX_FLAGS_INIT "${NFSMW_CPU_FLAGS}")
set(CMAKE_EXE_LINKER_FLAGS_INIT "-fuse-ld=lld")
set(CMAKE_SHARED_LINKER_FLAGS_INIT "-fuse-ld=lld")
set(CMAKE_MODULE_LINKER_FLAGS_INIT "-fuse-ld=lld")

set(PKG_CONFIG_EXECUTABLE pkg-config CACHE FILEPATH "")
set(ENV{PKG_CONFIG_LIBDIR} "/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig")
set(ENV{PKG_CONFIG_PATH} "")
set(CMAKE_LIBRARY_ARCHITECTURE x86_64-linux-gnu)
