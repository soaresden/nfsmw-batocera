/**
 * @file        dispositivo.cpp
 * @brief       nfsmw: the device used last (rex/input/dispositivo.h)
 *
 * @license     BSD 3-Clause License
 *              See LICENSE file in the project root for full license text.
 */
#include <rex/input/dispositivo.h>

#include <atomic>

namespace rex::input {

namespace {
std::atomic<uint32_t> g_ultimo{uint32_t(Dispositivo::kNinguno)};
}  // namespace

void MarcarDispositivo(Dispositivo dispositivo) {
  g_ultimo.store(uint32_t(dispositivo), std::memory_order_relaxed);
}

Dispositivo UltimoDispositivo() {
  return Dispositivo(g_ultimo.load(std::memory_order_relaxed));
}

}  // namespace rex::input
