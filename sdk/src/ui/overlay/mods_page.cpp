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
 *
 * The same list is also a screen in the style of the game's own menus (PantallaMods), opened from the game's
 * main menu: the app puts "Mods" in place of its Xbox Live entry (app/src/nfsmw_menu_mods.cpp) and calls
 * AbrirPantallaMods when it is chosen.
 */

#include <rex/ui/overlay/settings_overlay.h>

#include <rex/cvar.h>
#include <rex/input/dispositivo.h>
#include <rex/logging.h>
#include <rex/platform.h>
#include <rex/ui/imgui_dialog.h>
#include <rex/ui/imgui_drawer.h>
#include <rex/ui/windowed_app_context.h>
#include <imgui.h>

#include <atomic>

#include <algorithm>
#include <cctype>
#include <cfloat>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <functional>
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

// ---------------------------------------------------------------------------------------------------------
// The Mods screen of the game's main menu, drawn over it like one of its own screens: dark background, title,
// a row per mod with ACTIVÉ / DÉSACTIVÉ, the selected row framed in the game's orange. Driven with the
// controller (or the keyboard on a PC): up and down choose, the accept button switches, the back button
// leaves. While it is open the game gets no input (rex_app.cpp, PantallaModsAbierta).

ImGuiDrawer* g_dibujante = nullptr;
WindowedAppContext* g_contexto = nullptr;
std::atomic<bool> g_abierta{false};

const ImU32 kNaranja = IM_COL32(236, 153, 27, 255);
const ImU32 kBlanco = IM_COL32(240, 240, 240, 255);
const ImU32 kGris = IM_COL32(150, 150, 150, 255);
const ImU32 kGrisOscuro = IM_COL32(95, 95, 95, 255);

std::string Mayusculas(const std::string& s) {
  std::string out = s;
  for (char& c : out) {
    c = char(std::toupper(static_cast<unsigned char>(c)));
  }
  return out;
}

// The controller's icon style (mods/icones/<style>/): the one the launcher applied (NFSMW_ICONOS), or the one chosen
// in this screen, kept in mods/icones/choix.txt (the launchers read it first, before the Batocera option).
std::function<void(const std::string&)> g_cambio_estilo;  // the game's icons, live (app/src/nfsmw_iconos_teclado.cpp)
std::mutex g_mutex_estilo;

std::vector<std::string> Estilos(const fs::path& iconos) {
  std::vector<std::string> out;
  static const char* const kOrden[] = {"playstation", "xbox360", "gamecube"};
  for (const char* e : kOrden) {
    std::error_code ec;
    if (fs::is_directory(iconos / e, ec)) {
      out.push_back(e);
    }
  }
  return out;
}

std::string NombreEstilo(const std::string& e) {
  if (e == "playstation") return "PLAYSTATION";
  if (e == "xbox360") return "XBOX 360";
  if (e == "gamecube") return "GAMECUBE";
  return Mayusculas(e);
}

class PantallaMods final : public ImGuiDialog {
 public:
  explicit PantallaMods(ImGuiDrawer* dibujante) : ImGuiDialog(dibujante) {
    g_abierta.store(true);
    Leer(Datos());
    LeerEstilos();
    REXLOG_INFO("[mods] pantalla Mods abierta ({} mods)", Datos().mods.size());
  }
  ~PantallaMods() override {
    g_abierta.store(false);
    REXLOG_INFO("[mods] pantalla Mods cerrada");
  }

