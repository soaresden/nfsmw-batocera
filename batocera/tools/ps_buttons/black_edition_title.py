"""The Black Edition title screen, from the player's own FRONTEND/FRONTB.LZC (agreed design, 16/11/2026).

    python3 black_edition_title.py --frontb FRONTB.LZC --out titre.png [--texture texture.png]

The game's widescreen title background (WS_MWSPLASHBACK, 512x512, stretched to 16:9 by the game) in silver black and
white, as the Black Edition cover is the regular one in black and white; a light steel blue on the M3's paint; the
police lights red and blue, gently; a sprayed "Black Edition" tag (Sedgwick Ave Display, OFL, with drips and a red
overspray) on the black ink at the top right. --out is the 1280x720 view, --texture the 512x512 picture to put back in
FRONTB.LZC.

The Xbox 360 game shows WS_XENON_SPLASHBACK of GLOBAL/GLOBALB.LZC (1024x512 DXT5, the picture in 900x480 at 62,16)
behind "Press Start", not the FRONTB.LZC pictures: --zip writes the mod for NFS Most Wanted.sh/mods/black-edition/
with the three pictures (FRONTB's WS_MWSPLASHBACK and DEMO_SPLASH, GLOBALB's WS_XENON_SPLASHBACK) as patches
(<file>.patch, applied by mods.py over whatever file the icons and the other mods left there) and as whole files
made from the player's own FRONTB.LZC and GLOBALB.LZC (used when the game reads them from its archives).

    python3 black_edition_title.py --frontb FRONTB.LZC --globalb GLOBALB.LZC --zip black-edition.zip
"""
import argparse
import io
import os
import struct
import sys
import zipfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gamelist_media as gm  # noqa: E402
import jdlz  # noqa: E402
import ps_buttons as pb  # noqa: E402
import xenos  # noqa: E402

FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'SedgwickAveDisplay-Regular.ttf')
W, H = 1280, 720


def black_and_white(src):
    a = np.asarray(src).astype(np.float32) / 255
    l = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    l = np.clip((l - 0.04) / 0.86, 0, 1)
    l = l * l * (3 - 2 * l) * 0.75 + l * 0.25          # S curve: deep blacks, bright silver
    img = Image.fromarray((np.clip(np.stack([l * 0.98, l * 0.99, l * 1.02], -1), 0, 1) * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.UnsharpMask(2, 60, 2))).astype(np.float32) / 255


def blue_car_and_police(bw):
    lum = bw.mean(-1)
    car = Image.new('L', (W, H), 0)
    ImageDraw.Draw(car).polygon([(135, 495), (150, 465), (250, 408), (430, 368), (520, 300), (650, 284), (790, 290),
                                 (880, 330), (950, 380), (958, 470), (930, 500), (640, 598), (330, 640), (150, 610)],
                                fill=255)
    car = np.asarray(car.filter(ImageFilter.GaussianBlur(8))).astype(np.float32) / 255
    body = car * np.clip((0.62 - lum) / 0.4, 0, 1)
    steel = np.stack([lum * 0.62, lum * 0.85, np.clip(lum * 1.45 + 0.06, 0, 1)], -1)
    k = 0.38 * body[..., None]
    out = bw * (1 - k) + steel * k
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    for x, y, col, rad in ((985, 335, (0.15, 0.35, 1.0), 45), (1045, 345, (1.0, 0.08, 0.06), 40),
                           (1150, 340, (0.15, 0.35, 1.0), 45), (1212, 345, (1.0, 0.08, 0.06), 45)):
        r2 = (X - x) ** 2 + (Y - y) ** 2
        glow = 0.32 * np.exp(-r2 / (2 * rad ** 2)) + 0.35 * np.exp(-r2 / (2 * (rad / 4) ** 2))
        out = out + glow[..., None] * np.array(col)[None, None]
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def tag(width=500):
    rng = np.random.default_rng(3)
    font = ImageFont.truetype(FONT, 118)
    text, stroke = 'Black Edition', 9
    w = int(font.getlength(text)) + 4 * stroke + 40
    h = int(118 * 1.9) + 80
    fill = Image.new('L', (w, h), 0)
    ImageDraw.Draw(fill).text((2 * stroke + 20, 30), text, font=font, fill=255)
    outline = Image.new('L', (w, h), 0)
    ImageDraw.Draw(outline).text((2 * stroke + 20, 30), text, font=font, fill=255, stroke_width=stroke, stroke_fill=255)
    a = np.asarray(outline)
    cols = np.where(a.max(0) > 200)[0]
    d = ImageDraw.Draw(outline)
    for x in rng.choice(cols, 7, replace=False):       # paint drips
        y = np.where(a[:, x] > 200)[0].max()
        n, wd = int(rng.integers(20, 60)), int(rng.integers(3, 6))
        d.line((x, y, x, min(h - 6, y + n)), fill=255, width=wd)
        d.ellipse((x - wd, y + n - wd, x + wd, y + n + wd), fill=255)
    size = (w, h)
    red = outline.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.85))
    layer = Image.merge('RGBA', [Image.new('L', size, 200), Image.new('L', size, 10), Image.new('L', size, 20), red])
    layer = Image.alpha_composite(layer, Image.merge('RGBA', [Image.new('L', size, 8)] * 3 + [outline]))
    paint = Image.fromarray((rng.random((h, w)) * 60 + 195).astype(np.uint8))
    layer = Image.alpha_composite(layer, Image.merge('RGBA', [paint, paint, paint, fill]))
    layer = layer.rotate(5, resample=Image.BICUBIC, expand=True)
    return layer.resize((width, int(layer.height * width / layer.width)), Image.LANCZOS)


