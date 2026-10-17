import Link from "next/link";
import { formatAmount } from "@/lib/erp/util";

type L = { journalId: string; number: string; code: string; name: string; debit: number; credit: number; memo: string };

/** Tabel jurnal yang terbentuk dari sebuah dokumen. */
export function JournalView({ lines, title = "Jurnal otomatis" }: { lines: L[]; title?: string }) {
  if (!lines.length) return null;
  const d = lines.reduce((a, l) => a + Number(l.debit), 0);
  const c = lines.reduce((a, l) => a + Number(l.credit), 0);
  return (
    <section className="admin-table">
      <table className="compact">
        <caption>{title} · <Link href={`/akuntansi/jurnal/${lines[0].journalId}`}>{lines[0].number}</Link></caption>
        <thead><tr><th>Akun</th><th>Keterangan</th><th className="num">Debit</th><th className="num">Kredit</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td><span className="tabular muted">{l.code}</span> {l.name}</td>
              <td className="small">{l.memo}</td>
              <td className="num">{formatAmount(Number(l.debit), { blankZero: true })}</td>
              <td className="num">{formatAmount(Number(l.credit), { blankZero: true })}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={2}>Total</th><th className="num">{formatAmount(d)}</th><th className="num">{formatAmount(c)}</th></tr></tfoot>
      </table>
    </section>
  );
}
