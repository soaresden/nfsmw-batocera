@echo off
rem NFS Most Wanted (Xbox 360, recompile) pour Windows / RetroBat : lance nfsmw.exe (a cote de ce fichier).
rem Le jeu est pris dans game_root\ a cote de ce fichier, sinon dans le dossier Batocera "NFS Most Wanted.sh" voisin
rem (..\NFS Most Wanted.sh\, ou le dossier parent si ce fichier est dans NFS Most Wanted.sh\bin\x86_64-windows\) :
rem pas de copie en double, et les sauvegardes (data\, saves\) sont celles de la Retroid.
rem Pas de blocs entre parentheses : un chemin avec "(Windows)" les casserait.
setlocal
set "ICI=%~dp0"
set "JEU="
rem chemin_du_jeu.txt (a cote de ce fichier) : le dossier du jeu sur une ligne, par exemple
rem D:\batocera\roms\ports\NFS Most Wanted.sh
if exist "%ICI%chemin_du_jeu.txt" set /p JEU=<"%ICI%chemin_du_jeu.txt"
if defined JEU if not exist "%JEU%\game_root\default.xex" echo chemin_du_jeu.txt : pas de game_root\default.xex dans "%JEU%"
if defined JEU if not exist "%JEU%\game_root\default.xex" set "JEU="
if not defined JEU if exist "%ICI%game_root\default.xex" set "JEU=%ICI%."
if not defined JEU if exist "%ICI%..\NFS Most Wanted.sh\game_root\default.xex" set "JEU=%ICI%..\NFS Most Wanted.sh"
rem RetroBat : ce dossier dans roms\windows\, le jeu dans roms\ports\NFS Most Wanted.sh
if not defined JEU if exist "%ICI%..\..\ports\NFS Most Wanted.sh\game_root\default.xex" set "JEU=%ICI%..\..\ports\NFS Most Wanted.sh"
if not defined JEU if exist "%ICI%..\..\game_root\default.xex" set "JEU=%ICI%..\.."
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
rem Black Edition : son logo (GLOBAL\GLOBALA.BUN) n'est dans game_root que si mods.py l'y a mis (option BLACK EDITION).
set "BLACK="
if exist "%JEU%\game_root\GLOBAL\GLOBALA.BUN" set "BLACK=--nfsmw_black_edition"
rem ... ou l'option BLACK EDITION de Batocera, si ce dossier est dans une copie de /userdata (system\batocera.conf).
if exist "%JEU%\..\..\..\system\batocera.conf" findstr /c:"nfsmw_black_edition=on" "%JEU%\..\..\..\system\batocera.conf" >nul 2>&1 && set "BLACK=--nfsmw_black_edition"
rem Clavier (sans manette) : fleches pour les menus et la conduite (haut accelere, bas freine), Entree valide,
rem Echap ou Retour arriere revient, P met en pause. Les touches du jeu par defaut supposent un clavier QWERTY.
set TOUCHES="--keybind_lstick_up=Up" "--keybind_lstick_down=Down" "--keybind_lstick_left=Left" "--keybind_lstick_right=Right"
set TOUCHES=%TOUCHES% "--keybind_right_trigger=Up" "--keybind_left_trigger=Down"
set TOUCHES=%TOUCHES% "--keybind_a=Return,Space" "--keybind_b=Escape,Backspace" "--keybind_start=Return,P"
set TOUCHES=%TOUCHES% "--keybind_x=X" "--keybind_y=C" "--keybind_back=Tab"
set TOUCHES=%TOUCHES% "--keybind_rstick_up=I" "--keybind_rstick_down=K" "--keybind_rstick_left=J" "--keybind_rstick_right=L"
if not exist "%JEU%\data" mkdir "%JEU%\data"
start "" "%ICI%nfsmw.exe" --game_data_root="%JEU%\game_root" --user_data_root="%JEU%\data" --content_backup_root="%JEU%\saves" %LANGUE% %BLACK% %TOUCHES% %*