def title(frontb):
    fe = jdlz.decompress(frontb)
    src = gm.picture(fe, pb.find_textures(fe), 'WS_MWSPLASHBACK').convert('RGB').resize((W, H), Image.LANCZOS)
    img = blue_car_and_police(black_and_white(src)).convert('RGBA')
    t = tag()
    img.alpha_composite(t, (W - t.width - 30, 25))
    return img.convert('RGB')


def dxt_linear(img, fmt):
    """PIL image -> linear DXT1 / DXT5 blocks (as ps_buttons.dxt5_linear, with the FourCC check for old Pillow)."""
    b = io.BytesIO()
    try:
        img.save(b, 'DDS', pixel_format=fmt)
        data = b.getvalue()
    except (OSError, ValueError, KeyError, TypeError):
        data = b''
    if data[84:88] != fmt.encode():
        import dxt
        return dxt.encode(img, fmt)
    w, h = img.size
    return data[128:128 + max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * (8 if fmt == 'DXT1' else 16)]


def dxt_tiled(img, size, mips, fmt):
    """A colour picture -> the 360's tiled DXT1 / DXT5 texture with its mips, `size` bytes."""
    bpb = 8 if fmt == 'DXT1' else 16
    out = bytearray(size)
    for w, h, off, bx, by in pb.mip_layout(img.width, img.height, mips):
        if bpb == 8:  # pb.mip_layout counts 16-byte blocks
            off //= 2
        lin = dxt_linear(img.resize((w, h), Image.LANCZOS).convert('RGBA'), fmt)
        wb, hb = (w + 3) // 4, (h + 3) // 4
        blocks = np.frombuffer(lin, np.uint8)[:wb * hb * bpb].reshape(-1, 2)[:, ::-1].reshape(-1, bpb)
        aw = (max(wb, 32) + 31) & ~31
        for y in range(hb):
            for x in range(wb):
                t = xenos.tiled_offset(bx + x, by + y, aw, bpb)
                out[off + t * bpb:off + t * bpb + bpb] = blocks[y * wb + x].tobytes()
    return bytes(out)


def framed(img, size, box):
    """`img` stretched into `box` (x, y, w, h) of a black picture of `size`."""
    out = Image.new('RGB', size, (0, 0, 0))
    out.paste(img.convert('RGB').resize(box[2:], Image.LANCZOS), box[:2])
    return out


PATCH_MAGIC = b'NFSMWPAT'


def patch(data, pictures):
    """<file>.patch for mods.py: magic, decompressed size, count, then (offset, size, bytes) per texture."""
    out = PATCH_MAGIC + struct.pack('<II', len(data), len(pictures))
    for off, b in pictures:
        out += struct.pack('<II', off, len(b)) + b
    return out


def textures(frontb, globalb, log=print):
    """{file: (its JDLZ blob, its decompressed data, [(offset, new texture bytes)])} of the three pictures."""
    be = title(frontb)
    out = {}
    fe = jdlz.decompress(frontb)
    f = pb.find_textures(fe)
    ws, demo = f['WS_MWSPLASHBACK'], f['DEMO_SPLASH']
    out['FRONTEND/FRONTB.LZC'] = (frontb, fe, [
        (ws['start'], pb.argb32_encode(be.resize((512, 512), Image.LANCZOS),
                                       fe[ws['start']:ws['start'] + ws['size']])),
        (demo['start'], dxt_tiled(framed(be, (1024, 512), (0, 41, 1024, 391)), demo['size'], demo['mips'], 'DXT1'))])
    gl = jdlz.decompress(globalb)
    g = pb.find_textures(gl)['WS_XENON_SPLASHBACK']
    out['GLOBAL/GLOBALB.LZC'] = (globalb, gl, [
        (g['start'], dxt_tiled(framed(be, (1024, 512), (62, 16, 900, 480)), g['size'], g['mips'], 'DXT5'))])
    return out


LISEZMOI = """Ecran titre Black Edition pour NFS Most Wanted (Batocera)

Ce zip tel quel (sans le decompresser) dans NFS Most Wanted.sh/mods/black-edition/
Applique seulement avec l'option BLACK EDITION, par-dessus les icones et les autres mods (MX-5...).
Le premier lancement avec une nouvelle combinaison (icones, mods) prend quelques secondes de plus.
Fait a partir de VOTRE copie du jeu : ne le partagez pas.
"""


def mod_zip(frontb, globalb, log=print):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, (blob, data, pics) in textures(frontb, globalb, log).items():
            new = bytearray(data)
            for off, t in pics:
                new[off:off + len(t)] = t
            whole = jdlz.splice_to_fit(blob, bytes(new), [(o, o + len(t)) for o, t in pics], len(blob))
            if whole is None:
                raise ValueError(name + ': does not fit in its original size')
            log('%s: %d bytes (original %d)' % (name, len(whole), len(blob)))
            z.writestr(name, whole)
            z.writestr(name + '.patch', patch(data, pics))
        z.writestr('LISEZMOI.txt', LISEZMOI)
    return b.getvalue()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--frontb', required=True)
    ap.add_argument('--globalb', help='GLOBAL/GLOBALB.LZC, for --zip')
    ap.add_argument('--zip', help='the mods/black-edition/ zip to write')
    ap.add_argument('--out', help='1280x720 view')
    ap.add_argument('--texture', help='512x512 picture for WS_MWSPLASHBACK')
    a = ap.parse_args()
    if a.zip:
        open(a.zip, 'wb').write(mod_zip(open(a.frontb, 'rb').read(), open(a.globalb, 'rb').read()))
        print(a.zip)
    if not a.out:
        return
    img = title(open(a.frontb, 'rb').read())
    img.save(a.out)
    if a.texture:
        img.resize((512, 512), Image.LANCZOS).save(a.texture)
    print(a.out)


if __name__ == '__main__':
    main()