 protected:
  void OnDraw(ImGuiIO& io) override {
    Estado& e = Datos();
    if (std::chrono::steady_clock::now() - e.ultima_lectura > std::chrono::seconds(2)) {
      Leer(e);
    }
    const bool relanzar = PuedeRelanzar() && (e.al_empezar != e.apagados || estilo_cambiado_);
    const int filas = Primera() + int(e.mods.size()) + (relanzar ? 1 : 0);
    if (seleccion_ >= filas) {
      seleccion_ = filas > 0 ? filas - 1 : 0;
    }

    Entrada(io, e, filas, relanzar);

    const ImVec2 tam = io.DisplaySize;
    ImGui::SetNextWindowPos(ImVec2(0, 0));
    ImGui::SetNextWindowSize(tam);
    ImGui::SetNextWindowFocus();
    ImGui::SetNextWindowBgAlpha(0.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_WindowBorderSize, 0.0f);
    ImGui::Begin("##pantalla_mods", nullptr,
                 ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoSavedSettings |
                     ImGuiWindowFlags_NoScrollWithMouse);
    ImGui::PopStyleVar();
    Dibujar(e, tam, relanzar);
    ImGui::End();

    if (cerrando_ && !Pulsado(io, kVolver) && !Pulsado(io, kAceptar)) {
      Close();  // once the back button is released: the game must not see it pressed
    }
  }

 private:
  enum Accion { kAceptar, kVolver };

  static bool PuedeRelanzar() {
    const char* r = std::getenv("NFSMW_RELANCE");
    return r && *r == '1';
  }

  // The accept and back buttons by position, as ImGui's navigation reads them (imgui_drawer.cpp sets the swap
  // from input_sdl_por_letra), and their keys on a keyboard.
  static ImGuiKey Boton(const ImGuiIO& io, Accion a) {
    const bool cambiados = io.ConfigNavSwapGamepadButtons;
    if (a == kAceptar) {
      return cambiados ? ImGuiKey_GamepadFaceRight : ImGuiKey_GamepadFaceDown;
    }
    return cambiados ? ImGuiKey_GamepadFaceDown : ImGuiKey_GamepadFaceRight;
  }
  static bool Pulsado(const ImGuiIO& io, Accion a) {
    if (ImGui::IsKeyDown(Boton(io, a))) {
      return true;
    }
    return a == kAceptar ? (ImGui::IsKeyDown(ImGuiKey_Enter) || ImGui::IsKeyDown(ImGuiKey_Space))
                         : (ImGui::IsKeyDown(ImGuiKey_Escape) || ImGui::IsKeyDown(ImGuiKey_Backspace));
  }
  static bool Recien(const ImGuiIO& io, Accion a) {
    if (ImGui::IsKeyPressed(Boton(io, a), false)) {
      return true;
    }
    return a == kAceptar
               ? (ImGui::IsKeyPressed(ImGuiKey_Enter, false) || ImGui::IsKeyPressed(ImGuiKey_Space, false))
               : (ImGui::IsKeyPressed(ImGuiKey_Escape, false) || ImGui::IsKeyPressed(ImGuiKey_Backspace, false));
  }
  static bool Direccion(ImGuiKey cruceta, ImGuiKey stick, ImGuiKey tecla) {
    return ImGui::IsKeyPressed(cruceta, true) || ImGui::IsKeyPressed(stick, true) || ImGui::IsKeyPressed(tecla, true);
  }

  // Row 0 is the icon style when mods/icones/ has styles; the mods come after it.
  int Primera() const { return estilos_.empty() ? 0 : 1; }

  void LeerEstilos() {
    const fs::path iconos = Datos().carpeta / "icones";
    estilos_ = Estilos(iconos);
    std::string actual;
    std::ifstream f(iconos / "choix.txt");
    std::getline(f, actual);
    while (!actual.empty() && (actual.back() == '\r' || actual.back() == ' ')) {
      actual.pop_back();
    }
    if (actual.empty()) {
      const char* v = std::getenv("NFSMW_ICONOS");
      actual = v ? v : "";
    }
    estilo_ = 0;
    for (size_t i = 0; i < estilos_.size(); ++i) {
      if (estilos_[i] == actual) {
        estilo_ = int(i);
      }
    }
  }

