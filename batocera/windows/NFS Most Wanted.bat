@echo off
rem NFS Most Wanted (Xbox 360, recompile) pour Windows / RetroBat : lance nfsmw.exe (a cote de ce fichier).
rem Le jeu est pris d'abord dans le dossier Batocera "NFS Most Wanted.sh" (roms\ports\, avec ses mods), sinon dans game_root\ a cote de ce fichier
rem (..\NFS Most Wanted.sh\, ou le dossier parent si ce fichier est dans NFS Most Wanted.sh\bin\x86_64-windows\) :
rem pas de copie en double : les sauvegardes (data\, saves\) et les mods sont ceux de ce dossier.
rem Pas de blocs entre parentheses : un chemin avec "(Windows)" les casserait.
setlocal
set "ICI=%~dp0"
set "JEU="
rem chemin_du_jeu.txt (a cote de ce fichier) : le dossier du jeu sur une ligne, par exemple
rem D:\batocera\roms\ports\NFS Most Wanted.sh
if exist "%ICI%chemin_du_jeu.txt" set /p JEU=<"%ICI%chemin_du_jeu.txt"
if defined JEU if not exist "%JEU%\game_root\default.xex" echo chemin_du_jeu.txt : pas de game_root\default.xex dans "%JEU%"
if defined JEU if not exist "%JEU%\game_root\default.xex" set "JEU="
if not defined JEU if exist "%ICI%..\NFS Most Wanted.sh\game_root\default.xex" set "JEU=%ICI%..\NFS Most Wanted.sh"
rem RetroBat : ce dossier dans roms\windows\, le jeu dans roms\ports\NFS Most Wanted.sh
if not defined JEU if exist "%ICI%..\..\ports\NFS Most Wanted.sh\game_root\default.xex" set "JEU=%ICI%..\..\ports\NFS Most Wanted.sh"
if not defined JEU if exist "%ICI%..\..\game_root\default.xex" set "JEU=%ICI%..\.."
rem En dernier seulement : une copie du jeu dans game_root\ a cote de ce fichier (sans les mods de ports\).
if not defined JEU if exist "%ICI%game_root\default.xex" set "JEU=%ICI%."
if defined JEU goto trouve
echo Jeu introuvable : copiez default.xex, NFS\ et Movies\ dans game_root\ (voir LISEZMOI.txt),
echo ou mettez ce dossier a cote de "NFS Most Wanted.sh" (le dossier Batocera),
echo ou ecrivez le chemin de "NFS Most Wanted.sh" dans chemin_du_jeu.txt a cote de ce fichier.
echo Ce fichier est dans : %ICI%
pause
exit /b 1
:trouve
for %%I in ("%JEU%") do set "JEU=%%~fI"
echo Jeu : %JEU%
rem Reglages : ceux du dossier du jeu s'il en a.
if exist "%JEU%\nfsmw.toml" copy /y "%JEU%\nfsmw.toml" "%ICI%nfsmw.toml" >nul
rem La bibliotheque de shaders doit etre a cote de nfsmw.exe (une partie du jeu, dont les videos, ne cherche que la).
if exist "%JEU%\game_root\nfsmw_shaders.nfsp" copy /y "%JEU%\game_root\nfsmw_shaders.nfsp" "%ICI%nfsmw_shaders.nfsp" >nul
if not exist "%JEU%\game_root\nfsmw_shaders.nfsp" if exist "%JEU%\nfsmw_shaders.nfsp" copy /y "%JEU%\nfsmw_shaders.nfsp" "%ICI%nfsmw_shaders.nfsp" >nul
rem Avec la VF de la page (Movies\movies_report.txt), le francais est dans l'emplacement anglais : langue 0.
set "LANGUE="
if exist "%JEU%\game_root\Movies\movies_report.txt" set "LANGUE=--nfsmw_idioma=0"
rem Clavier (sans manette), comme la version PC d'origine : fleches pour conduire (haut accelere, bas freine) et
rem pour les menus, Maj = nitro, Ctrl = Speedbreaker, Espace = frein a main, Echap = pause, Entree valide, Retour
rem arriere revient, C = camera, X = regarder derriere. Sur la manette 360 : nitro A, frein a main B, Speedbreaker X
rem (le jeu : "Press X to activate Speedbreaker"), regard arriere Y, camera Back. Les touches sont lues a leur place
rem QWERTY : celles-ci sont au meme endroit sur un clavier AZERTY.
set TOUCHES="--mnk_modificadores_exactos=false"
set TOUCHES=%TOUCHES% "--keybind_lstick_up=Up" "--keybind_lstick_down=Down" "--keybind_lstick_left=Left" "--keybind_lstick_right=Right"
set TOUCHES=%TOUCHES% "--keybind_right_trigger=Up" "--keybind_left_trigger=Down"
set TOUCHES=%TOUCHES% "--keybind_a=Return,Shift" "--keybind_b=Space,Backspace" "--keybind_x=Control" "--keybind_y=X"
set TOUCHES=%TOUCHES% "--keybind_start=Escape,Return" "--keybind_back=C,Tab"
set TOUCHES=%TOUCHES% "--keybind_dpad_up=Home" "--keybind_dpad_down=End" "--keybind_dpad_left=Delete" "--keybind_dpad_right=PageDown"
set TOUCHES=%TOUCHES% "--keybind_rstick_up=I" "--keybind_rstick_down=K" "--keybind_rstick_left=J" "--keybind_rstick_right=L"
rem Synchronisation avec la console (partage reseau \\BATOCERA\share = /userdata), seulement si un fichier
rem synchro_console.txt est a cote de ce lanceur (vide, ou avec le partage d'une autre console sur une ligne, par
rem exemple \\RETROID\share) : ses mods recopies a l'identique, les sauvegardes les plus recentes des deux cotes
rem (data\, saves\ ; sans les fichiers de travail de mods.py) et ses options NFS dans options-console.txt.
rem Console eteinte : on joue avec ce qui est deja la.
set "SYNCHRO=non"
if not exist "%ICI%synchro_console.txt" goto options
set "CONSOLE="
set /p CONSOLE=<"%ICI%synchro_console.txt"
if not defined CONSOLE set "CONSOLE=\\BATOCERA\share"
set "RETROID=%CONSOLE%\roms\ports\NFS Most Wanted.sh"
if /i "%JEU%"=="%RETROID%" goto options
if not exist "%RETROID%\game_root\default.xex" goto options
set "SYNCHRO=oui"
echo Synchronisation avec la console...
robocopy "%RETROID%\mods" "%JEU%\mods" /MIR /R:1 /W:1 /NP /NJH /NJS /NDL >nul
robocopy "%RETROID%\data" "%JEU%\data" /E /XO /R:1 /W:1 /XD mods-cache mods-originals cache /XF mods-state.json /NP /NJH /NJS /NDL >nul
robocopy "%RETROID%\saves" "%JEU%\saves" /E /XO /R:1 /W:1 /NP /NJH /NJS /NDL >nul
if exist "%CONSOLE%\system\batocera.conf" findstr /c:"nfsmw_" "%CONSOLE%\system\batocera.conf" > "%JEU%\options-console.txt"
:options
rem Options NFS de la console (BLACK EDITION, ICONES DES BOUTONS) : options-console.txt de la derniere synchronisation,
rem ou system\batocera.conf si ce dossier est dans une copie de /userdata. Sinon : pas de Black Edition, icones PlayStation.
set "CONF=%JEU%\options-console.txt"
if not exist "%CONF%" set "CONF=%JEU%\..\..\..\system\batocera.conf"
set "BE=off"
set "STYLE="
if exist "%CONF%" findstr /c:"nfsmw_black_edition=on" "%CONF%" >nul 2>&1 && set "BE=on"
rem Sans batocera.conf : un fichier black_edition.txt (vide) a cote de ce lanceur active la Black Edition.
if exist "%ICI%black_edition.txt" set "BE=on"
if exist "%CONF%" for /f "tokens=2 delims==" %%S in ('findstr /c:"nfsmw_icons=" "%CONF%"') do set "STYLE=%%S"
rem Le style choisi dans l'ecran Mods du jeu (menu principal > Mods) passe avant les options de la console.
call :choix
if not defined STYLE set "STYLE=playstation"
set "BLACK="
if "%BE%"=="on" set "BLACK=--nfsmw_black_edition"
rem Mods (comme run.sh sur Batocera) : mods.py remet ce que le dernier lancement avait change, les icones du style
rem choisi vont dans game_root\GLOBAL\, puis mods\<nom>\ est applique (MX-5...), la Black Edition en dernier et
rem seulement avec son option. Les mods decoches dans le menu du jeu (L + R + Droite ou F4, onglet Mods :
rem mods\desactives.txt) sont sautes. Python est fourni dans python\ (Windows n'en a pas), mods.py et jdlz.py a cote.
set "PY=%ICI%python\python.exe"
set "JOURNAL=%ICI%nfsmw-launcher.log"
echo [windows] %DATE% %TIME% jeu "%JEU%", synchro console %SYNCHRO%, icones %STYLE%, Black Edition %BE% (options : %CONF%) > "%JOURNAL%"
if not exist "%JEU%\data" mkdir "%JEU%\data"
echo [windows] options : %LANGUE% %BLACK% >> "%JOURNAL%"
rem Le bouton Relancer du menu Mods termine le jeu avec le code 3 : mods appliques a nouveau et jeu relance.
set "NFSMW_RELANCE=1"
rem Le style d'icones, pour les boutons affiches dans l'ecran Mods du jeu.
set "NFSMW_ICONOS=%STYLE%"
:lancer
call :mods
rem Le style a pu changer dans l'ecran Mods avant le bouton Relancer.
call :choix
set "NFSMW_ICONOS=%STYLE%"
start "" /wait "%ICI%nfsmw.exe" --game_data_root="%JEU%\game_root" --user_data_root="%JEU%\data" --content_backup_root="%JEU%\saves" %LANGUE% %BLACK% %TOUCHES% %*
if errorlevel 3 if not errorlevel 4 echo [windows] relance avec les mods choisis dans le menu >> "%JOURNAL%"
if errorlevel 3 if not errorlevel 4 goto lancer
rem Avec la console : les sauvegardes plus recentes renvoyees vers elle.
if not "%SYNCHRO%"=="oui" exit /b 0
if not exist "%RETROID%\game_root\default.xex" exit /b 0
robocopy "%JEU%\data" "%RETROID%\data" /E /XO /R:1 /W:1 /XD mods-cache mods-originals cache /XF mods-state.json /NP /NJH /NJS /NDL >nul
robocopy "%JEU%\saves" "%RETROID%\saves" /E /XO /R:1 /W:1 /NP /NJH /NJS /NDL >nul
echo [windows] sauvegardes renvoyees vers la console >> "%JOURNAL%"
exit /b 0

:mods
if not exist "%PY%" exit /b 0
if not exist "%ICI%mods.py" exit /b 0
"%PY%" "%ICI%mods.py" restore "%JEU%" >> "%JOURNAL%" 2>&1
call :icones GLOBALB.LZC
call :icones GLOBALMEMORYFILE.BIN
call :icones DYNTEX.BIN
"%PY%" "%ICI%mods.py" apply "%JEU%" %STYLE% %BE% >> "%JOURNAL%" 2>&1
rem Les icones telles que le jeu va les charger, pour y echanger les touches du clavier pendant le jeu.
"%PY%" "%ICI%mods.py" icons "%JEU%" >> "%JOURNAL%" 2>&1
exit /b 0

:icones
rem %1 : un fichier du style d'icones dans game_root\GLOBAL\ (absent du style : celui du jeu, dans ses archives).
if not exist "%JEU%\mods\icones\%STYLE%" exit /b 0
if exist "%JEU%\mods\icones\%STYLE%\%1" copy /y "%JEU%\mods\icones\%STYLE%\%1" "%JEU%\game_root\GLOBAL\%1" >nul
if not exist "%JEU%\mods\icones\%STYLE%\%1" if exist "%JEU%\game_root\GLOBAL\%1" del "%JEU%\game_root\GLOBAL\%1"
exit /b 0

:choix
rem mods\icones\choix.txt (ecran Mods du jeu) : un style de manette, ou "clavier" (touches du PC tout le temps,
rem les fichiers du style de manette restent).
set "CHOIX="
set "NFSMW_CLAVIER="
if exist "%JEU%\mods\icones\choix.txt" set /p CHOIX=<"%JEU%\mods\icones\choix.txt"
if not defined CHOIX exit /b 0
if /i "%CHOIX%"=="clavier" set "NFSMW_CLAVIER=1"
if /i "%CHOIX%"=="clavier" exit /b 0
if exist "%JEU%\mods\icones\%CHOIX%" set "STYLE=%CHOIX%"
exit /b 0
