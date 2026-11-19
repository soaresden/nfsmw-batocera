"""Mods for NFS Most Wanted on Batocera: NFS Most Wanted.sh/mods/<name>/ (any name but icones) holds files laid out
as game_root/ (CARS/..., GLOBAL/...) or a zip of them, read as it is without extracting it: e.g. mods/mx5/ with the
zip of the MX-5 page (MazdaMx5-nd-rf-ingames) inside (its game_root/ prefix is skipped). mods/<name>.zip works too.

run.sh calls, at every start:
    python3 mods.py restore <NFS Most Wanted.sh>          before the button icons are put in place
    python3 mods.py apply <NFS Most Wanted.sh> <style>    after them
    python3 mods.py icons <NFS Most Wanted.sh>            then: the icons as the game will load them

mods/black-edition/ (the Black Edition title screen) is applied only when the BLACK EDITION option is on, and last.
mods/desactives.txt (written by the Mods tab of the game's menu, one mod name per line) lists the mods switched off:
they stay in mods/ but are not applied.
restore puts back what the last apply replaced (originals kept in data/mods-originals/, the list in
data/mods-state.json), so a removed mod folder means the base game again. apply copies every mod file over
game_root/. A mod's GLOBAL/GLOBALMEMORYFILE.BIN (a pack the game preloads) gets the chosen icon style's changes: every
pack entry the style's copy changes against mods/icones/xbox360/ (the player's own pack) is copied into the mod's
pack when it holds the same entry with the same size; and with the French dub (Movies/movies_report.txt) the pack's
copies of the English text are hidden as french-dub's patch_text.py does.

A mod file <file>.patch (black_edition_title.py writes them) replaces textures inside a JDLZ file (FRONTB.LZC,
GLOBALB.LZC) instead of the whole file: it is applied over game_root/<file> as the icons and the earlier mods left it,
with jdlz.py (next to mods.py); the result is kept in data/mods-cache/ for the next starts. When game_root has no such
file (the game reads it from its archives), the mod's own whole <file> is copied instead. Python standard library only.
"""
import hashlib
import json
import zipfile
import os
import shutil
import struct
import sys

PACK = 'GLOBAL/GLOBALMEMORYFILE.BIN'
PACK_MAGIC = 0x53219999
LOCH_EN = 0x21D83A59


def bstringhash(name):
    h = 0xFFFFFFFF
    for c in name.encode():
        h = (h * 33 + c) & 0xFFFFFFFF
    return h


def entries(pack):
    """{hash: (index, offset, stored size)} of a GLOBALMEMORYFILE.BIN pack, or {} if it is not one."""
    if len(pack) < 16 or struct.unpack_from('<I', pack, 8)[0] != PACK_MAGIC:
        return {}
    count = struct.unpack_from('<I', pack, 12)[0]
    out = {}
    for i in range(count):
        h, off, _mem, stored, _flags = struct.unpack_from('<5I', pack, 16 + 20 * i)
        if off + stored <= len(pack):
            out[h] = (i, off, stored)
    return out


def merge_pack(mod, style, base, dubbed):
    """The mod's pack with the icon style's changes (style vs base) and the dub's hidden text copies."""
    m = bytearray(mod)
    em, es, eb = entries(m), entries(style or b''), entries(base or b'')
    copied = 0
    for h, (_, so, ss) in es.items():
        if h in eb and h in em:
            _, bo, bs = eb[h]
            _, mo, ms = em[h]
            if ss == bs == ms and style[so:so + ss] != base[bo:bo + bs]:
                m[mo:mo + ms] = style[so:so + ss]
                copied += 1
    hidden = 0
    if dubbed and em:
        for en in (bstringhash('LANGUAGES\\ENGLISH.BIN'), LOCH_EN):
            if en in em:
                struct.pack_into('<I', m, 16 + 20 * em[en][0], bstringhash('FRENCH_DUB\\HIDDEN_%08X' % en))
                hidden += 1
    return bytes(m), copied, hidden


def read(path):
    try:
        with open(path, 'rb') as f:
            return f.read()
    except OSError:
        return None


