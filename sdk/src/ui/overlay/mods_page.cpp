/**
 * @file        mods_page.cpp
 * @brief       nfsmw: the Mods tab of the settings menu (L + R + Right, or F4)
 *
 * @license     BSD 3-Clause License
 *              See LICENSE file in the project root for full license text.
 *
 * The launcher (run.sh on Batocera, NFS Most Wanted.bat on Windows) applies at every start the mods in
 * NFS Most Wanted.sh/mods/ with mods.py, before the game reads its files. This page lists them with a
 * switch each: a mod switched off stays in mods/ but is written to mods/desactives.txt (one name per
 * line), which mods.py skips. The game has already loaded its files, so a change counts from the next
 * start; with a launcher that starts the game again (NFSMW_RELANCE, exit code 3) the page offers to do it
 * at once. Not on the Switch or Android: they have no mods.py.
 */

#include <rex/ui/overlay/settings_overlay.h>

#include <rex/cvar.h>
#include <rex/logging.h>
#include <rex/platform.h>
#include <imgui.h>

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <set>
#include <string>
#include <system_error>
#include <vector>

namespace rex::ui {

namespace {

namespace fs = std::filesystem;

constexpr char kArchivo[] = "desactives.txt";

#if defined(__cpp_char8_t)
fs::path DesdeUtf8(const std::string& s) {
  return fs::path(std::u8string(reinterpret_cast<const char8_t*>(s.data()), s.size()));
}

std::string AUtf8(const fs::path& p) {
  const std::u8string u = p.u8string();
  return std::string(reinterpret_cast<const char*>(u.data()), u.size());
}
#else
fs::path DesdeUtf8(const std::string& s) {
  return fs::u8path(s);
}

std::string AUtf8(const fs::path& p) {
  return p.u8string();
}
#endif

std::string Minusculas(std::string s) {
  for (char& c : s) {
    c = char(std::tolower(static_cast<unsigned char>(c)));
  }
  return s;
}

bool EsZip(const std::string& nombre) {
  const std::string b = Minusculas(nombre);
  return b.size() > 4 && b.compare(b.size() - 4, 4, ".zip") == 0;
}

// mods.py's is_black: black-edition, blackedition, Black Edition.zip...
bool EsBlackEdition(const std::string& nombre) {
  std::string base = nombre;
  if (EsZip(base)) {
    base.resize(base.size() - 4);
  }
  std::string letras;
  for (char c : base) {
    if (std::isalnum(static_cast<unsigned char>(c))) {
      letras += char(std::tolower(static_cast<unsigned char>(c)));
    }
  }
  return letras == "blackedition";
}

// NFS Most Wanted.sh/mods, next to game_root (game_data_root).
fs::path CarpetaMods() {
  fs::path raiz = DesdeUtf8(rex::cvar::GetFlagByName("game_data_root")).lexically_normal();
  if (!raiz.has_filename()) {
    raiz = raiz.parent_path();
  }
  return raiz.parent_path() / "mods";
}

struct Estado {
  bool leido = false;
  fs::path carpeta;
  std::vector<std::string> mods;     // as named in mods/
  std::set<std::string> apagados;    // lowercase, from desactives.txt
  std::set<std::string> al_empezar;  // what this start applied with
  std::chrono::steady_clock::time_point ultima_lectura;
  std::string error;
};

Estado& Datos() {
  static Estado e;
  return e;
}

std::set<std::string> LeerApagados(const fs::path& carpeta) {
  std::set<std::string> out;
  std::ifstream f(carpeta / kArchivo);
  std::string linea;
  while (std::getline(f, linea)) {
    while (!linea.empty() && (linea.back() == '\r' || linea.back() == ' ' || linea.back() == '\t')) {
      linea.pop_back();
    }
    size_t i = linea.find_first_not_of(" \t");
    if (i == std::string::npos || linea[i] == '#') {
      continue;
    }
    out.insert(Minusculas(linea.substr(i)));
  }
  return out;
}

void Leer(Estado& e) {
  e.carpeta = CarpetaMods();
  e.mods.clear();
  std::error_code ec;
  for (fs::directory_iterator it(e.carpeta, ec), fin; !ec && it != fin; it.increment(ec)) {
    const std::string nombre = AUtf8(it->path().filename());
    const std::string bajo = Minusculas(nombre);
    if (bajo == "icones" || bajo == "boutons-playstation") {
      continue;  // the button icons: their own option
    }
    std::error_code ec2;
    if (it->is_directory(ec2) || EsZip(bajo)) {
      e.mods.push_back(nombre);
    }
  }
  std::sort(e.mods.begin(), e.mods.end(),
            [](const std::string& a, const std::string& b) { return Minusculas(a) < Minusculas(b); });
  e.apagados = LeerApagados(e.carpeta);
  if (!e.leido) {
    e.al_empezar = e.apagados;
    e.leido = true;
  }
  e.ultima_lectura = std::chrono::steady_clock::now();
}

bool Escribir(Estado& e) {
  const fs::path archivo = e.carpeta / kArchivo;
  std::error_code ec;
  if (e.apagados.empty()) {
    fs::remove(archivo, ec);
    return !ec;
  }
  std::ofstream f(archivo, std::ios::binary | std::ios::trunc);
  if (!f) {
    return false;
  }
  f << "# Mods desactives dans le menu du jeu (onglet Mods), un par ligne. mods.py ne les applique pas.\n";
  for (const std::string& nombre : e.mods) {
    if (e.apagados.count(Minusculas(nombre))) {
      f << nombre << "\n";
    }
  }
  // Names no longer in mods/ are kept: the folder may come back (a sync, a copy in progress).
  for (const std::string& bajo : e.apagados) {
    bool listado = false;
    for (const std::string& nombre : e.mods) {
      listado = listado || Minusculas(nombre) == bajo;
    }
    if (!listado) {
      f << bajo << "\n";
    }
  }
  return bool(f);
}

[[noreturn]] void Relanzar() {
  REXLOG_INFO("[mods] menu: relance demandee (code 3), mods desactives: {}",
              Datos().apagados.empty() ? std::string("aucun") : [] {
                std::string s;
                for (const std::string& n : Datos().apagados) {
                  s += (s.empty() ? "" : ", ") + n;
                }
                return s;
              }());
  rex::FlushLogging();
  std::fflush(nullptr);
  std::_Exit(3);
}

void Dibujar() {
  Estado& e = Datos();
  if (!e.leido || std::chrono::steady_clock::now() - e.ultima_lectura > std::chrono::seconds(2)) {
    Leer(e);
  }

  ImGui::TextWrapped("Mods du dossier : %s", AUtf8(e.carpeta).c_str());
  ImGui::Separator();
  if (e.mods.empty()) {
    ImGui::TextWrapped(
        "Aucun mod : mettez un dossier (ou un .zip) par mod dans ce dossier, range comme game_root "
        "(CARS/..., GLOBAL/...).");
  }
  for (const std::string& nombre : e.mods) {
    const std::string bajo = Minusculas(nombre);
    bool activo = e.apagados.count(bajo) == 0;
    ImGui::PushID(nombre.c_str());
    std::string etiqueta = nombre;
    if (EsBlackEdition(nombre)) {
      etiqueta += "  (avec l'option Black Edition)";
    }
    if (ImGui::Checkbox(etiqueta.c_str(), &activo)) {
      if (activo) {
        e.apagados.erase(bajo);
      } else {
        e.apagados.insert(bajo);
      }
      e.error = Escribir(e) ? std::string() : "Impossible d'ecrire " + AUtf8(e.carpeta / kArchivo);
      REXLOG_INFO("[mods] menu: {} {}", nombre, activo ? "active" : "desactive");
    }
    if (e.al_empezar.count(bajo) != e.apagados.count(bajo)) {
      ImGui::SameLine();
      ImGui::TextDisabled(activo ? "(au prochain lancement)" : "(retire au prochain lancement)");
    }
    ImGui::PopID();
  }
  if (!e.error.empty()) {
    ImGui::TextColored(ImVec4(1.0f, 0.4f, 0.3f, 1.0f), "%s", e.error.c_str());
  }

  ImGui::Spacing();
  ImGui::Separator();
  ImGui::TextWrapped(
      "Les mods sont appliques au lancement du jeu : un changement compte au prochain lancement.");
  if (e.al_empezar != e.apagados) {
    const char* relance = std::getenv("NFSMW_RELANCE");
    if (relance && *relance == '1') {
      if (ImGui::Button("Relancer le jeu maintenant")) {
        ImGui::OpenPopup("##relancer");
      }
      ImGui::SameLine();
      ImGui::TextDisabled("(la partie en cours non sauvegardee est perdue)");
      if (ImGui::BeginPopup("##relancer")) {
        ImGui::TextUnformatted("Relancer le jeu avec ces mods ?");
        if (ImGui::Button("Oui, relancer")) {
          Relanzar();
        }
        ImGui::SameLine();
        if (ImGui::Button("Non")) {
          ImGui::CloseCurrentPopup();
        }
        ImGui::EndPopup();
      }
    } else {
      ImGui::TextWrapped("Quittez et relancez le jeu pour les appliquer.");
    }
  }
}

}  // namespace

void RegistrarPaginaMods() {
#if !REX_PLATFORM_SWITCH && !REX_PLATFORM_ANDROID
  Leer(Datos());  // what this start was given, to tell what a change will do
  RegistrarPaginaMenu("Mods", Dibujar);
#endif
}

}  // namespace rex::ui
