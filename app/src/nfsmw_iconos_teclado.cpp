// nfsmw - the button icons follow the device in use: keyboard keys while the keyboard is used, the controller's
// buttons (in the icon style chosen) as soon as the controller is touched again, as modern games do.
//
// The game draws its buttons with nine small textures of GLOBALB.LZC (CROSS, TRIANGLE, SQUARE, CIRCLE, L1, L2, R1,
// R2, SELECT: 32x32 DXT5, tiled, two mips). batocera/tools/ps_buttons writes, for each icon style, ICONOS.BIN with
// those textures' bytes exactly as the game holds them in memory (mods/icones/<style>/ICONOS.BIN), and one more set,
// mods/icones/clavier/ICONOS.BIN, with the PC keys the Windows launcher binds to each button (Enter, Backspace,
// Ctrl, X, 1, 3, Down, Up).
//
// The icons live in the console's physical memory (512 MB, where the GPU reads textures from): memory is searched
// for the style's own bytes (the launcher applied that style, NFSMW_ICONOS),
// every copy is noted, and from then on the other set's bytes are written over them. The native renderer notices on
// its own: it checks a texture's content again every few frames (an XXH3 of the bytes, nfsmw_nativo_dibujos.cpp).
// Before each write the bytes found are checked again; if the memory was reused, the search starts over.
//
// A thread looks at rex::input::UltimoDispositivo every 150 ms (the input drivers set it). It searches for the icons
// from the start (every 5 s until the game has loaded them, and says in the log how many copies it found), so that
// the first key already shows the keys. The Mods screen of the main menu changes the controller's icon style while
// the game runs (rex::ui::RegistrarCambioEstiloIconos): that style's ICONOS.BIN is written in at once. Without
// ICONOS.BIN, or with nfsmw_iconos_teclado = false, it does nothing. The style "clavier" (chosen in the Mods screen,
// NFSMW_CLAVIER=1 from the launcher) shows the keys all the time, the controller style's files staying in place. Not on the Switch or Android.
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

namespace nfsmw::nativo {
void ForzarComprobacionTexturas();  // nfsmw_nativo_dibujos.cpp
}

