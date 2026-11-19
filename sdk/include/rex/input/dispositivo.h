/**
 * @file        rex/input/dispositivo.h
 * @brief       nfsmw: which device the player used last, the keyboard or a controller
 *
 * @license     BSD 3-Clause License
 *              See LICENSE file in the project root for full license text.
 *
 * The input drivers note every key press (mnk) and every controller button or stick push past half way (SDL,
 * XInput); the app reads it to show the button icons of the device in use (app/src/nfsmw_iconos_teclado.cpp), as
 * modern games do. Lock free, any thread.
 */
#pragma once

#include <cstdint>

namespace rex::input {

enum class Dispositivo : uint32_t { kNinguno = 0, kMando = 1, kTeclado = 2 };

void MarcarDispositivo(Dispositivo dispositivo);
Dispositivo UltimoDispositivo();

}  // namespace rex::input
