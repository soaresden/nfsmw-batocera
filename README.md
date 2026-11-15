# NFSMW pour Batocera (Retroid Pocket 5)

**Need for Speed: Most Wanted (2005, version Xbox 360)** en natif sous **Batocera Linux ARM64**, visé sur la
**Retroid Pocket 5** (Snapdragon 865, GPU Adreno 650, Vulkan via Mesa Turnip).

Ce n'est pas un émulateur : le code PowerPC du `default.xex` est recompilé en C++ avec
[ReXGlue](https://github.com/rexglue/rexglue-sdk) puis compilé pour Linux aarch64. Le jeu est dessiné par le
renderer Vulkan natif du port.

> [!WARNING]
> **Expérimental.** Le jeu n'a pas encore tourné sous Batocera. Le code vient d'un port Android qui marche sur la
> même machine, mais le système, le pilote graphique et le fenêtrage ne sont pas les mêmes.

> [!NOTE]
> Il faut **votre propre copie** du jeu Xbox 360, édition **PAL Espagne** (la même que le port Android). Ce dépôt ne
> contient aucun fichier du jeu ni rien de généré à partir de lui.

## Deux voies

| Voie | Ce que c'est | État |
|---|---|---|
| **A. SpeedBreaker** (recommandée pour commencer) | [SpeedBreaker](https://github.com/SpeedBreakerProject/speedbreaker), une autre recompilation du même jeu Xbox 360, publie déjà une version **Linux arm64**, faite pour le Steam Frame (Snapdragon, Adreno, Mesa Turnip). Ce dépôt l'emballe pour Batocera : `speedbreaker/` | Paquet prêt, à essayer sur la RP5 |
| **B. Ce port** (nfsmw-nx → Android Evolved → Linux) | Notre propre build aarch64 à partir du fork Android, qui tourne déjà sur la RP5 sous Android : `batocera/` | Le SDK compile pour aarch64 ; le jeu attend le `default.xex` |

### Voie A : SpeedBreaker

```sh
speedbreaker/make_package.sh            # télécharge SpeedBreaker arm64 et fait out/nfsmw-speedbreaker-batocera.zip
```

1. Décompressez `nfsmw-speedbreaker-batocera.zip` dans `/userdata/roms/ports/`.
2. Copiez votre jeu dans `/userdata/roms/ports/speedbreaker/disc/` : le disque extrait (`default.xex`, `NFS/`,
   `Movies/`, par exemple ceux du dossier `nsfmw-androidevolved/` de l'app Android) ou une image `.iso`. Disques
   acceptés par SpeedBreaker : USA et PAL Espagne.
3. Mettez à jour la liste des jeux, puis lancez **SpeedBreaker** dans **Ports**. Le premier lancement vérifie et
   installe le jeu dans `speedbreaker/data/game` (une ou deux minutes, écran noir), puis il démarre.

Les journaux sont `speedbreaker/batocera-launch.log` (le lanceur) et `speedbreaker/last-run.log` (le jeu).
Le menu de SpeedBreaker s'ouvre avec **Back + Start** ; **Hotkey + Start** quitte.

SpeedBreaker arm64 demande glibc 2.38 et la libstdc++ de GCC 15 (`GLIBCXX_3.4.34`). Si celle de Batocera est plus
ancienne, `speedbreaker.sh` prend automatiquement celle de `lib/cxx/` que le paquet ajoute.

## D'où vient ce port

| Projet | Apport |
|---|---|
| [StevensND/nfsmw-nx](https://github.com/StevensND/nfsmw-nx) | La recompilation, le renderer natif et le port Switch |
| [codepdbh/nfsmw-android](https://github.com/codepdbh/nfsmw-android) (NFSMW Android Evolved) | Le passage à l'ARM64 générique avec SDL3, Vulkan 1.1 et les correctifs Adreno/Turnip. Ce dépôt part de sa version 0.8.2 |
| Ce dépôt | La cible Linux aarch64, la compilation croisée et le paquet « Ports » de Batocera |

Le README d'origine du port Android est dans [README.android.md](README.android.md).

## Installation sur la console

1. Construisez le paquet (voir [Compilation](#compilation)) : il sort dans `out/batocera/`.
2. Copiez **le contenu** de `out/batocera/` dans `/userdata/roms/ports/` (partage réseau `\\BATOCERA\share\roms\ports`
   ou carte SD).
3. Copiez les fichiers de votre jeu dans `/userdata/roms/ports/nfsmw/game_root/`. Si le port Android tourne déjà sur
   la Retroid, ce sont ceux du dossier `nsfmw-androidevolved/` du stockage interne :

   ```text
   /userdata/roms/ports/
     NFS Most Wanted.sh          (lanceur, visible dans « Ports »)
     NFS Most Wanted.sh.keys     (Hotkey + Start pour quitter)
     nfsmw/
       nfsmw                     (le jeu)
       nfsmw.toml                (réglages)
       lib/
       game_root/
         default.xex
         NFS/
         Movies/
         nfsmw_shaders.nfsp      (celle générée par l'app Android)
   ```

4. Dans EmulationStation : **Menu → Paramètres du jeu → Mettre à jour la liste des jeux**, puis lancez
   *NFS Most Wanted* dans **Ports**.

Le journal du jeu se trouve dans `nfsmw/nfsmw-stdout.log`. **Envoyez-le à chaque essai** : il dit ce qui manque.

> [!CAUTION]
> **La première course compile les pipelines graphiques**, donc elle saccade quelques secondes. Ils sont ensuite
> gardés dans `nfsmw/cache/mesa`.

## Commandes

Les boutons sont ceux de la manette Xbox 360 : **A** valide, **B** revient, **ZR/ZL** pour accélérer et freiner,
**+/Start** pour la pause. **Hotkey + Start** quitte le jeu. Le menu de debug s'ouvre avec **L + R + Droite**.

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
| `batocera/toolchain-aarch64-linux.cmake` | Compilation croisée clang + lld, réglée pour le Cortex-A77, libstdc++ statique |
| `batocera/build.sh` | Les quatre étapes, du `default.xex` au paquet |
| `batocera/package.sh` | Le dossier Ports : binaire, bibliothèques, réglages, lanceur |
| `batocera/port/` | Le lanceur `.sh` et sa touche de sortie (`.keys`) |
| `batocera/nfsmw.toml` | Les réglages de départ |
| `app/src/nfsmw_nucleos_grandes.cpp` | Les threads du jeu sur les cœurs rapides (A77), repris du port Android |

## Licence

GPL-3.0, héritée de NFSMW Recompiled, nfsmw-nx et NFSMW Android Evolved (voir [LICENSE](LICENSE) et
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). Ce projet n'a aucun lien avec Electronic Arts. « Need for
Speed » est une marque d'Electronic Arts Inc.
