// Data induk dari laporan Zahir 27 Nov 2026 → SQL idempoten untuk D1 (pemasok ke Nama Alamat, proyek ke Data Proyek).
// Pemakaian: node scripts/impor-zahir/data-induk.mjs > out.sql ; lalu wrangler d1 execute istana-block-web-db --remote --file out.sql
// - Pemasok: dibuat kind 'pemasok' dengan catatan "Zahir VNDR-…"; bila nama sudah ada sebagai pelanggan → kind 'keduanya'.
// - Proyek: kode Zahir sebagai kode proyek (unik); yang sudah ada tidak diubah.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "data");
const q = (v) => (v == null || v === "" ? "''" : `'${String(v).replace(/'/g, "''")}'`);
const now = Math.floor(Date.now() / 1000);

/** CSV sederhana dengan dukungan tanda kutip ganda. */
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
for (const v of csv("pemasok-2026-11-27.csv")) {
  const note = `Zahir ${v.kode}${v.kontak ? ` · kontak ${v.kontak}` : ""}`;
  // Sudah ada (nama sama, huruf besar/kecil diabaikan): jadikan 'keduanya' bila pelanggan, lengkapi telepon/alamat yang kosong.
  sql.push(`UPDATE fin_contacts SET kind = CASE WHEN kind = 'pelanggan' THEN 'keduanya' ELSE kind END, phone = CASE WHEN phone = '' THEN ${q(v.telepon)} ELSE phone END, address = CASE WHEN address = '' THEN ${q(v.alamat)} ELSE address END, note = CASE WHEN note NOT LIKE '%${v.kode}%' THEN trim(note || ' ' || ${q(note)}) ELSE note END, updated_at = ${now} WHERE lower(trim(name)) = lower(${q(v.nama.trim())});`);
  sql.push(`INSERT INTO fin_contacts (id, kind, name, company, phone, email, address, npwp, term_days, note, active, created_at, updated_at) SELECT lower(hex(randomblob(16))), 'pemasok', ${q(v.nama.trim())}, '', ${q(v.telepon)}, '', ${q(v.alamat)}, '', 0, ${q(note)}, 1, ${now}, ${now} WHERE NOT EXISTS (SELECT 1 FROM fin_contacts WHERE lower(trim(name)) = lower(${q(v.nama.trim())}));`);
}
for (const p of csv("proyek-2026-11-27.csv")) {
  const note = [p.keterangan, p.no_pesanan ? `No. pesanan Zahir ${p.no_pesanan}` : "", p.pelanggan ? `Pelanggan ${p.pelanggan}` : ""].filter(Boolean).join(" · ");
  sql.push(`INSERT INTO fin_projects (id, code, name, note, active, contact_id, location, start_date, end_date, budget, status, created_at, updated_at) SELECT lower(hex(randomblob(16))), ${q(p.kode)}, ${q(p.nama)}, ${q(note)}, 1, (SELECT id FROM fin_contacts WHERE lower(trim(name)) = lower(${q(p.pelanggan)}) LIMIT 1), '', ${q(p.tanggal)}, NULL, 0, 'aktif', ${now}, ${now} WHERE NOT EXISTS (SELECT 1 FROM fin_projects WHERE code = ${q(p.kode)});`);
}
process.stdout.write(sql.join("\n") + "\n");
