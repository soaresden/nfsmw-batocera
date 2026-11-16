"""French dub in the browser: batocera/tools/french-dub (nfsmw-nx tools/french-dub) under Pyodide.

The steps and checks are those of build_package.py: text (patch_text), movies (patch_movies), speech (patch_speech).
What changes for the browser:
- the two disc images are read in place (WORKERFS, /iso/x360.iso and /iso/xbox.iso);
- subprocess.run reaches ffmpeg/ffprobe (ffmpeg.wasm) and vgmstream-cli (WASI) through js.vf_run;
- each finished file is handed to the page with js.vf_flush and removed, so the 2 GB of output never sit in memory;
- the speech lines are decoded and encoded in groups (ordered by their length in the stream header) instead of all
  decoded first: 9929 decoded lines would take about 1.7 GB.
"""
import os
import struct
import subprocess
import sys

import js
from pyodide.ffi import to_js

sys.path.insert(0, '/vf')

X360 = '/iso/x360.iso'
XBOX = '/iso/xbox.iso'
OUT = '/out'
GROUP = 256


# ---------------------------------------------------------------- external programs

def _run(cmd, input=None, cwd=None, check=False, capture_output=False, text=False, **kw):
    cmd = [str(c) for c in cmd]
    data = to_js(input) if input is not None else None
    r = js.vf_run(to_js(cmd), data, cwd or os.getcwd())
    rc = int(r.returncode)
    out = r.stdout.to_bytes()
    err = str(r.stderr)
    if text:
        out = out.decode('utf-8', 'replace')
    else:
        err = err.encode()
    if check and rc:
        raise subprocess.CalledProcessError(rc, cmd, out, err)
    return subprocess.CompletedProcess(cmd, rc, out, err)


subprocess.run = _run


def progress(fraction, text):
    js.vf_progress(fraction, text)


def flush(path, rel):
    """Hands a finished file to the page (written into game_root/<rel>) and frees it here."""
    js.vf_flush(path, rel)


# ---------------------------------------------------------------- checks

def diagnostic():
    """What the two images hold, for the editions this tool was not tested with (the USA disc)."""
    import hashlib
    from zzdata import Disc, bstringhash, path
    lines = []
    x360 = Disc(X360)
    xex = x360.read_file('default.xex')
    lines.append('Xbox 360: default.xex %s, NFS/ZZDATA0.BIN %d bytes' % (
        hashlib.sha256(xex).hexdigest(), x360.files['NFS/ZZDATA0.BIN'][0]))
    for name in ('ENGLISH', 'FRENCH', 'SPANISH', 'GERMAN', 'ITALIAN'):
        lines.append('  LANGUAGES\\%s.BIN: %s' % (name, 'yes' if x360.has(path('LANGUAGES', name + '.BIN')) else 'no'))
    for h in (0x21D83A59, 0xA8A7B105):
        lines.append('  LOCH %08x: %s' % (h, 'yes' if h in x360.entries else 'no'))
    for lang in ('EN', 'FR'):
        for ext in ('BIG', 'IDX', 'CSI', 'EVT'):
            n = path('SOUND', 'SPEECH', 'COPSPEECH_%s.%s' % (lang, ext))
            lines.append('  %s: %s' % (n, 'yes' if x360.has(n) else 'no'))
    movies = sorted(p for p in x360.files if p.startswith('MOVIES/'))
    lines.append('  %d files in Movies/: %s' % (len(movies), ', '.join(m[7:].lower() for m in movies)))
    pack = x360.read(path('GLOBAL', 'GLOBALMEMORYFILE.BIN'))
    count = struct.unpack_from('<I', pack, 12)[0]
    hashes = {struct.unpack_from('<I', pack, 16 + 20 * i)[0] for i in range(count)}
    lines.append('  GLOBALMEMORYFILE.BIN: %d entries; ENGLISH.BIN copy: %s; LOCH 21d83a59 copy: %s' % (
        count, bstringhash(path('LANGUAGES', 'ENGLISH.BIN')) in hashes, 0x21D83A59 in hashes))
    xbox = Disc(XBOX)
    lines.append('Xbox: %s' % ', '.join(sorted(p for p in xbox.files if '/' not in p)))
    lines.append('  COPSPEECH_FR.BIG: %s' % ('yes' if xbox.has(path('SOUND', 'SPEECH', 'COPSPEECH_FR.BIG')) else 'no'))
    stems = sorted({m[7:].lower().rsplit('_english', 1)[0] for m in movies if '_english' in m.lower()})
    found = [s for s in stems if xbox.has(path('MOVIES', s.upper() + '_FRENCH_PAL.VP6'))]
    lines.append('  French movies (<NAME>_FRENCH_PAL.VP6) for %d of %d English movies' % (len(found), len(stems)))
    return '\n'.join(lines)


