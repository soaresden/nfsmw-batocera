# Changelog

NFS Most Wanted (Xbox 360, recompiled) for Batocera, Linux aarch64. Tested on a Retroid Pocket 5 (Snapdragon 865,
Adreno 650 with Turnip) under Batocera v44. The `VERSION` file in the package names the build.

## 2026-11

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
