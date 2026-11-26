// Perbaiki baris yang salah kolom memakai saldo berjalan; saldo awal semua akun = 0 (Zahir mulai Juni 2026).
import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(new URL("./ledger.json", import.meta.url)));
const c2 = (x) => Math.round(x * 100);
let fixed = 0, unresolved = [], closingBad = [];
for (const a of A) {
  a.opening = 0;
  // orientasi
  let best = null;
  for (const sgn of [1, -1]) { let bal = 0, ok = 0; for (const r of a.rows) { bal += sgn * (r.debit - r.credit); if (r.saldo != null) { if (Math.abs(c2(bal) - c2(r.saldo)) <= 2) ok++; bal = r.saldo; } } if (!best || ok > best.ok) best = { sgn, ok }; }
  a.sgn = /^[234]/.test(a.code) ? -1 : 1; if (best.sgn !== a.sgn && best.ok > 3) console.log("orientasi beda", a.code, a.name, best);
  let bal = 0, segStart = 0;
  for (let i = 0; i < a.rows.length; i++) {
    const r = a.rows[i];
    if (r.saldo == null) continue;
    const seg = a.rows.slice(segStart, i + 1);
    const calc = seg.reduce((s, x) => s + a.sgn * (x.debit - x.credit), bal);
    if (Math.abs(c2(calc) - c2(r.saldo)) > 2) {
      const delta = r.saldo - bal;
      if (seg.length === 1) {
        const amt = Math.abs(delta);
        const up = delta * a.sgn > 0; // naik di sisi debit bila sgn=1
        r.debit = up ? amt : 0; r.credit = up ? 0 : amt; r.fixed = true; fixed++;
      } else {
        // coba: baris dengan jumlah 0 di segmen mendapat sisa selisih
        const zero = seg.filter((x) => !x.debit && !x.credit);
        const others = seg.filter((x) => x.debit || x.credit).reduce((s, x) => s + a.sgn * (x.debit - x.credit), 0);
        const rest = delta - others;
        if (zero.length === 1) { const z = zero[0]; const up = rest * a.sgn > 0; z.debit = up ? Math.abs(rest) : 0; z.credit = up ? 0 : Math.abs(rest); z.fixed = true; fixed++; }
        else unresolved.push(`${a.code} line ${r.line} seg ${seg.length} delta ${delta.toFixed(2)} calc-saldo ${(calc - r.saldo).toFixed(2)}`);
      }
    }
    bal = r.saldo; segStart = i + 1;
  }
  const end = a.rows.reduce((s, x) => s + a.sgn * (x.debit - x.credit), 0);
  if (a.closing != null && Math.abs(c2(end) - c2(a.closing)) > 100) closingBad.push(`${a.code} ${a.name}: calc ${end.toFixed(2)} vs akhir ${a.closing}`);
  const zeros = a.rows.filter((x) => !x.debit && !x.credit);
  if (zeros.length) unresolved.push(`${a.code} zero rows ${zeros.map((z) => z.line).join(",")}`);
}
fs.writeFileSync(new URL("./ledger2.json", import.meta.url), JSON.stringify(A));
console.log({ fixed, unresolved: unresolved.length, closingBad: closingBad.length });
console.log(unresolved.slice(0, 20).join("\n")); console.log(closingBad.slice(0, 20).join("\n"));