  void CambiarEstilo(int paso) {
    if (estilos_.empty()) {
      return;
    }
    estilo_ = (estilo_ + int(estilos_.size()) + paso) % int(estilos_.size());
    const std::string& nuevo = estilos_[estilo_];
    const fs::path archivo = Datos().carpeta / "icones" / "choix.txt";
    std::ofstream f(archivo, std::ios::binary | std::ios::trunc);
    f << nuevo << "\n";
    Datos().error = f ? std::string() : "Impossible d'écrire " + AUtf8(archivo);
    estilo_cambiado_ = true;
    {
      std::lock_guard<std::mutex> cerrojo(g_mutex_estilo);
      if (g_cambio_estilo) {
        g_cambio_estilo(nuevo);  // the game's icons change at once
      }
    }
    // The face buttons as the launcher sets them for each style (run.sh), unless the player chose them in Batocera.
    const char* auto_botones = std::getenv("NFSMW_BOUTONS_AUTO");
    if (auto_botones && *auto_botones == '1') {
      rex::cvar::SetFlagByName("input_sdl_por_letra", nuevo == "playstation" ? "false" : "true");
    }
    setenv_estilo(nuevo);
    REXLOG_INFO("[mods] pantalla: iconos {}", nuevo);
  }

  // The hints of this screen follow the style chosen.
  static void setenv_estilo(const std::string& e) {
#if defined(_WIN32)
    _putenv_s("NFSMW_ICONOS", e.c_str());
#else
    setenv("NFSMW_ICONOS", e.c_str(), 1);
#endif
  }

  void Entrada(ImGuiIO& io, Estado& e, int filas, bool relanzar) {
    // The button that opened the screen (or chose in it) acts once released and pressed again.
    if (!armada_) {
      armada_ = !Pulsado(io, kAceptar) && !Pulsado(io, kVolver);
      return;
    }
    if (cerrando_) {
      return;
    }
    const bool arriba = Direccion(ImGuiKey_GamepadDpadUp, ImGuiKey_GamepadLStickUp, ImGuiKey_UpArrow);
    const bool abajo = Direccion(ImGuiKey_GamepadDpadDown, ImGuiKey_GamepadLStickDown, ImGuiKey_DownArrow);
    const bool izquierda = Direccion(ImGuiKey_GamepadDpadLeft, ImGuiKey_GamepadLStickLeft, ImGuiKey_LeftArrow);
    const bool derecha = Direccion(ImGuiKey_GamepadDpadRight, ImGuiKey_GamepadLStickRight, ImGuiKey_RightArrow);
    const bool aceptar = Recien(io, kAceptar);
    const bool volver = Recien(io, kVolver);

    if (confirmar_) {
      if (izquierda || derecha) {
        si_ = !si_;
      }
      if (volver) {
        confirmar_ = false;
      } else if (aceptar) {
        if (si_) {
          Relanzar();
        }
        confirmar_ = false;
      }
      return;
    }
    if (volver) {
      cerrando_ = true;
      return;
    }
    if (filas == 0) {
      return;
    }
    if (arriba) {
      seleccion_ = (seleccion_ + filas - 1) % filas;
    }
    if (abajo) {
      seleccion_ = (seleccion_ + 1) % filas;
    }
    const int o = Primera();
    if (o && seleccion_ == 0) {
      if (aceptar || derecha) {
        CambiarEstilo(1);
      } else if (izquierda) {
        CambiarEstilo(-1);
      }
      return;
    }
    const int m = seleccion_ - o;  // the mod's index
    if (aceptar || ((izquierda || derecha) && m < int(e.mods.size()))) {
      if (m < int(e.mods.size())) {
        const std::string& nombre = e.mods[m];
        const std::string bajo = Minusculas(nombre);
        const bool activar = e.apagados.count(bajo) != 0;
        if (activar) {
          e.apagados.erase(bajo);
        } else {
          e.apagados.insert(bajo);
        }
        e.error = Escribir(e) ? std::string() : "Impossible d'écrire " + AUtf8(e.carpeta / kArchivo);
        REXLOG_INFO("[mods] pantalla: {} {}", nombre, activar ? "active" : "desactive");
      } else if (relanzar && aceptar) {
        confirmar_ = true;
        si_ = true;
      }
    }
  }

  static void Texto(ImDrawList* dl, ImFont* f, float tam, ImVec2 p, ImU32 color, const std::string& t) {
    dl->AddText(f, tam, p, color, t.c_str());
  }
  static float Ancho(ImFont* f, float tam, const std::string& t) {
    return f->CalcTextSizeA(tam, FLT_MAX, 0.0f, t.c_str()).x;
  }

