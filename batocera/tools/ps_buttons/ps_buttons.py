"""PlayStation button icons for NFS Most Wanted (Xbox 360 data, nfsmw-nx / Batocera port).

The front end draws its button prompts with textures whose names come from the PS2 version: CROSS, CIRCLE,
SQUARE, TRIANGLE, L1, R1... On the Xbox 360 they hold the Xbox icons (found in the second texture pack of
GLOBAL/GLOBALB.LZC, 32x32 DXT5, 2 mips, white on transparent):

    CROSS = A   TRIANGLE = B   SQUARE = X   CIRCLE = Y
    L1 = LT     L2 = LB        R1 = RT      R2 = RB      SELECT = RB   START = Start   R3 = right stick

This tool redraws them as PlayStation icons in the same style (or, with --retroid, by the Retroid Pocket 5's
places when the port's face buttons go by letter: see RETROID below), (white, ring around the face buttons) by
position, as on a PlayStation pad: A (bottom) becomes cross, B circle, X square, Y triangle; LB/RB become
L1/R1 and LT/RT L2/R2. With them, set the face buttons by position in the port (input_sdl_por_letra = false,
or BOUTONS A/B X/Y = Par position in Batocera's menu): the bottom button is cross.

GLOBALB.LZC is also preloaded from GLOBAL/GLOBALMEMORYFILE.BIN, and the game uses that copy first, so both are
written, as loose files for game_root (the game opens loose files before the archives), at their original sizes.

    python3 ps_buttons.py --globalb GLOBALB.LZC --memfile GLOBALMEMORYFILE.BIN --out <game_root>
                          [--preview icons.png]

GLOBALB.LZC: from the archives (batocera/tools/Extraire textures NFSMW.sh). GLOBALMEMORYFILE.BIN: the one the
game uses (a loose one in game_root/GLOBAL/ if a mod put it there, e.g. the MX-5, otherwise from the archives).
The output holds game data: do not share it.
"""
import argparse
import io
import os
import struct
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jdlz  # noqa: E402
import tpk  # noqa: E402
import xenos  # noqa: E402

GLOBALB_HASH = 0x4C939B36  # bStringHash("GLOBAL\GLOBALB.LZC")
MEMFILE_MAGIC = 0x53219999
SIZE = 32
WHITE = (255, 255, 255, 255)

# texture -> what to draw (by position: the Xbox button it shows -> the PlayStation one in its place)
# Retroid layout (--retroid): with the port's face buttons by letter (input_sdl_por_letra = true) on a pad
# labelled Nintendo-style (Retroid Pocket 5: A right, B bottom, X top, Y left), the Xbox A is the right
# button, B the bottom one, X the top one and Y the left one: each icon is the PlayStation symbol at that place.
RETROID = {'SQUARE': 'triangle', 'CIRCLE': 'square'}  # cross and circle stay by position (tested on the RP5)
GAMECUBE = {
    'CROSS': 'gcA',          # A: big round button
    'TRIANGLE': 'gcB',       # B: small round button
    'SQUARE': 'gcX',         # X: kidney
    'CIRCLE': 'gcY',         # Y: kidney
}
# Keyboard (style clavier): the PC keys the Windows launcher binds to each 360 button, as the game's controls screen
# lays them out (batocera/windows/NFS Most Wanted.bat): A Enter (nitro: Shift), B Backspace (handbrake: Space),
# X D (shift down), Y E (shift up), LB X (look back), RB Ctrl (Speedbreaker), LT Down, RT Up. The game swaps these in
# while the keyboard is in use (app/src/nfsmw_iconos_teclado.cpp, from ICONOS.BIN).
CLAVIER = {
    'CROSS': 'key:\u21b5',      # A: Enter
    'TRIANGLE': 'key:\u232b',   # B: Backspace
    'SQUARE': 'key:D',          # X: shift down
    'CIRCLE': 'key:E',          # Y: shift up
    'L2': 'key:X',              # LB: look back
    'R2': 'key:Ctrl',           # RB: Speedbreaker
    'SELECT': 'key:Ctrl',       # RB as well
    'L1': 'key:\u2193',         # LT: Down
    'R1': 'key:\u2191',         # RT: Up
}
TEXTURES = {
    'CROSS': 'cross',        # A
    'TRIANGLE': 'circle',    # B
    'SQUARE': 'square',      # X
    'CIRCLE': 'triangle',    # Y
    'L2': 'L1',              # LB
    'L1': 'L2',              # LT
    'R2': 'R1',              # RB
    'R1': 'R2',              # RT
    'SELECT': 'R1',          # RB as well on the 360
}


