// Halaman data induk generik: Satuan Pengukuran, Data Pajak, Data Departemen, Data Proyek.
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, sql } from "drizzle-orm";
import { ActionButton } from "@/components/erp/ActionButton";
import { MasterForm } from "@/components/erp/MasterForm";
import { PageHead } from "@/components/erp/ui";
import { deleteMaster } from "@/app/akuntansi/actions/masterData";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { isMasterKind, MASTER } from "@/lib/erp/masterData";
import { formatAmount, tgl } from "@/lib/erp/util";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ jenis: string }> }) {
  const j = (await params).jenis;
  return { title: isMasterKind(j) ? MASTER[j].title : "Data" };
}

export default async function DataInduk({ params, searchParams }: { params: Promise<{ jenis: string }>; searchParams: Promise<{ ubah?: string; ok?: string }> }) {
  await requireModule("keuangan");
  const { jenis } = await params;
  if (!isMasterKind(jenis)) notFound();
  const sp = await searchParams;
  const cfg = MASTER[jenis];
  const db = await getDb();
  const rows = await db.all<Record<string, unknown> & { id: string }>(sql.raw(`select * from ${cfg.table} order by code`));
  const camel = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));
  const list = rows.map(camel);
  const editing = sp.ubah ? list.find((r) => r.id === sp.ubah) : undefined;
  const [accounts, contacts] = await Promise.all([
    cfg.fields.some((f) => f.options === "accounts") ? db.select().from(schema.accounts).orderBy(asc(schema.accounts.code)) : Promise.resolve([]),
    cfg.fields.some((f) => f.options === "contacts") ? db.select({ id: schema.contacts.id, name: schema.contacts.name }).from(schema.contacts).orderBy(asc(schema.contacts.name)) : Promise.resolve([]),
  ]);
  const usage = jenis === "proyek" || jenis === "departemen"
    ? new Map((await db.all<{ k: string; n: number; net: number }>(sql.raw(`select ${jenis === "proyek" ? "project_id" : "department_id"} k, count(*) n, 0 net from fin_journal_lines where ${jenis === "proyek" ? "project_id" : "department_id"} is not null group by k`))).map((u) => [u.k, Number(u.n)]))
    : new Map<string, number>();
  const options = {
    accounts: accounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
    contacts: contacts.map((c) => ({ value: c.id, label: c.name })),
    status: [{ value: "aktif", label: "Aktif" }, { value: "selesai", label: "Selesai" }, { value: "batal", label: "Batal" }],
  };
  const accName = new Map(accounts.map((a) => [a.id, `${a.code} ${a.name}`]));
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const shown = cfg.fields.filter((f) => f.type !== "check" && f.name !== "note");
  const show = (f: (typeof shown)[number], v: unknown) => {
    if (v == null || v === "") return "-";
    if (f.options === "accounts") return accName.get(String(v)) ?? "-";
    if (f.options === "contacts") return contactName.get(String(v)) ?? "-";
    if (f.type === "money") return formatAmount(Number(v));
    if (f.type === "date") return tgl(String(v));
    if (f.type === "number") return `${v}%`;
    return String(v);
  };
  return (
    <>
      <PageHead title={cfg.title} sub={cfg.sub} />
      {sp.ok && <p className="alert alert-ok">Tersimpan: {sp.ok}</p>}
      <section className="zd-card">
        <h2>{editing ? `Ubah ${String(editing.code)}` : `Tambah ${cfg.title.replace(/^Data /, "").toLowerCase()}`}</h2>
        <MasterForm key={String(editing?.id ?? "baru")} kind={jenis} fields={cfg.fields} value={editing} options={options} />
        {editing && <p className="small"><Link href={`/akuntansi/data/${jenis}`}>Batal ubah</Link></p>}
      </section>
      <div className="admin-table" style={{ marginTop: 16 }}>
        <table>
          <thead><tr>{shown.map((f) => <th key={f.name} className={f.type === "money" || f.type === "number" ? "num" : undefined}>{f.label}</th>)}{usage.size > 0 && <th className="num">Dipakai</th>}<th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={String(r.id)} className={r.active ? undefined : "muted"}>
                {shown.map((f) => <td key={f.name} className={f.type === "money" || f.type === "number" ? "num" : undefined}>{show(f, r[f.name])}</td>)}
                {usage.size > 0 && <td className="num">{usage.get(String(r.id)) ?? 0}</td>}
                <td className="small">{r.active ? "Aktif" : "Nonaktif"}</td>
                <td className="nowrap small">
                  <Link href={`/akuntansi/data/${jenis}?ubah=${r.id}`}>Ubah</Link>{" "}
                  {jenis === "proyek" && <Link href={`/akuntansi/laporan/proyek?proyek=${r.id}`}>Laba rugi</Link>}{" "}
                  <ActionButton action={deleteMaster.bind(null, jenis, String(r.id))} label="Hapus" confirmText={`Hapus ${String(r.code)}?`} className="link-btn" />
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={shown.length + 3} className="muted">Belum ada data.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