  // The game's selection frame: orange corners.
  static void Esquinas(ImDrawList* dl, ImVec2 a, ImVec2 b, float largo, float grosor) {
    dl->AddLine(a, ImVec2(a.x + largo, a.y), kNaranja, grosor);
    dl->AddLine(a, ImVec2(a.x, a.y + largo), kNaranja, grosor);
    dl->AddLine(ImVec2(b.x, a.y), ImVec2(b.x - largo, a.y), kNaranja, grosor);
    dl->AddLine(ImVec2(b.x, a.y), ImVec2(b.x, a.y + largo), kNaranja, grosor);
    dl->AddLine(ImVec2(a.x, b.y), ImVec2(a.x + largo, b.y), kNaranja, grosor);
    dl->AddLine(ImVec2(a.x, b.y), ImVec2(a.x, b.y - largo), kNaranja, grosor);
    dl->AddLine(b, ImVec2(b.x - largo, b.y), kNaranja, grosor);
    dl->AddLine(b, ImVec2(b.x, b.y - largo), kNaranja, grosor);
  }

  // The button icon style the launcher applied (NFSMW_ICONOS: playstation, xbox360, gamecube).
  static std::string Estilo() {
    const char* v = std::getenv("NFSMW_ICONOS");
    return v ? std::string(v) : std::string();
  }

  // One hint: the PC key while the keyboard is the device used last (rex/input/dispositivo.h, as the game's own
  // icons, app/src/nfsmw_iconos_teclado.cpp), else the controller button in the chosen icon style; then what it
  // does. Returns the x after it.
  float Pista(ImDrawList* dl, ImFont* f, float t, float x, float y, bool aceptar, const std::string& que) {
    const ImU32 fondo = IM_COL32(30, 30, 32, 255);
    if (rex::input::UltimoDispositivo() == rex::input::Dispositivo::kTeclado) {
      const std::string tecla = aceptar ? "Entrée" : "Échap";
      const float w = Ancho(f, t * 0.8f, tecla) + t * 0.8f;
      dl->AddRectFilled(ImVec2(x, y - t * 0.1f), ImVec2(x + w, y + t * 1.1f), IM_COL32(225, 225, 225, 255), t * 0.18f);
      dl->AddRect(ImVec2(x, y - t * 0.1f), ImVec2(x + w, y + t * 1.1f), IM_COL32(120, 120, 120, 255), t * 0.18f, 0,
                  2.0f);
      Texto(dl, f, t * 0.8f, ImVec2(x + t * 0.4f, y + t * 0.1f), fondo, tecla);
      x += w;
    } else {
      const float r = t * 0.62f;
      const ImVec2 c(x + r, y + t * 0.5f);
      const std::string estilo = Estilo();
      // Which physical button: the bottom one accepts unless the face buttons are read by letter (A on the right).
      const bool derecha = ImGui::GetIO().ConfigNavSwapGamepadButtons ? aceptar : !aceptar;
      if (estilo == "playstation") {
        dl->AddCircleFilled(c, r, fondo, 32);
        if (derecha) {
          dl->AddCircle(c, r * 0.5f, IM_COL32(232, 72, 85, 255), 32, r * 0.17f);  // circle
        } else {
          const float q = r * 0.42f;
          const ImU32 azul = IM_COL32(124, 178, 232, 255);  // cross
          dl->AddLine(ImVec2(c.x - q, c.y - q), ImVec2(c.x + q, c.y + q), azul, r * 0.17f);
          dl->AddLine(ImVec2(c.x - q, c.y + q), ImVec2(c.x + q, c.y - q), azul, r * 0.17f);
        }
      } else {
        // Xbox 360 and GameCube icons: the letters, A green and B red.
        const bool es_a = aceptar;
        const ImU32 color = estilo == "gamecube" ? (es_a ? IM_COL32(40, 170, 120, 255) : IM_COL32(210, 50, 50, 255))
                                                 : (es_a ? IM_COL32(96, 178, 56, 255) : IM_COL32(214, 48, 48, 255));
        dl->AddCircleFilled(c, r, color, 32);
        const std::string letra = es_a ? "A" : "B";
        Texto(dl, f, t * 0.85f, ImVec2(c.x - Ancho(f, t * 0.85f, letra) * 0.5f, c.y - t * 0.5f), kBlanco, letra);
      }
      x += 2.0f * r;
    }
    Texto(dl, f, t, ImVec2(x + t * 0.4f, y), kBlanco, que);
    return x + t * 0.4f + Ancho(f, t, que) + t * 1.6f;
  }

