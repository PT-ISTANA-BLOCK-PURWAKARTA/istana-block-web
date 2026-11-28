// Urai "Piutang Usaha Per Pelanggan - Rincian" Zahir per 28/11/2026 (PIUTANG TAMU.pdf) → sisa piutang per faktur.
// Baris raw: "NAMA | CUST-n (IDR)", lalu per faktur "dd/mm/yyyy TP NOREF" + "dd/mm/yyyy JUMLAH" (jatuh tempo + sisa).
// Hasil: data/pdf-2026-11-28/piutang-tamu.json & .csv (kode,nama,tanggal,jatuh_tempo,tipe,nomor,sisa).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "data", "pdf-2026-11-28");
const raw = execFileSync("pdftotext", ["-raw", join(DIR, "PIUTANG TAMU.pdf"), "-"], { encoding: "utf8" }).split(/\r?\n/).map((l) => l.trim());
const iso = (d) => { const [a, b, c] = d.split("/"); return `${c}-${b}-${a}`; };
const num = (s) => Number(s.replace(/,/g, ""));

const rows = [];
let cust = null;
for (let i = 0; i < raw.length; i++) {
  const c = raw[i].match(/^(.+?) \| (CUST-\d+|[^(]+?) \(IDR\)$/);
  if (c) { cust = { name: c[1].trim(), code: c[2].trim() }; continue; }
  const doc = raw[i].match(/^(\d{2}\/\d{2}\/\d{4}) ([A-Z]{2}) (\S+)$/);
  const due = raw[i + 1]?.match(/^(\d{2}\/\d{2}\/\d{4}) (-?[\d,]+\.\d\d)$/);
  if (cust && doc && due) {
    rows.push({ code: cust.code, name: cust.name, date: iso(doc[1]), due: iso(due[1]), tp: doc[2], ref: doc[3], open: num(due[2]) });
    i++;
  }
}
const total = rows.reduce((s, r) => s + r.open, 0);
writeFileSync(join(DIR, "piutang-tamu.json"), JSON.stringify(rows, null, 1));
writeFileSync(join(DIR, "piutang-tamu.csv"), ["kode,nama,tanggal,jatuh_tempo,tipe,nomor,sisa", ...rows.map((r) => [r.code, `"${r.name.replace(/"/g, '""')}"`, r.date, r.due, r.tp, r.ref, r.open].join(","))].join("\n") + "\n");
console.log(`${rows.length} faktur, ${new Set(rows.map((r) => r.code)).size} pelanggan, total Rp${total.toLocaleString("id-ID")}`);
