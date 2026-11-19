// nfsmw - the button icons follow the device in use: keyboard keys while the keyboard is used, the controller's
// buttons (in the icon style chosen) as soon as the controller is touched again, as modern games do.
//
// The game draws its buttons with nine small textures of GLOBALB.LZC (CROSS, TRIANGLE, SQUARE, CIRCLE, L1, L2, R1,
// R2, SELECT: 32x32 DXT5, tiled, two mips). batocera/tools/ps_buttons writes, for each icon style, ICONOS.BIN with
// those textures' bytes exactly as the game holds them in memory (mods/icones/<style>/ICONOS.BIN), and one more set,
// mods/icones/clavier/ICONOS.BIN, with the PC keys the Windows launcher binds to each button (Enter, Backspace,
// Ctrl, X, 1, 3, Down, Up).
//
// The icons live in the console's memory (the physical 512 MB, where the GPU reads textures from; the committed
// virtual heaps are searched too, in case): the first time a swap is needed, memory is searched for the style's own
// bytes (the launcher applied that style, NFSMW_ICONOS),
// every copy is noted, and from then on the other set's bytes are written over them. The native renderer notices on
// its own: it checks a texture's content again every few frames (an XXH3 of the bytes, nfsmw_nativo_dibujos.cpp).
// Before each write the bytes found are checked again; if the memory was reused, the search starts over.
//
// A thread looks at rex::input::UltimoDispositivo every 150 ms (the input drivers set it). It searches for the icons
// from the start (every 5 s until the game has loaded them, and says in the log how many copies it found), so that
// the first key already shows the keys. The Mods screen of the main menu changes the controller's icon style while
// the game runs (rex::ui::RegistrarCambioEstiloIconos): that style's ICONOS.BIN is written in at once. Without
// ICONOS.BIN, or with nfsmw_iconos_teclado = false, it does nothing. Not on the Switch or Android.
#include <algorithm>
#include <atomic>
#include <functional>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <mutex>
#include <fstream>
#include <string>
#include <thread>
#include <vector>

#include <rex/cvar.h>
#include <rex/input/dispositivo.h>
#include <rex/logging.h>
#include <rex/platform.h>
#include <rex/system/xmemory.h>
#include <rex/ui/overlay/settings_overlay.h>

REXCVAR_DEFINE_BOOL(nfsmw_iconos_teclado, true, "NFSMW",
                    "Iconos de los botones: teclas del PC mientras se usa el teclado, botones del mando (en el estilo "
                    "elegido) en cuanto se toca el mando. Hace falta mods/icones/clavier/ICONOS.BIN")
    .lifecycle(rex::cvar::Lifecycle::kInitOnly);

