"""The Black Edition title screen, from the player's own FRONTEND/FRONTB.LZC (agreed design, 16/11/2026).

    python3 black_edition_title.py --frontb FRONTB.LZC --out titre.png [--texture texture.png]

The game's widescreen title background (WS_MWSPLASHBACK, 512x512, stretched to 16:9 by the game) in silver black and
white, as the Black Edition cover is the regular one in black and white; a light steel blue on the M3's paint; the
police lights red and blue, gently; a sprayed "Black Edition" tag (Sedgwick Ave Display, OFL, with drips and a red
overspray) on the black ink at the top right. --out is the 1280x720 view, --texture the 512x512 picture to put back in
FRONTB.LZC (to do: the in-game switch with the BLACK EDITION option, merged with the MX-5's FRONTB.LZC).
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gamelist_media as gm  # noqa: E402
import jdlz  # noqa: E402
import ps_buttons as pb  # noqa: E402

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


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--frontb', required=True)
    ap.add_argument('--out', required=True, help='1280x720 view')
    ap.add_argument('--texture', help='512x512 picture for WS_MWSPLASHBACK')
    a = ap.parse_args()
    img = title(open(a.frontb, 'rb').read())
    img.save(a.out)
    if a.texture:
        img.resize((512, 512), Image.LANCZOS).save(a.texture)
    print(a.out)


if __name__ == '__main__':
    main()
