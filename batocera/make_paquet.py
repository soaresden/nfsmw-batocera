"""Encrypts a built "NFS Most Wanted.sh/" for the installation page.

    python3 batocera/make_paquet.py <out/batocera/NFS Most Wanted.sh> <default.xex> <edition key> [page/paquets]

The package holds the translated game code, so it is encrypted with a key that only the edition's own default.xex
gives: SHA-256 of "nfsmw-batocera/paquet/1\\0" followed by the whole default.xex. The page reads the player's
default.xex, derives the same key and decrypts in the browser; without the game the file is noise.

File: "NFSMWPK1" + 12-byte nonce + AES-256-GCM(gzip(container)).
Container: u32 LE length of a JSON index {"version", "files": [{"path", "size"}]} + the index + the files' bytes
in that order. game_root/ is left out (the player's files go there).

paquets/index.json lists the packages by SHA-256 of default.xex (already public: tools/editions/regional).
"""
import gzip
import hashlib
import json
import os
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

SALT = b'nfsmw-batocera/paquet/1\0'
MAGIC = b'NFSMWPK1'


def key_of(xex):
    return hashlib.sha256(SALT + xex).digest()


def container(port):
    files, blobs = [], []
    for root, dirs, names in os.walk(port):
        dirs.sort()
        rel_root = os.path.relpath(root, port)
        if rel_root.split(os.sep)[0] == 'game_root':
            continue
        for name in sorted(names):
            path = os.path.join(root, name)
            rel = os.path.relpath(path, port).replace(os.sep, '/')
            data = open(path, 'rb').read()
            files.append({'path': rel, 'size': len(data)})
            blobs.append(data)
    version = open(os.path.join(port, 'VERSION'), encoding='utf-8').read().strip()
    index = json.dumps({'version': version, 'files': files}, separators=(',', ':')).encode()
    return version, len(index).to_bytes(4, 'little') + index + b''.join(blobs)


def main():
    if len(sys.argv) not in (4, 5):
        sys.exit(__doc__)
    port, xex_path, edition = sys.argv[1:4]
    out = sys.argv[4] if len(sys.argv) == 5 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..',
                                                              'page', 'paquets')
    os.makedirs(out, exist_ok=True)
    xex = open(xex_path, 'rb').read()
    version, plain = container(port)
    nonce = os.urandom(12)
    blob = MAGIC + nonce + AESGCM(key_of(xex)).encrypt(nonce, gzip.compress(plain, 9, mtime=0), MAGIC)
    name = 'nfsmw-%s.pak' % edition
    with open(os.path.join(out, name), 'wb') as f:
        f.write(blob)
    index_path = os.path.join(out, 'index.json')
    index = json.load(open(index_path)) if os.path.exists(index_path) else {'paquets': []}
    xex_sha = hashlib.sha256(xex).hexdigest()
    index['paquets'] = [p for p in index['paquets'] if p['xex_sha256'] != xex_sha]
    index['paquets'].append({'edition': edition, 'xex_sha256': xex_sha, 'fichier': name, 'version': version,
                             'taille': len(blob), 'sha256': hashlib.sha256(blob).hexdigest()})
    index['paquets'].sort(key=lambda p: p['edition'])
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print('%s: %d bytes (%d before compression), version %s' % (name, len(blob), len(plain), version))


if __name__ == '__main__':
    main()
