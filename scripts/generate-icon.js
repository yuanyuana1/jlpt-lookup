/**
 * 生成应用图标
 * - assets/icon.png  (256x256, 用于 Linux / electron-builder)
 * - assets/icon.ico  (多尺寸 ICO, 用于 Windows)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── PNG 生成 ──────────────────────────────────────────────
function createPNG(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 6;

  const rowSize = 1 + size * 4;
  const rawData = Buffer.alloc(rowSize * size);
  const center = (size - 1) / 2;
  const radius = size * 0.42;
  const innerR = size * 0.28;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;
    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - center, dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        const aa = dist > radius - 1.5 ? Math.round((radius - dist) / 1.5 * 255) : 255;
        // 背景圆：深蓝
        rawData[px]   = 22;
        rawData[px+1] = 27;
        rawData[px+2] = 34;
        rawData[px+3] = aa;

        // 中心字符区域：画一个简单的 "J" 形状
        const nx = (x - center) / radius;  // -1..1
        const ny = (y - center) / radius;

        // 竖线
        if (nx > 0.05 && nx < 0.25 && ny > -0.65 && ny < 0.35) {
          rawData[px] = 88; rawData[px+1] = 166; rawData[px+2] = 255; rawData[px+3] = aa;
        }
        // 底部弯钩
        if (ny > 0.2 && ny < 0.55 && nx > -0.3 && nx < 0.25) {
          const cx = -0.05, cy = 0.3;
          const r2 = Math.sqrt((nx-cx)**2 + (ny-cy)**2);
          if (r2 > 0.18 && r2 < 0.32) {
            rawData[px] = 88; rawData[px+1] = 166; rawData[px+2] = 255; rawData[px+3] = aa;
          }
        }
        // 顶部横线
        if (ny > -0.65 && ny < -0.45 && nx > -0.1 && nx < 0.45) {
          rawData[px] = 88; rawData[px+1] = 166; rawData[px+2] = 255; rawData[px+3] = aa;
        }
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, data]);
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, t, data, crcVal]);
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c & 1) ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── ICO 生成（包含 16/32/48/256 四个尺寸）────────────────
function createICO(sizes) {
  const pngs = sizes.map(s => createPNG(s));

  // ICO header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);       // reserved
  header.writeUInt16LE(1, 2);       // type: icon
  header.writeUInt16LE(sizes.length, 4);

  // directory entries (16 bytes each)
  const dirSize = sizes.length * 16;
  const dirs = Buffer.alloc(dirSize);
  let offset = 6 + dirSize;

  pngs.forEach((png, i) => {
    const base = i * 16;
    const s = sizes[i];
    dirs[base]   = s >= 256 ? 0 : s;  // width  (0 = 256)
    dirs[base+1] = s >= 256 ? 0 : s;  // height
    dirs[base+2] = 0;   // color count
    dirs[base+3] = 0;   // reserved
    dirs.writeUInt16LE(1, base+4);    // planes
    dirs.writeUInt16LE(32, base+6);   // bit count
    dirs.writeUInt32LE(png.length, base+8);
    dirs.writeUInt32LE(offset, base+12);
    offset += png.length;
  });

  return Buffer.concat([header, dirs, ...pngs]);
}

// ── 输出 ─────────────────────────────────────────────────
const assetsDir = path.join(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const png256 = createPNG(256);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png256);
console.log(`icon.png generated (256x256, ${png256.length} bytes)`);

const ico = createICO([16, 32, 48, 256]);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico);
console.log(`icon.ico generated (16/32/48/256px, ${ico.length} bytes)`);
