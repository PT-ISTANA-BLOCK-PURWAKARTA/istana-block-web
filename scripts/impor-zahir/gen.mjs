// Buat SQL impor rinci Zahir (Buku Besar - Mutasi, Jun–Nov 2026) untuk istana-block-web-db:
// 1) akun Zahir yang belum ada, 2) hapus 6 jurnal ringkasan JU/26xx/0001, 3) saldo awal 31/05 = neraca Zahir (live) − mutasi rinci s.d. 31/10,
// 4) 8.9rb jurnal rinci (nomor = No. Ref. Zahir, source 'zahir').
import fs from "node:fs";
const dir = new URL(".", import.meta.url);
const A = JSON.parse(fs.readFileSync(new URL("ledger2.json", dir)));
const web = JSON.parse(fs.readFileSync(new URL("web-accounts.json", dir)))[0].results;
const webNet = new Map(JSON.parse(fs.readFileSync(new URL("web-net.json", dir)))[0].results.map((r) => [r.code, Number(r.net)]));
const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;
const now = Math.floor(Date.now() / 1000);
const BY = 100001;

// --- jurnal dari baris ledger
const J = new Map();
for (const a of A) for (const r of a.rows) {
  if (!r.debit && !r.credit) continue;
  let ref = r.ref;
  if (r.tp === "PJ" && ref === "30000001") ref = "00000001"; // nomor rusak terbaca dari PDF
  const k = `${r.tp}|${ref}`;
  const j = J.get(k) ?? { tp: r.tp, ref, date: r.date, lines: [] };
  if (r.date < j.date) j.date = r.date;
  j.lines.push({ code: a.code, debit: r.debit, credit: r.credit, desc: r.desc, desc2: r.desc2 ?? "" });
  J.set(k, j);
}
// pembulatan rupiah per baris, selisih pembulatan ke baris terbesar
let maxAdj = 0;
for (const j of J.values()) {
  for (const l of j.lines) { l.d = Math.round(l.debit); l.c = Math.round(l.credit); }
  const diff = j.lines.reduce((s, l) => s + l.d - l.c, 0);
  if (diff) {
    const big = [...j.lines].sort((x, y) => Math.max(y.d, y.c) - Math.max(x.d, x.c))[0];
    if (big.d) big.d -= diff; else big.c += diff;
    maxAdj = Math.max(maxAdj, Math.abs(diff));
  }
  const memoCount = new Map();
  for (const l of j.lines) memoCount.set(l.desc, (memoCount.get(l.desc) ?? 0) + 1);
  const pref = j.lines.find((l) => /^(Penjualan|Pembelian|Retur Penjualan|Retur Pembelian|Potongan Penjualan|Uang Muka Penjualan|Uang Muka Pembelian|Pengiriman)\s*,/i.test(l.desc));
  j.memo = pref ? pref.desc : [...memoCount.entries()].sort((x, y) => y[1] - x[1])[0][0];
}
const num = (j) => (/^\d+$/.test(j.ref) ? `${j.tp}/${j.ref}` : j.ref);

// --- akun baru
const webCodes = new Set(web.map((w) => w.code));
const names = new Map(A.map((a) => [a.code, a.name]));
const newAcc = [...names.keys()].filter((c) => !webCodes.has(c)).map((code) => {
  const sib = web.find((w) => w.code.slice(0, 3) === code.slice(0, 3)) ?? web.find((w) => w.code[0] === code[0] && /^\d{3}-/.test(w.code));
  return { code, name: names.get(code), grp: sib.grp };
});

