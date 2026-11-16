// Black Edition: the extra content of the Black Edition (BMW M3 GTR road version, Camaro SS, eight tuned bonus
// cars, Challenge Series event 70 and three extra races), which is on every disc but locked outside that edition.
//
// One 32-bit value in .data turns it on: 0x00000100 at 0x82A2CE04 (zero on the disc). This is tuhana's patch from
// xenia-canary/game-patches ("454107D9 - Need for Speed Most Wanted (2005).patch.toml", "Black Edition content"),
// also used by Epix Digital Studio's modified executables (Pixelplix93/NFS-Most-Wanted-Black-Edition-Xbox-360).
// .data does not move between the PAL and USA editions, so the address is the same there (the edition trees go
// through tools/editions anyway). Written once after the XEX is mapped, as Xenia does, before the game starts.
#include <cstdint>

#include <rex/cvar.h>
#include <rex/logging.h>
#include <rex/memory/utils.h>
#include <rex/system/xmemory.h>

REXCVAR_DEFINE_BOOL(nfsmw_black_edition, false, "NFSMW",
                    "Black Edition: coches extra (M3 GTR de calle, Camaro SS, 8 coches tuneados), evento 70 del "
                    "Challenge Series y tres carreras mas (parche de tuhana)")

namespace nfsmw {

void AplicarBlackEdition(rex::memory::Memory* memory) {
  if (!REXCVAR_GET(nfsmw_black_edition) || !memory) return;
  constexpr uint32_t kDireccion = 0x82A2CE04;
  constexpr uint32_t kValor = 0x00000100;
  auto* p = memory->TranslateVirtual(kDireccion);
  const uint32_t antes = rex::memory::load_and_swap<uint32_t>(p);
  rex::memory::store_and_swap<uint32_t>(p, kValor);
  REXLOG_INFO("Black Edition: 0x{:08X} = 0x{:08X} (antes 0x{:08X})", kDireccion, kValor, antes);
}

}  // namespace nfsmw