# ---------------------------------------------------------------- texture pack access

def packs(d, off=0, end=None, out=None):
    out = [] if out is None else out
    for c, b, e in tpk.iter_chunks(d, off, len(d) if end is None else end):
        if c == 0xB3300000:
            out.append((b, e))
        elif c & 0x80000000:
            packs(d, b, e, out)
    return out


def find_textures(fe):
    """name -> dict(start, size, w, h, comp, mips) for every texture of every pack."""
    found = {}
    for pb, pe in packs(fe):
        info = tpk.find(fe, 0x33310004, pb, pe)
        data = tpk.find(fe, 0x33320003, pb, pe)
        if not info or not data:
            continue
        base = (data[0] + 0xFFF) & ~0xFFF  # texture data offsets count from the data chunk aligned to 4 KiB
        for o in range(info[0], info[1], 0x7C):
            name = fe[o + 0x0C:o + 0x24].split(b'\0')[0].decode('latin-1')
            off, = struct.unpack_from('<I', fe, o + 0x30)
            size, = struct.unpack_from('<i', fe, o + 0x38)
            w, h = struct.unpack_from('<hh', fe, o + 0x44)
            found.setdefault(name, dict(start=base + off, size=size, w=w, h=h, comp=fe[o + 0x4A], mips=fe[o + 0x4E]))
    return found


def decode(data, w, h):
    lin = xenos.untile(data, w, h, 16)
    hdr = struct.pack('<4sIIIIIII44xII4sIIIIIIIIII', b'DDS ', 124, 0x81007, h, w, len(lin), 0, 1,
                      32, 4, b'DXT5', 0, 0, 0, 0, 0, 0x1000, 0, 0, 0, 0)
    im = Image.open(io.BytesIO(hdr + lin))
    im.load()
    return im.convert('RGBA')


def dxt5_linear(img):
    """PIL image -> linear DXT5 blocks, base level only (tpk360.dxt_linear of the MX-5 project)."""
    b = io.BytesIO()
    try:
        img.save(b, 'DDS', pixel_format='DXT5')
    except (OSError, ValueError, KeyError, TypeError):
        import dxt  # older Pillow: the MX-5 project's own encoder
        return dxt.encode(img, 'DXT5')
    data = b.getvalue()
    # Pillow before 11 writes uncompressed DDS and ignores pixel_format (Pyodide has 10.2): check the FourCC.
    if data[84:88] not in (b'DXT5', b'DX10') or (data[84:88] == b'DX10' and data[128] not in (77, 78)):
        import dxt
        return dxt.encode(img, 'DXT5')
    off = 128 + (20 if data[84:88] == b'DX10' else 0)
    w, h = img.size
    return data[off:off + max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * 16]


def mip_layout(w, h, mips):
    """As fe_badges.py: each level in its own tile of 32x32 blocks; a level 16 texels high sits 16 down."""
    out, off = [], 0
    for _ in range(mips):
        out.append((w, h, off, 0, 4 if h <= 16 else 0))
        wb, hb = (w + 3) // 4, (h + 3) // 4
        off += ((wb + 31) & ~31) * ((hb + 31) & ~31) * 16
        w, h = max(1, w // 2), max(1, h // 2)
    return out


def encode(img, size, mips):
    """White-on-alpha RGBA -> 360 tiled DXT5 with its mips, `size` bytes (fe_badges.encode)."""
    out = bytearray(size)
    for w, h, off, bx, by in mip_layout(img.width, img.height, mips):
        level = img.resize((w, h), Image.LANCZOS)
        alpha = level.getchannel('A')
        level = Image.new('RGBA', (w, h), WHITE)
        level.putalpha(alpha)
        lin = dxt5_linear(level)
        wb, hb = (w + 3) // 4, (h + 3) // 4
        blocks = np.frombuffer(lin, np.uint8)[:wb * hb * 16].reshape(-1, 2)[:, ::-1].reshape(-1, 16).copy()
        a = np.asarray(alpha).reshape(hb, 4, wb, 4).max(axis=(1, 3)).reshape(-1)
        blocks[a == 0] = 0
        aw = (max(wb, 32) + 31) & ~31
        for y in range(hb):
            for x in range(wb):
                t = xenos.tiled_offset(bx + x, by + y, aw, 16)
                out[off + t * 16:off + t * 16 + 16] = blocks[y * wb + x].tobytes()
    return bytes(out)


# ---------------------------------------------------------------- drawing

def font(px):
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'DejaVuSans-Bold.ttf')  # the page's copy
    for path in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', here, 'DejaVuSans-Bold.ttf', 'arialbd.ttf'):
        try:
            return ImageFont.truetype(path, px)
        except OSError:
            pass
    return ImageFont.load_default(px)


