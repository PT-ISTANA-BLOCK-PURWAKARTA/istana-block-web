import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { PrintDoc, Sign } from "@/components/erp/PrintDoc";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { partyFromMemo } from "@/lib/erp/cashList";
import { getFinSettings, loadAccounts } from "@/lib/erp/server";
import { formatAmount, terbilang, tglPanjang } from "@/lib/erp/util";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak bukti kas", robots: { index: false } };

type Kind = "masuk" | "keluar" | "transfer";
const TITLE: Record<Kind, string> = { masuk: "BUKTI KAS MASUK", keluar: "BUKTI KAS KELUAR", transfer: "BUKTI TRANSFER KAS" };
type Row = { key: string; code: string; name: string; job: string; memo: string; amount: number };
type Voucher = { kind: Kind; number: string; date: string; cash: string; party: string; partyCode: string; memo: string; project: string; rows: Row[]; amount: number; back: string; zahir: boolean };

/**
 * Bukti Kas Masuk / Kas Keluar / Transfer (gaya Zahir) untuk ditandatangani: akun kas, nama & ID, alokasi dana per akun dan job, terbilang.
 * `id` = transaksi kas web, atau jurnal impor Zahir (CD/CR/TR) dari histori daftar kas.
 */
async function loadVoucher(id: string): Promise<Voucher | "draft" | null> {
  const db = await getDb();
  const acc = await loadAccounts(db);
  const accName = (accountId: string | null | undefined) => {
    const a = accountId ? acc.byId.get(accountId) : undefined;
    return a ? `${a.code} · ${a.name}` : "—";
  };
  const c = await db.query.cashTxns.findFirst({ where: eq(schema.cashTxns.id, id) });
  if (c) {
    if (c.status === "draft") return "draft";
    const [contact, lines] = await Promise.all([
      c.contactId ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, c.contactId) }) : undefined,
      db.select().from(schema.cashLines).where(eq(schema.cashLines.cashId, id)).orderBy(asc(schema.cashLines.sort)),
    ]);
    const projIds = [...new Set([c.projectId, ...lines.map((l) => l.projectId)].filter(Boolean) as string[])];
    const projects = new Map((projIds.length ? await db.select().from(schema.projects).where(inArray(schema.projects.id, projIds)) : []).map((p) => [p.id, p]));
    const head = c.projectId ? projects.get(c.projectId) : undefined;
    const rows: Row[] =
      c.kind === "transfer"
        ? [{ key: "t", code: acc.byId.get(c.toAccountId ?? "")?.code ?? "", name: acc.byId.get(c.toAccountId ?? "")?.name ?? "", job: "", memo: c.memo, amount: c.amount }]
        : lines.map((l) => ({
            key: l.id,
            code: acc.byId.get(l.accountId)?.code ?? "",
            name: acc.byId.get(l.accountId)?.name ?? "",
            job: (l.projectId ? projects.get(l.projectId) : head)?.code ?? "",
            memo: l.memo,
            amount: l.amount,
          }));
    return {
      kind: c.kind,
      number: c.number,
      date: c.date,
      cash: accName(c.accountId),
      party: c.kind === "transfer" ? "" : (contact?.name ?? partyFromMemo(c.memo)),
      partyCode: contact?.code ?? "",
      memo: c.memo,
      project: head ? `${head.code}${head.name ? ` · ${head.name}` : ""}` : "",
      rows,
      amount: c.amount,
      back: `/akuntansi/kas/${c.id}`,
      zahir: false,
    };
  }
  // Histori impor Zahir: jurnal bernomor CD… (kas keluar), CR… (kas masuk), TR… (transfer).
  const j = await db.query.journals.findFirst({ where: eq(schema.journals.id, id) });
  if (!j || !/^(CD|CR|TR)/.test(j.number)) return null;
  const kind: Kind = j.number.startsWith("CR") ? "masuk" : j.number.startsWith("CD") ? "keluar" : "transfer";
  const lines = await db.select().from(schema.journalLines).where(eq(schema.journalLines.journalId, id)).orderBy(asc(schema.journalLines.sort));
  const isCash = (accountId: string) => acc.byId.get(accountId)?.group === "kas_bank";
  // Sisi kas: kas masuk = debit akun kas, kas keluar/transfer = kredit akun kas. Sisi lawan = alokasi dana.
  const cashLines = lines.filter((l) => isCash(l.accountId) && (kind === "masuk" ? l.debit > 0 : l.credit > 0));
  const alloc = lines.filter((l) => !cashLines.includes(l)).filter((l) => (kind === "masuk" ? l.credit > 0 : l.debit > 0));
  const amount = lines.reduce((s, l) => s + l.debit, 0);
  return {
    kind,
    number: j.number,
    date: j.date,
    cash: cashLines.map((l) => accName(l.accountId)).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "—",
    party: kind === "transfer" ? "" : partyFromMemo(j.memo),
    partyCode: "",
    memo: j.memo,
    project: "",
    rows: alloc.map((l) => ({ key: l.id, code: acc.byId.get(l.accountId)?.code ?? "", name: acc.byId.get(l.accountId)?.name ?? "", job: "", memo: l.memo, amount: kind === "masuk" ? l.credit : l.debit })),
    amount,
    back: `/akuntansi/kas?jenis=${kind}`,
    zahir: true,
  };
}

