"""French dub in the browser: batocera/tools/french-dub (nfsmw-nx tools/french-dub) under Pyodide.

The steps and checks are those of build_package.py: text (patch_text), movies (patch_movies), speech (patch_speech).
What changes for the browser:
- the two disc images are read in place through js.vf_iso_read (File.slice): Python's file offsets are 32-bit in
  Pyodide (wasm32), and the data of a 7 GB 360 image or of an original Xbox image (partition at 0x18300000) lies
  beyond 2 GB, so open() of /iso/x360.iso and /iso/xbox.iso returns IsoFile instead;
- subprocess.run reaches ffmpeg/ffprobe (ffmpeg.wasm) and vgmstream-cli (WASI) through js.vf_run;
- each finished file is handed to the page with js.vf_flush and removed, so the 2 GB of output never sit in memory;
- the speech lines are decoded and encoded in groups (ordered by their length in the stream header) instead of all
  decoded first: 9929 decoded lines would take about 1.7 GB;
- the worker (vf-worker.js) runs the steps: text_step, then movie() for each of movies_list(), movies_report,
  speech_start, speech_group() for each group, speech_finish.
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
GROUP = 64  # speech lines per call: one ffmpeg run each, and a fresh ffmpeg.wasm per group (vf-worker.js)


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


# ---------------------------------------------------------------- the disc images

class IsoFile:
    """Read-only file over one of the page's ISO files, with offsets beyond 2 GB (JavaScript numbers)."""

    def __init__(self, key):
        self.key = key
        self.size = int(js.vf_iso_size(key))
        self.pos = 0

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def tell(self):
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        n = max(0, min(n, self.size - self.pos))
        if not n:
            return b''
        data = js.vf_iso_read(self.key, self.pos, n).to_bytes()
        self.pos += len(data)
        return data

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


import builtins  # noqa: E402

_open = builtins.open
_ISOS = {X360: 'x360', XBOX: 'xbox'}


def _iso_open(file, mode='r', *args, **kwargs):
    if isinstance(file, str) and file in _ISOS:
        if any(c in mode for c in 'wa+'):
            raise PermissionError(file)
        return IsoFile(_ISOS[file])
    return _open(file, mode, *args, **kwargs)


builtins.open = _iso_open


def progress(fraction, text):
    js.vf_progress(fraction, text)


def L(fr, en):
    """The page's language (vf-worker.js sets vf_lang)."""
    return en if str(getattr(js, 'vf_lang', 'fr')) == 'en' else fr


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


def accept_modified_copy():
    """A PAL (English) disc whose default.xex was swapped, e.g. for the PAL Spanish one as the Android port wanted:
    the dub only reads the disc's data files, so it is accepted when those are the official PAL (English) ones
    (the size of NFS/ZZDATA0.BIN, which also keeps the fan translations out, and the PAL English movies)."""
    import hashlib
    import zzdata
    x360 = zzdata.Disc(X360)
    if x360.files.get('NFS/ZZDATA0.BIN', (0, 0))[0] != zzdata.PAL_ENGLISH_ZZDATA0:
        return False
    if not any(p.startswith('MOVIES/') and p.endswith('_ENGLISH_PAL.WMV') for p in x360.files):
        return False
    xex = hashlib.sha256(x360.read_file('default.xex')).hexdigest()
    if xex != zzdata.PAL_ENGLISH_XEX:
        print('PAL (English) data with another default.xex (%s...): accepted for the dub' % xex[:8])
        zzdata.PAL_ENGLISH_XEX = xex
    return True


def check():
    """The tool's own check: official PAL (English) Xbox 360 data and French Xbox image."""
    from zzdata import open_discs
    accept_modified_copy()
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


# The movies and the speech are cut into calls the worker makes one by one (one movie, one group of lines): in
# between, it can start a fresh ffmpeg.wasm, whose memory gets corrupted after a few hundred runs ("memory access
# out of bounds"), and retry the movie that failed. Module state keeps what the steps share.
_S = {}


