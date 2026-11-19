/**
 * @file        rex/ui/overlay/settings_overlay.h
 *
 * @brief       ImGui settings overlay dialog for cvar editing with save-to-config.
 *
 * @copyright   Copyright (c) 2026 Tom Clay <tomc@tctechstuff.com>
 *              All rights reserved.
 *
 * @license     BSD 3-Clause License
 *              See LICENSE file in the project root for full license text.
 */
#pragma once
#include <filesystem>
#include <functional>
#include <string>
#include <vector>
#include <rex/ui/imgui_dialog.h>

namespace rex::ui {

// nfsmw: the app removes from the settings menu the cvars that do nothing in its configuration (for
// example, the emulated path's ones when its own renderer draws). They are only hidden: the command
// line and the configuration file still read them. Can be called at any time; calls accumulate.
void OcultarAjustesEnMenu(const std::vector<std::string>& nombres);

// nfsmw: a page of the settings menu drawn by its own code (the Mods tab): listed with the categories
// under `nombre`, and drawn instead of the cvars when chosen. `dibujar` runs on the UI thread, inside the
// menu window.
void RegistrarPaginaMenu(const std::string& nombre, std::function<void()> dibujar);

class WindowedAppContext;

// nfsmw: the Mods tab (mods_page.cpp): the mods in mods/ next to game_data_root, with a switch each,
// written to mods/desactives.txt for the launcher's mods.py; applied at the next start. The drawer and
// the UI thread's context are for the Mods screen below.
void RegistrarPaginaMods(ImGuiDrawer* dibujante, WindowedAppContext* contexto);

// nfsmw: the same list as a full screen in the style of the game's menus, opened from the game's main menu
// (app/src/nfsmw_menu_mods.cpp). Can be called from any thread; does nothing if it is already open.
void AbrirPantallaMods();

// True while the Mods screen is open (or about to be): the game does not get the controller meanwhile.
bool PantallaModsAbierta();

class SettingsDialog : public ImGuiDialog {
 public:
  // config_path: where "Save to config" writes (e.g. exe_dir / "app.toml")
  SettingsDialog(ImGuiDrawer* imgui_drawer, std::filesystem::path config_path);
  ~SettingsDialog();

 protected:
  void OnDraw(ImGuiIO& io) override;

 private:
  std::filesystem::path config_path_;
  char search_buf_[128] = {};
  std::string selected_category_;
  std::string capturing_bind_name_;
};

}  // namespace rex::ui
