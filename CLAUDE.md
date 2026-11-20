# CLAUDE.md : reprendre le projet nfsmw-batocera

À lire en premier dans une nouvelle session. Résume l'état au 20/11/2026 ; le détail est dans `README.md`,
`CHANGELOG.md`, `docs/` et les commentaires en tête de chaque fichier.

## Le projet

**Need for Speed: Most Wanted (Xbox 360)** recompilé en natif (pas d'émulateur) : le code PowerPC du `default.xex`
est traduit en C++ par **ReXGlue** (`sdk/`, fork local), dessiné par un renderer Vulkan natif. Cibles :

- **Batocera aarch64** (Retroid Pocket 5, l'appareil de l'utilisateur) et **Batocera x86_64** (PC, AVX2) ;
- **Windows / RetroBat** (`.exe` MinGW), version **privée** : jamais publiée, ni sur la page ni sur le site.

Trois éditions : **PAL Espagne** (`app/`, la référence), **USA** et **PAL anglaise** (`app_usa/`, `app_pal_en/`,
générés par `tools/editions/` en traduisant les adresses : ne jamais éditer `app_*` à la main, tout part de `app/`).

Dépôts : `soaresden/nfsmw-batocera` (celui-ci, on pousse sur **main**), `soaresden/myhtml` (le site perso : fiche du
projet dans `data.js`, et `?v=NN` à incrémenter dans `index.html` à chaque changement), `soaresden/nfsmw-nx`
(port Switch et outils de VF).

## Règles

- **Rien du jeu dans git** : ni fichiers du jeu, ni code généré, ni binaires (`.gitignore`). Le code traduit n'est
  publié que **chiffré** (`page/paquets/*.pak`, clé dérivée du `default.xex` de l'édition) : on les ajoute avec
  `git add -f page/paquets/*.pak page/paquets/index.json`.
- Les zips faits avec les fichiers de l'utilisateur (Windows, icônes, Black Edition…) sont **privés** : le dire en
  les donnant. Pas d'art EA sur le site.
- Commits : auteur `soaresden <soaresden@gmail.com>`, committer `Claude <noreply@anthropic.com>`
  (`GIT_COMMITTER_NAME=Claude GIT_COMMITTER_EMAIL=noreply@anthropic.com git -c user.name=soaresden
  -c user.email=soaresden@gmail.com commit …`), messages en anglais, terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Ne jamais mettre d'identifiant de modèle ailleurs.
- L'utilisateur parle **français**, attend des réponses courtes et des fichiers prêts à poser. Commentaires du code :
  anglais (les anciens fichiers sont parfois en espagnol). Textes affichés au joueur : français.
- Tester ce qui peut l'être (rendu hors jeu, compilation, scripts) avant de livrer ; dire clairement ce qui n'a pas
  pu être vérifié en jeu. Les logs utiles : `nfsmw-launcher.log` (Windows) ou `nfsmw-stdout.log` (Batocera), et
  `logs/nfsmw_0XX.log`.

## Où est quoi

| Chemin | Rôle |
|---|---|
| `app/src/` | Code du port (crochets `REX_HOOK_RAW(sub_X)` sur des fonctions du jeu) |
| `sdk/` | ReXGlue modifié (UI ImGui, entrées, mémoire, renderer de base) |
| `batocera/port/run.sh` | Lanceur Batocera (options ES, mods, icônes, relance code 3, fiche gamelist) |
| `batocera/port/mods.py` | Mods (`restore`/`apply`/`icons`/`gamelist`), lancé par les deux lanceurs |
| `batocera/windows/NFS Most Wanted.bat` | Lanceur Windows/RetroBat (CRLF, **pas de blocs entre parenthèses**) |
| `batocera/tools/ps_buttons/` | Icônes PlayStation/GameCube/Xbox/**clavier**, écran titre Black Edition, images gamelist |
| `page/` | Page d'installation (navigateur, Pyodide) : déchiffre le paquet, fait VF, icônes, BE, gamelist |
| `tools/editions/` | Portage des adresses vers USA / PAL anglaise ; `tools/re/` : désassembleur et xrefs |

## Compiler

- Référence PAL Espagne : `cmake --build out/arm64` (Retroid) et `out/x86_64` (PC Linux). Éditions :
  `batocera/build_edition.sh <usa|pal_en> <default.xex>` (`ARCH=x86_64 SKIP_CODEGEN=1` pour la version PC).
- **Tout d'un coup** : `batocera/rebuild_all.sh` (≈ 15-45 min), puis `git add -f` des paquets et push.
- Après un **nouveau crochet** `REX_HOOK_RAW(sub_X)` : `python3 tools/llamadas_directas.py --deshacer &&
  python3 tools/llamadas_directas.py` pour `app/` ; les éditions repassent par le codegen (fait par
  `rebuild_all.sh`, `tools/codegen.sh` défait maintenant les appels directs avant de les refaire).
- **Windows** : `cmake -S app_pal_en -B out/win64-pal_en -G Ninja -DCMAKE_BUILD_TYPE=Release
  -DCMAKE_TOOLCHAIN_FILE=batocera/toolchain-x86_64-windows-mingw.cmake -DREXSDK_DIR=sdk
  -DREXGLUE_ENABLE_TRACY=OFF -DNFSMW_BUILD_LAUNCHER=OFF` (clang-20 + MinGW, threads **win32**). Le dossier livré :
  `nfsmw.exe`, `librexruntime.dll`, `librexgpu-xenos.dll` (passés à `llvm-strip-20 --strip-debug`),
  `libstdc++-6.dll` et `libgcc_s_seh-1.dll` de `/usr/lib/gcc/x86_64-w64-mingw32/13-win32/`, `python/` (Python 3.12
  embarqué, paquet NuGet `python` 3.12.10, dossier `tools/`), `mods.py`, `jdlz.py`, `nfsmw.toml`, le `.bat`.
  Vérifier que tous les imports des DLL se résolvent (`llvm-objdump-20 -p`). Donner le `.bat` renommé en `.bat.txt`
  (sinon non téléchargeable).
- Ce qui a été fait jusqu'ici l'a été dans un conteneur Linux (cross-compilation). Sur le PC Windows de
  l'utilisateur, la compilation demande WSL ou un Linux ; une session locale sert surtout à tester, lire les logs,
  et éditer/pousser.

## Installation chez l'utilisateur

- **Retroid** : `/userdata/roms/ports/NFS Most Wanted.sh/` (`bin/aarch64/`, `game_root/`, `mods/`, `data/`,
  `logs/`). Mise à jour : relancer l'installation depuis la page (elle reconnaît le dossier, ne refait pas la VF).
- **PC** : le jeu et ses mods dans `D:\batocera\roms\ports\NFS Most Wanted.sh\`, le lanceur dans
  `D:\batocera\roms\windows\NFS Most Wanted (Windows)\`. Synchro avec la Retroid seulement si
  `synchro_console.txt` est à côté du `.bat`.

## Fonctions récentes (à connaître)

- **Menu Mods** (`app/src/nfsmw_menu_mods.cpp`, `sdk/src/ui/overlay/mods_page.cpp`) : l'entrée Xbox Live du
  menu principal devient « Mods » (texte via `sub_822BCE60`, icône via `sub_822E00C0`, action via
  `sub_82237080`, menu rechargé derrière via `sub_82284928("MainMenu.fng")`). Écran ImGui au style du jeu :
  mods on/off (`mods/desactives.txt`), **style d'icônes** (PlayStation, Xbox 360, GameCube, **Clavier** ;
  `mods/icones/choix.txt`), « Relancer » (code de sortie 3, les lanceurs bouclent). Aussi dans le menu du port
  (L + R + Droite / F4).
- **Icônes clavier en direct** (`app/src/nfsmw_iconos_teclado.cpp`) : le dernier appareil utilisé
  (`sdk/include/rex/input/dispositivo.h`) décide ; les 9 icônes (CROSS, TRIANGLE… de GLOBALB) et les 2 images de
  l'écran des commandes (`DYNTEX_EC3C0443/4`) sont cherchées dans la mémoire physique et réécrites (seulement les
  plages de texels). Sources : `data/iconos-juego.bin` (écrit à chaque lancement par `mods.py icons`, ce que le
  jeu charge vraiment) et `mods/icones/<style>/ICONOS.BIN` (`ps_buttons.py`). Le renderer refait une empreinte
  complète après chaque échange (`nfsmw::nativo::ForzarComprobacionTexturas`).
- **Touches PC** (dans le `.bat`), calées sur l'écran des commandes : Maj/Entrée = A, Espace/Retour arrière = B,
  D = X (rapport inf.), E = Y (rapport sup.), X = LB (vue arrière), Ctrl = RB (Supercontrôle), flèches, C = caméra,
  R/Tab = Back, Échap = Start. Lues par position QWERTY (E, D, X, C, R identiques en AZERTY).
- **Fiche EmulationStation** : `mods.py gamelist` écrit/complète l'entrée (`ports/gamelist.xml`, ou
  `windows/gamelist.xml` de RetroBat) : description anglaise avec les références GitHub, images de `forgamelist/`.

## À vérifier avec l'utilisateur (non testé en jeu au moment de l'écriture)

1. Icônes clavier : dans le log, `[iconos] … copias nuevas …; sin encontrar todavia: ninguno`, puis toutes les
   icônes qui passent aux touches (le A aussi) et reviennent avec la manette.
2. Écran des commandes : clavier dessiné à la place de la manette (`[iconos] imagen de la pantalla de controles
   encontrada`).
3. Fiche EmulationStation / RetroBat après redémarrage d'ES.
4. Connu, pas de notre fait : Hotkey + Start ne quitte plus depuis une mise à jour de Batocera (evmapy) ;
   `pkill -9 -x nfsmw` en SSH en attendant.