namespace nfsmw {
namespace {

namespace fs = std::filesystem;
using Bytes = std::vector<uint8_t>;
using Juego = std::vector<std::pair<std::string, Bytes>>;

struct Icono {
  std::string nombre;
  Bytes mando;                   // the controller style's bytes
  Bytes teclado;                 // the keyboard's
  Bytes puesto;                  // what memory holds (what was found or last written)
  std::vector<uint8_t*> copias;  // where (host pointers into guest memory)
};

std::vector<Icono> g_iconos;
std::thread g_hilo;
fs::path g_carpeta;  // mods/icones
std::mutex g_mutex;
std::string g_estilo_pedido;  // a new controller style from the Mods screen, "" if none

fs::path DesdeUtf8(const std::string& s) {
#if defined(__cpp_char8_t)
  return fs::path(std::u8string(reinterpret_cast<const char8_t*>(s.data()), s.size()));
#else
  return fs::u8path(s);
#endif
}

// ICONOS.BIN: "NFSMWICO", u32 count, then per texture name[24], u32 size, bytes (little endian).
bool LeerIconos(const fs::path& ruta, Juego& out) {
  std::ifstream f(ruta, std::ios::binary);
  if (!f) {
    return false;
  }
  Bytes d((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
  if (d.size() < 12 || std::memcmp(d.data(), "NFSMWICO", 8) != 0) {
    return false;
  }
  auto u32 = [&](size_t o) {
    return uint32_t(d[o]) | uint32_t(d[o + 1]) << 8 | uint32_t(d[o + 2]) << 16 | uint32_t(d[o + 3]) << 24;
  };
  const uint32_t n = u32(8);
  size_t p = 12;
  for (uint32_t i = 0; i < n; ++i) {
    if (p + 28 > d.size()) {
      return false;
    }
    std::string nombre(reinterpret_cast<const char*>(&d[p]), strnlen(reinterpret_cast<const char*>(&d[p]), 24));
    const uint32_t tam = u32(p + 24);
    p += 28;
    if (p + tam > d.size()) {
      return false;
    }
    out.emplace_back(nombre, Bytes(d.begin() + p, d.begin() + p + tam));
    p += tam;
  }
  return true;
}

const Bytes* Buscar(const Juego& juego, const std::string& nombre, size_t tam) {
  for (const auto& [n, b] : juego) {
    if (n == nombre && b.size() == tam) {
      return &b;
    }
  }
  return nullptr;
}

// Every place of `aguja` in [inicio, inicio + tam) (Boyer-Moore-Horspool: with a needle of a kilobyte or more it
// skips most of the bytes).
void Hallar(uint8_t* inicio, size_t tam, const Bytes& aguja, std::vector<uint8_t*>& out) {
  if (aguja.size() < 64 || tam < aguja.size()) {
    return;
  }
  const std::boyer_moore_horspool_searcher buscador(aguja.begin(), aguja.end());
  uint8_t* p = inicio;
  uint8_t* fin = inicio + tam;
  while (true) {
    uint8_t* hallado = std::search(p, fin, buscador);
    if (hallado == fin) {
      break;
    }
    out.push_back(hallado);
    p = hallado + aguja.size();
  }
}

// Where to look: the physical memory (512 MB, where the GPU reads textures from), then, in case, the committed
// regions of the virtual heaps below the executable.
std::vector<std::pair<uint8_t*, size_t>> Zonas(rex::memory::Memory* memory) {
  std::vector<std::pair<uint8_t*, size_t>> zonas;
  zonas.emplace_back(memory->physical_membase(), size_t(512) * 1024 * 1024);
  uint32_t dir = 0x00010000;
  while (dir < 0x80000000u) {
    rex::memory::HeapAllocationInfo info{};
    rex::memory::BaseHeap* heap = memory->LookupHeap(dir);
    if (!heap || !heap->QueryRegionInfo(dir, &info) || !info.region_size) {
      dir += 0x10000;
      continue;
    }
    if (info.state & rex::memory::kMemoryAllocationCommit) {
      zonas.emplace_back(memory->TranslateVirtual(info.base_address), size_t(info.region_size));
    }
    const uint64_t siguiente = uint64_t(info.base_address) + info.region_size;
    dir = siguiente > dir ? uint32_t(std::min<uint64_t>(siguiente, 0x80000000u)) : dir + 0x10000;
  }
  return zonas;
}

// Are the copies still holding what was put there? (a texture pack can be unloaded and its memory reused)
bool Validas() {
  size_t total = 0;
  for (const Icono& ic : g_iconos) {
    for (uint8_t* p : ic.copias) {
      if (std::memcmp(p, ic.puesto.data(), ic.puesto.size()) != 0) {
        return false;
      }
    }
    total += ic.copias.size();
  }
  return total > 0;
}

size_t BuscarCopias(rex::memory::Memory* memory) {
  const auto zonas = Zonas(memory);
  size_t total = 0;
  for (Icono& ic : g_iconos) {
    ic.copias.clear();
    for (const auto& [inicio, tam] : zonas) {
      Hallar(inicio, tam, ic.puesto, ic.copias);
    }
    total += ic.copias.size();
  }
  return total;
}

void Hilo(rex::memory::Memory* memory) {
  bool encontrado = false;
  bool avisado_ausente = false;
  bool teclado_mostrado = false;
  auto proxima_busqueda = std::chrono::steady_clock::now();
  while (true) {
    std::this_thread::sleep_for(std::chrono::milliseconds(150));

    // A new controller style chosen in the Mods screen.
    std::string pedido;
    {
      std::lock_guard<std::mutex> cerrojo(g_mutex);
      pedido.swap(g_estilo_pedido);
    }
    if (!pedido.empty()) {
      Juego nuevo;
      if (LeerIconos(g_carpeta / pedido / "ICONOS.BIN", nuevo)) {
        for (Icono& ic : g_iconos) {
          if (const Bytes* b = Buscar(nuevo, ic.nombre, ic.mando.size())) {
            ic.mando = *b;
          }
        }
        REXLOG_INFO("[iconos] estilo del mando: {}", pedido);
      } else {
        REXLOG_WARN("[iconos] sin mods/icones/{}/ICONOS.BIN: el estilo cambia en el proximo lanzamiento", pedido);
      }
    }

    if (!encontrado || !Validas()) {
      if (std::chrono::steady_clock::now() < proxima_busqueda) {
        continue;
      }
      const auto t0 = std::chrono::steady_clock::now();
      const size_t total = BuscarCopias(memory);
      const auto ms =
          std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count();
      encontrado = total > 0;
      proxima_busqueda = std::chrono::steady_clock::now() + std::chrono::seconds(5);
      if (encontrado || !avisado_ausente) {
        REXLOG_INFO("[iconos] {} copias de los {} iconos en memoria ({} ms){}", total, g_iconos.size(), ms,
                    total ? "" : ": todavia no cargados, se busca otra vez cada 5 s");
        avisado_ausente = !encontrado;
      }
      if (!encontrado) {
        continue;
      }
    }

    const bool teclado = rex::input::UltimoDispositivo() == rex::input::Dispositivo::kTeclado;
    bool escrito = false;
    for (Icono& ic : g_iconos) {
      const Bytes& quiero = teclado ? ic.teclado : ic.mando;
      if (quiero != ic.puesto) {
        for (uint8_t* p : ic.copias) {
          std::memcpy(p, quiero.data(), quiero.size());
        }
        ic.puesto = quiero;
        escrito = true;
      }
    }
    if (escrito || teclado != teclado_mostrado) {
      REXLOG_INFO("[iconos] {}", teclado ? "teclado: teclas del PC" : "mando: botones del estilo elegido");
      teclado_mostrado = teclado;
    }
  }
}

}  // namespace

void PrepararIconosTeclado(rex::memory::Memory* memory) {
#if !REX_PLATFORM_SWITCH && !REX_PLATFORM_ANDROID
  if (!REXCVAR_GET(nfsmw_iconos_teclado) || !memory || !memory->physical_membase() || g_hilo.joinable()) {
    return;
  }
  fs::path raiz = DesdeUtf8(rex::cvar::GetFlagByName("game_data_root")).lexically_normal();
  if (!raiz.has_filename()) {
    raiz = raiz.parent_path();
  }
  g_carpeta = raiz.parent_path() / "mods" / "icones";
  const char* e = std::getenv("NFSMW_ICONOS");
  const std::string estilo = e && *e ? e : "xbox360";
  Juego mando, teclado;
  if (!LeerIconos(g_carpeta / estilo / "ICONOS.BIN", mando) || !LeerIconos(g_carpeta / "clavier" / "ICONOS.BIN", teclado)) {
    REXLOG_INFO("[iconos] sin mods/icones/{}/ICONOS.BIN o mods/icones/clavier/ICONOS.BIN: los iconos no siguen al "
                "teclado (rehaga los iconos desde la pagina de instalacion)", estilo);
    return;
  }
  for (const auto& [nombre, bytes] : mando) {
    if (const Bytes* t = Buscar(teclado, nombre, bytes.size())) {
      g_iconos.push_back({nombre, bytes, *t, bytes, {}});
    }
  }
  if (g_iconos.empty()) {
    return;
  }
  rex::ui::RegistrarCambioEstiloIconos([](const std::string& nuevo) {
    std::lock_guard<std::mutex> cerrojo(g_mutex);
    g_estilo_pedido = nuevo;
  });
  REXLOG_INFO("[iconos] {} iconos: {} con el mando, teclas del PC con el teclado", g_iconos.size(), estilo);
  g_hilo = std::thread(Hilo, memory);
  g_hilo.detach();
#else
  (void)memory;
#endif
}

}  // namespace nfsmw