def movies_list():
    """The 360 movies, as patch_movies.main lists them: [file name in lower case]."""
    import patch_movies
    from zzdata import open_discs
    x360, xbox = open_discs(X360, XBOX)
    _S['x360'], _S['xbox'] = x360, xbox
    os.makedirs(os.path.join(OUT, 'Movies'), exist_ok=True)
    suffix = patch_movies.SUFFIX.upper()
    _S['movies'] = sorted(p for p in x360.files if p.startswith('MOVIES/') and p.endswith(suffix))
    _S['report'] = []
    return [os.path.basename(p).lower() for p in _S['movies']]


def movie(k, done=False):
    """Movie k of movies_list(): converted and handed over, or noted as done by an earlier run."""
    import patch_movies
    from zzdata import path
    file_path = _S['movies'][k]
    suffix = patch_movies.SUFFIX.upper()
    name = file_path[len('MOVIES/'):-len(suffix)]
    output = os.path.join(OUT, 'Movies')
    vp6 = path('MOVIES', '%s_FRENCH_PAL.VP6' % name)
    if not _S['xbox'].has(vp6):
        line = '%-45s unchanged (no French version on the Xbox disc)' % os.path.basename(file_path).lower()
    elif done:
        line = '%-45s OK (converted by an earlier run)' % os.path.basename(file_path).lower()
    else:
        line = patch_movies.convert(_S['x360'], _S['xbox'], file_path, vp6, output, 'ffmpeg')
    print(line)
    _S['report'].append(line)
    target = os.path.join(output, os.path.basename(file_path).lower())
    if os.path.exists(target):
        flush(target, 'Movies/' + os.path.basename(target))
    return line


def movies_report():
    report_file = os.path.join(OUT, 'Movies', 'movies_report.txt')
    with open(report_file, 'w', encoding='utf-8') as w:
        w.writelines(line + '\n' for line in _S['report'])
    flush(report_file, 'Movies/movies_report.txt')


def _samples(elements):
    values = {t: int.from_bytes(v, 'big') for t, v in elements if v is not None}
    return values.get(0x85, 0)


def speech_start():
    """patch_speech.main up to the encoding: returns the number of groups of lines."""
    import tempfile
    import patch_speech as ps
    from speech_idx import read, to_360
    from zzdata import open_discs
    x360, xbox = open_discs(X360, XBOX)
    os.makedirs(os.path.join(OUT, 'NFS'), exist_ok=True)
    idx_fr = xbox.read(ps.SPEECH.format('FR', 'IDX'))
    idx = to_360(idx_fr)
    if read(idx, '>') != read(idx_fr, '<'):
        raise SystemExit('converting the IDX changed its content')
    lines = ps.list_streams(xbox.read(ps.SPEECH.format('FR', 'BIG')))
    print('COPSPEECH_FR.BIG: %d lines' % len(lines))
    # ps.encoded_lines, in groups: decode a group, encode it, keep only the EA-XA streams
    order = sorted(range(len(lines)), key=lambda i: _samples(lines[i][2]))
    _S.update(x360=x360, xbox=xbox, idx=idx, lines=lines, order=order, streams=[None] * len(lines),
              folder=tempfile.mkdtemp())
    return (len(order) + GROUP - 1) // GROUP


def speech_group(g):
    import patch_speech as ps
    from ea_stream import stream
    lines, order, streams = _S['lines'], _S['order'], _S['streams']
    group = order[g * GROUP:(g + 1) * GROUP]
    decoded = [ps.decode(lines[i][1], 'vgmstream-cli', 'ffmpeg', _S['folder']) for i in group]
    data = iter(ps.encode_all([s for channels, _ in decoded for s in channels]))
    for i, (channels, rate) in zip(group, decoded):
        streams[i] = stream(lines[i][2], [next(data) for _ in channels], len(channels[0]), rate)
    return min((g + 1) * GROUP, len(order))


def speech_finish():
    """The rest of patch_speech.main: .BIG and .IDX rebuilt, ZZDATA9 written, ZDIR.BIN pointed at them."""
    import patch_speech as ps
    from speech_idx import read, unit
    from zzdata import SECTOR, bstringhash
    x360, xbox, lines = _S['x360'], _S['xbox'], _S['lines']
    nfs = os.path.join(OUT, 'NFS')
    streams = [ps.canonical_header(s) for s in _S.pop('streams')]
    big, idx = ps.rebuild(_S['idx'], [p for p, _, _ in lines], streams)
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
    flush(zdir_file, 'NFS/ZDIR.BIN')