namespace nfsmw {
namespace {

namespace fs = std::filesystem;
using Bytes = std::vector<uint8_t>;
using Juego = std::vector<std::pair<std::string, Bytes>>;

// The ranges of a 32 KB icon region that hold texels (the rest is the tiling's padding, zero in the file): only
// they are compared and written, so whatever memory holds in the padding does not matter and is never touched.
using Tramos = std::vector<std::pair<uint32_t, uint32_t>>;  // [begin, end)

struct Icono {
  std::string nombre;
  Bytes mando;                   // the controller style's bytes
  Bytes teclado;                 // the keyboard's
  Bytes inicial;                 // what the game loads (data/iconos-juego.bin): what is searched for
  Bytes puesto;                  // what memory holds where it was found (what was found or last written)
  std::vector<uint8_t*> copias;  // where (host pointers into guest memory)
  Tramos tramos;
  // The controls screen's pictures (DYNTEX_<hash>): loaded only while that screen or a loading screen shows, so
  // searched for often, while what they should show differs from what the game loads.
  bool transitoria = false;
};

Tramos CalcularTramos(const Icono& ic) {
  Tramos t;
  const size_t n = ic.puesto.size();
  size_t i = 0;
  while (i < n) {
    auto usado = [&](size_t k) {
      return (k < ic.mando.size() && ic.mando[k]) || (k < ic.teclado.size() && ic.teclado[k]) || ic.puesto[k] ||
             ic.inicial[k];
    };
    if (!usado(i)) {
      ++i;
      continue;
    }
    size_t fin = i;
    size_t ceros = 0;
    while (fin < n && ceros < 64) {
      ceros = usado(fin) ? 0 : ceros + 1;
      ++fin;
    }
    fin -= ceros;
    t.emplace_back(uint32_t(i), uint32_t(fin));
    i = fin;
  }
  return t;
}

bool Igual(const uint8_t* mem, const Bytes& b, const Tramos& t) {
  for (const auto& [i, f] : t) {
    if (std::memcmp(mem + i, b.data() + i, f - i) != 0) {
      return false;
    }
  }
  return true;
}

void Poner(uint8_t* mem, const Bytes& b, const Tramos& t) {
  for (const auto& [i, f] : t) {
    std::memcpy(mem + i, b.data() + i, f - i);
  }
}

std::vector<Icono> g_iconos;
std::thread g_hilo;
fs::path g_carpeta;  // mods/icones
std::mutex g_mutex;
std::string g_estilo_pedido;  // a new controller style from the Mods screen, "" if none
std::atomic<bool> g_forzar_teclado{false};  // style "clavier": the keys always (NFSMW_CLAVIER=1, or the Mods screen)

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

// The icons are 32 KB regions, mostly zero (a 32x32 tiled texture is spread over the tiling's padding), and so is
// much of memory: searching for the whole region makes Boyer-Moore-Horspool crawl. So a short anchor is searched
// for, 32 bytes of the texture with no zero at either end and as many different bytes as possible, and the whole
// region is compared only where the anchor is.
size_t Ancla(const Bytes& b) {
  constexpr size_t kAncla = 32;
  size_t mejor = 0;
  int mejor_puntos = -1;
  for (size_t o = 0; o + kAncla <= b.size(); o += 4) {
    if (!b[o] || !b[o + kAncla - 1]) {
      continue;
    }
    bool visto[256] = {};
    int distintos = 0;
    for (size_t i = 0; i < kAncla; ++i) {
      if (!visto[b[o + i]]) {
        visto[b[o + i]] = true;
        ++distintos;
      }
    }
    if (distintos > mejor_puntos) {
      mejor_puntos = distintos;
      mejor = o;
    }
  }
  return mejor;
}

// A texture's base address is a multiple of 4 KB on the Xenos (its fetch constant holds it in 4 KB units): checking
// those addresses only is enough, and instant.
void HallarAlineado(uint8_t* inicio, size_t tam, uint32_t guest_inicio, const Bytes& aguja, const Tramos& tramos,
                    std::vector<uint8_t*>& out) {
  constexpr size_t kAncla = 32;
  if (aguja.size() < 64 || tam < aguja.size()) {
    return;
  }
  const size_t off = Ancla(aguja);
  const size_t primero = (0x1000 - (guest_inicio & 0xFFF)) & 0xFFF;
  for (size_t o = primero; o + aguja.size() <= tam; o += 0x1000) {
    uint8_t* base = inicio + o;
    if (std::memcmp(base + off, aguja.data() + off, kAncla) == 0 && Igual(base, aguja, tramos)) {
      out.push_back(base);
    }
  }
}

// Every place of `aguja` in [inicio, inicio + tam), at any address (the slow way, if the aligned one finds nothing).
void Hallar(uint8_t* inicio, size_t tam, const Bytes& aguja, const Tramos& tramos, std::vector<uint8_t*>& out) {
  constexpr size_t kAncla = 32;
  if (aguja.size() < 64 || tam < aguja.size()) {
    return;
  }
  const size_t off = Ancla(aguja);
  const std::boyer_moore_horspool_searcher buscador(aguja.begin() + off, aguja.begin() + off + kAncla);
  uint8_t* p = inicio + off;
  uint8_t* fin = inicio + tam - (aguja.size() - off - kAncla);
  while (p < fin) {
    uint8_t* hallado = std::search(p, fin, buscador);
    if (hallado == fin) {
      break;
    }
    uint8_t* base = hallado - off;
    if (base >= inicio && Igual(base, aguja, tramos)) {
      out.push_back(base);
      p = base + aguja.size() + off;
    } else {
      p = hallado + 1;
    }
  }
}

// Where to look: the physical memory (512 MB, where the GPU reads textures from, so where the icons are), its
// committed and readable regions only, as its heap lists them: a page the heap has released or guards is protected,
// and reading it kills the game (an access violation in a virtual heap, 19/11, which is no longer searched).
struct Zona {
  uint8_t* inicio;
  size_t tam;
  uint32_t guest;  // its physical address
};

std::vector<Zona> Zonas(rex::memory::Memory* memory) {
  std::vector<Zona> zonas;
  rex::memory::BaseHeap* heap = memory->GetPhysicalHeap();
  if (!heap) {
    return zonas;
  }
  uint8_t* fisica = memory->physical_membase();
  uint64_t dir = 0;
  while (dir < 0x20000000u) {
    rex::memory::HeapAllocationInfo info{};
    if (!heap->QueryRegionInfo(uint32_t(dir), &info) || !info.region_size) {
      dir += 0x1000;
      continue;
    }
    if ((info.state & rex::memory::kMemoryAllocationCommit) && (info.protect & rex::memory::kMemoryProtectRead)) {
      zonas.push_back({fisica + info.base_address, size_t(info.region_size), info.base_address});
    }
    const uint64_t siguiente = uint64_t(info.base_address) + info.region_size;
    dir = siguiente > dir ? siguiente : dir + 0x1000;
  }
  return zonas;
}

// Searches for the icons not found yet, as the game loads them (it loads them some seconds after the start, not all
// at once: a single early search found 2 of 9, 19/11). Returns how many were found this time.
size_t BuscarFaltan(rex::memory::Memory* memory, bool transitorias) {
  const auto zonas = Zonas(memory);
  size_t nuevas = 0;
  for (bool lento : {false, true}) {
    for (Icono& ic : g_iconos) {
      if (!ic.copias.empty() || ic.transitoria != transitorias) {
        continue;
      }
      for (const Zona& z : zonas) {
        if (lento) {
          Hallar(z.inicio, z.tam, ic.inicial, ic.tramos, ic.copias);
        } else {
          HallarAlineado(z.inicio, z.tam, z.guest, ic.inicial, ic.tramos, ic.copias);
        }
      }
      if (!ic.copias.empty()) {
        ic.puesto = ic.inicial;
        nuevas += ic.copias.size();
      }
    }
    if (nuevas) {
      break;  // the aligned search worked: the slow one is not needed
    }
  }
  return nuevas;
}

void Hilo(rex::memory::Memory* memory) {
  const auto inicio = std::chrono::steady_clock::now();
  auto proxima_busqueda = inicio;
  auto proxima_transitorias = inicio;
  std::string faltaban;  // what the log last said was missing
  bool teclado_mostrado = false;
  bool primera = true;
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
            ic.tramos = CalcularTramos(ic);
          }
        }
        REXLOG_INFO("[iconos] estilo del mando: {}", pedido);
      } else {
        REXLOG_WARN("[iconos] sin mods/icones/{}/ICONOS.BIN: el estilo cambia en el proximo lanzamiento", pedido);
      }
    }

    // Copies whose memory no longer holds what was put there (a texture pack unloaded, its memory reused): forgotten,
    // and searched for again as the game loads them.
    for (Icono& ic : g_iconos) {
      for (uint8_t* p : ic.copias) {
        if (!Igual(p, ic.puesto, ic.tramos)) {
          ic.copias.clear();
          ic.puesto = ic.inicial;
          break;
        }
      }
    }

    const bool teclado =
        g_forzar_teclado.load() || rex::input::UltimoDispositivo() == rex::input::Dispositivo::kTeclado;

    // The controls screen's pictures: every 3 s while one is missing and should look different from the game's.
    const auto ahora = std::chrono::steady_clock::now();
    bool buscar_transitorias = false;
    for (const Icono& ic : g_iconos) {
      buscar_transitorias = buscar_transitorias ||
                            (ic.transitoria && ic.copias.empty() && (teclado ? ic.teclado : ic.mando) != ic.inicial);
    }
    if (buscar_transitorias && ahora >= proxima_transitorias) {
      if (BuscarFaltan(memory, true)) {
        REXLOG_INFO("[iconos] imagen de la pantalla de controles encontrada");
      }
      proxima_transitorias = std::chrono::steady_clock::now() + std::chrono::seconds(3);
    }

    // The icons not found yet: every 5 s for two minutes, then every 30 s.
    std::string faltan;
    for (const Icono& ic : g_iconos) {
      if (ic.copias.empty() && !ic.transitoria) {
        faltan += (faltan.empty() ? "" : ", ") + ic.nombre;
      }
    }
    if (!faltan.empty() && ahora >= proxima_busqueda) {
      if (primera) {
        REXLOG_INFO("[iconos] buscando los iconos en memoria...");
        primera = false;
      }
      const size_t nuevas = BuscarFaltan(memory, false);
      const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - ahora).count();
      proxima_busqueda = std::chrono::steady_clock::now() +
                         (ahora - inicio < std::chrono::minutes(2) ? std::chrono::seconds(5) : std::chrono::seconds(30));
      std::string siguen;
      for (const Icono& ic : g_iconos) {
        if (ic.copias.empty() && !ic.transitoria) {
          siguen += (siguen.empty() ? "" : ", ") + ic.nombre;
        }
      }
      if (nuevas || siguen != faltaban) {
        REXLOG_INFO("[iconos] {} copias nuevas en memoria ({} ms); sin encontrar todavia: {}", nuevas, ms,
                    siguen.empty() ? "ninguno" : siguen);
        faltaban = siguen;
      }
    }

    bool escrito = false;
    for (Icono& ic : g_iconos) {
      if (ic.copias.empty()) {
        continue;
      }
      const Bytes& quiero = teclado ? ic.teclado : ic.mando;
      if (quiero != ic.puesto) {
        for (uint8_t* p : ic.copias) {
          Poner(p, quiero, ic.tramos);
        }
        ic.puesto = quiero;
        escrito = true;
      }
    }
    if (escrito) {
      nfsmw::nativo::ForzarComprobacionTexturas();  // the sample fingerprint may not read the bytes changed
    }
    if (teclado != teclado_mostrado) {
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
  // data/iconos-juego.bin (mods.py icons, at each start): the icons exactly as the game loads them this time. The
  // style's own ICONOS.BIN can differ by a few bytes (the page draws its sets with the browser's Pillow) and then
  // would never be found in memory (19/11: 0 copies).
  const fs::path juego = raiz.parent_path() / "data" / "iconos-juego.bin";
  const bool hay_juego = LeerIconos(juego, mando);
  if (!hay_juego) {
    mando.clear();
  }
  // What iconos-juego.bin lacks: the controller pictures when game_root has no DYNTEX.BIN, so the game loads the
  // disc's, the Xbox 360 ones (mods/icones/xbox360/ICONOS.BIN); without iconos-juego.bin at all, everything from the
  // style's ICONOS.BIN.
  Juego del_estilo;
  LeerIconos(g_carpeta / (hay_juego ? std::string("xbox360") : estilo) / "ICONOS.BIN", del_estilo);
  for (auto& [nombre, bytes] : del_estilo) {
    bool esta = false;
    for (const auto& [n, b] : mando) {
      esta = esta || n == nombre;
    }
    if (!esta) {
      mando.emplace_back(nombre, std::move(bytes));
    }
  }
  if (mando.empty() || !LeerIconos(g_carpeta / "clavier" / "ICONOS.BIN", teclado)) {
    REXLOG_INFO("[iconos] sin mods/icones/{}/ICONOS.BIN o mods/icones/clavier/ICONOS.BIN: los iconos no siguen al "
                "teclado (rehaga los iconos desde la pagina de instalacion)", estilo);
    return;
  }
  for (const auto& [nombre, bytes] : mando) {
    if (const Bytes* t = Buscar(teclado, nombre, bytes.size())) {
      g_iconos.push_back({nombre, bytes, *t, bytes, bytes, {}, {}, nombre.rfind("DYNTEX_", 0) == 0});
      g_iconos.back().tramos = CalcularTramos(g_iconos.back());
    }
  }
  if (g_iconos.empty()) {
    return;
  }
  const char* clavier = std::getenv("NFSMW_CLAVIER");
  g_forzar_teclado.store(clavier && *clavier == '1');
  rex::ui::RegistrarCambioEstiloIconos([](const std::string& nuevo) {
    if (nuevo == "clavier") {
      g_forzar_teclado.store(true);
      return;
    }
    g_forzar_teclado.store(false);
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
