# PARCHE LOCAL - MinGW (clang + lld, nfsmw-batocera's Windows build): writes a linker response file that keeps the
# symbols of the given static libraries out of a DLL's automatic exports.
#
#   cmake -DNM=<llvm-nm> -DOUT=<file.rsp> -DLIBS="<a.a>|<b.a>" -P rexglue_mingw_exports.cmake
#
# lld exports every symbol of a MinGW DLL that has no explicit dllexport, those of the static third-party libraries
# it links too (spdlog, fmt, SDL3, FFmpeg...). The executable links those libraries again, so a function it had
# imported from the DLL was then defined locally ("spdlog::logger::log_it_ was replaced"). MSVC's
# WINDOWS_EXPORT_ALL_SYMBOLS only exports the DLL's own objects; this does the same.
string(REPLACE "|" ";" LIBS "${LIBS}")  # "|"-separated: a ";" would end the shell command
set(names "")
foreach(lib IN LISTS LIBS)
  if(NOT EXISTS "${lib}")
    continue()
  endif()
  execute_process(COMMAND "${NM}" --defined-only --extern-only -j "${lib}"
                  OUTPUT_VARIABLE out ERROR_QUIET RESULT_VARIABLE rc)
  if(NOT rc EQUAL 0)
    message(FATAL_ERROR "${NM} failed on ${lib}")
  endif()
  string(REGEX REPLACE "[^\n]*:\n" "" out "${out}")  # archive member headers ("x.obj:")
  string(REPLACE "\n" ";" out "${out}")
  list(APPEND names ${out})
endforeach()
list(FILTER names EXCLUDE REGEX "^$")
list(REMOVE_DUPLICATES names)
list(JOIN names "," joined)
file(WRITE "${OUT}" "--exclude-symbols=${joined}\n")
list(LENGTH names n)
message(STATUS "rexruntime: ${n} symbols of static libraries kept out of the DLL's exports")
