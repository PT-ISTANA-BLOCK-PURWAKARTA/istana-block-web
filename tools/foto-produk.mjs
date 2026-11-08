// Mengubah foto produk asli (dari kamera/HP) menjadi master 1600x1600 di public/img/produk/.
//
// Pakai:
//   1. Taruh foto di 06-aset/foto-produk/ dengan nama = slug produk:
//      paving-block.jpg, u-ditch.jpg, buis-beton.jpg, kanstin.jpg,
//      genteng-beton.jpg, greffel-beton.jpg, jasa-pasang-paving.jpg
//   2. npm run foto:produk
//
// Skrip memotong persegi (fokus otomatis ke bagian paling "menarik"), menyimpan WebP 1600px,
// lalu memanggil tools/gambar-varian.mjs untuk membuat varian 320/480/800/1200.
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sumber = join(root, "..", "06-aset", "foto-produk");
const tujuan = join(root, "public", "img", "produk");

const SLUG = new Set([
  "paving-block", "u-ditch", "buis-beton", "kanstin", "genteng-beton", "greffel-beton",
  "jasa-pasang-paving", "buis-beton", "kanstin-beton", "grass-block",
]);
const GANTI_NAMA = { "kanstin-beton": "kanstin", "grass-block": "greffel-beton" };
const EKSTENSI = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);

if (!existsSync(sumber)) {
  console.error(`Folder foto belum ada: ${sumber}`);
  console.error("Buat folder itu dan taruh foto produk di dalamnya (nama berkas = slug produk).");
  process.exit(1);
}

const berkas = readdirSync(sumber).filter((f) => EKSTENSI.has(extname(f).toLowerCase()));
if (!berkas.length) {
  console.error(`Tidak ada foto di ${sumber}.`);
  process.exit(1);
}

let jadi = 0;
for (const nama of berkas) {
  const slugAsli = basename(nama, extname(nama)).toLowerCase().replace(/\s+/g, "-");
  if (!SLUG.has(slugAsli)) {
    console.warn(`lewati ${nama}: nama bukan slug produk yang dikenal`);
    continue;
  }
  const slug = GANTI_NAMA[slugAsli] ?? slugAsli;
  const masuk = join(sumber, nama);
  const keluar = join(tujuan, `${slug}.webp`);
  const info = await sharp(masuk).metadata();
  await sharp(masuk)
    .resize({ width: 1600, height: 1600, fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 80, effort: 6, smartSubsample: true })
    .toFile(keluar);
  const ukuran = statSync(keluar).size;
  console.log(`+ ${slug}.webp  ${info.width}x${info.height} -> 1600x1600  ${Math.round(ukuran / 1024)} KB`);
  jadi++;
}

if (!jadi) {
  console.error("Tidak ada berkas yang cocok dengan nama slug produk.");
  process.exit(1);
}

console.log(`\n${jadi} foto diproses. Membuat varian...`);
const r = spawnSync("node", [join(root, "tools", "gambar-varian.mjs"), "--paksa"], { stdio: "inherit", cwd: root });
process.exit(r.status ?? 0);
