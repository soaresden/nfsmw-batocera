"""Mods for NFS Most Wanted on Batocera: NFS Most Wanted.sh/mods/<name>/ (any name but icones) holds files laid out
as game_root/ (CARS/..., GLOBAL/...), e.g. the MX-5 from MazdaMx5-nd-rf-ingames in mods/mx5/.

run.sh calls, at every start:
    python3 mods.py restore <NFS Most Wanted.sh>          before the button icons are put in place
    python3 mods.py apply <NFS Most Wanted.sh> <style>    after them

restore puts back what the last apply replaced (originals kept in data/mods-originals/, the list in
data/mods-state.json), so a removed mod folder means the base game again. apply copies every mod file over
game_root/. A mod's GLOBAL/GLOBALMEMORYFILE.BIN (a pack the game preloads) gets the chosen icon style's changes: every
pack entry the style's copy changes against mods/icones/xbox360/ (the player's own pack) is copied into the mod's
pack when it holds the same entry with the same size; and with the French dub (Movies/movies_report.txt) the pack's
copies of the English text are hidden as french-dub's patch_text.py does. Python standard library only.
"""
import json
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


def apply(port, style):
    root, mods = os.path.join(port, 'game_root'), os.path.join(port, 'mods')
    backup = os.path.join(port, 'data', 'mods-originals')
    state = {}
    names = sorted(n for n in os.listdir(mods) if n not in ('icones', 'boutons-playstation')
                   and os.path.isdir(os.path.join(mods, n))) if os.path.isdir(mods) else []
    dubbed = os.path.exists(os.path.join(root, 'Movies', 'movies_report.txt'))
    for name in names:
        top = os.path.join(mods, name)
        for d, _, files in os.walk(top):
            for f in files:
                rel = os.path.relpath(os.path.join(d, f), top).replace(os.sep, '/')
                if f.upper() in ('LISEZMOI.TXT', 'README.TXT', 'README.MD'):
                    continue
                dst = os.path.join(root, rel)
                if rel not in state:  # keep what the game had, once
                    state[rel] = os.path.exists(dst)
                    if state[rel]:
                        os.makedirs(os.path.dirname(os.path.join(backup, rel)), exist_ok=True)
                        shutil.copyfile(dst, os.path.join(backup, rel))
                data = read(os.path.join(d, f))
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
        print('[mods] %s applied' % name)
    if state:
        os.makedirs(os.path.join(port, 'data'), exist_ok=True)
        with open(os.path.join(port, 'data', 'mods-state.json'), 'w') as w:
            json.dump(state, w, indent=1)


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'restore':
        restore(sys.argv[2])
    elif len(sys.argv) >= 3 and sys.argv[1] == 'apply':
        apply(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '')
    else:
        sys.exit(__doc__)
