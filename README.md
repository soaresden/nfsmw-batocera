# NFSMW pour Batocera (Retroid Pocket 5)

**Need for Speed: Most Wanted (2005, version Xbox 360)** en natif sous **Batocera Linux ARM64**, visé sur la
**Retroid Pocket 5** (Snapdragon 865, GPU Adreno 650, Vulkan via Mesa Turnip).

Ce n'est pas un émulateur : le code PowerPC du `default.xex` est recompilé en C++ avec
[ReXGlue](https://github.com/rexglue/rexglue-sdk) puis compilé pour Linux aarch64. Le jeu est dessiné par le
renderer Vulkan natif du port.

> [!IMPORTANT]
> **Ça tourne sur la Retroid Pocket 5** (Batocera v44, Turnip Adreno 650) : **60 FPS en course en 1280x720**,
> son, vidéos, sauvegardes, VF, manette, menu d'options, mod boutons PlayStation. Détails : [État](#état).

> [!NOTE]
> Il faut **votre propre copie** du jeu Xbox 360, édition **PAL Espagne** (la même que le port Android). Ce dépôt ne
> contient aucun fichier du jeu ni rien de généré à partir de lui.

## Installation facile : la page web

`page/` est une page à ouvrir dans **Chrome ou Edge sur un PC**. Elle demande l'**ISO** Xbox 360 du jeu (ou un
dossier extrait), puis le dossier `roms/ports` de Batocera (carte SD ou partage réseau), et elle prépare tout sans rien envoyer :

- elle reconnaît l'édition par le SHA-256 du `default.xex` ;
- elle déchiffre le port compilé avec ce `default.xex` (le paquet chiffré ne sert à rien sans le jeu, voir
  `batocera/make_paquet.py`) ;
- elle fabrique `nfsmw_shaders.nfsp` avec les modules de l'installeur nfsmw-nx, les trois styles d'icônes et les
  images `forgamelist/` avec les outils Python du dépôt (exécutés par Pyodide dans le navigateur) ;
- elle écrit `NFS Most Wanted.sh/` et extrait le jeu dans `game_root/` (les fichiers déjà là sont sautés) : l'ISO
  est lue directement (XDVDFS, `page/iso.js`), sans outil d'extraction.

Sans Chrome ni Edge, elle fabrique un zip et le jeu se copie à la main. `page/build_site.sh` assemble le site,
`.github/workflows/page.yml` le publie sur GitHub Pages (réglage unique : Settings → Pages → Source : GitHub
Actions).

## Votre copie du jeu

Il faut votre propre copie Xbox 360 **PAL Espagne** (`default.xex` `aad15fc2…`), comme pour le port Android. Les
fichiers de données peuvent être modifiés (traduction, voitures…) : le port ne les vérifie pas. Le Port
**Identifier NFSMW** (`batocera/tools/Identifier NFSMW.sh`) dit quelle édition est votre copie et quels fichiers
diffèrent de l'original (`ports/nfsmw-identification.txt`). Éditions connues :
`tools/editions/regional/ediciones.json`.

**Version française doublée.** La branche `tools/french-dub` de
[soaresden/nfsmw-nx](https://github.com/soaresden/nfsmw-nx/tree/tools/french-dub) fait une VF complète (texte,
32 vidéos, voix en jeu) avec le disque Xbox original français. Seuls `NFS/ZDIR.BIN`, `NFS/ZZDATA0.BIN`,
`NFS/ZZDATA9.BIN` et des `Movies/*.wmv` changent ; le lanceur la reconnaît et met la langue du jeu en
conséquence.