def restore(port):
    root, backup = os.path.join(port, 'game_root'), os.path.join(port, 'data', 'mods-originals')
    state_file = os.path.join(port, 'data', 'mods-state.json')
    try:
        state = json.load(open(state_file))
    except (OSError, ValueError):
        return
    for rel, existed in state.items():
        dst = os.path.join(root, rel)
        if existed and os.path.exists(os.path.join(backup, rel)):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(os.path.join(backup, rel), dst)
        elif not existed and os.path.exists(dst):
            os.remove(dst)
    shutil.rmtree(backup, ignore_errors=True)
    os.remove(state_file)
    print('[mods] restored %d file(s)' % len(state))


SKIP = ('LISEZMOI.TXT', 'README.TXT', 'README.MD')


def mod_files(path):
    """[(path under game_root, function giving its bytes)] of a mod folder or zip."""
    out = []
    if os.path.isdir(path):  # loose files, and any zip in the folder read as it is (mods/mx5/mx5.zip)
        for d, _, files in os.walk(path):
            for f in sorted(files):
                p = os.path.join(d, f)
                if f.lower().endswith('.zip'):
                    out += mod_files(p)
                elif f.upper() not in SKIP:
                    out.append((os.path.relpath(p, path).replace(os.sep, '/'), lambda p=p: read(p)))
        return out
    z = zipfile.ZipFile(path)
    for info in z.infolist():
        if info.is_dir():
            continue
        rel = info.filename.replace('\\', '/')
        if 'game_root/' in rel:  # the MX-5 page's zip: game_root/CARS/...
            rel = rel.split('game_root/', 1)[1]
        elif '/mods/' in rel:    # NFS Most Wanted.sh/mods/<name>/CARS/...
            rel = rel.split('/mods/', 1)[1].split('/', 1)[-1]
        if rel and os.path.basename(rel).upper() not in SKIP:
            out.append((rel, lambda n=info.filename: z.read(n)))
    return out


PATCH_MAGIC = b'NFSMWPAT'


def patched(port, base, patch):
    """`base` (a JDLZ file) with the textures of `patch` put in, or None if it does not apply."""
    if patch[:8] != PATCH_MAGIC or base[:4] != b'JDLZ':
        return None
    size, count = struct.unpack_from('<II', patch, 8)
    if struct.unpack_from('<I', base, 8)[0] != size:
        return None
    cache = os.path.join(port, 'data', 'mods-cache')
    key = os.path.join(cache, hashlib.sha1(base + patch).hexdigest())
    done = read(key)
    if done:
        os.utime(key)
        return done
    import jdlz
    data = bytearray(jdlz.decompress(base))
    ranges, p = [], 16
    for _ in range(count):
        off, n = struct.unpack_from('<II', patch, p)
        data[off:off + n] = patch[p + 8:p + 8 + n]
        ranges.append((off, off + n))
        p += 8 + n
    out = jdlz.splice_to_fit(base, bytes(data), ranges, len(base))
    if out:
        os.makedirs(cache, exist_ok=True)
        old = sorted((os.path.getmtime(os.path.join(cache, f)), f) for f in os.listdir(cache))
        for _, f in old[:-5]:  # keep the last few combinations (icons x mods)
            os.remove(os.path.join(cache, f))
        with open(key, 'wb') as w:
            w.write(out)
    return out


def into_pack(port, root, rel, patch, name, keep):
    """A .patch also goes in the pack's preloaded copy of the file (GLOBALB.LZC is one: the game never reads the
    loose file then), padded to the entry's size."""
    pf = os.path.join(root, PACK)
    pack = read(pf)
    e = entries(pack or b'')
    h = bstringhash(rel.replace('/', '\\').upper())
    if h not in e:
        return
    _, off, stored = e[h]
    base = pack[off:off + stored]
    comp = struct.unpack_from('<I', base, 12)[0] if base[:4] == b'JDLZ' else 0
    data = patched(port, base[:comp], patch) if 0 < comp <= stored else None
    if data is None or len(data) > stored:
        print('[mods] %s: %s.patch does not fit the copy of %s in %s' % (name, rel, rel, PACK))
        return
    keep(PACK)
    pack = bytearray(pack)
    pack[off:off + stored] = data + bytes(stored - len(data))
    with open(pf, 'wb') as w:
        w.write(pack)
    print('[mods] %s: %s patched in %s' % (name, rel, PACK))


BLACK = 'black-edition'  # only with the BLACK EDITION option, and last (its FRONTB.LZC is built on the others')


def is_black(name):
    """mods/black-edition/, however it is spelled: blackedition, Black Edition, black_edition.zip..."""
    return ''.join(c for c in os.path.splitext(name)[0].lower() if c.isalnum()) == 'blackedition'


