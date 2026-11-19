// nfsmw - "Mods" in the game's main menu, in place of its Xbox Live entry (online play does not exist in the port).
//
// The main menu (MainMenu_Sub.fng) is an icon carousel filled by sub_82237900: Career, Challenge Series, Quick
// Race, My Cars, Xbox Live, Profile Manager (only with a profile), Options. Each entry is a 76-byte object made in
// place: vtable at +0, icon texture hash at +12, label text hash at +44. Xbox Live's vtable is 0x8207A268, label
// 0x8AC4F1AA ("Xbox Live"), icon 0x771849A5; its React, sub_82237080(r3 = entry, r5 = message, r7 = ...), on the
// accept message 0x0C407210 asks the main menu to go to the online screens (flag 8 at +300 of the FE object at
// 0x82A2C684).
//
// Three hooks, all off with nfsmw_menu_mods = false:
//  - sub_822BCE60 is the game's text lookup (r3 = text hash -> r3 = guest char*, a binary search over the loaded
//    language's (hash, string) pairs at 0x82A2C674, count at 0x82A2C66C). For 0x8AC4F1AA it returns "Mods",
//    written once in the system heap (PrepararMenuMods, from OnPostLoadXexImage). The online screens, the only
//    other users of that text, cannot be reached any more.
//  - sub_822E00C0, the carousel's add-entry (r3 = carousel, r4 = entry, which it reads the icon hash from): for the
//    entry labelled 0x8AC4F1AA the icon becomes 0xB8C8C0D4, the frontend's PERFORMANCE_ICON_PACKAG (a box with an
//    arrow up, from the performance packages screen) instead of MAIN_ICON_GO_ONLINE. The label, not the vtable,
//    tells the entry: a text hash is the same in every edition.
//  - sub_82237080: on accept the port's Mods screen opens (sdk/src/ui/overlay/mods_page.cpp, AbrirPantallaMods)
//    and the game's own action is skipped; any other message goes to the game.
// The addresses are the PAL Spanish edition's; tools/editions translates them for the others.
#include <cstdint>
#include <cstring>

#include <rex/cvar.h>
#include <rex/hook.h>
#include <rex/logging.h>
#include <rex/memory/utils.h>
#include <rex/platform.h>
#include <rex/system/xmemory.h>
#include <rex/ui/overlay/settings_overlay.h>

REXCVAR_DEFINE_BOOL(nfsmw_menu_mods, true, "NFSMW",
                    "Menu principal: la entrada Xbox Live (el juego en linea no existe en el port) se convierte en "
                    "Mods y abre la lista de mods para activarlos o desactivarlos")
    .lifecycle(rex::cvar::Lifecycle::kInitOnly);

namespace nfsmw {
namespace {
constexpr uint32_t kTextoXboxLive = 0x8AC4F1AA;
constexpr uint32_t kMensajeAceptar = 0x0C407210;
constexpr uint32_t kIconoMods = 0xB8C8C0D4;  // PERFORMANCE_ICON_PACKAG in FRONTB.LZC
uint32_t g_texto_mods = 0;  // guest address of "Mods", 0 while off
}  // namespace

void PrepararMenuMods(rex::memory::Memory* memory) {
#if !REX_PLATFORM_SWITCH && !REX_PLATFORM_ANDROID
  if (!REXCVAR_GET(nfsmw_menu_mods) || !memory || g_texto_mods) return;
  const uint32_t dir = memory->SystemHeapAlloc(16);
  if (!dir) {
    REXLOG_WARN("[mods] menu principal: sin memoria para el texto; la entrada Xbox Live se queda como estaba");
    return;
  }
  static const char kTexto[] = "Mods";
  std::memcpy(memory->TranslateVirtual(dir), kTexto, sizeof(kTexto));
  g_texto_mods = dir;
  REXLOG_INFO("[mods] menu principal: Xbox Live -> Mods (texto en 0x{:08X})", dir);
#else
  (void)memory;
#endif
}

}  // namespace nfsmw

// Text lookup: r3 = hash -> r3 = string or 0.
REX_EXTERN(__imp__sub_822BCE60);
REX_HOOK_RAW(sub_822BCE60) {
  if (nfsmw::g_texto_mods && ctx.r3.u32 == nfsmw::kTextoXboxLive) {
    ctx.r3.u64 = nfsmw::g_texto_mods;
    return;
  }
  __imp__sub_822BCE60(ctx, base);
}

// The carousel's add-entry: r4 = the entry (+12 icon hash, +44 label hash).
REX_EXTERN(__imp__sub_822E00C0);
REX_HOOK_RAW(sub_822E00C0) {
  const uint32_t entrada = ctx.r4.u32;
  if (nfsmw::g_texto_mods && entrada >= 0x10000u &&
      rex::memory::load_and_swap<uint32_t>(base + entrada + 44) == nfsmw::kTextoXboxLive) {
    rex::memory::store_and_swap<uint32_t>(base + entrada + 12, nfsmw::kIconoMods);
  }
  __imp__sub_822E00C0(ctx, base);
}

// React of the main menu's Xbox Live entry.
REX_EXTERN(__imp__sub_82237080);
REX_HOOK_RAW(sub_82237080) {
  if (nfsmw::g_texto_mods && ctx.r5.u32 == nfsmw::kMensajeAceptar) {
    REXLOG_INFO("[mods] menu principal: entrada Mods elegida");
    rex::ui::AbrirPantallaMods();
    return;
  }
  __imp__sub_82237080(ctx, base);
}
