# NFSMW pour Batocera (Retroid Pocket 5, PC x86_64)

**Need for Speed: Most Wanted (2005, version Xbox 360)** en natif sous **Batocera Linux**, visé sur la
**Retroid Pocket 5** (ARM64 : Snapdragon 865, GPU Adreno 650, Vulkan via Mesa Turnip), et aussi pour **Batocera
sur PC (x86_64)** : processeur avec AVX2 (Intel depuis 2013, AMD Zen, Steam Deck) et carte graphique Vulkan.

Ce n'est pas un émulateur : le code PowerPC du `default.xex` est recompilé en C++ avec
[ReXGlue](https://github.com/rexglue/rexglue-sdk) puis compilé pour Linux aarch64 ou x86_64. Le jeu est dessiné
par le renderer Vulkan natif du port.

> [!IMPORTANT]
> **Ça tourne sur la Retroid Pocket 5** (Batocera v44, Turnip Adreno 650) : **60 FPS en course en 1280x720**,
> son, vidéos, sauvegardes, VF, manette, menu d'options, mod boutons PlayStation. Détails : [État](#état).

> [!NOTE]
> Il faut **votre propre copie** du jeu Xbox 360 : **USA**, **PAL anglaise** ou **PAL Espagne** (la VF complète se
> fait à partir de la PAL anglaise et de l'ISO Xbox française). Ce dépôt ne contient aucun fichier du jeu, et le code
> traduit n'est publié que chiffré, ouvrable seulement avec le `default.xex` de l'édition.

## Installation facile : la page web

`page/` est une page à ouvrir dans **Chrome ou Edge sur un PC**. Elle demande l'**ISO** Xbox 360 du jeu (ou un
dossier extrait), puis le dossier `roms/ports` de Batocera (carte SD ou partage réseau), et elle prépare tout sans rien envoyer :

- on choisit la machine : console ARM (Retroid…) ou PC (x86_64) ;
- elle reconnaît l'édition par le SHA-256 du `default.xex` ;
- elle déchiffre le port compilé avec ce `default.xex` (le paquet chiffré ne sert à rien sans le jeu, voir
  `batocera/make_paquet.py`) ;
- elle fabrique `nfsmw_shaders.nfsp` avec les modules de l'installeur nfsmw-nx, les trois styles d'icônes et les
  images `forgamelist/` avec les outils Python du dépôt (exécutés par Pyodide dans le navigateur) ;
- elle écrit `NFS Most Wanted.sh/` et extrait le jeu dans `game_root/` (les fichiers déjà là sont sautés) : l'ISO
  est lue directement (XDVDFS, `page/iso.js`), sans outil d'extraction.

**Un dossier pour les deux machines** : ce qui dépend du processeur est dans `bin/aarch64/` (Retroid…) et
`bin/x86_64/` (PC) : l'exécutable, `librexruntime.so`, `librexgpu-xenos.so` et `lib/`, environ 50 et 65 Mo. Tout le
reste est commun : le jeu (`game_root/`, avec `nfsmw_shaders.nfsp`), les sauvegardes (`data/`, `saves/`), les
journaux (`logs/`), les mods, les icônes et les réglages (`nfsmw.toml`). Choisir sur la page l'autre machine et le
même dossier y ajoute seulement son `bin/` ; `run.sh` lance celui de la machine (`uname -m`). Le dossier se copie
tel quel d'une machine à l'autre, carrière comprise. Une installation d'avant (exécutable à la racine) est rangée
dans `bin/<processeur>/` par le lanceur au lancement suivant. Un dossier ne contient qu'une édition du jeu.

**VF** : avec l'ISO 360 PAL anglaise, la page propose d'ajouter l'ISO de la **Xbox d'origine en français**. Elle
lance alors l'outil french-dub de nfsmw-nx (`batocera/tools/french-dub/`) dans le navigateur (`page/vf/` : Pyodide,
ffmpeg.wasm, vgmstream compilé pour WASI) : textes, 31 vidéos sur 36 (la bande-annonce de l'écran titre reste en anglais) et voix en jeu en français, en 1 à 3 heures.
Pour une autre édition (USA), elle fait un rapport des fichiers des deux ISO pour adapter l'outil.

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
31 vidéos, voix en jeu) avec le disque Xbox original français. Seuls `NFS/ZDIR.BIN`, `NFS/ZZDATA0.BIN`,
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
est sur ✕ en course ; gâchettes pour accélérer et freiner, **Start** pour la pause. **Hotkey + Start** quitte le jeu.

