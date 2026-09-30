// Packs extension/ into public/downloads/savant-apply.zip, the download on
// the /autofill install guide. Run after changing anything in extension/:
//
//   node scripts/pack-extension.mjs
//
// Files go under a "savant-apply/" folder, so unzipping gives the folder to
// pick in Chrome's "Load unpacked". Uses only Node built-ins (zlib.crc32
// needs Node 22+).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

const SRC = "extension";
const OUT_DIR = join("public", "downloads");
const OUT = join(OUT_DIR, "savant-apply.zip");
const ROOT = "savant-apply/";

const files = readdirSync(SRC, { withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => e.name)
  .sort();

// Fixed timestamp (2026-01-01 00:00) so the zip only changes when the files do.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const locals = [];
const centrals = [];
let offset = 0;
for (const name of files) {
  const data = readFileSync(join(SRC, name));
  const packed = deflateRawSync(data, { level: 9 });
  const path = Buffer.from(ROOT + name, "utf8");
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(path.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, path, packed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(path.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, path);

  offset += local.length + path.length + packed.length;
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, Buffer.concat([...locals, ...centrals, end]));
const version = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8")).version;
console.log(`Wrote ${OUT} (Savant Apply ${version}, ${files.length} files)`);
