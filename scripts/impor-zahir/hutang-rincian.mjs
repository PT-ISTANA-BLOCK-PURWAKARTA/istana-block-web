// Urai "Pembelian - Rincian" Zahir 1/6–28/11/2026 (HUTANG-RINCIAN.pdf) → sisa hutang per faktur pemasok (Saldo > 0).
// Tiap dokumen memuat "Pembayaran :" dan "Saldo :"; sisa hutang = Saldo. Pemasok & kode (VNDR-n) dari kepala dokumen.
// Hasil: data/pdf-2026-11-28/hutang-rincian.json & ../hutang-rincian-2026-11-28.csv (kode,nama,tanggal,jatuh_tempo,tipe,no_ref,sisa).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "data");
const DIR = join(DATA, "pdf-2026-11-28");
const txt = readFileSync(join(DIR, "HUTANG-RINCIAN.txt"), "utf8");
const num = (s) => Number(String(s).replace(/,/g, ""));
const iso = (d) => { const [a, b, c] = d.split("/"); return `${c.length === 2 ? `20${c}` : c}-${b}-${a}`; };

const docs = [];
for (const blk of txt.split(/(?=^Tanggal :\s+\d{2}\/\d{2}\/\d{2,4}\s+Pemasok)/m)) {
  // Nama pemasok boleh memuat tanda kurung ("PT. … (BEZT) (VNDR-25 )"): kode = kurung berisi VNDR-n atau kurung terakhir sebelum "Mata Uang".
  const h = blk.match(/^Tanggal :\s+(\d{2}\/\d{2}\/\d{2,4})\s+Pemasok :\s+(.+?)\s+\(((?:VNDR-\d+)|[^()]*?)\s*\)\s+Mata Uang/m);
  const ref = blk.match(/No\. Referensi :\s+(\S+)/);
  if (!h || !ref) continue;
  const saldo = blk.match(/Saldo :\s+(-?[\d,]+\.\d\d)/);
  const bayar = blk.match(/Pembayaran :\s+(-?[\d,]+\.\d\d)/);
  // Saldo kadang turun ke baris lain (kosong di baris labelnya) → Total − Pembayaran.
  const tot = blk.match(/Total:\s*(-?[\d,]+\.\d\d)/);
  const open = saldo ? num(saldo[1]) : tot && bayar ? Math.round((num(tot[1]) - num(bayar[1])) * 100) / 100 : null;
  docs.push({ code: h[3].trim(), name: h[2].trim(), date: iso(h[1]), ref: ref[1], total: tot ? num(tot[1]) : null, paid: bayar ? num(bayar[1]) : 0, open, derived: !saldo });
}
const unknown = docs.filter((d) => d.open === null);
const rows = docs.filter((d) => d.open !== null && d.open > 0.004);
const total = rows.reduce((s, r) => s + r.open, 0);
writeFileSync(join(DIR, "hutang-rincian.json"), JSON.stringify(rows, null, 1));
const q = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
writeFileSync(join(DATA, "hutang-rincian-2026-11-28.csv"), ["kode,nama,tanggal,jatuh_tempo,tipe,no_ref,sisa", ...rows.map((r) => [r.code, q(r.name), r.date, r.date, "PJ", r.ref, r.open].join(","))].join("\n") + "\n");
console.log(`${docs.length} dokumen, ${rows.length} faktur terbuka, ${new Set(rows.map((r) => r.code)).size} pemasok, total Rp${total.toLocaleString("id-ID")}, saldo tak terbaca ${unknown.length}`);
console.log("tanpa kode pemasok:", rows.filter((r) => !/^VNDR-\d+$/.test(r.code)).map((r) => `${r.ref}:${r.code}`).slice(0, 8).join(", ") || "-");
