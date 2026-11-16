# Icônes des boutons : PlayStation, GameCube, Xbox 360

Remplace les icônes de boutons Xbox du jeu (A B X Y, LB RB, LT RT) par des icônes PlayStation (✕ ○ □ △, L1 R1,
L2 R2), **par position** comme sur une manette PlayStation.

Le jeu dessine ses boutons avec des textures aux noms hérités de la PS2 (`CROSS`, `CIRCLE`, `SQUARE`,
`TRIANGLE`, `L1`, `R1`…), qui contiennent les icônes Xbox sur la 360. Elles sont dans le second pack de
textures de `GLOBAL/GLOBALB.LZC`, préchargé aussi depuis `GLOBAL/GLOBALMEMORYFILE.BIN` : l'outil réécrit les
deux, aux mêmes tailles, sans toucher au reste (une MX-5 ou un autre mod de `GLOBALMEMORYFILE.BIN` est gardé).

```sh
python3 ps_buttons.py --globalb GLOBALB.LZC --memfile GLOBALMEMORYFILE.BIN --dyntex DYNTEX.BIN \
                      --out <game_root> --preview icones.png --preview-controller manette.png \
                      --zip nfsmw-boutons-playstation.zip
```

Avec `--zip`, le zip se décompresse directement par-dessus `/userdata/roms/ports/` sur Batocera
(`NFS Most Wanted.sh/game_root/GLOBAL/…`). Gardez une copie de votre `game_root/GLOBAL/` avant.

**L'image de manette** des écrans de chargement et du menu Commandes (`--dyntex`) : `GLOBAL/DYNTEX.BIN` garde
les images de toutes les plateformes faites par EA. Le jeu affiche `LOADING_CONTROLLER_X360_C1/C2` (256x256,
32 bits ARGB, 5 mips) ; l'outil y met les photos de DualShock 2 d'EA (`LOADING_CONTROLLER_PS2_C1/C2`, DXT5),
dont les traits de légende tombent aux mêmes endroits (seul celui du bouton Guide n'a pas d'équivalent).
Les images Xbox d'origine (`_XBOX_C1/C2`) sont remplacées aussi. Seules ces textures changent : l'index et
l'en-tête préchargé dans `GLOBALMEMORYFILE.BIN` restent les mêmes. L'image suit les positions PlayStation
(△ en haut), y compris avec `--retroid`.

- `GLOBALB.LZC` et `DYNTEX.BIN` : tirés des archives avec `../Extraire textures NFSMW.sh`.
- `GLOBALMEMORYFILE.BIN` : celui que le jeu utilise (un fichier séparé dans `game_root/GLOBAL/` si un mod l'y a
  mis, sinon celui des archives).

Copiez ensuite le dossier `GLOBAL/` produit dans `game_root/`, puis :

- par défaut, réglez les boutons **par position** (`input_sdl_por_letra = false`, ou dans Batocera : BOUTONS
  A/B X/Y = Par position) : le bouton du bas est ✕ ;
- avec `--retroid`, gardez les boutons **par lettre** (réglage par défaut du paquet Batocera) : les symboles sont
  dessinés pour la Retroid Pocket 5 dans ce mode : X en haut = △, Y à gauche = □, et ✕ / ○ comme par position
  (A = ✕, B = ○), réglé d'après l'essai sur la console.

Les fichiers produits contiennent des données du jeu : ne les partagez pas. Les modules `jdlz.py`, `tpk.py`,
`huff.py`, `xenos.py` et `dxt.py` viennent de [MazdaMx5-nd-rf-ingames](https://github.com/soaresden/MazdaMx5-nd-rf-ingames)
(GPL-3.0). Inspiré des packs d'icônes de [NFS XtendedInput](https://github.com/xan1242/NFS-XtendedInput) pour
la version PC.

## Les trois styles au choix dans EmulationStation

```sh
python3 ps_buttons.py --globalb GLOBALB.LZC --memfile GLOBALMEMORYFILE.BIN --dyntex DYNTEX.BIN \
                      --icon-sets nfsmw-icones-boutons.zip
```

Le zip se décompresse par-dessus `/userdata/roms/ports/` et range dans `NFS Most Wanted.sh/mods/icones/` :

| Style | Icônes | Manette (chargements, menu Commandes) | Boutons |
|---|---|---|---|
| `playstation/` | ✕ ○ □ △, L1 R1 L2 R2 | DualShock 2 d'EA | par position |
| `gamecube/` | A et B ronds, X et Y en haricot, L1 R1 L2 R2 | manette GameCube d'EA | par lettre |
| `xbox360/` | celles du jeu (seul votre `GLOBALMEMORYFILE.BIN` d'origine y est) | celle du jeu | par lettre |

Le choix se fait dans **Options avancées du jeu → NFS MOST WANTED → ICÔNES DES BOUTONS** ; le lanceur pose le
style choisi dans `game_root/GLOBAL/` à chaque lancement (PlayStation par défaut une fois les styles installés).
Les gâchettes gardent les noms imprimés sur la Retroid (L1 R1 L2 R2) en PlayStation comme en GameCube. Sur la
GameCube, les anciennes images de la manette Xbox d'origine (que la 360 n'affiche pas) restent telles quelles :
la photo GameCube n'y tient pas.
