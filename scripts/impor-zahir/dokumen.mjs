// Urai laporan "Rincian" Zahir (28/11/2026, folder MIGRATE-ZAHIR) menjadi histori dokumen:
//   Penjualan - Rincian, Pengiriman Penjualan - Rincian, Pembelian - Rincian, Pengiriman Pembelian - Rincian.
// Kepala & baris barang dari `pdftotext -raw` (baris "tanggal NAMA (KODE ) IDR", baris nomor dokumen, baris
// "KODE NAMA jumlah SATUAN harga diskon% pajak%" lalu subtotal; nama panjang bisa terpotong ke baris sebelumnya).
// Biaya kirim / diskon akhir / pembayaran dari `pdftotext -layout`. Hasil: data/pdf-2026-11-28/dokumen.json.
// Pemakaian: node scripts/impor-zahir/dokumen.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "data", "pdf-2026-11-28");
const num = (s) => (s == null || s === "" ? 0 : Number(String(s).replace(/,/g, "")));
const iso = (d) => { const [a, b, c] = d.split("/"); return `${c.length === 2 ? `20${c}` : c}-${b}-${a}`; };
const text = (file, mode) => execFileSync("pdftotext", [mode, join(DIR, `${file}.pdf`), "-"], { encoding: "utf8", maxBuffer: 64 << 20 });

export const KINDS = [
  { kind: "penjualan", file: "PENJUALAN RINCIAN" },
  { kind: "pengiriman", file: "PENGIRIMAN PENJUALAN ZAHIR" },
  { kind: "pembelian", file: "PEMBELIAN RINCIAN" },
  { kind: "penerimaan", file: "PEMBELIAN PENGIRIMAN" },
];

const UNIT = "[A-Za-z0-9.\\-/]+";
const QTY = "(-?[\\d,]+\\.\\d\\d)";
const TAIL = `(?:(-?[\\d,]+\\.\\d\\d) )?(\\d+(?:\\.\\d+)?)% (\\d+(?:\\.\\d+)?)%$`;
const ITEM = new RegExp(`^(.+?) ${QTY} (${UNIT}) ${TAIL}`);
const NUMS = new RegExp(`^${QTY} (${UNIT}) ${TAIL}`);
const MONEY = /^-?[\d,]+\.\d\d$/;
// Nomor dokumen; Zahir punya nomor kembar berakhiran titik ("DO000651." ≠ "DO000651").
const REF = /^(\S*\d\S*)(?=\s+(?:Gudang|Head Quarter))/;
const HEAD = /^(\d{2}\/\d{2}\/\d{2,4}) (.+?) \(([^)]*?)\s*\) IDR\b/;
const SKIP = /^(Diterima|Dipesan|Keterangan|Deskripsi|Posting|Jumlah|Telah|Harga|Pajak|Halaman|PT\. ISTANA)/;

function parse({ kind, file }) {
  const lay = text(file, "-layout");
  const raw = text(file, "-raw").split(/\r?\n/).map((l) => l.trim());
  const docs = [];
  let cur = null;
  let pending = [];
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const r = line.match(REF);
    if (r && /Gudang|Head Quarter/.test(line) && !ITEM.test(line)) {
      let head = null;
      let note = "";
      for (let k = i - 1; k >= Math.max(0, i - 10); k--) {
        // Nama panjang: "(KODE )" dan "IDR 1.00" bisa turun ke baris berikutnya.
        if (!head) head = raw[k].match(HEAD) ?? (/^\d{2}\/\d{2}\/\d{2,4} /.test(raw[k]) ? `${raw[k]} ${raw[k + 1] ?? ""} ${raw[k + 2] ?? ""}`.match(HEAD) : null);
        if (raw[k] === "Catatan :" && !note) note = raw[k - 1] ?? "";
      }
      if (!head) continue;
      const code = head[3].trim();
      cur = { kind, ref: r[1], date: iso(head[1]), partyName: head[2].trim(), partyCode: /^(CUST|VNDR)-\d+$/.test(code) ? code : "", note, lines: [] };
      docs.push(cur);
      pending = [];
      continue;
    }
    if (!cur) continue;
    let it = line.match(ITEM);
    if (!it) {
      const n = line.match(NUMS);
      if (n) it = [line, pending.join(" "), ...n.slice(1)];
    }
    if (!it) {
      if (line && !MONEY.test(line) && !line.includes(":") && !SKIP.test(line) && !HEAD.test(line)) pending.push(line);
      continue;
    }
    let sub = null;
    for (let k = i + 1; k < Math.min(i + 4, raw.length); k++) if (MONEY.test(raw[k])) { sub = num(raw[k]); break; }
    cur.lines.push({ label: String(it[1]).trim(), qty: num(it[2]), unit: it[3], price: num(it[4]), disc: Number(it[5]), amount: sub ?? Math.round(num(it[2]) * num(it[4]) * 100) / 100 });
    pending = [];
  }
  const blocks = lay.split(/(?=Tanggal :\s+\d{2}\/)/);
  for (const d of docs) {
    const body = blocks.find((b) => b.includes(d.ref)) ?? "";
    const pick = (re) => num(body.match(re)?.[1]);
    d.ongkir = pick(/Biaya Pengiriman :\s+([\d,.]+)/);
    d.discount = pick(/Diskon Akhir :\s+([\d,.]+)/);
    d.paidReported = /Pembayaran :\s+[\d,]/.test(body) ? pick(/Pembayaran :\s+([\d,.]+)/) : null;
    d.order = body.match(/(?:Pesanan|Sales Order):\s+([A-Z]{2}\d{6})/)?.[1] ?? "";
    d.subtotal = Math.round(d.lines.reduce((t, l) => t + l.amount, 0) * 100) / 100;
    d.total = Math.round((d.subtotal + d.ongkir - d.discount) * 100) / 100;
  }
  return docs;
}

const all = KINDS.flatMap(parse);
const out = join(DIR, "dokumen.json");
writeFileSync(out, JSON.stringify(all, null, 1));
for (const k of KINDS) {
  const ds = all.filter((d) => d.kind === k.kind);
  console.log(`${k.kind}: ${ds.length} dokumen, ${ds.reduce((s, d) => s + d.lines.length, 0)} baris, tanpa baris ${ds.filter((d) => !d.lines.length).length}, total Rp${Math.round(ds.reduce((s, d) => s + d.total, 0)).toLocaleString("id-ID")}, ${ds[0]?.date}..${ds.at(-1)?.date}`);
}
console.log("→", out);