OFF = 'desactives.txt'


def switched_off(mods):
    """The names in mods/desactives.txt, lowercase (the menu writes them as listed in mods/)."""
    try:
        with open(os.path.join(mods, OFF), encoding='utf-8', errors='replace') as f:
            return {l.strip().lower() for l in f if l.strip() and not l.startswith('#')}
    except OSError:
        return set()


def apply(port, style, black=False):
    root, mods = os.path.join(port, 'game_root'), os.path.join(port, 'mods')
    backup = os.path.join(port, 'data', 'mods-originals')
    state = {}
    names = sorted(n for n in os.listdir(mods) if n not in ('icones', 'boutons-playstation')
                   and (os.path.isdir(os.path.join(mods, n)) or n.lower().endswith('.zip'))) if os.path.isdir(mods) else []
    # One Black Edition only: the page's mods/black-edition/ first, else the first one found (blackedition...).
    be = sorted((n for n in names if is_black(n)), key=lambda n: (n != BLACK, n))[:1]
    names = [n for n in names if not is_black(n)] + (be if black else [])
    off = switched_off(mods)
    for n in [n for n in names if n.lower() in off]:
        print('[mods] %s: switched off in the menu' % n)
        names.remove(n)

    dubbed = os.path.exists(os.path.join(root, 'Movies', 'movies_report.txt'))

    def keep(rel):  # what the game had, once
        if rel not in state:
            dst = os.path.join(root, rel)
            state[rel] = os.path.exists(dst)
            if state[rel]:
                os.makedirs(os.path.dirname(os.path.join(backup, rel)), exist_ok=True)
                shutil.copyfile(dst, os.path.join(backup, rel))

    for name in names:
        try:
            files = mod_files(os.path.join(mods, name))
        except (OSError, zipfile.BadZipFile) as e:
            print('[mods] %s: unreadable (%s)' % (name, e))
            continue
        patches = [rel[:-6] for rel, _ in files if rel.lower().endswith('.patch')]
        present = {rel for rel in patches if os.path.exists(os.path.join(root, rel))}
        for rel, get in files:
            if rel in present:
                continue  # its .patch goes over what is there
            if rel.lower().endswith('.patch') and rel[:-6] in patches:
                rel = rel[:-6]
                if rel not in present:
                    continue  # not in game_root: the mod's whole file is copied instead
                data = patched(port, read(os.path.join(root, rel)), get())
                if data is None:
                    print('[mods] %s: %s.patch does not fit this %s' % (name, rel, rel))
                    continue
                get = lambda data=data: data
                print('[mods] %s: %s patched' % (name, rel))
            dst = os.path.join(root, rel)
            keep(rel)
            data = get()
            if rel.upper() == PACK:
                icons = os.path.join(mods, 'icones')
                data, copied, hidden = merge_pack(
                    data, read(os.path.join(icons, style, 'GLOBALMEMORYFILE.BIN')) if style != 'xbox360' else None,
                    read(os.path.join(icons, 'xbox360', 'GLOBALMEMORYFILE.BIN')), dubbed)
                print('[mods] %s: %s with %d icon entries (%s), %d English text copies hidden'
                      % (name, rel, copied, style or 'none', hidden))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, 'wb') as w:
                w.write(data)
        for rel, get in files:
            if rel.lower().endswith('.patch') and rel[:-6] in patches:
                into_pack(port, root, rel[:-6], get(), name, keep)
        print('[mods] %s applied' % name)
    if state:
        os.makedirs(os.path.join(port, 'data'), exist_ok=True)
        with open(os.path.join(port, 'data', 'mods-state.json'), 'w') as w:
            json.dump(state, w, indent=1)


ICON_NAMES = ('CROSS', 'TRIANGLE', 'SQUARE', 'CIRCLE', 'L1', 'L2', 'R1', 'R2', 'SELECT')
GLOBALB = 'GLOBAL/GLOBALB.LZC'


def chunks(d, off, end):
    while off + 8 <= end:
        cid, size = struct.unpack_from('<II', d, off)
        yield cid, off + 8, off + 8 + size
        off += 8 + size


def find_chunk(d, cid, off, end):
    for c, b, e in chunks(d, off, end):
        if c == cid:
            return b, e
        if c & 0x80000000:
            r = find_chunk(d, cid, b, e)
            if r:
                return r
    return None


