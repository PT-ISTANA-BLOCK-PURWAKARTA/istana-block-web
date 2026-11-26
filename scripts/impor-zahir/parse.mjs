// Parse Zahir "Buku Besar - Mutasi" (pdftotext -table) → per akun: saldo awal, baris (tanggal, tp, ref, ket, debet, kredit, saldo), total.
import fs from "node:fs";
const txt = fs.readFileSync(new URL("./t.txt", import.meta.url), "utf8").replace(/\f/g, "\n");
const lines = txt.split(/\r?\n/);
const NUM = /-?\d{1,3}(?:,\d{3})*\.\d{2}/g;
const toN = (s) => Number(s.replace(/,/g, ""));
const accounts = [];
let acc = null, cols = null, curDate = null, last = null, prevHeadLine = "";
const issues = [];
for (let i = 0; i < lines.length; i++) {
  let L = lines[i];
  if (!L.trim()) continue;
  if (/^Halaman\s*:/.test(L) || /^\d\d\.\d\d\s+\d+\s+\w+,\s+\d{4}/.test(L) || /PT\. ISTANA BLOCK|Buku Besar - Mutasi|Januari 2026 - Kamis/.test(L)) continue;
  const ah = L.match(/^(\d{3}-\d{2})\s{2,}(\S.*?)\s*$/);
  if (ah && !NUM.test(L)) { NUM.lastIndex = 0;
    if (!acc || acc.code !== ah[1]) { acc = { code: ah[1], name: ah[2].replace(/\s+/g, " "), opening: 0, rows: [], total: null, closing: null, mutasi: null }; accounts.push(acc); curDate = null; }
    continue; }
  NUM.lastIndex = 0;
  if (/^Tanggal\s/.test(L)) {
    const pos = (w) => { const k = L.indexOf(w); return k < 0 ? null : k + w.length; };
    cols = { d: pos("Debet"), k: pos("Kredit"), s: pos("Saldo") };
    continue;
  }
  const amounts = [...L.matchAll(NUM)].map((m) => ({ v: toN(m[0]), end: m.index + m[0].length, start: m.index }));
  if (/^Saldo\s+Akhir/.test(L)) { acc.closing = amounts[0]?.v ?? 0; acc.mutasi = amounts[1]?.v ?? null; last = null; continue; }
  if (/^Saldo\s+Awal/.test(L)) {
    if (/Total\s*:/.test(L) || amounts.length === 2) { acc.total = { d: amounts[0]?.v ?? 0, k: amounts[1]?.v ?? 0 }; }
    else if (amounts.length === 1) acc.opening = amounts[0].v;
    last = null; continue;
  }
  if (/^\s*Total\s*:/.test(L)) { acc.total = { d: amounts[0]?.v ?? 0, k: amounts[1]?.v ?? 0 }; continue; }
  // baris transaksi
  const m = L.match(/^(\S*)\s+(CD|CR|GJ|PJ|SA|PA|SJ|SD|SR|IJ|PD|DO)\s+(\S+)\s+(.*)$/);
  if (m && /^(|\d|\d?\d\d\/\d\d\/\d{3})$/.test(m[1])) {
    let dTok = m[1];
    if (dTok.length === 10) dTok = dTok.slice(1);
    if (/^\d\d\/\d\d\/\d{3}$/.test(dTok)) curDate = `2026-${dTok.slice(3, 5)}-${dTok.slice(0, 2)}`;
    const near = (a) => [cols?.d, cols?.k, cols?.s].some((c) => c != null && a.end >= c - 14 && a.end <= c + 14) && a.start > 60;
    const amts = amounts.filter(near);
    const firstNum = amts[0]?.start ?? L.length;
    const restStart = L.indexOf(m[4], L.indexOf(m[3]) + m[3].length);
    const desc = L.slice(restStart, Math.max(restStart, firstNum)).replace(/\s+/g, " ").trim();
    let debit = 0, credit = 0, saldo = null;
    for (const a of amts) {
      const dist = (c) => (c == null ? 1e9 : Math.abs(a.end - c));
      const best = [["d", dist(cols?.d)], ["k", dist(cols?.k)], ["s", dist(cols?.s)]].sort((x, y) => x[1] - y[1])[0][0];
      if (best === "d") debit += a.v; else if (best === "k") credit += a.v; else saldo = a.v;
    }
    let ref = m[3]; if (/^\d[A-Z]{2}\d+$/.test(ref)) ref = ref.slice(1); if (/^\d{9}$/.test(ref)) ref = ref.slice(1);
    last = { date: curDate, tp: m[2], ref, desc, debit, credit, saldo, line: i + 1 };
    if (!curDate) issues.push(`no date line ${i + 1}`);
    acc.rows.push(last);
    continue;
  }
  // lanjutan keterangan (atau sisa tahun "6")
  const t = L.replace(/^\s*6?\s+/, "").replace(/\s+/g, " ").trim();
  if (last && t) { last.desc2 = last.desc2 ? `${last.desc2} ${t}` : t; continue; }
  if (t && t !== "6") issues.push(`unparsed ${i + 1}: ${L.trim().slice(0, 100)}`);
}
// verifikasi: total debet/kredit & saldo berjalan
let bad = 0;
for (const a of accounts) {
  const d = a.rows.reduce((s, r) => s + r.debit, 0), k = a.rows.reduce((s, r) => s + r.credit, 0);
  const r2 = (x) => Math.round(x * 100);
  if (a.total && (r2(d) !== r2(a.total.d) || r2(k) !== r2(a.total.k))) { bad++; issues.push(`TOTAL ${a.code} ${a.name}: parsed ${d}/${k} vs ${a.total.d}/${a.total.k}`); }
}
fs.writeFileSync(new URL("./ledger.json", import.meta.url), JSON.stringify(accounts));
console.log({ accounts: accounts.length, rows: accounts.reduce((s, a) => s + a.rows.length, 0), totalMismatch: bad, issues: issues.length });
console.log(issues.filter(x=>x.startsWith("TOTAL")).slice(0, 25).join("\n"));
