import Link from "next/link";
import { Ok, PageHead, Rp } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { GROUP_LABEL, GROUP_ORDER } from "@/lib/erp/accounting";
import { trialBalance } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Daftar akun" };

export default async function Akun({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { ok } = await searchParams;
  const db = await getDb();
  const acc = await loadAccounts(db);
  const tb = await trialBalance(db, acc.rows, today());
  const bal = new Map(tb.rows.map((r) => [r.account.id, r.balance]));
  return (
    <>
      <PageHead title="Daftar akun" sub="Bagan akun untuk pembukuan. Akun bertanda “sistem” dipakai jurnal otomatis.">
        <Link href="/keuangan/akun/baru" className="btn btn-primary btn-sm">+ Akun</Link>
      </PageHead>
      <Ok ok={ok} />
      <div className="admin-table">
        <table>
          <thead><tr><th>Kode</th><th>Nama akun</th><th>Golongan</th><th className="num">Saldo hari ini</th></tr></thead>
          <tbody>
            {GROUP_ORDER.flatMap((g) =>
              acc.rows
                .filter((a) => a.group === g)
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((a) => (
                  <tr key={a.id} className={a.active ? "" : "row-muted"}>
                    <td className="tabular">{a.code}</td>
                    <td>
                      <Link href={`/keuangan/akun/${a.id}`}><b>{a.name}</b></Link> {a.systemKey && <span className="badge badge-info">sistem</span>}
                      {a.note && <div className="small muted">{a.note}</div>}
                    </td>
                    <td>{GROUP_LABEL[a.group]}</td>
                    <td className="num"><Link href={`/keuangan/laporan/buku-besar?akun=${a.id}`}><Rp n={bal.get(a.id) ?? 0} /></Link></td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