def draw_icon(kind, k=8):
    """One icon at SIZE*k, then reduced: white on transparent, like the game's own."""
    s = SIZE * k
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lw = int(2.6 * k)
    c = s / 2
    if kind in ('cross', 'circle', 'square', 'triangle'):
        r = s / 2 - 1.5 * k
        d.ellipse((c - r, c - r, c + r, c + r), outline=WHITE, width=lw)
        g = s * 0.22  # half size of the symbol
        sw = int(2.4 * k)
        if kind == 'cross':
            d.line((c - g, c - g, c + g, c + g), fill=WHITE, width=sw)
            d.line((c - g, c + g, c + g, c - g), fill=WHITE, width=sw)
        elif kind == 'circle':
            d.ellipse((c - g, c - g, c + g, c + g), outline=WHITE, width=sw)
        elif kind == 'square':
            q = g * 0.9
            d.rectangle((c - q, c - q, c + q, c + q), outline=WHITE, width=sw)
        else:
            t = g * 1.15
            pts = [(c, c - t), (c + t * 0.95, c + t * 0.62), (c - t * 0.95, c + t * 0.62)]
            d.line(pts + [pts[0]], fill=WHITE, width=sw, joint='curve')
    elif kind in ('gcA', 'gcB'):  # GameCube A and B: round buttons with their letter
        r = s / 2 - 1.5 * k
        d.ellipse((c - r, c - r, c + r, c + r), outline=WHITE, width=lw)
        d.text((c, c + 0.5 * k), kind[2], font=font(int(17 * k)), fill=WHITE, anchor='mm')
    elif kind in ('gcX', 'gcY'):  # GameCube X and Y: kidney-shaped, drawn as a pill
        m = 1.5 * k
        top = s * 0.2
        d.rounded_rectangle((m, top, s - m, s - top), radius=int(9 * k), outline=WHITE, width=lw)
        d.text((c, c + 0.5 * k), kind[2], font=font(int(15 * k)), fill=WHITE, anchor='mm')
    elif kind.startswith('key:'):  # a keyboard key: a key cap with its label, white on transparent
        label = kind[4:]
        m = 1.2 * k
        d.rounded_rectangle((m, m, s - m, s - m), radius=int(6 * k), outline=WHITE, width=int(2.2 * k))
        d.line((m + 5 * k, s - m - 4.2 * k, s - m - 5 * k, s - m - 4.2 * k), fill=WHITE, width=int(1.2 * k))
        px = 19 if len(label) == 1 else (12 if len(label) <= 3 else 10)
        d.text((c, c - 1.5 * k), label, font=font(int(px * k)), fill=WHITE, anchor='mm')
    else:  # L1/L2/R1/R2: a rounded tab with the name, as the game's LB/RB
        m = 1.5 * k
        top = s * 0.18
        d.rounded_rectangle((m, top, s - m, s - top), radius=int(6 * k), outline=WHITE, width=lw)
        f = font(int(13 * k))
        d.text((c, c + 0.5 * k), kind, font=f, fill=WHITE, anchor='mm')
    return im.resize((SIZE, SIZE), Image.LANCZOS)


# ---------------------------------------------------------------- files

