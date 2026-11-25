// Tabel laporan 12 bulan dengan susunan Zahir Accounting 6: judul kelompok, sub-kelompok, baris rekening
// (kode · nama rekening), "Total …", dan baris hasil (Laba/Rugi …). Angka tanpa "Rp", minus untuk saldo berlawanan.
import Link from "next/link";
import { Fragment } from "react";
import { monthCol, type ZBlock } from "@/lib/erp/zahirReports";

const n = (v: number) => (Math.round(v) || 0).toLocaleString("id-ID");

export function ZahirTable({ blocks, months, ledgerTo }: { blocks: ZBlock[]; months: string[]; ledgerTo?: (accountId: string) => string }) {
  const cols = months.length + 2;
  return (
    <div className="admin-table zr-wrap">
      <table className="zr">
        <thead>
          <tr><th className="zr-code">Kode</th><th>Nama Rekening</th>{months.map((m) => <th key={m} className="num">{monthCol(m)}</th>)}</tr>
        </thead>
        <tbody>
          {blocks.map((b, bi) =>
            b.kind === "result" ? (
              <tr key={`r${bi}`} className="zr-result">
                <td colSpan={2}>{b.label}</td>
                {b.values.map((v, i) => <td key={i} className={`num${v < 0 ? " zr-neg" : ""}`}>{n(v)}</td>)}
              </tr>
            ) : (
              <Fragment key={`s${bi}`}>
                <tr className="zr-section"><td colSpan={cols}>{b.section.name}</td></tr>
                {b.section.subs.map((s) => (
                  <Fragment key={s.name}>
                    <tr className="zr-sub"><td colSpan={cols}>{s.name}</td></tr>
                    {s.rows.map((r) => (
                      <tr key={r.code + r.name} className="zr-acc">
                        <td className="zr-code">{r.code}</td>
                        <td>{r.accountId && ledgerTo ? <Link href={ledgerTo(r.accountId)}>{r.name}</Link> : r.name}</td>
                        {r.values.map((v, i) => <td key={i} className={`num${v < 0 ? " zr-neg" : ""}`}>{n(v)}</td>)}
                      </tr>
                    ))}
                    <tr className="zr-subtotal">
                      <td colSpan={2}>Total {s.name}</td>
                      {s.total.map((v, i) => <td key={i} className={`num${v < 0 ? " zr-neg" : ""}`}>{n(v)}</td>)}
                    </tr>
                  </Fragment>
                ))}
                <tr className="zr-total">
                  <td colSpan={2}>{b.totalLabel}</td>
                  {b.section.total.map((v, i) => <td key={i} className={`num${v < 0 ? " zr-neg" : ""}`}>{n(v)}</td>)}
                </tr>
              </Fragment>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Baris datar untuk Excel (urutan & judul sama dengan tabel). */
export function zahirRows(blocks: ZBlock[], months: string[]) {
  const rows: Record<string, string | number>[] = [];
  const line = (code: string, name: string, values: number[]) => rows.push({ code, name, ...Object.fromEntries(values.map((v, i) => [months[i], Math.round(v) || 0])) });
  for (const b of blocks) {
    if (b.kind === "result") { line("", b.label, b.values); continue; }
    rows.push({ code: "", name: b.section.name });
    for (const s of b.section.subs) {
      rows.push({ code: "", name: s.name });
      for (const r of s.rows) line(r.code, r.name, r.values);
      line("", `Total ${s.name}`, s.total);
    }
    line("", b.totalLabel, b.section.total);
  }
  return rows;
}
