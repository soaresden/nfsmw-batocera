// Reads the files of an Xbox 360 ISO (XDVDFS) without extracting it: every file is a slice of the ISO.
// The game partition starts at 0 (an "xiso" made by extract-xiso and the like), 0xFD90000 (XGD2 disc image, the
// case of NFS Most Wanted), 0x2080000 (XGD3) or 0x18300000 (XGD1). Its volume descriptor is at sector 32:
// "MICROSOFT*XBOX*MEDIA", root directory sector and size. A directory is a binary tree of entries:
// u16 left, u16 right (in 4-byte units from the table's start), u32 sector, u32 size, u8 attributes (0x10 =
// directory), u8 name length, the name; unused room is filled with 0xFF.
const SECTOR = 2048;
const PARTITIONS = [0, 0xfd90000, 0x2080000, 0x18300000];
const MAGIC = 'MICROSOFT*XBOX*MEDIA';

const ascii = (bytes) => String.fromCharCode(...bytes);

// iso: Blob/File -> [{path: 'NFS/ZZDATA0.BIN', get: async () => Blob}]
export async function readXiso(iso) {
  for (const base of PARTITIONS) {
    const at = base + 32 * SECTOR;
    if (at + 28 > iso.size) continue;
    const vd = new Uint8Array(await iso.slice(at, at + 28).arrayBuffer());
    if (ascii(vd.subarray(0, 20)) !== MAGIC) continue;
    const view = new DataView(vd.buffer);
    const out = [];
    await readDirectory(iso, base, view.getUint32(20, true), view.getUint32(24, true), '', out, 0);
    return out;
  }
  throw new Error('ce fichier n\'est pas une ISO Xbox 360 (XDVDFS)');
}

async function readDirectory(iso, base, sector, size, prefix, out, depth) {
  if (!size || depth > 32) return;
  const start = base + sector * SECTOR;
  const table = new Uint8Array(await iso.slice(start, start + size).arrayBuffer());
  const view = new DataView(table.buffer);
  const seen = new Set();
  const subdirs = [];
  const visit = (off) => {
    if (off + 14 > table.length || seen.has(off)) return;
    seen.add(off);
    const left = view.getUint16(off, true);
    const right = view.getUint16(off + 2, true);
    if (left === 0xffff) return;  // padding
    const fileSector = view.getUint32(off + 4, true);
    const fileSize = view.getUint32(off + 8, true);
    const attributes = table[off + 12];
    const name = ascii(table.subarray(off + 14, off + 14 + table[off + 13]));
    if (left) visit(left * 4);
    if (attributes & 0x10) {
      subdirs.push([fileSector, fileSize, `${prefix}${name}/`]);
    } else {
      const from = base + fileSector * SECTOR;
      out.push({ path: prefix + name, get: async () => iso.slice(from, from + fileSize) });
    }
    if (right) visit(right * 4);
  };
  visit(0);
  for (const [s, n, p] of subdirs) await readDirectory(iso, base, s, n, p, out, depth + 1);
}