def check():
    """The tool's own check: official PAL (English) Xbox 360 image and French Xbox image."""
    from zzdata import open_discs
    try:
        open_discs(X360, XBOX)
    except SystemExit as e:
        return str(e)
    return ''


# ---------------------------------------------------------------- the three steps

def text_step():
    import patch_text
    from zzdata import open_discs
    x360, _ = open_discs(X360, XBOX)
    os.makedirs(os.path.join(OUT, 'NFS'), exist_ok=True)
    patch_text.patch_zdir(x360, OUT)
    patch_text.patch_pack(x360, OUT)
    for name in os.listdir(os.path.join(OUT, 'NFS')):
        if name.upper() != 'ZDIR.BIN':  # ZDIR.BIN: the speech step changes it again
            flush(os.path.join(OUT, 'NFS', name), 'NFS/' + name)


def movies_step(start, span):
    import patch_movies
    from zzdata import open_discs, path
    x360, xbox = open_discs(X360, XBOX)
    output = os.path.join(OUT, 'Movies')
    os.makedirs(output, exist_ok=True)
    suffix = patch_movies.SUFFIX.upper()
    movies = sorted(p for p in x360.files if p.startswith('MOVIES/') and p.endswith(suffix))
    report = []
    for k, file_path in enumerate(movies):
        name = file_path[len('MOVIES/'):-len(suffix)]
        progress(start + span * k / len(movies), 'Vidéos : %s (%d/%d)' % (name.lower(), k + 1, len(movies)))
        vp6 = path('MOVIES', '%s_FRENCH_PAL.VP6' % name)
        if xbox.has(vp6):
            line = patch_movies.convert(x360, xbox, file_path, vp6, output, 'ffmpeg')
        else:
            line = '%-45s unchanged (no French version on the Xbox disc)' % os.path.basename(file_path).lower()
        print(line)
        report.append(line)
        target = os.path.join(output, os.path.basename(file_path).lower())
        if os.path.exists(target):
            flush(target, 'Movies/' + os.path.basename(target))
    report_file = os.path.join(output, 'movies_report.txt')
    with open(report_file, 'w', encoding='utf-8') as w:
        w.writelines(line + '\n' for line in report)
    flush(report_file, 'Movies/movies_report.txt')


def _samples(elements):
    values = {t: int.from_bytes(v, 'big') for t, v in elements if v is not None}
    return values.get(0x85, 0)


