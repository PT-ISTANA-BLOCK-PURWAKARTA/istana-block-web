// Membuat varian lebar kecil (webp) untuk gambar statis di public/img, lalu menulis
// src/data/img-variants.json yang dipakai src/lib/img.ts untuk srcset.
//
// Jalankan sekali setiap menambah/mengganti foto statis:  npm run gambar:varian
// Berkas varian yang sudah ada dilewati; tambahkan --paksa untuk membuat ulang.
// Hanya waktu pengembangan (sharp tidak jalan di Workers); hasilnya di-commit sebagai berkas biasa.
//
// Gambar unggahan panel (R2, /media/...) tidak melewati skrip ini dan tampil apa adanya.
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const paksa = process.argv.includes("--paksa");

// Lebar tampil di CSS x DPR menentukan lebar varian (lihat sizes di komponen yang memakainya).
const ATURAN = [
  // Hero beranda: lebar tampil 554px desktop / 277px ponsel (object-fit cover). 800 sudah ada dari sebelumnya.
  { cocok: /^img\/pabrik\/pabrik-mesin-paving\.webp$/, lebar: [400, 800, 1200] },
  // Thumbnail galeri: sizes 285px (desktop) atau 375px (ponsel).
  { cocok: /^img\/galeri\/galeri-\d+-thumb\.webp$/, lebar: [320] },
  // Foto produk persegi 800px: kartu +-300-380px, hero produk 404px tinggi.
  { cocok: /^img\/produk\/.+\.webp$/, lebar: [480] },
  // Lembar spesifikasi/TKDN 1200px: kolom 220-560px.
  { cocok: /^img\/tkdn\/.+\.webp$/, lebar: [480, 800] },
];

// Varian hasil skrip ini (-480.webp dst.) bukan sumber baru.
const VARIAN = /-\d+\.webp$/;

function* telusur(dir) {
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) yield* telusur(p);
    else yield p;
  }
}

const manifest = {};
let baru = 0;
for (const abs of [...telusur(join(pub, "img"))].sort()) {
  const rel = abs.slice(pub.length + 1).replaceAll("\\", "/");
  if (VARIAN.test(rel)) continue;
  const aturan = ATURAN.find((a) => a.cocok.test(rel));
  if (!aturan) continue;
  const { width } = await sharp(abs).metadata();
  // Hanya perkecil dan hanya bila hematnya berarti: varian maksimal 75% lebar asli.
  const sudah = [];
  for (const w of aturan.lebar.filter((x) => x <= width * 0.75)) {
    const tujuan = abs.replace(/\.webp$/, `-${w}.webp`);
    if (paksa || !existsSync(tujuan)) {
      await sharp(abs).resize({ width: w }).webp({ quality: 78, effort: 6 }).toFile(tujuan);
      baru++;
      console.log(`+ ${tujuan.slice(pub.length + 1).replaceAll("\\", "/")}  ${statSync(tujuan).size} B`);
    }
    sudah.push(w);
  }
  if (sudah.length) manifest["/" + rel] = { w: width, v: sudah };
}

// Satu baris per gambar supaya diff mudah dibaca.
const baris = Object.entries(manifest).map(([k, e]) => `  ${JSON.stringify(k)}: ${JSON.stringify(e).replace(/([:,])/g, "$1 ").replace("{", "{ ").replace("}", " }")}`);
writeFileSync(join(root, "src/data/img-variants.json"), `{\n${baris.join(",\n")}\n}\n`);
console.log(`${baru} varian baru; ${Object.keys(manifest).length} gambar masuk src/data/img-variants.json`);
