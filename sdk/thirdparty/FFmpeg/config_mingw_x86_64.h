/* NFSMW: Windows x86_64 built with clang and MinGW-w64 (batocera/toolchain-x86_64-windows-mingw.cmake): the MSVC
 * configuration, without what only Microsoft's C library has. */
#include "config_windows_x86_64.h"
#undef HAVE_LIBC_MSVCRT
#define HAVE_LIBC_MSVCRT 0