export default async function CetakKas({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const v = await loadVoucher(id);
  if (!v) notFound();
  if (v === "draft") {
    return (
      <div className="print-wrap">
        <div className="print-tools no-print"><a href={`/akuntansi/kas/${id}`} className="btn btn-ghost btn-sm">← Kembali</a></div>
        <article className="print-page"><p className="alert alert-warn">Transaksi ini masih draft. Rekam dulu sebelum mencetak bukti kas.</p></article>
      </div>
    );
  }
  const db = await getDb();
  const [site, fin] = await Promise.all([getSettings(), getFinSettings(db)]);
  const company = site.legal_name || site.company_name || "PT. Istana Block Purwakarta";
  return (
    <PrintDoc site={site} npwp={fin.npwp} title={TITLE[v.kind]} subtitle={v.number} back={v.back}>
      <section className="print-meta">
        <div>
          <span className="pm-label">{v.kind === "masuk" ? "Diterima dari" : v.kind === "keluar" ? "Dibayarkan kepada" : "Dari kas/bank"}</span>
          <b>{v.kind === "transfer" ? v.cash : v.party || "—"}</b>
          {v.partyCode && <div>ID {v.partyCode}</div>}
          {v.memo && <div className="pre" style={{ marginTop: 6 }}>{v.memo}</div>}
        </div>
        <dl>
          <dt>No. bukti</dt><dd>{v.number}</dd>
          <dt>Tanggal</dt><dd>{tglPanjang(v.date)}</dd>
          {v.kind !== "transfer" && (<><dt>Akun kas</dt><dd>{v.cash}</dd></>)}
          {v.project && (<><dt>Proyek</dt><dd>{v.project}</dd></>)}
          {v.zahir && (<><dt>Sumber</dt><dd>Impor Zahir</dd></>)}
        </dl>
      </section>
      <table className="print-lines">
        <thead><tr><th style={{ width: 32 }}>No</th><th style={{ width: 80 }}>Kode</th><th>{v.kind === "transfer" ? "Ke kas/bank" : "Nama Akun"}</th><th>Job</th><th>Keterangan</th><th className="num">Nilai</th></tr></thead>
        <tbody>
          {v.rows.map((r, i) => (
            <tr key={r.key}><td>{i + 1}</td><td>{r.code}</td><td>{r.name}</td><td>{r.job}</td><td>{r.memo}</td><td className="num">{formatAmount(r.amount)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="print-foot">
        <div className="print-words">
          <span className="pm-label">Terbilang</span>
          <i>{terbilang(v.amount)}</i>
        </div>
        <dl className="print-totals">
          <dt className="grand">Total</dt><dd className="grand">Rp {formatAmount(v.amount)}</dd>
        </dl>
      </div>
      <Sign labels={["Dibuat oleh,", "Disetujui oleh,", v.kind === "masuk" ? "Penyetor," : v.kind === "keluar" ? "Penerima," : "Diperiksa oleh,"]} />
      <p className="print-note small">{company}</p>
    </PrintDoc>
  );
}