// --- saldo awal = neraca live (s.d. Okt) − rinci s.d. 31/10
const detNet = new Map();
for (const j of J.values()) if (j.date <= "2026-10-31") for (const l of j.lines) detNet.set(l.code, (detNet.get(l.code) ?? 0) + l.d - l.c);
const opening = [];
for (const code of new Set([...webNet.keys(), ...detNet.keys()])) {
  const v = (webNet.get(code) ?? 0) - (detNet.get(code) ?? 0);
  if (v) opening.push({ code, d: v > 0 ? v : 0, c: v < 0 ? -v : 0 });
}
const opDiff = opening.reduce((s, l) => s + l.d - l.c, 0);
if (opDiff) throw new Error(`saldo awal tidak seimbang ${opDiff}`);

// --- SQL
const out = [];
out.push(`-- Impor rinci Zahir ${new Date().toISOString()}: ${J.size} jurnal`);
for (const a of newAcc) out.push(`INSERT OR IGNORE INTO fin_accounts (id, code, name, grp, system_key, active, note, created_at, updated_at) VALUES (${q(`acc_${a.code}`)}, ${q(a.code)}, ${q(a.name)}, ${q(a.grp)}, NULL, 1, ${q("Zahir: dari Buku Besar - Mutasi")}, ${now}, ${now});`);
out.push(`DELETE FROM fin_journal_lines WHERE journal_id IN (SELECT id FROM fin_journals WHERE number IN ('JU/2605/0001','JU/2606/0001','JU/2607/0001','JU/2608/0001','JU/2609/0001','JU/2610/0001') AND source = 'manual');`);
out.push(`DELETE FROM fin_journals WHERE number IN ('JU/2605/0001','JU/2606/0001','JU/2607/0001','JU/2608/0001','JU/2609/0001','JU/2610/0001') AND source = 'manual';`);
const journalRows = [], lineRows = [];
const addJournal = (id, number, date, memo, lines) => {
  journalRows.push(`(${q(id)}, ${q(number)}, ${q(date)}, ${q(memo.slice(0, 500))}, 'zahir', NULL, ${BY}, ${now}, ${now})`);
  lines.forEach((l, i) => lineRows.push(`(${q(`${id}_${i}`)}, ${q(id)}, ${q(date)}, ${q(l.code)}, ${l.d}, ${l.c}, ${q((l.memo ?? "").slice(0, 500))}, ${i})`));
};
addJournal("zj_saldo_awal", "SA/ZAHIR/0001", "2026-05-31", "Saldo awal dari Zahir sebelum mutasi Juni 2026 (aset tetap, modal, saldo lama)", opening.sort((a, b) => a.code.localeCompare(b.code)).map((l) => ({ ...l, memo: "Saldo awal" })));
const sorted = [...J.values()].sort((a, b) => a.date.localeCompare(b.date) || num(a).localeCompare(num(b)));
for (const j of sorted) addJournal(`zj_${j.tp}_${j.ref}`, num(j), j.date, j.memo, j.lines.map((l) => ({ code: l.code, d: l.d, c: l.c, memo: l.desc2 || (l.desc !== j.memo ? l.desc : "") })));
for (let i = 0; i < journalRows.length; i += 200) out.push(`INSERT INTO fin_journals (id, number, date, memo, source, source_id, created_by, created_at, updated_at) VALUES\n${journalRows.slice(i, i + 200).join(",\n")};`);
for (let i = 0; i < lineRows.length; i += 200)
  out.push(`INSERT INTO fin_journal_lines (id, journal_id, date, account_id, debit, credit, memo, sort) SELECT v.column1, v.column2, v.column3, a.id, v.column5, v.column6, v.column7, v.column8 FROM (VALUES\n${lineRows.slice(i, i + 200).join(",\n")}) v JOIN fin_accounts a ON a.code = v.column4;`);
fs.writeFileSync(new URL("impor-zahir-rinci.sql", dir), out.join("\n") + "\n");
console.log({ journals: J.size + 1, lines: lineRows.length, newAccounts: newAcc.map((a) => `${a.code} ${a.grp}`), openingLines: opening.length, maxRoundingAdj: maxAdj, sqlMB: (out.join("\n").length / 1e6).toFixed(1) });
