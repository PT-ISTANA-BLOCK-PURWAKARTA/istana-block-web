import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(new URL("./ledger2.json", import.meta.url)));
const J = new Map();
for (const a of A) for (const r of a.rows) {
  const k = `${r.tp}|${r.ref}`;
  const j = J.get(k) ?? { tp: r.tp, ref: r.ref, dates: new Set(), lines: [] };
  j.dates.add(r.date); j.lines.push({ code: a.code, name: a.name, debit: r.debit, credit: r.credit, desc: r.desc, desc2: r.desc2 ?? "" });
  J.set(k, j);
}
const c = (x) => Math.round(x * 100);
// gabungkan pasangan tak seimbang (tp & tanggal sama, selisih saling menutup) akibat nomor ref terbaca rusak
const ub = () => [...J.values()].filter((j) => Math.abs(c(j.lines.reduce((s, l) => s + l.debit - l.credit, 0))) > 5);
for (const j of ub()) { if (!J.has(j.tp + "|" + j.ref)) continue; const dj = j.lines.reduce((s, l) => s + l.debit - l.credit, 0); const o = ub().find((x) => x !== j && x.tp === j.tp && [...x.dates][0] === [...j.dates][0] && Math.abs(c(dj + x.lines.reduce((s, l) => s + l.debit - l.credit, 0))) <= 5); if (o) { const keep = /^[A-Z]{2}d{6}$|^d{8}$/.test(j.ref) ? j : o; const drop = keep === j ? o : j; keep.lines.push(...drop.lines); drop.dates.forEach((d) => keep.dates.add(d)); J.delete(drop.tp + "|" + drop.ref); console.log("gabung", drop.ref, "->", keep.ref); } }
let unbal = [], multiDate = 0, totalAbs = 0;
for (const j of J.values()) {
  const d = j.lines.reduce((s, l) => s + l.debit, 0), k = j.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(c(d) - c(k)) > 5) unbal.push(`${j.tp} ${j.ref} ${[...j.dates]} d=${d.toFixed(2)} k=${k.toFixed(2)} diff=${(d - k).toFixed(2)} ${j.lines.map((l) => l.code).join(",")}`);
  if (j.dates.size > 1) multiDate++;
  totalAbs += d;
}
console.log({ journals: J.size, unbalanced: unbal.length, multiDate, totalDebit: totalAbs.toFixed(2) });
console.log(unbal.slice(0, 30).join("\n"));
const months = {}; for (const j of J.values()) { const m = [...j.dates][0]?.slice(0, 7); months[m] = (months[m] || 0) + 1; } console.log(months);
fs.writeFileSync(new URL("./journals.json", import.meta.url), JSON.stringify([...J.values()].map((j) => ({ ...j, dates: [...j.dates] }))));
