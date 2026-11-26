// Uji impor di salinan live: muat backup → jalankan impor → cek neraca saldo, saldo per akun s.d. 31/10 = sebelum impor, laba rugi per bulan.
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
const dir = new URL(".", import.meta.url);
const db = new DatabaseSync(":memory:");
db.exec(fs.readFileSync(new URL("backup-live-sebelum-impor.sql", dir), "utf8"));
const bal = (to) => new Map(db.prepare(`select a.code, sum(l.debit) - sum(l.credit) net from fin_journal_lines l join fin_accounts a on a.id = l.account_id where l.date <= ? group by a.code`).all(to).map((r) => [r.code, Number(r.net)]));
const pl = () => db.prepare(`select substr(l.date,1,7) m, sum(case when a.grp in ('pendapatan','pendapatan_lain') then l.credit - l.debit else 0 end) rev, sum(l.credit - l.debit) * 1 x from fin_journal_lines l join fin_accounts a on a.id = l.account_id where substr(a.code,1,1) between '4' and '9' group by m order by m`).all();
const before = bal("2026-10-31");
const plBefore = pl();
const t0 = Date.now();
db.exec(fs.readFileSync(new URL("impor-zahir-rinci.sql", dir), "utf8"));
console.log("impor", (Date.now() - t0) + "ms");
const after = bal("2026-10-31");
let diff = 0;
for (const c of new Set([...before.keys(), ...after.keys()])) if ((before.get(c) ?? 0) !== (after.get(c) ?? 0)) { diff++; if (diff < 10) console.log("beda", c, before.get(c), after.get(c)); }
console.log("akun beda saldo 31/10:", diff);
const tb = db.prepare("select sum(debit) d, sum(credit) c, count(*) n from fin_journal_lines").get();
console.log("neraca saldo semua:", tb, "seimbang:", tb.d === tb.c);
const unb = db.prepare("select j.number, sum(l.debit)-sum(l.credit) x from fin_journals j join fin_journal_lines l on l.journal_id=j.id group by j.id having x <> 0").all();
console.log("jurnal tak seimbang:", unb.length);
console.log("jurnal per sumber:", db.prepare("select source, count(*) n, min(date) a, max(date) b from fin_journals group by source").all());
console.log("laba bersih per bulan (sebelum → sesudah):");
const plAfter = pl();
for (const r of plAfter) { const b = plBefore.find((x) => x.m === r.m); console.log(r.m, b ? Math.round(b.x) : "-", "→", Math.round(r.x)); }
const lines0 = db.prepare("select count(*) n from fin_journal_lines l left join fin_accounts a on a.id=l.account_id where a.id is null").get();
console.log("baris tanpa akun:", lines0.n);
const nov = bal("2026-11-30");
for (const c of ["110-20", "120-10", "120-20", "120-30", "130-10", "210-10"]) console.log("saldo akhir", c, nov.get(c));
