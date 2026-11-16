"""Pictures for an EmulationStation gamelist entry, taken from the player's own copy of the game.

    python3 gamelist_media.py --frontb FRONTB.LZC --zip nfsmw-forgamelist.zip

FRONTEND/FRONTB.LZC (from game_root/FRONTEND/ if a mod put one there, otherwise out of the archives with
"Extraire textures NFSMW.sh") holds the game's splash pictures:
  DEMO_SPLASH       1024x512, the M3 GTR chased by the police  -> image.png (black bars cropped) and fanart.png
  WS_MWSPLASHBACK   512x512, the same scene, square            -> thumbnail.png

The zip, extracted over /userdata/roms/ports/, gives NFS Most Wanted.sh/forgamelist/ with those pictures, an empty
screenshots/ folder and LISEZMOI.txt. Nothing is written into the gamelist: each player makes their own entry.
The pictures are game artwork: do not share them.
"""
import argparse
import io
import os
import struct
import sys
import zipfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jdlz  # noqa: E402
import ps_buttons as pb  # noqa: E402
import xenos  # noqa: E402

LISEZMOI = """Images pour la fiche EmulationStation de NFS Most Wanted

Faites votre propre entree dans /userdata/roms/ports/gamelist.xml (ou avec l'editeur de metadonnees
d'EmulationStation) ; ces images sont la pour ca :

  image.png      l'ecran titre (la M3 GTR poursuivie par la police), 16:9  -> <image>
  thumbnail.png  la meme scene, carree                                     -> <thumbnail>
  fanart.png     l'ecran titre complet                                     -> <fanart>
  screenshots/   vos captures en jeu

Chemins relatifs a ports/ : ./NFS Most Wanted.sh/forgamelist/image.png, etc.

Captures en jeu : Hotkey + L1 (raccourci de Batocera). Elles arrivent dans /userdata/screenshots/ ;
copiez celles que vous voulez dans screenshots/ (ou utilisez-en une comme image.png).

Images tirees de votre propre copie du jeu : ne les partagez pas.
"""


def dxt1(px, w, h):
    lin = xenos.untile(px, w, h, 8)
    hdr = struct.pack('<4sIIIIIII44xII4sIIIIIIIIII', b'DDS ', 124, 0x81007, h, w, len(lin), 0, 1,
                      32, 4, b'DXT1', 0, 0, 0, 0, 0, 0x1000, 0, 0, 0, 0)
    im = Image.open(io.BytesIO(hdr + lin))
    im.load()
    return im.convert('RGB')


def picture(fe, found, name):
    t = found[name]
    px = bytes(fe[t['start']:t['start'] + t['size']])
    if t['comp'] == 0x20:
        return pb.argb_preview(px, t['w'], t['h']).convert('RGB')
    if t['comp'] == 0x22:
        return dxt1(px, t['w'], t['h'])
    return pb.decode(px, t['w'], t['h']).convert('RGB')


def crop_black(im, threshold=12):
    """The picture without its black bars (rows and columns darker than `threshold` on average)."""
    a = np.asarray(im).astype(np.float32).mean(axis=2)
    rows = np.where(a.mean(axis=1) > threshold)[0]
    cols = np.where(a.mean(axis=0) > threshold)[0]
    if not len(rows) or not len(cols):
        return im
    return im.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1))


def to_16_9(im):
    w, h = im.size
    if w / h > 16 / 9:
        nw = int(h * 16 / 9)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = int(w * 9 / 16)
    y = (h - nh) // 2
    return im.crop((0, y, w, y + nh))


def media(frontb):
    """The forgamelist/ folder from FRONTB.LZC: {path under NFS Most Wanted.sh/: bytes}."""
    fe = jdlz.decompress(frontb)
    found = pb.find_textures(fe)
    splash = picture(fe, found, 'DEMO_SPLASH')
    pictures = {'image.png': to_16_9(crop_black(splash)).resize((1280, 720), Image.LANCZOS),
                'fanart.png': crop_black(splash),
                'thumbnail.png': picture(fe, found, 'WS_MWSPLASHBACK')}
    out = {}
    for name, im in pictures.items():
        b = io.BytesIO()
        im.save(b, 'PNG')
        out['forgamelist/' + name] = b.getvalue()
    # A small file keeps the folder (not a dot file: Chrome's File System Access refuses those names on a real disk).
    out['forgamelist/screenshots/LISEZMOI.txt'] = ('Copiez ici vos captures (Hotkey + L1, rangees par Batocera dans '
                                                  '/userdata/screenshots/).\n').encode('utf-8')
    out['forgamelist/LISEZMOI.txt'] = LISEZMOI.encode('utf-8')
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--frontb', required=True, help='FRONTEND/FRONTB.LZC')
    ap.add_argument('--zip', required=True, help='zip to extract over /userdata/roms/ports/')
    a = ap.parse_args()
    with zipfile.ZipFile(a.zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in media(open(a.frontb, 'rb').read()).items():
            z.writestr('NFS Most Wanted.sh/' + name, data)
            print(name, len(data))
    print('zip:', a.zip)


if __name__ == '__main__':
    main()
