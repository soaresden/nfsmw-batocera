# Petits outils de rétro-ingénierie

Sur l'image décodée de l'exécutable (`out/editions/pal_es.img`, faite par `tools/editions/regional/imagen.py`,
base 0x82000000) :

- `xref.py <image> <hex>...` : les instructions dont `lis` + `addi`/`ori`/chargement forment ces adresses ou
  constantes (chaînes, globales, hashes de textes ou de textures).
- `dis.py <image> <début> <fin>` : désassemblage (llvm-mc-20, PowerPC) avec les constantes `lis`/`addi` résolues,
  les chaînes pointées et les cibles des branchements.

C'est avec eux qu'ont été trouvés le menu principal (`sub_82237900`, entrées à 76 octets), la recherche de textes
(`sub_822BCE60`), le React de l'entrée Xbox Live (`sub_82237080`) et le rechargement de `MainMenu.fng`
(`sub_82284928`) : voir `app/src/nfsmw_menu_mods.cpp`.