def speech_step(start, span):
    import tempfile
    import patch_speech as ps
    from ea_stream import stream
    from speech_idx import read, to_360, unit
    from zzdata import SECTOR, bstringhash, open_discs
    x360, xbox = open_discs(X360, XBOX)
    nfs = os.path.join(OUT, 'NFS')
    os.makedirs(nfs, exist_ok=True)

    idx_fr = xbox.read(ps.SPEECH.format('FR', 'IDX'))
    idx = to_360(idx_fr)
    if read(idx, '>') != read(idx_fr, '<'):
        raise SystemExit('converting the IDX changed its content')
    lines = ps.list_streams(xbox.read(ps.SPEECH.format('FR', 'BIG')))
    print('COPSPEECH_FR.BIG: %d lines' % len(lines))

    # ps.encoded_lines, in groups: decode a group, encode it, keep only the EA-XA streams
    order = sorted(range(len(lines)), key=lambda i: _samples(lines[i][2]))
    streams = [None] * len(lines)
    with tempfile.TemporaryDirectory() as folder:
        for g in range(0, len(order), GROUP):
            group = order[g:g + GROUP]
            progress(start + span * 0.95 * g / len(order),
                     'Voix : %d / %d répliques' % (g, len(lines)))
            decoded = [ps.decode(lines[i][1], 'vgmstream-cli', 'ffmpeg', folder) for i in group]
            data = iter(ps.encode_all([s for channels, _ in decoded for s in channels]))
            for i, (channels, rate) in zip(group, decoded):
                streams[i] = stream(lines[i][2], [next(data) for _ in channels], len(channels[0]), rate)
            del decoded, data
    streams = [ps.canonical_header(s) for s in streams]
    progress(start + span * 0.96, 'Voix : reconstruction de COPSPEECH')
    big, idx = ps.rebuild(idx, [p for p, _, _ in lines], streams)
    del streams

    def line_at(bk, v):
        p = bk['big'] + v * unit(idx, bk['pos'])
        return big[p:p + 4]
    if any(line_at(bk, v) != b'SCHl' for bk in read(idx, '>') for v in bk['offsets']):
        raise SystemExit('an IDX offset does not land on a line')
    print('COPSPEECH .BIG rebuilt: %d bytes; IDX checked' % len(big))

    evt = bytearray(x360.read(ps.SPEECH.format('EN', 'EVT')))
    evt[12:16] = struct.pack('>HH', *struct.unpack_from('<HH', xbox.read(ps.SPEECH.format('FR', 'EVT')), 12))

    placed = {}
    zz = os.path.join(nfs, 'ZZDATA%d.BIN' % ps.ZZDATA)
    with open(zz, 'wb') as w:
        for ext, data in (('BIG', big), ('IDX', idx), ('EVT', bytes(evt))):
            placed[bstringhash(ps.SPEECH.format('EN', ext))] = (w.tell() // SECTOR, len(data))
            w.write(data + bytes(ps._align(len(data), SECTOR) - len(data)))
        end = w.tell()
    del big

    zdir_file = os.path.join(nfs, 'ZDIR.BIN')
    with open(zdir_file, 'rb') as f:
        zdir = bytearray(f.read())
    base = x360.global_sector_base(ps.ZZDATA)
    for i in range(0, len(zdir) - 23, 24):
        h, number, sector, _, size, checksum = struct.unpack_from('<6I', zdir, i)
        if h in placed:
            sector, size = placed.pop(h)
        elif number == ps.ZZDATA:
            sector = end // SECTOR
        else:
            continue
        struct.pack_into('<6I', zdir, i, h, ps.ZZDATA, sector, base + sector, size, checksum)
    if placed:
        raise SystemExit('COPSPEECH_EN entries missing from ZDIR.BIN')
    with open(zdir_file, 'wb') as w:
        w.write(zdir)
    print('ZZDATA%d.BIN: %d bytes; ZDIR.BIN: COPSPEECH_EN.BIG, .IDX and .EVT -> French' % (ps.ZZDATA, end))
    flush(zz, 'NFS/ZZDATA%d.BIN' % ps.ZZDATA)


def run_all():
    import time
    t = time.time()
    progress(0.0, 'VF : textes')
    text_step()
    movies_step(0.05, 0.4)
    speech_step(0.45, 0.55)
    flush(os.path.join(OUT, 'NFS', 'ZDIR.BIN'), 'NFS/ZDIR.BIN')
    progress(1.0, 'VF terminée')
    print('VF: %.0f min' % ((time.time() - t) / 60))
