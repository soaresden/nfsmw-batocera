# nfsmw - reverse engineering helper (see tools/re/README.md).
"""dis.py <image> <hexstart> <hexend>: disassembly with addresses (llvm-mc), + resolved lis/addi constants and string hints."""
import subprocess, sys, struct, re
BASE = 0x82000000
d = open(sys.argv[1], 'rb').read()
a, b = int(sys.argv[2], 16), int(sys.argv[3], 16)
raw = d[a - BASE:b - BASE]
txt = '\n'.join(' '.join('0x%02x' % x for x in raw[i:i + 4]) for i in range(0, len(raw), 4))
r = subprocess.run(['llvm-mc-20', '--disassemble', '-triple=powerpc64', '-mcpu=pwr7'], input=txt, capture_output=True, text=True)
bad = {int(m) for m in re.findall(r'<stdin>:(\d+):', r.stderr)}
good = iter([l.strip() for l in r.stdout.splitlines() if l.startswith('\t')])
lines = ['.long 0x' + raw[4 * k:4 * k + 4].hex() if (k + 1) in bad else next(good) for k in range(len(raw) // 4)]
hi = {}
def s_at(addr):
    o = addr - BASE
    if 0 <= o < len(d):
        e = d.find(b'\0', o, o + 64)
        s = d[o:e] if e > o else b''
        if len(s) >= 4 and all(32 <= c < 127 for c in s): return repr(s.decode())
    return ''
for i, l in enumerate(lines):
    addr = a + 4 * i
    w = struct.unpack_from('>I', raw, 4 * i)[0]
    op = w >> 26; rd = (w >> 21) & 31; ra = (w >> 16) & 31; si = w & 0xFFFF
    if si & 0x8000: si -= 0x10000
    note = ''
    if op == 15 and ra == 0: hi[rd] = (w & 0xFFFF) << 16
    elif op == 24 and ra in hi: note = '= %08X' % ((hi[ra] | (w & 0xFFFF)) & 0xFFFFFFFF)
    elif ra in hi and op in (14, 32, 34, 36, 40, 48, 50):
        v = (hi[ra] + si) & 0xFFFFFFFF; note = '= %08X %s' % (v, s_at(v))
    if op == 18:  # b/bl
        li = w & 0x03FFFFFC
        if li & 0x02000000: li -= 0x04000000
        note = '-> %08X' % ((addr + li) & 0xFFFFFFFF if not (w & 2) else li)
    if op == 16:
        bd = w & 0xFFFC
        if bd & 0x8000: bd -= 0x10000
        note = '-> %08X' % (addr + bd)
    print('%08X  %-34s %s' % (addr, l.replace('\t', ' '), note))