def icon_textures(fe):
    """{name: bytes} of the button icon textures in a decompressed GLOBALB.LZC, as the game holds them."""
    found = {}

    def walk(off, end):
        for c, b, e in chunks(fe, off, end):
            if c == 0xB3300000:  # a texture pack
                info, data = find_chunk(fe, 0x33310004, b, e), find_chunk(fe, 0x33320003, b, e)
                if not info or not data:
                    continue
                base = (data[0] + 0xFFF) & ~0xFFF
                for o in range(info[0], info[1], 0x7C):
                    name = fe[o + 0x0C:o + 0x24].split(b'\0')[0].decode('latin-1')
                    if name in ICON_NAMES and name not in found:
                        off_t, = struct.unpack_from('<I', fe, o + 0x30)
                        size, = struct.unpack_from('<i', fe, o + 0x38)
                        found[name] = bytes(fe[base + off_t:base + off_t + size])
            elif c & 0x80000000:
                walk(b, e)
    walk(0, len(fe))
    return found


CONTROLLERS = (0xEC3C0443, 0xEC3C0444)  # LOADING_CONTROLLER_X360, the controls screen's two pictures


def controller_pictures(dyn):
    """{DYNTEX_<hash>: pixels} of the controls screen's pictures in a DYNTEX.BIN (its compressed TPK index)."""
    import jdlz
    out = {}
    b = find_chunk(dyn, 0x33310003, 0, len(dyn))
    if not b:
        return out
    for o in range(b[0], b[1] - 23, 24):
        h, off, size, usize, _, _ = struct.unpack_from('<IIiiII', dyn, o)
        if h in CONTROLLERS and dyn[off:off + 4] == b'JDLZ':
            raw = jdlz.decompress(dyn[off:off + size])
            out['DYNTEX_%08X' % h] = raw[:len(raw) - 0x9C]
    return out


def icons(port):
    """data/iconos-juego.bin: the button icons as the game will hold them in memory this time (from the copy of
    GLOBALB.LZC that GLOBALMEMORYFILE.BIN preloads, else the loose GLOBALB.LZC), so that the game finds them to swap
    the keyboard keys in (app/src/nfsmw_iconos_teclado.cpp). The icon sets' own ICONOS.BIN may have been drawn by
    another Pillow (the page's, in the browser) and differ by a few bytes. Kept until the source changes."""
    root = os.path.join(port, 'game_root')
    src = None
    pack = read(os.path.join(root, PACK))
    e = entries(pack or b'')
    h = bstringhash(GLOBALB.replace('/', '\\'))
    if h in e:
        _, off, stored = e[h]
        comp = struct.unpack_from('<I', pack, off + 12)[0] if pack[off:off + 4] == b'JDLZ' else 0
        if 0 < comp <= stored:
            src = pack[off:off + comp]
    if src is None:
        src = read(os.path.join(root, GLOBALB))
    out = os.path.join(port, 'data', 'iconos-juego.bin')
    dyn = read(os.path.join(root, 'GLOBAL', 'DYNTEX.BIN')) or b''  # the style's controller pictures, if it has them
    if not src or src[:4] != b'JDLZ':
        if os.path.exists(out):
            os.remove(out)
        return
    key = hashlib.sha1(src + dyn).hexdigest()
    if read(out + '.sha1') == key.encode():
        return
    import jdlz
    found = icon_textures(jdlz.decompress(src))
    pictures = controller_pictures(dyn) if dyn else {}
    blob = [b'NFSMWICO', struct.pack('<I', len(found) + len(pictures))]
    for name in ICON_NAMES:
        if name in found:
            blob += [name.encode().ljust(24, b'\0'), struct.pack('<I', len(found[name])), found[name]]
    for name, data in pictures.items():
        blob += [name.encode().ljust(24, b'\0'), struct.pack('<I', len(data)), data]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'wb') as w:
        w.write(b''.join(blob))
    with open(out + '.sha1', 'w') as w:
        w.write(key)
    print('[mods] icons as the game loads them: %d in data/iconos-juego.bin, %d controller pictures'
          % (len(found), len(pictures)))


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'restore':
        restore(sys.argv[2])
    elif len(sys.argv) >= 3 and sys.argv[1] == 'icons':
        icons(sys.argv[2])
    elif len(sys.argv) >= 3 and sys.argv[1] == 'apply':
        apply(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '', len(sys.argv) > 4 and sys.argv[4] == 'on')
    else:
        sys.exit(__doc__)