> [!NOTE]
> Autre recompilation du même jeu, [SpeedBreaker](https://github.com/SpeedBreakerProject/speedbreaker) a une
> version Linux arm64, mais elle n'installe que les disques USA et PAL Espagne d'origine (49 fichiers vérifiés) :
> pas de VF doublée ni de mods.

## D'où vient ce port

| Projet | Apport |
|---|---|
| [StevensND/nfsmw-nx](https://github.com/StevensND/nfsmw-nx) | La recompilation, le renderer natif et le port Switch |
| [codepdbh/nfsmw-android](https://github.com/codepdbh/nfsmw-android) (NFSMW Android Evolved) | Le passage à l'ARM64 générique avec SDL3, Vulkan 1.1 et les correctifs Adreno/Turnip. Ce dépôt part de sa version 0.8.2 |
| Ce dépôt | La cible Linux aarch64, la compilation croisée et le paquet « Ports » de Batocera |

Le dépôt ne garde que ce qui sert à Batocera : le port Android (Java, GLES, Gradle), la Switch et leurs outils
sont dans leurs dépôts d'origine. `docs/` et `tools/` gardent la documentation et les scripts communs de nfsmw-nx
(recompilation, renderer, éditions), écrits pour la Switch mais valables ici.

## Installation sur la console

1. Construisez le paquet (voir [Compilation](#compilation)) : il sort dans `out/batocera/`, un seul dossier
   `NFS Most Wanted.sh/`.
2. Copiez ce dossier dans `/userdata/roms/ports/` (partage réseau `\\BATOCERA\share\roms\ports` ou carte SD).
   EmulationStation affiche un dossier qui porte l'extension `.sh` comme un jeu, et Batocera lance son `run.sh`.
3. Copiez les fichiers de votre jeu dans son `game_root/`. Si le port Android tourne déjà sur la Retroid, ce sont
   ceux du dossier `nsfmw-androidevolved/` du stockage interne :

   ```text
   /userdata/roms/ports/NFS Most Wanted.sh/
     run.sh                    (lanceur)
     padto.keys                (Hotkey + Start pour quitter)
     nfsmw                     (le jeu), librexruntime.so, librexgpu-xenos.so
     nfsmw.toml                (réglages)
     es_features_nfsmw.cfg     (le menu d'options, installé par le lanceur)
     lib/
     data/                     (sauvegardes, profils, cache : créé au premier lancement)
     game_root/
       default.xex
       NFS/
       Movies/
     nfsmw_shaders.nfsp        (celle générée par l'app Android, ici ou dans game_root/)
   ```

4. Dans EmulationStation : **Menu → Paramètres du jeu → Mettre à jour la liste des jeux**, puis lancez
   *NFS Most Wanted* dans **Ports**. Après le premier lancement, redémarrez EmulationStation pour voir le menu
   **Options avancées du jeu → NFS MOST WANTED** (langue, résolution, FPS, filtres, manette).

Les journaux sont `nfsmw-stdout.log` (lanceur) et `logs/nfsmw_001.log` (jeu). **Envoyez-les à chaque essai.**

> [!NOTE]
> L'ancienne disposition (`NFS Most Wanted.sh` à la racine de `ports/` et un dossier `nfsmw/` à côté) marche
> encore. Pour passer à la nouvelle : supprimez `NFS Most Wanted.sh` et `NFS Most Wanted.sh.keys`, renommez
> `nfsmw/` en `NFS Most Wanted.sh/`, et copiez-y le contenu du nouveau paquet.

> [!CAUTION]
> **La première course compile les pipelines graphiques**, donc elle saccade quelques secondes. Ils sont ensuite
> gardés dans `data/cache`.

## État

| Sujet | État |
|---|---|
| Affichage | Vulkan sur Turnip (Adreno 650), 16/9 natif, 1280x720 interne (1920x1080 au choix) |
| Performances | 60 FPS presque tout le temps en 720p avec ThinLTO et les fonctions chaudes en tête (20 tranches de 10 s sur 24 à 58-60, moyenne 56,9) ; quelques saccades à la première course (shaders) |
| Son du jeu | Repli stéréo du jeu (avec le LFE), limiteur et pompe audio comme sur Android |
| Son des vidéos | Décodé par le jeu (`nfsmw_video_audio_nativo = false`) : le flux natif du port sortait mal en Bluetooth |
| Sauvegardes | Dans `data/` (copie lisible dans `saves/`) |
| Langue | Celle de Batocera ; avec la VF doublée de nfsmw-nx, le français |
| Manette | Reconnue par le SDL du jeu (la correspondance de Batocera est décalée d'un bouton pour lui : son SDL 3.4 et celui du jeu, 3.5, ne numérotent pas la manette pareil) ; boutons de gauche et du haut remis en place (`input_sdl_intercambiar_xy`) |
| Quitter | Hotkey + Start |

Le lanceur écrit en tête de `nfsmw-stdout.log` la version du port (`VERSION`), Batocera, les pilotes Vulkan et
la manette vue par SDL : **envoyez ce fichier et `logs/nfsmw_00X.log` avec chaque retour.**

## Commandes et options

Avec les icônes PlayStation (par défaut), le bouton du bas (✕) valide, celui de droite (○) revient, et la nitro
est sur ✕ en course ; gâchettes pour accélérer et freiner, **Start** pour la pause. **Hotkey + Start** quitte le jeu. Le menu de debug s'ouvre avec
**L + R + Droite**.

**Options avancées du jeu → NFS MOST WANTED** dans EmulationStation (installé par le lanceur, visible après un
redémarrage d'EmulationStation) :

| Option | Valeurs |
|---|---|
| Langue du jeu | Auto (celle de Batocera), celle du disque, ou une des dix langues |
| Résolution interne | 1280x720 (celle de la Xbox 360, 60 FPS sur la RP5), 1920x1080 (l'écran de la RP5, plus lourd ; le maximum du renderer), 1024x576 (plus léger) |
| Limite de FPS | 60, 30 |
| Filtre jaune du jeu | original, doux, désactivé |
| Anticrénelage | désactivé, FXAA |
| Filtre d'image | aucun, cinéma, sépia, noir et blanc, froid, chaud, vif, Matrix, CRT |
| Icônes des boutons | PlayStation, Xbox 360 (d'origine), GameCube : avec le zip des icônes (voir plus bas) |
| Vibration | activée (défaut) ou désactivée ; le journal dit si le pilote de la manette la gère (`SDL rumble:`) |
| Boutons A/B X/Y | **Par lettre** (la lettre affichée est celle du bouton de la Retroid, A à droite, B en bas) ou par position (comme une manette Xbox ou PlayStation). Par défaut : par position avec les icônes PlayStation, par lettre sinon |

Les autres réglages sont dans `nfsmw.toml`.

### Icônes des boutons : PlayStation, GameCube, Xbox 360

`batocera/tools/ps_buttons/` fabrique, à partir de vos fichiers (sortis des archives par
`batocera/tools/Extraire textures NFSMW.sh`), un zip à décompresser par-dessus `ports/` avec trois styles
d'icônes : **PlayStation** (✕ ○ □ △), **GameCube** (A B ronds, X Y en haricot) et **Xbox 360** (celles du jeu).
Chaque style change aussi la photo de manette des écrans de chargement et du menu Commandes, avec celles qu'EA a
laissées dans le jeu (DualShock 2, manette GameCube). Le style se choisit dans le menu **ICÔNES DES BOUTONS** ;
les autres mods de `GLOBALMEMORYFILE.BIN` (la MX-5…) sont gardés. Voir
[son README](batocera/tools/ps_buttons/README.md).

### Outils

| Outil (Port à copier dans `ports/`) | Rôle |
|---|---|
| `batocera/tools/Identifier NFSMW.sh` | Dit quelle édition est votre copie et quels fichiers diffèrent de l'original (`ports/nfsmw-identification.txt`) |
| `batocera/tools/Extraire textures NFSMW.sh` | Sort des archives les packs de textures dont le mod PlayStation a besoin (`ports/nfsmw-extrait/`) |

Sur le PC :

| Outil | Rôle |
|---|---|
| `batocera/tools/ps_buttons/ps_buttons.py --icon-sets` | Le zip des trois styles d'icônes (voir plus haut) |
| `batocera/tools/ps_buttons/gamelist_media.py` | Un zip `forgamelist/` avec les images de l'écran titre (image, vignette, fanart) pour votre fiche EmulationStation, et un dossier `screenshots/` pour vos captures (**Hotkey + L1**, rangées par Batocera dans `/userdata/screenshots/`). Rien n'est écrit dans `gamelist.xml` |
| `batocera/build_shaders.sh <jeu> [sortie]` | Fabrique `nfsmw_shaders.nfsp` depuis votre copie (Node.js 18+), comme l'installeur de l'app Android. Inutile si vous avez déjà celui de l'app |

## Compilation

Sur un PC Linux x86_64 (Ubuntu 24.04 testé), en compilation croisée vers aarch64 avec clang et lld.

```sh
# compilateur et bibliothèques ARM64 (multiarch)
sudo dpkg --add-architecture arm64      # + une source ports.ubuntu.com pour arm64
sudo apt install clang-20 lld-20 llvm-20 cmake ninja-build python3 g++-aarch64-linux-gnu \
  libc6-dev:arm64 libstdc++-13-dev:arm64 libvulkan-dev:arm64 libwayland-dev:arm64 libxkbcommon-dev:arm64 \
  libx11-dev:arm64 libx11-xcb-dev:arm64 libxext-dev:arm64 libxtst-dev:arm64 libxrandr-dev:arm64 libxi-dev:arm64 \
  libxcursor-dev:arm64 libxss-dev:arm64 libxfixes-dev:arm64 libasound2-dev:arm64 libpulse-dev:arm64 \
  libdrm-dev:arm64 libgbm-dev:arm64 libudev-dev:arm64 libegl-dev:arm64 libgles-dev:arm64 libdbus-1-dev:arm64

python3 tools/fetch_thirdparty.py         # bibliothèques du SDK ReXGlue v0.10.0
batocera/build.sh /chemin/vers/default.xex
```

`batocera/build.sh` construit le générateur de code pour le PC, traduit le jeu en C++ (`app/generated`, jamais
versionné), compile pour aarch64 et prépare `out/batocera/`. Il faut environ 16 Go de RAM.

| Fichier | Rôle |
|---|---|
| `batocera/toolchain-aarch64-linux.cmake` | Compilation croisée clang 20 + lld, réglée pour le Cortex-A77 |
| `batocera/build.sh` | Les quatre étapes, du `default.xex` au paquet |
| `batocera/package.sh` | Le dossier `NFS Most Wanted.sh/` : binaire, bibliothèques, réglages, lanceur, `VERSION` |
| `batocera/port/` | Le lanceur `run.sh`, la touche de sortie `padto.keys` et le menu d'options `es_features_nfsmw.cfg` |
| `batocera/nfsmw.toml` | Les réglages de départ |
| `batocera/shader-builder/` | Le constructeur de la bibliothèque de shaders (compilateurs HLSL/DXC en WebAssembly), utilisé par `build_shaders.sh` |
| `app/src/nfsmw_nucleos_grandes.cpp` | Les threads du jeu sur les cœurs rapides (A77), repris du port Android |
| `app/orden_funciones_lld.txt` | Les fonctions chaudes en tête du code (ordre de la Switch), avec ThinLTO |

### Autres éditions

`batocera/build_edition.sh <édition> <default.xex>` compile le port d'une autre édition (`usa`, `pal_en`,
`pal_fr`, `pal_de`, `pal_it`) à partir de la PAL Espagne déjà construite : correspondance des adresses entre les
deux exécutables, arbre `app_<édition>` (outils de nfsmw-nx dans `tools/editions/`), génération du code,
compilation, paquet chiffré pour la page. Testé de bout en bout en passant la PAL Espagne pour une autre édition.

## Licence

GPL-3.0, héritée de NFSMW Recompiled, nfsmw-nx et NFSMW Android Evolved (voir [LICENSE](LICENSE) et
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). Ce projet n'a aucun lien avec Electronic Arts. « Need for
Speed » est une marque d'Electronic Arts Inc.