  void Dibujar(Estado& e, ImVec2 tam, bool relanzar) {
    ImDrawList* dl = ImGui::GetWindowDrawList();
    ImFontAtlas* atlas = ImGui::GetIO().Fonts;
    ImFont* fuente = atlas->Fonts.Size > 1 ? atlas->Fonts[1] : ImGui::GetFont();
    ImFont* fuente_titulo = atlas->Fonts.Size > 2 ? atlas->Fonts[2] : fuente;
    const float W = tam.x, H = tam.y;
    const float t_titulo = H * 0.085f, t_texto = H * 0.042f, t_peque = H * 0.03f;

    // Background: the main menu stays behind, darkened, with a band on the left like the game's screens.
    dl->AddRectFilled(ImVec2(0, 0), tam, IM_COL32(0, 0, 0, 222));
    dl->AddRectFilledMultiColor(ImVec2(0, 0), ImVec2(W * 0.75f, H), IM_COL32(10, 10, 12, 200),
                                IM_COL32(10, 10, 12, 0), IM_COL32(10, 10, 12, 0), IM_COL32(10, 10, 12, 200));

    const float x0 = W * 0.08f;
    float y = H * 0.07f;
    Texto(dl, fuente_titulo, t_titulo, ImVec2(x0, y), kBlanco, "MODS");
    y += t_titulo * 1.05f;
    dl->AddRectFilled(ImVec2(x0, y), ImVec2(x0 + W * 0.12f, y + H * 0.007f), kNaranja);
    y += H * 0.025f;
    Texto(dl, fuente, t_peque, ImVec2(x0, y), kGris, "Activer ou désactiver les mods du dossier mods/");
    y += t_peque * 2.0f;

    const float ancho_fila = W * 0.62f;
    const float alto_fila = H * 0.078f;
    const float y_lista = y;
    const int visibles = std::max(1, int((H * 0.80f - y_lista) / alto_fila));
    const int o = Primera();
    const int filas = o + int(e.mods.size()) + (relanzar ? 1 : 0);
    if (seleccion_ < primera_) {
      primera_ = seleccion_;
    }
    if (seleccion_ >= primera_ + visibles) {
      primera_ = seleccion_ - visibles + 1;
    }

    if (e.mods.empty()) {
      const float ym = y_lista + float(o) * alto_fila + alto_fila * 0.2f;
      Texto(dl, fuente, t_texto, ImVec2(x0, ym), kBlanco, "Aucun mod");
      Texto(dl, fuente, t_peque, ImVec2(x0, ym + t_texto * 1.4f), kGris,
            "Mettez un dossier ou un .zip par mod dans " + AUtf8(e.carpeta));
    }
    for (int i = primera_; i < filas && i < primera_ + visibles; ++i) {
      const float fy = y_lista + float(i - primera_) * alto_fila;
      const ImVec2 a(x0, fy), b(x0 + ancho_fila, fy + alto_fila * 0.86f);
      const bool sel = i == seleccion_ && !confirmar_;
      dl->AddRectFilled(a, b, sel ? IM_COL32(236, 153, 27, 40) : IM_COL32(255, 255, 255, 14));
      if (sel) {
        Esquinas(dl, ImVec2(a.x - 4, a.y - 4), ImVec2(b.x + 4, b.y + 4), alto_fila * 0.28f, 3.0f);
      }
      const float ty = fy + (alto_fila * 0.86f - t_texto) * 0.5f;
      if (o && i == 0) {  // the icon style: < PLAYSTATION >
        Texto(dl, fuente, t_texto, ImVec2(a.x + W * 0.015f, ty), kBlanco, "ICÔNES DES BOUTONS");
        const std::string valor = NombreEstilo(estilos_[estilo_]);
        const float wv = Ancho(fuente, t_texto, valor);
        const float xv = b.x - W * 0.015f - wv;
        Texto(dl, fuente, t_texto, ImVec2(xv, ty), kNaranja, valor);
        const float r = t_texto * 0.28f, cy = ty + t_texto * 0.55f;
        const float xi = xv - W * 0.012f, xd = b.x - W * 0.004f;
        dl->AddTriangleFilled(ImVec2(xi - r, cy), ImVec2(xi, cy - r), ImVec2(xi, cy + r), sel ? kNaranja : kGris);
        dl->AddTriangleFilled(ImVec2(xd + r, cy), ImVec2(xd, cy - r), ImVec2(xd, cy + r), sel ? kNaranja : kGris);
        if (estilo_cambiado_) {
          Texto(dl, fuente, t_peque, ImVec2(b.x + W * 0.02f, ty + (t_texto - t_peque) * 0.6f), kGris,
                "image de manette au prochain lancement");
        }
        continue;
      }
      const int k = i - o;
      if (k < int(e.mods.size())) {
        const std::string& nombre = e.mods[k];
        const bool activo = e.apagados.count(Minusculas(nombre)) == 0;
        std::string etiqueta = Mayusculas(EsZip(nombre) ? nombre.substr(0, nombre.size() - 4) : nombre);
        Texto(dl, fuente, t_texto, ImVec2(a.x + W * 0.015f, ty), activo ? kBlanco : kGris, etiqueta);
        if (EsBlackEdition(nombre)) {
          const float x_nota = a.x + W * 0.025f + Ancho(fuente, t_texto, etiqueta);
          Texto(dl, fuente, t_peque, ImVec2(x_nota, ty + (t_texto - t_peque) * 0.6f), kGrisOscuro,
                "avec l'option Black Edition");
        }
        const std::string estado = activo ? "ACTIVÉ" : "DÉSACTIVÉ";
        Texto(dl, fuente, t_texto, ImVec2(b.x - W * 0.015f - Ancho(fuente, t_texto, estado), ty),
              activo ? kNaranja : kGrisOscuro, estado);
        if (e.al_empezar.count(Minusculas(nombre)) != e.apagados.count(Minusculas(nombre))) {
          Texto(dl, fuente, t_peque, ImVec2(b.x + W * 0.02f, ty + (t_texto - t_peque) * 0.6f), kGris,
                "au prochain lancement");
        }
      } else {
        Texto(dl, fuente, t_texto, ImVec2(a.x + W * 0.015f, ty), kNaranja, "RELANCER LE JEU MAINTENANT");
      }
    }
    if (primera_ > 0) {
      const float cx = x0 + ancho_fila * 0.5f, cy = y_lista - alto_fila * 0.25f, r = alto_fila * 0.12f;
      dl->AddTriangleFilled(ImVec2(cx - r, cy + r * 0.5f), ImVec2(cx + r, cy + r * 0.5f), ImVec2(cx, cy - r * 0.6f),
                            kGris);
    }

    if (primera_ + visibles < filas) {
      const float cx = x0 + ancho_fila * 0.5f, cy = y_lista + float(visibles) * alto_fila + alto_fila * 0.1f;
      const float r = alto_fila * 0.12f;
      dl->AddTriangleFilled(ImVec2(cx - r, cy - r * 0.5f), ImVec2(cx + r, cy - r * 0.5f), ImVec2(cx, cy + r * 0.6f),
                            kGris);
    }

    // Footer: what a change does, and the buttons.
    float yp = H * 0.83f;
    if (!e.error.empty()) {
      Texto(dl, fuente, t_peque, ImVec2(x0, yp - t_peque * 1.4f), IM_COL32(230, 80, 60, 255), e.error);
    }
    if (e.al_empezar != e.apagados || estilo_cambiado_) {
      Texto(dl, fuente, t_peque, ImVec2(x0, yp), kNaranja,
            relanzar ? "Les changements s'appliquent au prochain lancement : « Relancer le jeu maintenant » le fait tout de suite."
                     : "Les changements s'appliquent au prochain lancement du jeu.");
    } else {
      Texto(dl, fuente, t_peque, ImVec2(x0, yp), kGris,
            "Les mods sont appliqués au lancement du jeu.");
    }
    yp += t_peque * 1.9f;
    dl->AddRectFilled(ImVec2(0, yp - H * 0.012f), ImVec2(W, H), IM_COL32(0, 0, 0, 150));
    {
      float xp = Pista(dl, fuente, t_peque, x0, yp, true, confirmar_ ? "choisir" : "changer");
      Pista(dl, fuente, t_peque, xp, yp, false, confirmar_ ? "annuler" : "retour");
    }

    if (confirmar_) {
      const ImVec2 a(W * 0.25f, H * 0.36f), b(W * 0.75f, H * 0.64f);
      dl->AddRectFilled(ImVec2(0, 0), tam, IM_COL32(0, 0, 0, 120));
      dl->AddRectFilled(a, b, IM_COL32(18, 18, 20, 245));
      Esquinas(dl, a, b, H * 0.03f, 3.0f);
      Texto(dl, fuente, t_texto, ImVec2(a.x + W * 0.03f, a.y + H * 0.04f), kBlanco, "Relancer le jeu avec ces mods ?");
      Texto(dl, fuente, t_peque, ImVec2(a.x + W * 0.03f, a.y + H * 0.04f + t_texto * 1.5f), kGris,
            "Ce qui n'est pas sauvegardé sera perdu.");
      const float yb = b.y - H * 0.08f;
      const std::string oui = "OUI", non = "NON";
      const float xo = W * 0.40f - Ancho(fuente, t_texto, oui) * 0.5f;
      const float xn = W * 0.60f - Ancho(fuente, t_texto, non) * 0.5f;
      Texto(dl, fuente, t_texto, ImVec2(xo, yb), si_ ? kNaranja : kGris, oui);
      Texto(dl, fuente, t_texto, ImVec2(xn, yb), si_ ? kGris : kNaranja, non);
      const float xs = si_ ? xo : xn;
      const float ws = Ancho(fuente, t_texto, si_ ? oui : non);
      Esquinas(dl, ImVec2(xs - 12, yb - 8), ImVec2(xs + ws + 12, yb + t_texto + 8), t_texto * 0.4f, 2.5f);
    }
  }

