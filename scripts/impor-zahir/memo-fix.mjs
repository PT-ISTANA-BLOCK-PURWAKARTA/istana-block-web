// Keterangan jurnal Zahir: utamakan baris "Penjualan, …/Pembelian, …/Retur/Potongan" daripada "Penyesuaian persediaan".
import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(new URL("./ledger2.json", import.meta.url)));
const pref = /^(Penjualan|Pembelian|Retur Penjualan|Retur Pembelian|Potongan Penjualan|Uang Muka Penjualan|Uang Muka Pembelian|Pengiriman)\s*,/i;
const best = new Map();
for (const a of A) for (const r of a.rows) {
  let ref = r.ref; if (r.tp === "PJ" && ref === "30000001") ref = "00000001";
  if (pref.test(r.desc) && !best.has(`${r.tp}|${ref}`)) best.set(`${r.tp}|${ref}`, r.desc);
}
const q = (s) => `'${s.replace(/'/g, "''")}'`;
const out = [...best.entries()].map(([k, m]) => { const [tp, ref] = k.split("|"); return `UPDATE fin_journals SET memo = ${q(m)} WHERE id = ${q(`zj_${tp}_${ref}`)} AND memo LIKE 'Penyesuaian persediaan%';`; });
fs.writeFileSync(new URL("./fix-memo2.sql", import.meta.url), out.join("\n") + "\n");
console.log(out.length);