def patch_globalb(blob, retroid=False, log=print, style='playstation'):
    """GLOBALB.LZC bytes -> (new bytes at the same size, [(name, before, after)])."""
    fe = bytearray(jdlz.decompress(blob))
    found = find_textures(fe)
    changed, shown = [], []
    if style == 'gamecube':
        textures = dict(TEXTURES, **GAMECUBE)
    elif style == 'clavier':
        textures = dict(CLAVIER)
    else:
        textures = dict(TEXTURES, **RETROID) if retroid else TEXTURES
    for name, kind in textures.items():
        t = found.get(name)
        if t is None:
            log('missing texture %s: skipped' % name)
            continue
        if (t['w'], t['h'], t['comp'], t['mips']) != (SIZE, SIZE, 0x26, 2):
            raise ValueError('%s: %dx%d comp %02X mips %d, expected 32x32 DXT5 with 2 mips'
                             % (name, t['w'], t['h'], t['comp'], t['mips']))
        before = decode(bytes(fe[t['start']:t['start'] + t['size']]), t['w'], t['h'])
        icon = draw_icon(kind)
        fe[t['start']:t['start'] + t['size']] = encode(icon, t['size'], t['mips'])
        changed.append((t['start'], t['start'] + t['size']))
        shown.append((name, before, decode(bytes(fe[t['start']:t['start'] + t['size']]), t['w'], t['h'])))
        log('%-8s <- %s' % (name, kind))
    new = jdlz.splice_to_fit(blob, bytes(fe), changed, len(blob))
    if new is None:
        raise ValueError('GLOBALB.LZC does not fit in its %d bytes' % len(blob))
    assert jdlz.game_decompress(new) == bytes(fe)
    log('GLOBALB.LZC: %d bytes compressed, %d allowed' % (len(new), len(blob)))
    return new + b'\0' * (len(blob) - len(new)), shown


ICON_NAMES = ('CROSS', 'TRIANGLE', 'SQUARE', 'CIRCLE', 'L1', 'L2', 'R1', 'R2', 'SELECT')
ICONOS_MAGIC = b'NFSMWICO'


def iconos_bin(globalb, extra=None):
    """ICONOS.BIN of a GLOBALB.LZC: the icon textures' bytes as the game holds them in memory (tiled DXT5, mips
    included), so that the game can find them and swap another style's in while it runs: "NFSMWICO", u32 count,
    then per texture its name (24 bytes, zero padded), u32 size and the bytes. Little endian."""
    fe = jdlz.decompress(globalb)
    found = find_textures(fe)
    out = [ICONOS_MAGIC, struct.pack('<I', 0)]
    n = 0
    for name in ICON_NAMES:
        t = found.get(name)
        if t is None:
            continue
        out += [name.encode().ljust(24, b'\0'), struct.pack('<I', t['size']), bytes(fe[t['start']:t['start'] + t['size']])]
        n += 1
    for name, data in (extra or {}).items():  # the controls screen's pictures (DYNTEX_<hash>)
        out += [name.encode().ljust(24, b'\0'), struct.pack('<I', len(data)), bytes(data)]
        n += 1
    out[1] = struct.pack('<I', n)
    return b''.join(out)


def patch_memfile(mem, globalb):
    """GLOBALMEMORYFILE.BIN with its preloaded copy of GLOBALB.LZC replaced (same size, same table)."""
    mem = bytearray(mem)
    magic, count = struct.unpack_from('<II', mem, 8)
    if magic != MEMFILE_MAGIC:
        raise ValueError('GLOBALMEMORYFILE.BIN: unexpected header')
    for i in range(count):
        h, off, mem_size, stored, _ = struct.unpack_from('<IIIII', mem, 16 + i * 20)
        if h == GLOBALB_HASH:
            if stored != len(globalb):
                raise ValueError('GLOBALMEMORYFILE.BIN holds a GLOBALB.LZC of %d bytes, not %d' % (stored, len(globalb)))
            mem[off:off + stored] = globalb
            return bytes(mem)
    raise ValueError('GLOBALMEMORYFILE.BIN has no copy of GLOBALB.LZC')


# ---------------------------------------------------------------- loading screen / controls controller

