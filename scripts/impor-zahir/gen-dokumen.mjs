// SQL histori dokumen Zahir (zh_docs / zh_doc_lines, migrasi 0028) dari data/pdf-2026-11-28/dokumen.json.
// Idempoten (INSERT OR REPLACE dengan id tetap). Nomor jurnal tautan: penjualan "SJ/<ref>", pembelian "PJ/<ref>",
// pengiriman & penerimaan = nomornya sendiri (DO…, PD…). Tidak membuat jurnal.
// Pemakaian: node scripts/impor-zahir/gen-dokumen.mjs > out.sql ; wrangler d1 execute istana-block-web-db --local|--remote --file out.sql
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const docs = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "data", "pdf-2026-11-28", "dokumen.json"), "utf8"));
const q = (v) => `'${String(v ?? "").replace(/'/g, "''")}'`;
const n = (v) => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "0");
const JOURNAL = { penjualan: (r) => `SJ/${r}`, pembelian: (r) => `PJ/${r}`, pengiriman: (r) => r, penerimaan: (r) => r };

const out = [];
for (const d of docs) {
  const id = `zh:${d.kind}:${d.ref}`;
  out.push(`INSERT OR REPLACE INTO zh_docs (id, kind, ref, date, party_code, party_name, note, order_ref, subtotal, journal_number) VALUES (${[id, d.kind, d.ref, d.date, d.partyCode, d.partyName, d.note, d.order].map(q).join(", ")}, ${n(d.subtotal)}, ${q(JOURNAL[d.kind](d.ref))});`);
  out.push(`DELETE FROM zh_doc_lines WHERE doc_id = ${q(id)};`);
  d.lines.forEach((l, i) => out.push(`INSERT INTO zh_doc_lines (id, doc_id, sort, label, qty, unit, price, amount) VALUES (${q(`${id}:${i}`)}, ${q(id)}, ${i}, ${q(l.label)}, ${n(l.qty)}, ${q(l.unit)}, ${n(l.price)}, ${n(l.amount)});`));
}
process.stdout.write(out.join("\n") + "\n");