Menus du port, à la manette (le combo est relu tant qu'il est tenu : le même ferme le menu) ou au clavier :

| Combo | Touche | Menu |
|---|---|---|
| **L + R + Droite** | F4 | Réglages, avec l'onglet **Mods** |
| L + R + Haut | F3 | Compteurs (FPS, temps de rendu) |
| L + R + Bas | ² / ` | Journal |
| L + R + Gauche | F7 | Succès |

Dans un menu, la croix déplace, le bouton du bas valide, celui de droite revient ; tant qu'il est ouvert, le jeu ne
reçoit plus la manette.

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

### Mods (la MX-5…)

Un dossier `NFS Most Wanted.sh/mods/<nom>/`, rangé comme `game_root/` (`CARS/…`, `GLOBAL/…`), est appliqué à chaque
lancement par `mods.py`, ou un zip posé dedans tel quel : par exemple `mods/mx5/mx5.zip`, le zip de la page
MX-5 (MazdaMx5-nd-rf-ingames), sans le décompresser. Les fichiers d'origine sont gardés dans `data/mods-originals/` : supprimer le dossier du
mod rend le jeu de base au lancement suivant. Le `GLOBALMEMORYFILE.BIN` d'un mod reçoit les icônes du style choisi
(et, avec la VF, les textes anglais y sont masqués comme le fait french-dub). Un fichier `<fichier>.patch` d'un mod
(écrit par `black_edition_title.py`) remplace seulement des textures dans un fichier compressé (`FRONTB.LZC`,
`GLOBALB.LZC`, et la copie de `GLOBALB.LZC` préchargée dans `GLOBALMEMORYFILE.BIN`), par-dessus les icônes et les
autres mods ; le résultat est gardé dans `data/mods-cache/` (le premier lancement après un changement prend une
demi-minute de plus).

**Activer ou désactiver un mod sans le supprimer** : menu Réglages (**L + R + Droite**, ou F4) → onglet **Mods**,
une case par dossier ou zip de `mods/` (sauf `icones/`, qui suit l'option des icônes). Une case décochée écrit le
nom du mod dans `mods/desactives.txt`, que `mods.py` saute. Les fichiers du jeu sont déjà chargés : le changement
compte au lancement suivant, et le bouton **Relancer le jeu maintenant** relance tout de suite (le lanceur réapplique
les mods ; une partie non sauvegardée est perdue). `black-edition` n'est appliqué qu'avec l'option Black Edition, même
coché.

### Black Edition

L'option **BLACK EDITION** du menu NFS MOST WANTED débloque le contenu de la Black Edition, présent sur tous les
disques mais verrouillé hors de cette édition : BMW M3 GTR de route, Camaro SS, huit voitures tunées, l'épreuve 70
du Challenge Series et trois courses (City Perimeter, NFS World Loop, Seaside & Power Station). C'est le patch de
tuhana (`xenia-canary/game-patches`, une valeur de `.data` à `0x82A2CE04`), repris par
[Epix Digital Studio](https://github.com/Pixelplix93/NFS-Most-Wanted-Black-Edition-Xbox-360) dans ses XEX
modifiés ; ici pas de XEX modifié : le port écrit la valeur au démarrage (`app/src/nfsmw_black_edition.cpp`).
À activer avant de commencer une carrière.

Avec l'option, `mods/black-edition/` (fait par la page d'installation, ou par
`batocera/tools/ps_buttons/black_edition_title.py` à partir de vos `FRONTB.LZC`, `GLOBALB.LZC` et `GLOBALA.BUN`)
donne aussi son écran titre : le fond de l'écran « Appuyer sur START » (`WS_XENON_SPLASHBACK` de `GLOBALB.LZC`) en
noir et blanc argenté, la M3 légèrement bleu acier, les gyrophares rouge et bleu, et « Black Edition » au pochoir
graffiti (Sedgwick Ave Display, OFL) sous le logo du jeu (`MW_LOGO` de `GLOBALA.BUN`), sur l'écran titre et dans
les menus. Sans l'option, ou sans le dossier, le jeu reprend ses images d'origine.

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

**Pour Batocera sur PC** : `ARCH=x86_64 batocera/build.sh /chemin/vers/default.xex` compile en natif sur le même
PC (paquets `:amd64` des mêmes bibliothèques de développement, déjà là sur une Ubuntu x86_64) et prépare
`out/batocera-x86_64/` ; `ARCH=x86_64 batocera/build_edition.sh <édition> <default.xex>` fait de même pour une autre
édition, et le paquet chiffré s'appelle `nfsmw-<édition>-x86_64.pak`. Le lanceur vérifie que le paquet correspond
à la machine (et, sur PC, que le processeur a AVX2) et le dit dans `nfsmw-stdout.log`.

| Fichier | Rôle |
|---|---|
| `batocera/toolchain-aarch64-linux.cmake` | Compilation croisée clang 20 + lld, réglée pour le Cortex-A77 |
| `batocera/toolchain-x86_64-linux.cmake` | Compilation pour PC, clang 20 + lld, x86-64-v3 (AVX2) |
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
