# Changelog

NFS Most Wanted (Xbox 360, recompiled) for Batocera, Linux aarch64. Tested on a Retroid Pocket 5 (Snapdragon 865,
Adreno 650 with Turnip) under Batocera v44. The `VERSION` file in the package names the build.

## 2026-11

- "Mods" in the game's main menu, in place of Xbox Live (`app/src/nfsmw_menu_mods.cpp`): the text lookup
  `sub_822BCE60` answers "Mods" for its label and its React `sub_82237080` opens a Mods screen drawn in the style
  of the game's menus (Roboto Medium, the game's orange); its icon becomes the frontend's PERFORMANCE_ICON_PACKAG (`sub_822E00C0`); `nfsmw_menu_mods = false` gives Xbox Live back.

- Mods tab in the settings menu (`sdk/src/ui/overlay/mods_page.cpp`): a switch per mod in `mods/`, written to
  `mods/desactives.txt`, which `mods.py` skips; applied at the next start, or at once with "Relancer le jeu
  maintenant" (the game ends with code 3 and `run.sh` / the Windows launcher apply the mods and start it again,
  `NFSMW_RELANCE=1`).
- The port's menus on an SDL controller (Batocera, Windows), as on the Switch: L+R+Right settings, L+R+Up counters,
  L+R+Down log, L+R+Left achievements; the menus are driven with the controller, which the game does not get while
  one has focus.
- Windows launcher: the sync with the console is now off unless `synchro_console.txt` sits next to it.

- One folder for both machines: `bin/aarch64/` and `bin/x86_64/` hold what depends on the processor; the game,
  shader library (now in `game_root/`), saves, logs, mods and settings are shared. The launcher picks
  `bin/$(uname -m)/` and moves an older install's executable into `bin/<its processor>/`; the page adds a machine
  to an existing folder and refuses a folder holding another edition.
- Batocera on PC (x86_64): USA, PAL English and PAL Spain built natively with clang 20 (x86-64-v3, AVX2); packages
  `nfsmw-<edition>-x86_64.pak`, the machine is chosen on the installation page. The launcher refuses a package built
  for another processor, or a PC without AVX2, with a message in `nfsmw-stdout.log`. Checked up to the game's first
  disc reads under Mesa's software Vulkan (lavapipe); not yet played on a real PC.
- Black Edition option (ES menu, cvar `nfsmw_black_edition`): tuhana's data patch written after the XEX is mapped.
- Black Edition title screen (`mods/black-edition/`, made by the page from the player's files): black-and-white title
  picture and "Black Edition" under the game's logo, applied only with the option.
- Mods: `<file>.patch` textures put into compressed files over the icons and other mods, also into the copy
  `GLOBALMEMORYFILE.BIN` preloads; results cached in `data/mods-cache/`.
- USA (NTSC) port built with `batocera/build_edition.sh`.
- Installation page redesigned: drop both ISOs at once (360 and original Xbox told apart by default.xex /
  default.xbe), flags, a "what you get" summary, the PAL English + Xbox French route to the French dub spelled out.
- French dub in the installation page: with the PAL English 360 ISO and the original Xbox French ISO, the
  nfsmw-nx french-dub tools run in the browser (Pyodide, ffmpeg.wasm, vgmstream for WASI). The icon sets start from
  the pack with its English text hidden, as the dub needs. Other 360 editions get a report of both discs.
- `batocera/build_edition.sh`: the port of another edition from its default.xex.
- Editions table on the installation page.
- The installation page takes the Xbox 360 ISO directly (XDVDFS read in the browser, XGD2 disc images and xiso).
- Installation page (`page/`): from the player's game folder it decrypts the port with their `default.xex`, builds
  the shaders, the icon sets and the gamelist pictures in the browser, and writes `NFS Most Wanted.sh/` to the SD card
  or the network share. `batocera/make_paquet.py` makes the encrypted packages.
- Icons: Pillow before 11 silently wrote uncompressed DDS; the numpy DXT5 encoder is used then (the browser).
- Repository cleaned up: only the Batocera port remains. The Android app, the Switch build and their tools stay in
  their original repositories; `docs/` and `tools/` keep the shared nfsmw-nx documentation and scripts.
- `batocera/build_shaders.sh` builds `nfsmw_shaders.nfsp` from your copy of the game, without the Android app.
- `batocera/tools/ps_buttons/gamelist_media.py`: title-screen pictures for your own EmulationStation entry
  (`forgamelist/`), no `gamelist.xml` written.
- `Identifier NFSMW.sh` no longer depends on SpeedBreaker: it reports the edition, the French dub, the shaders and
  the file list.
- Rumble on by default, with a VIBRATION option (`SDL rumble: supported` in the log when the pad's driver has it).
- Button icon styles chosen in EmulationStation: PlayStation (default, buttons by position), Xbox 360 and GameCube
  (buttons by letter), including the controller pictures of the loading screens and the Controls menu.
- Controller: Batocera's SDL mapping is always ignored (off by one with the game's SDL); X and Y are swapped back
  for the Retroid's face buttons.
- Sound: WMA decoder enabled, Android audio path (stereo fold of 5.1, limiter) on Linux arm64; the intro movies
  play their sound through the game's own decoder.
- Language picked from Batocera's language (French text with the nfsmw-nx French dub).
- Performance: ThinLTO, hot functions first, game threads on the A77 cores, ARM command publication: about 60 FPS
  at 1280x720 on the RP5.
- Options in EmulationStation (language, internal resolution, FPS limit, yellow filter, FXAA, image filter, icons,
  buttons, rumble); Hotkey + Start quits.
- First Batocera package: a `NFS Most Wanted.sh/` Ports folder with its launcher, cross-compiled with clang 20
  from the NFSMW Android Evolved 0.8.2 sources.
