// Crash report (Linux: Batocera aarch64 and x86_64). SIGTRAP, SIGABRT and SIGFPE used to end the game without a
// word in any log (exit code 133 for SIGTRAP: a __builtin_trap of the recompiled code, "jump to null value" or
// "switch case out of range", or a debug trap). This handler writes the faulting instruction, the link register and
// the call stack to stderr (nfsmw-stdout.log on Batocera) as module+offset, then lets the signal kill the process as
// before. The offsets resolve against the unstripped build (out/arm64*/nfsmw, librexruntime.so):
//   llvm-symbolizer-20 --obj=out/arm64-pal_en/nfsmw 0x<offset>
// SIGSEGV, SIGILL and SIGBUS stay with the SDK's exception handler (guest memory accesses).
#if defined(__linux__) && !defined(__ANDROID__)

#include <dlfcn.h>
#include <execinfo.h>
#include <signal.h>
#include <ucontext.h>
#include <unistd.h>

#include <cstdio>
#include <cstring>

namespace {

void Escribir(const char* texto) {
  const ssize_t r = write(STDERR_FILENO, texto, std::strlen(texto));
  (void)r;
}

void Direccion(const char* que, void* direccion) {
  char linea[512];
  Dl_info info{};
  if (direccion != nullptr && dladdr(direccion, &info) != 0 && info.dli_fname != nullptr) {
    const char* modulo = std::strrchr(info.dli_fname, '/');
    modulo = modulo != nullptr ? modulo + 1 : info.dli_fname;
    std::snprintf(linea, sizeof(linea), "[fallo] %s %p = %s+0x%zx (%s)\n", que, direccion, modulo,
                  static_cast<size_t>(static_cast<char*>(direccion) - static_cast<char*>(info.dli_fbase)),
                  info.dli_sname != nullptr ? info.dli_sname : "?");
  } else {
    std::snprintf(linea, sizeof(linea), "[fallo] %s %p\n", que, direccion);
  }
  Escribir(linea);
}

const char* Nombre(int senal) {
  switch (senal) {
    case SIGTRAP: return "SIGTRAP (trap of the recompiled code or a debug trap)";
    case SIGABRT: return "SIGABRT (abort)";
    case SIGFPE: return "SIGFPE (arithmetic)";
    default: return "?";
  }
}

void AlFallar(int senal, siginfo_t* /*info*/, void* contexto) {
  char linea[256];
  std::snprintf(linea, sizeof(linea), "[fallo] signal %d %s in thread %ld\n", senal, Nombre(senal),
                static_cast<long>(gettid()));
  Escribir(linea);
  const auto* uc = static_cast<const ucontext_t*>(contexto);
#if defined(__aarch64__)
  Direccion("pc", reinterpret_cast<void*>(uc->uc_mcontext.pc));
  Direccion("lr", reinterpret_cast<void*>(uc->uc_mcontext.regs[30]));
#elif defined(__x86_64__)
  Direccion("pc", reinterpret_cast<void*>(uc->uc_mcontext.gregs[REG_RIP]));
#endif
  void* pila[32];
  const int n = backtrace(pila, 32);
  for (int i = 0; i < n; ++i) {
    Direccion("stack", pila[i]);
  }
  // As before: the default action ends the process with the same signal (and exit code).
  signal(senal, SIG_DFL);
  raise(senal);
}

struct Instalar {
  Instalar() {
    // backtrace() loads libgcc_s on its first call: not inside the handler.
    void* calentar[1];
    backtrace(calentar, 1);
    struct sigaction accion {};
    accion.sa_sigaction = AlFallar;
    accion.sa_flags = SA_SIGINFO | SA_ONSTACK;
    sigemptyset(&accion.sa_mask);
    for (const int senal : {SIGTRAP, SIGABRT, SIGFPE}) {
      sigaction(senal, &accion, nullptr);
    }
  }
} instalar;

}  // namespace

#endif
