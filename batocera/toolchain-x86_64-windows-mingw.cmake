# Windows x86_64 (RetroBat, or any Windows PC) cross-compiled from Linux with clang 20 + lld and the MinGW-w64 runtime
# (Ubuntu's mingw-w64). Microsoft's SDK and MSVC libraries are not needed. clang takes GCC's "win32" thread model
# (/usr/lib/gcc/x86_64-w64-mingw32/13-win32): ship that variant's libstdc++-6.dll and libgcc_s_seh-1.dll next to
# nfsmw.exe (the POSIX variant's libgcc lacks __gthr_win32_self: "point d'entree introuvable" on Windows).
set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_PROCESSOR x86_64)
set(NFSMW_TRIPLE x86_64-w64-mingw32)
set(NFSMW_CLANG_SUFFIX "-20" CACHE STRING "Suffix of the clang executables")
set(CMAKE_C_COMPILER clang${NFSMW_CLANG_SUFFIX})
set(CMAKE_CXX_COMPILER clang++${NFSMW_CLANG_SUFFIX})
set(CMAKE_ASM_COMPILER clang${NFSMW_CLANG_SUFFIX})
set(CMAKE_RC_COMPILER llvm-windres-20)
set(CMAKE_C_COMPILER_TARGET ${NFSMW_TRIPLE})
set(CMAKE_CXX_COMPILER_TARGET ${NFSMW_TRIPLE})
set(CMAKE_ASM_COMPILER_TARGET ${NFSMW_TRIPLE})
set(NFSMW_MINGW_GCC "/usr/lib/gcc/x86_64-w64-mingw32/13-win32" CACHE PATH "MinGW GCC whose DLLs go with nfsmw.exe")
set(NFSMW_CPU_FLAGS "-march=x86-64-v3 -mtune=generic" CACHE STRING "CPU tuning flags")
# mingw-include/: Windows.h, ObjBase.h... as the sources spell them (MinGW's are in lower case, on a case-sensitive
# disk). __INTRINSIC_DEFINED___cpuidex: MinGW's intrin.h would define __cpuidex, then clang's cpuid.h again.
# -femulated-tls: thread_local as GCC built MinGW's libstdc++-6.dll (std::call_once's __once_call, ...).
set(NFSMW_MINGW_FLAGS "-isystem ${CMAKE_CURRENT_LIST_DIR}/mingw-include -D__INTRINSIC_DEFINED___cpuidex -femulated-tls")
set(CMAKE_C_FLAGS_INIT "${NFSMW_CPU_FLAGS} ${NFSMW_MINGW_FLAGS}")
set(CMAKE_CXX_FLAGS_INIT "${NFSMW_CPU_FLAGS} ${NFSMW_MINGW_FLAGS}")
# The C++ runtime shared (libstdc++-6.dll and libgcc_s_seh-1.dll of ${NFSMW_MINGW_GCC} next to nfsmw.exe): linked into
# both librexruntime.dll and nfsmw.exe, its std::string members were defined twice.
set(CMAKE_EXE_LINKER_FLAGS_INIT "-fuse-ld=lld")
set(CMAKE_SHARED_LINKER_FLAGS_INIT "-fuse-ld=lld")
set(CMAKE_MODULE_LINKER_FLAGS_INIT "${CMAKE_SHARED_LINKER_FLAGS_INIT}")
set(CMAKE_FIND_ROOT_PATH /usr/x86_64-w64-mingw32)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