  int seleccion_ = 0;
  int primera_ = 0;
  bool armada_ = false;
  bool cerrando_ = false;
  bool confirmar_ = false;
  bool si_ = true;
  std::vector<std::string> estilos_;
  int estilo_ = 0;
  bool estilo_cambiado_ = false;
};

}  // namespace

void RegistrarPaginaMods(ImGuiDrawer* dibujante, WindowedAppContext* contexto) {
#if !REX_PLATFORM_SWITCH && !REX_PLATFORM_ANDROID
  g_dibujante = dibujante;
  g_contexto = contexto;
  Leer(Datos());  // what this start was given, to tell what a change will do
  RegistrarPaginaMenu("Mods", Dibujar);
#else
  (void)dibujante;
  (void)contexto;
#endif
}

void AbrirPantallaMods() {
#if !REX_PLATFORM_SWITCH && !REX_PLATFORM_ANDROID
  if (!g_dibujante || !g_contexto || g_abierta.load()) {
    return;
  }
  g_abierta.store(true);  // the game thread asks; the screen is made on the UI thread
  auto abrir = [] { new PantallaMods(g_dibujante); };  // deletes itself when closed (ImGuiDialog::Close)
  if (!g_contexto->CallInUIThread(abrir)) {
    g_abierta.store(false);
  }
#endif
}

void RegistrarCambioEstiloIconos(std::function<void(const std::string&)> cambio) {
  std::lock_guard<std::mutex> cerrojo(g_mutex_estilo);
  g_cambio_estilo = std::move(cambio);
}

bool PantallaModsAbierta() {
  return g_abierta.load();
}

}  // namespace rex::ui
