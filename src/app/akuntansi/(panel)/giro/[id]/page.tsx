// Detail giro: data giro, bukti penerimaan/pembayaran, pencairan / penolakan.
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/erp/ActionButton";
import { GiroActions } from "@/components/erp/GiroForms";
import { BackLink, PageHead } from "@/components/erp/ui";
import { deleteGiro, undoClearGiro } from "@/app/akuntansi/actions/returnsGiro";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { GIRO_STATUS_LABEL } from "@/lib/erp/returnsGiro";
import { journalFor, loadAccounts } from "@/lib/erp/server";
import { formatAmount, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Giro" };
export const dynamic = "force-dynamic";

export default async function GiroDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const g = await db.query.giros.findFirst({ where: eq(schema.giros.id, id) });
  if (!g) notFound();
  const [acc, clearJ, info] = await Promise.all([
    loadAccounts(db),
    journalFor(db, "giro", g.id),
    db.get<{ contact: string; doc: string | null }>(sql`select c.name contact, coalesce(r.number, p.number) doc from fin_giros g join fin_contacts c on c.id = g.contact_id left join fin_receipts r on r.id = g.doc_id left join fin_payments p on p.id = g.doc_id where g.id = ${id}`),
  ]);
  const banks = acc.rows.filter((a) => a.group === "kas_bank" && a.active).sort((a, b) => (a.systemKey === "bank" ? -1 : b.systemKey === "bank" ? 1 : a.code.localeCompare(b.code))).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  const docHref = g.docId ? `/akuntansi/${g.kind === "masuk" ? "penerimaan" : "pembayaran"}/${g.docId}` : null;
  return (
    <>
      <BackLink href={`/akuntansi/giro?jenis=${g.kind}`}>Giro {g.kind}</BackLink>
      <PageHead title={`Giro ${g.giroNo}`} sub={`${g.kind === "masuk" ? "Dari" : "Untuk"} ${info?.contact ?? ""} · ${GIRO_STATUS_LABEL[g.status]}`}>
        {g.status === "cair" && <ActionButton action={undoClearGiro.bind(null, g.id)} label="Batalkan pencairan" confirmText="Batalkan pencairan giro ini?" className="btn btn-ghost btn-sm" />}
        {g.status === "tolak" && <ActionButton action={deleteGiro.bind(null, g.id)} label="Hapus catatan" confirmText="Hapus catatan giro yang ditolak ini?" className="btn btn-ghost btn-sm" />}
      </PageHead>
      <section className="zd-card">
        <dl className="kv">
          <dt>Bank</dt><dd>{g.bank || "-"}</dd>
          <dt>Nominal</dt><dd><b>{formatAmount(g.amount)}</b></dd>
          <dt>{g.kind === "masuk" ? "Diterima" : "Diterbitkan"}</dt><dd>{tgl(g.issueDate)}</dd>
          <dt>Jatuh tempo</dt><dd className={g.status === "beredar" && g.dueDate <= today() ? "text-bahaya" : undefined}>{tgl(g.dueDate)}</dd>
          <dt>Bukti</dt><dd>{docHref && info?.doc ? <Link href={docHref}>{info.doc}</Link> : "-"}</dd>
          {g.clearedDate && <><dt>Cair</dt><dd>{tgl(g.clearedDate)} {clearJ[0] && <Link href={`/akuntansi/jurnal/${clearJ[0].journalId}`}>{clearJ[0].number}</Link>}</dd></>}
          {g.note && <><dt>Catatan</dt><dd>{g.note}</dd></>}
        </dl>
      </section>
      {g.status === "beredar" && (
        <section className="zd-card" style={{ marginTop: 16 }}>
          <h2>Pencairan</h2>
          <GiroActions id={g.id} banks={banks} today={today()} status={g.status} />
        </section>
      )}
    </>
  );
}
