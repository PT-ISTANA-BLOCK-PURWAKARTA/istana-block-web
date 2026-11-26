// Giro Masuk / Giro Keluar: daftar giro dengan status dan jatuh tempo.
import Link from "next/link";
import { Kpis, PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { GIRO_STATUS_LABEL, listGiros } from "@/lib/erp/returnsGiro";
import { addDays, formatAmount, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Giro" };
export const dynamic = "force-dynamic";

export default async function Giro({ searchParams }: { searchParams: Promise<{ jenis?: string; status?: string; ok?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const kind = sp.jenis === "keluar" ? "keluar" : "masuk";
  const status = ["beredar", "cair", "tolak"].includes(sp.status ?? "") ? sp.status : undefined;
  const db = await getDb();
  const rows = await listGiros(db, kind, status);
  const t = today();
  const open = rows.filter((r) => r.status === "beredar");
  const due = open.filter((r) => r.dueDate <= addDays(t, 7));
  const tab = (s: string | undefined, label: string) => <Link href={`/akuntansi/giro?jenis=${kind}${s ? `&status=${s}` : ""}`} aria-current={s === status ? "page" : undefined}>{label}</Link>;
  return (
    <>
      <PageHead title={kind === "masuk" ? "Giro Masuk" : "Giro Keluar"} sub={kind === "masuk" ? "Giro/cek dari pelanggan: dicatat saat diterima, lalu dicairkan ke bank saat jatuh tempo." : "Giro/cek ke pemasok: dicatat saat diterbitkan, lalu dicairkan saat bank mendebet rekening."}>
        <Link href={`/akuntansi/giro/baru?jenis=${kind}`} className="btn btn-primary btn-sm">+ Giro {kind} baru</Link>
      </PageHead>
      {sp.ok && <p className="alert alert-ok">{sp.ok === "dihapus" ? "Catatan giro dihapus." : "Tersimpan."}</p>}
      <nav className="zt-tabs">
        <Link href="/akuntansi/giro" aria-current={kind === "masuk" ? "page" : undefined}>Giro Masuk</Link>
        <Link href="/akuntansi/giro?jenis=keluar" aria-current={kind === "keluar" ? "page" : undefined}>Giro Keluar</Link>
      </nav>
      <Kpis items={[
        { label: "Belum cair", value: formatAmount(open.reduce((s, r) => s + Number(r.amount), 0)), sub: `${open.length} lembar` },
        { label: "Jatuh tempo ≤ 7 hari", value: formatAmount(due.reduce((s, r) => s + Number(r.amount), 0)), sub: `${due.length} lembar`, tone: due.length ? "warn" : undefined },
      ]} />
      <nav className="zt-tabs">{tab(undefined, "Semua")}{tab("beredar", "Belum cair")}{tab("cair", "Cair")}{tab("tolak", "Ditolak")}</nav>
      <div className="admin-table">
        <table>
          <thead><tr><th>No. giro</th><th>Bank</th><th>{kind === "masuk" ? "Pelanggan" : "Pemasok"}</th><th>Diterima/terbit</th><th>Jatuh tempo</th><th>Status</th><th>Bukti</th><th className="num">Nominal</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/akuntansi/giro/${r.id}`}>{r.giroNo}</Link></td><td>{r.bank || "-"}</td><td>{r.contactName}</td><td className="nowrap">{tgl(r.issueDate)}</td>
                <td className={`nowrap${r.status === "beredar" && r.dueDate <= t ? " text-bahaya" : ""}`}>{tgl(r.dueDate)}</td>
                <td className="small">{GIRO_STATUS_LABEL[r.status]}{r.clearedDate ? ` ${tgl(r.clearedDate)}` : ""}</td><td className="small">{r.docNumber ?? "-"}</td>
                <td className="num">{formatAmount(Number(r.amount))}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">Belum ada giro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