# GLOBAL/DYNTEX.BIN ("Global\\DynamicTextures.tpk", 151 textures; its header is preloaded from
# GLOBALMEMORYFILE.BIN) keeps the controller picture of every platform, as EA made them: the 360 shows
# LOADING_CONTROLLER_X360_C1/C2 (256x256, 32 bpp ARGB, 5 mips) on the loading screens and in the controls menu.
# The PS2 ones (DualShock 2 photo, DXT5) have their callout lines where the 360's are, so they take their place.
X360_C1, X360_C2 = 0xEC3C0443, 0xEC3C0444
XBOX_C1, XBOX_C2 = 0x1113B973, 0x1113B974
PS2_C1, PS2_C2 = 0xDF7B27A7, 0xDF7B27A8
GC_C1, GC_C2 = 0xED543BAB, 0xED543BAC
CONTROLLERS = {X360_C1: PS2_C1, X360_C2: PS2_C2, XBOX_C1: PS2_C1, XBOX_C2: PS2_C2}
CONTROLLERS_GAMECUBE = {X360_C1: GC_C1, X360_C2: GC_C2, XBOX_C1: GC_C1, XBOX_C2: GC_C2}


def tpk_entries(d):
    """Compressed TPK index (0x33310003): [(offset of the 24-byte entry, hash, data offset, stored size, size)]."""
    b, e = tpk.find(d, 0x33310003)
    out = []
    for o in range(b, e - 23, 24):
        h, off, size, usize, _, _ = struct.unpack_from('<IIiiII', d, o)
        out.append((o, h, off, size, usize))
    return out


def unpack(blob):
    import huff
    return huff.decompress(blob) if blob[:4] == b'HUFF' else jdlz.decompress(blob)


