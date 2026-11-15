# Boutons PlayStation

Remplace les icônes de boutons Xbox du jeu (A B X Y, LB RB, LT RT) par des icônes PlayStation (✕ ○ □ △, L1 R1,
L2 R2), **par position** comme sur une manette PlayStation.

Le jeu dessine ses boutons avec des textures aux noms hérités de la PS2 (`CROSS`, `CIRCLE`, `SQUARE`,
`TRIANGLE`, `L1`, `R1`…), qui contiennent les icônes Xbox sur la 360. Elles sont dans le second pack de
textures de `GLOBAL/GLOBALB.LZC`, préchargé aussi depuis `GLOBAL/GLOBALMEMORYFILE.BIN` : l'outil réécrit les
deux, aux mêmes tailles, sans toucher au reste (une MX-5 ou un autre mod de `GLOBALMEMORYFILE.BIN` est gardé).

```sh
python3 ps_buttons.py --globalb GLOBALB.LZC --memfile GLOBALMEMORYFILE.BIN --out <game_root> --preview icones.png
```

- `GLOBALB.LZC` : tiré des archives avec `../Extraire textures NFSMW.sh`.
- `GLOBALMEMORYFILE.BIN` : celui que le jeu utilise (un fichier séparé dans `game_root/GLOBAL/` si un mod l'y a
  mis, sinon celui des archives).

Copiez ensuite le dossier `GLOBAL/` produit dans `game_root/` et réglez les boutons **par position**
(`input_sdl_por_letra = false`, ou dans Batocera : BOUTONS A/B X/Y = Par position) : le bouton du bas est ✕.

Les fichiers produits contiennent des données du jeu : ne les partagez pas. Les modules `jdlz.py`, `tpk.py`,
`huff.py`, `xenos.py` et `dxt.py` viennent de [MazdaMx5-nd-rf-ingames](https://github.com/soaresden/MazdaMx5-nd-rf-ingames)
(GPL-3.0). Inspiré des packs d'icônes de [NFS XtendedInput](https://github.com/xan1242/NFS-XtendedInput) pour
la version PC.
