# nfsmw - reverse engineering helper (see tools/re/README.md).
"""xref.py <image> <hexaddr>...: code addresses whose lis/addi (or lis/ori, lis + load/store disp) form the address."""
import struct, sys
BASE = 0x82000000
d = open(sys.argv[1], 'rb').read()
targets = {int(a, 16) for a in sys.argv[2:]}
hi = {}
n = len(d) // 4
words = struct.unpack('>%dI' % n, d[:n * 4])
for i, w in enumerate(words):
    op = w >> 26
    rd = (w >> 21) & 31
    ra = (w >> 16) & 31
    simm = w & 0xFFFF
    if simm & 0x8000: simm -= 0x10000
    if op == 15 and ra == 0:  # lis
        hi[rd] = ((w & 0xFFFF) << 16) & 0xFFFFFFFF
        continue
    if w == 0x4E800020:  # blr: forget
        hi.clear(); continue
    if ra in hi and op in (14, 32, 34, 36, 38, 40, 44, 48, 50, 52, 54):  # addi, lwz, lbz, stw, stb, lhz, sth, lfs, lfd, stfs, stfd
        a = (hi[ra] + simm) & 0xFFFFFFFF
        if a in targets:
            print('%08X %s -> %08X' % (BASE + i * 4, {14: 'addi', 32: 'lwz', 34: 'lbz', 36: 'stw', 38: 'stb', 40: 'lhz', 44: 'sth', 48: 'lfs', 50: 'lfd', 52: 'stfs', 54: 'stfd'}[op], a))
    if op == 24 and ra in hi:  # ori
        a = hi[ra] | (w & 0xFFFF)
        if a in targets:
            print('%08X ori -> %08X' % (BASE + i * 4, a))