def argb32_level(img, w, h):
    """RGBA image -> one tiled big-endian ARGB level, padded to 32x32 texels."""
    level = np.asarray(img.resize((w, h), Image.LANCZOS).convert('RGBA'), np.uint8)
    aw, ah = (w + 31) & ~31, (h + 31) & ~31
    out = np.zeros((aw * ah, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            out[xenos.tiled_offset(x, y, aw, 4)] = level[y, x][[3, 0, 1, 2]]
    return out.tobytes()


def argb32_encode(img, original):
    """Levels 256..32 from `img`; the 16x16 tail (packed elsewhere, never visible here) kept from `original`."""
    out = bytearray(original)
    off, w = 0, img.width
    while w >= 32:
        lv = argb32_level(img, w, w)
        out[off:off + len(lv)] = lv
        off += len(lv)
        w //= 2
    return bytes(out)


# The controls screen's picture (LOADING_CONTROLLER_X360, two variants) as a keyboard, for the clavier set: the
# callout lines end where the 360 picture's do (left edge y 11, 80, 250; right edge y 12, 80, 140, 200, 250), so the
# game's labels point at the keys the Windows launcher binds: Down brake, Left/Right steer, Up accelerate, E shift
# up, Space handbrake, Shift nitro, D shift down. AZERTY letters (the keys are read by position: E and D are the
# same on both). The Guide label points at nothing.
def keyboard_picture(k=4):
    W = 256 * k
    white, grey, text = (245, 245, 245, 255), (200, 200, 205, 255), (40, 40, 45, 255)
    S = lambda *v: [x * k for x in v]
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    body = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    db = ImageDraw.Draw(body)
    db.rounded_rectangle(S(52, 74, 244, 196), radius=8 * k, fill=(232, 232, 236, 255))
    glow = body.filter(ImageFilter.GaussianBlur(9 * k))
    a = glow.split()[3].point(lambda v: min(255, v * 2))
    im.alpha_composite(Image.merge('RGBA', (a.point(lambda v: 255),) * 3 + (a,)))
    db.rounded_rectangle(S(52, 74, 244, 196), radius=8 * k, outline=(180, 180, 188, 255), width=2 * k)
    im.alpha_composite(body)
    d = ImageDraw.Draw(im)

    def key(x0, y0, x1, y1, label, px=11):
        d.rounded_rectangle(S(x0, y0, x1, y1), radius=3 * k, fill=white, outline=grey, width=k)
        d.rounded_rectangle(S(x0 + 1.5, y1 - 3, x1 - 1.5, y1 - 1), radius=k, fill=(225, 225, 230, 255))
        d.text(S((x0 + x1) / 2, (y0 + y1) / 2 - 1), label, font=font(int(px * k)), fill=text, anchor='mm')
    for x, label in ((62, '\u2190'), (84, '\u2193'), (106, '\u2191'), (128, '\u2192')):
        key(x, 82, x + 20, 102, label, 13)
    for i, label in enumerate('AZERT'):
        key(116 + 20 * i, 108, 134 + 20 * i, 126, label)
    for i, label in enumerate('QSDFG'):
        key(121 + 20 * i, 130, 139 + 20 * i, 148, label)
    key(60, 152, 119, 170, 'Maj', 9)
    for i, label in enumerate('WXCV'):
        key(121 + 20 * i, 152, 139 + 20 * i, 170, label)
    key(201, 152, 238, 170, 'Maj', 9)
    key(60, 174, 92, 190, 'Ctrl', 9)
    key(94, 174, 198, 190, 'Espace', 9)

    def line(*pts):
        d.line(S(*pts), fill=(30, 30, 34, 255), width=5 * k, joint='curve')
        d.line(S(*pts), fill=white, width=3 * k, joint='curve')
    line(0, 11, 94, 11, 94, 82)                    # Freiner/Reculer -> Down
    line(0, 250, 40, 250, 40, 92, 62, 92)          # Direction -> Left
    line(255, 12, 116, 12, 116, 82)                # Accelerer -> Up
    line(255, 80, 166, 80, 166, 108)               # Rapport superieur -> E
    line(255, 140, 249, 140, 249, 182, 198, 182)   # Frein a main -> Space
    line(255, 200, 228, 200, 228, 170)             # Nitro -> right Shift
    line(255, 250, 162, 250, 162, 148)             # Rapport inferieur -> D
    return im.resize((256, 256), Image.LANCZOS)


def controller_pictures(d):
    """{name in ICONOS.BIN: pixels as the game holds them} of the controls screen's 360 pictures in a DYNTEX.BIN."""
    ent = {h: (o, off, size, usize) for o, h, off, size, usize in tpk_entries(d)}
    out = {}
    for h in (X360_C1, X360_C2):
        if h in ent:
            _, off, size, _ = ent[h]
            raw = unpack(bytes(d[off:off + size]))
            out['DYNTEX_%08X' % h] = raw[:len(raw) - 0x9C]
    return out


def keyboard_controllers(d):
    """The keyboard picture in place of each 360 picture of a DYNTEX.BIN, same layout (tiled ARGB, 5 levels)."""
    pic = keyboard_picture()
    return {name: argb32_encode(pic, px) for name, px in controller_pictures(d).items()}


def patch_dyntex(d, log=print, style='playstation'):
    """DYNTEX.BIN bytes -> (new bytes, same size and index, [(name, before, after)])."""
    d = bytearray(d)
    ent = {h: (o, off, size, usize) for o, h, off, size, usize in tpk_entries(d)}
    shown = []
    for dst, src in (CONTROLLERS_GAMECUBE if style == 'gamecube' else CONTROLLERS).items():
        if dst not in ent or src not in ent:
            log('DYNTEX: texture %08X or %08X missing, skipped' % (dst, src))
            continue
        _, doff, dsize, dusize = ent[dst]
        _, soff, ssize, _ = ent[src]
        draw = unpack(bytes(d[doff:doff + dsize]))
        sraw = unpack(bytes(d[soff:soff + ssize]))
        dinfo, sinfo = draw[-0x9C:-0x20], sraw[-0x9C:-0x20]
        dname = dinfo[0x0C:0x24].split(b'\0')[0].decode('latin-1')
        w, h = struct.unpack_from('<hh', sinfo, 0x44)
        picture = decode(sraw[:len(sraw) - 0x9C], w, h)  # the PS2 photo, DXT5
        dw, dh = struct.unpack_from('<hh', dinfo, 0x44)
        comp = dinfo[0x4A]
        pixels = draw[:len(draw) - 0x9C]
        if comp == 0x20:  # 32 bpp ARGB (the 360's)
            before = argb_preview(pixels, dw, dh)
            new_pixels = argb32_encode(picture.resize((dw, dh), Image.LANCZOS), pixels)
            after = argb_preview(new_pixels, dw, dh)
        elif comp == 0x26 and len(pixels) == len(sraw) - 0x9C:  # DXT5 like the PS2 one: same bytes
            before = decode(pixels, dw, dh)
            new_pixels = sraw[:len(sraw) - 0x9C]
            after = decode(new_pixels, dw, dh)
        else:
            log('DYNTEX %s: format %02X not handled, skipped' % (dname, comp))
            continue
        raw = new_pixels + draw[len(draw) - 0x9C:]
        assert len(raw) == dusize
        blob = jdlz.compress(raw)
        if len(blob) > dsize:
            if dst in (XBOX_C1, XBOX_C2):  # the original Xbox's pictures: the 360 does not show them
                log('%s: %d bytes compressed, only %d room: left as it is' % (dname, len(blob), dsize))
                continue
            raise ValueError('%s: %d bytes compressed, only %d room' % (dname, len(blob), dsize))
        assert jdlz.decompress(blob) == raw
        d[doff:doff + dsize] = blob + b'\0' * (dsize - len(blob))
        shown.append((dname, before, after))
        log('%-26s <- %s controller (%d of %d bytes)' % (dname, style, len(blob), dsize))
    return bytes(d), shown


def argb_preview(pixels, w, h):
    idx, total = xenos._map(w, h, 4)
    a = np.frombuffer(pixels[:total * 4], np.uint8).reshape(total, 4)
    return Image.fromarray(a[idx.reshape(-1)].reshape(h, w, 4)[:, :, [1, 2, 3, 0]].copy(), 'RGBA')


def preview(shown, path):
    if shown and shown[0][1].width > 64:
        sheet = Image.new('RGBA', (len(shown) * 264, 560), (50, 50, 50, 255))
        d = ImageDraw.Draw(sheet)
        for i, (name, before, after) in enumerate(shown):
            sheet.alpha_composite(before.resize((256, 256)), (i * 264 + 4, 4))
            sheet.alpha_composite(after.resize((256, 256)), (i * 264 + 4, 266))
            d.text((i * 264 + 4, 540), name, fill=WHITE)
        sheet.convert('RGB').save(path)
        return
    sheet = Image.new('RGBA', (len(shown) * 76, 170), (50, 50, 50, 255))
    d = ImageDraw.Draw(sheet)
    for i, (name, before, after) in enumerate(shown):
        sheet.alpha_composite(before.resize((64, 64), Image.NEAREST), (i * 76 + 6, 6))
        sheet.alpha_composite(after.resize((64, 64), Image.NEAREST), (i * 76 + 6, 80))
        d.text((i * 76 + 4, 150), name, fill=WHITE)
    sheet.convert('RGB').save(path)


LISEZMOI = """Icones des boutons pour NFS Most Wanted (Batocera)

A decompresser par-dessus /userdata/roms/ports/. Le choix se fait dans EmulationStation :
Options avancees du jeu > NFS MOST WANTED > ICONES DES BOUTONS (Xbox 360, PlayStation, GameCube).

mods/icones/<style>/ garde, pour chaque style, les fichiers que le lanceur pose dans game_root/GLOBAL/ :
  GLOBALB.LZC           icones des boutons
  GLOBALMEMORYFILE.BIN  les memes icones dans le pack precharge (votre version, avec ses autres mods)
  DYNTEX.BIN            la photo de manette des chargements et du menu Commandes
xbox360/ ne garde que votre GLOBALMEMORYFILE.BIN d'origine : le jeu reprend alors les fichiers de ses archives.

Boutons : PlayStation = par position (bas = croix, droite = rond, gauche = carre, haut = triangle) ;
Xbox 360 et GameCube = par lettre (la lettre affichee est celle du bouton de la Retroid). Le menu
BOUTONS A/B X/Y peut changer ce choix. Pour tout enlever : remettre votre GLOBALMEMORYFILE.BIN
(mods/icones/xbox360/) dans game_root/GLOBAL/, supprimer GLOBALB.LZC et DYNTEX.BIN de game_root/GLOBAL/
et le dossier mods/icones/.

Fait avec batocera/tools/ps_buttons du depot nfsmw-batocera. Contient des donnees du jeu : ne pas partager.
"""

PORT = 'NFS Most Wanted.sh/'


def build_style(style, blob, mem, dyn, retroid=False, log=print):
    """{file name: bytes} for one icon style, plus the previews' tiles."""
    files = {}
    new, shown = patch_globalb(blob, retroid, log, style)
    files['GLOBALB.LZC'] = new
    pictures = {}
    if dyn:
        pictures = keyboard_controllers(dyn) if style == 'clavier' else controller_pictures(patch_dyntex(dyn, lambda *a: None, style)[0])
    files['ICONOS.BIN'] = iconos_bin(new, pictures)
    if mem:
        files['GLOBALMEMORYFILE.BIN'] = patch_memfile(mem, new)
    dshown = []
    if dyn and style != 'clavier':
        files['DYNTEX.BIN'], dshown = patch_dyntex(dyn, log, style)
    return files, shown, dshown


def icon_sets(blob, mem, dyn, log=print):
    """The three icon sets: {path under NFS Most Wanted.sh/: bytes}, previews included."""
    import tempfile
    out = {}
    if mem:  # Xbox 360: the game's own icons; only the GLOBALMEMORYFILE.BIN to put back
        out['mods/icones/xbox360/GLOBALMEMORYFILE.BIN'] = mem
    # the game's own, to swap back to (its controller pictures too)
    out['mods/icones/xbox360/ICONOS.BIN'] = iconos_bin(blob, controller_pictures(dyn) if dyn else None)
    for style in ('playstation', 'gamecube', 'clavier'):
        log('== ' + style)
        files, shown, dshown = build_style(style, blob, mem, dyn, log=log)
        if style == 'clavier':  # not a style of its own: only the icons the game swaps in while the keyboard is used
            files, dshown = {'ICONOS.BIN': files['ICONOS.BIN']}, []
        for name, data in files.items():
            out['mods/icones/%s/%s' % (style, name)] = data
        with tempfile.TemporaryDirectory() as t:
            for tiles, name in ((shown, 'icones.png'), (dshown, 'manette.png')):
                if tiles:
                    preview(tiles, os.path.join(t, name))
                    with open(os.path.join(t, name), 'rb') as f:
                        out['mods/icones/%s/%s' % (style, name)] = f.read()
    out['mods/icones/LISEZMOI.txt'] = LISEZMOI.encode('utf-8')
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--globalb', required=True, help='GLOBAL/GLOBALB.LZC (5018060 bytes)')
    ap.add_argument('--memfile', help='GLOBAL/GLOBALMEMORYFILE.BIN the game uses (its GLOBALB copy is patched)')
    ap.add_argument('--dyntex', help='GLOBAL/DYNTEX.BIN: the controller picture of the loading screens and the '
                                     'controls menu becomes EA\'s one for that style')
    ap.add_argument('--style', choices=('playstation', 'gamecube', 'clavier'), default='playstation')
    ap.add_argument('--retroid', action='store_true',
                    help='PlayStation: triangle on top and square on the left with the face buttons by letter')
    ap.add_argument('--out', help='game_root: writes GLOBAL/ for --style')
    ap.add_argument('--preview', help='PNG with the icons before and after')
    ap.add_argument('--preview-controller', help='PNG with the controller pictures before and after')
    ap.add_argument('--icon-sets', metavar='ZIP',
                    help='a zip to extract over /userdata/roms/ports/ with the Xbox 360, PlayStation and GameCube '
                         'sets (NFS Most Wanted.sh/mods/icones/<style>/), chosen in EmulationStation')
    a = ap.parse_args()
    blob = open(a.globalb, 'rb').read()
    mem = open(a.memfile, 'rb').read() if a.memfile else None
    dyn = open(a.dyntex, 'rb').read() if a.dyntex else None
    if a.icon_sets:
        import zipfile
        with zipfile.ZipFile(a.icon_sets, 'w', zipfile.ZIP_DEFLATED) as z:
            for name, data in icon_sets(blob, mem, dyn).items():
                z.writestr(PORT + name, data)
        print('icon sets for Batocera:', a.icon_sets)
        return
    if not a.out:
        ap.error('--out or --icon-sets is needed')
    files, shown, dshown = build_style(a.style, blob, mem, dyn, a.retroid)
    os.makedirs(os.path.join(a.out, 'GLOBAL'), exist_ok=True)
    for name, data in files.items():
        with open(os.path.join(a.out, 'GLOBAL', name), 'wb') as f:
            f.write(data)
    if a.preview:
        preview(shown, a.preview)
    if a.preview_controller and dshown:
        preview(dshown, a.preview_controller)
    print('written to', os.path.join(a.out, 'GLOBAL'))


if __name__ == '__main__':
    main()
