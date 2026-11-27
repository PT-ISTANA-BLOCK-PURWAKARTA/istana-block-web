// "Data Nama" Zahir → ID kontak (fin_contacts.code, migrasi 0026_kas_gaya_zahir) supaya jendela Data Nama di Kas Masuk/Keluar
// menampilkan ID yang sama dengan Zahir dan ID baru di web tidak bentrok dengan ID lama Zahir.
// Pemakaian: node scripts/impor-zahir/data-nama.mjs > out.sql ; lalu wrangler d1 execute istana-block-web-db --local|--remote --file out.sql
// Idempoten (aman dijalankan ulang). Isi:
// 1. Kontak hasil impor sebelumnya yang catatannya memuat "Zahir CUST-…" (impor saldo awal piutang) atau "Zahir VNDR-…"
//    (data-induk.mjs) dan belum punya ID → ID diisi dari catatan itu.
// 2. Employee (EMPL-…) dan Other (OTHR-…) dari laporan 27/11/2026 (employee.pdf, Partner Zahir.pdf):
//    nama yang sudah ada dengan jenis sama & belum ber-ID → diberi ID; belum ada → kontak baru jenis karyawan/lainnya.
//    Nama kembar di Zahir (mis. CEPI EMPL-1 & EMPL-134) hanya dibuat sekali dengan ID pertama.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "data");
const q = (v) => (v == null || v === "" ? "''" : `'${String(v).replace(/'/g, "''")}'`);
const now = Math.floor(Date.now() / 1000);

function csv(file) {
  const [head, ...rows] = readFileSync(join(dir, file), "utf8").trim().split(/\r?\n/).map((line) => {
    const out = []; let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ; else if (ch === "," && !inQ) { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur);
    return out;
  });
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const sql = [];
const free = (code) => `NOT EXISTS (SELECT 1 FROM fin_contacts x WHERE x.code = ${q(code)})`;
// Catatan memuat kode utuh ("Zahir VNDR-1 · kontak …" cocok, "Zahir VNDR-10" tidak cocok untuk VNDR-1).
const noted = (code) => `(' ' || note || ' ') LIKE ${q(`% Zahir ${code} %`)}`;

// 1. ID dari catatan impor sebelumnya.
const known = new Set();
for (const file of ["piutang-rincian-2026-11-27.csv", "pemasok-2026-11-27.csv"]) {
  for (const r of csv(file)) {
    if (!/^(CUST|VNDR)-\d+$/.test(r.kode) || known.has(r.kode)) continue;
    known.add(r.kode);
    sql.push(`UPDATE fin_contacts SET code = ${q(r.kode)}, updated_at = ${now} WHERE id = (SELECT id FROM fin_contacts WHERE code = '' AND ${noted(r.kode)} ORDER BY created_at LIMIT 1) AND ${free(r.kode)};`);
  }
}

// 2. Employee & Other.
for (const v of csv("karyawan-rekanan-2026-11-27.csv")) {
  const name = v.nama.trim();
  if (!name || !/^(EMPL|OTHR)-\d+$/.test(v.kode)) continue;
  const kind = v.kode.startsWith("OTHR") ? "lainnya" : "karyawan";
  const same = `kind = ${q(kind)} AND lower(trim(name)) = lower(${q(name)})`;
  sql.push(`UPDATE fin_contacts SET code = ${q(v.kode)}, note = CASE WHEN ${noted(v.kode)} THEN note ELSE trim(note || ' ' || ${q(`Zahir ${v.kode}`)}) END, updated_at = ${now} WHERE id = (SELECT id FROM fin_contacts WHERE code = '' AND ${same} ORDER BY created_at LIMIT 1) AND ${free(v.kode)};`);
  sql.push(`INSERT INTO fin_contacts (id, kind, code, name, company, phone, email, address, npwp, term_days, note, active, created_at, updated_at) SELECT lower(hex(randomblob(16))), ${q(kind)}, ${q(v.kode)}, ${q(name)}, '', '', '', '', '', 0, ${q(`Zahir ${v.kode}`)}, 1, ${now}, ${now} WHERE ${free(v.kode)} AND NOT EXISTS (SELECT 1 FROM fin_contacts WHERE ${same});`);
}
process.stdout.write(sql.join("\n") + "\n");
