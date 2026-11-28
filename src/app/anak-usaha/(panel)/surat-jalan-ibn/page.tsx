// Surat Jalan IBN (CV. Istana Bangun Nusantara) untuk proyek U-Ditch: daftar, buat / ubah (keuangan), cetak format Zahir.
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { ActionButton } from "@/components/erp/ActionButton";
import { DeliveryNoteForm, type DeliveryNoteValue } from "@/components/erp/DeliveryNoteForm";
import { deleteDeliveryNote } from "@/app/akuntansi/actions/deliveryNotes";
import { getDb, schema } from "@/db";
import { requireAnak } from "@/lib/auth";
import { deliveryNoteNumber, noteLines } from "@/lib/erp/deliveryNote";
import { documentSigners, productNames } from "@/lib/erp/signers";
import { today } from "@/lib/erp/util";
import { can } from "@/lib/roles";
import { ZahirPage } from "@/components/erp/ZahirPage";

export const metadata = { title: "Surat Jalan IBN" };
export const dynamic = "force-dynamic";

type Row = { id: string; number: string; note_date: string; customer_name: string; po_number: string | null; driver_name: string | null; plate: string | null; items: string; pickup: number; is_internal: number };

export default async function SuratJalanIbn({ searchParams }: { searchParams: Promise<{ q?: string; bulan?: string; baru?: string; id?: string; ok?: string }> }) {
  const user = await requireAnak("uditch", "keuangan");
  const canEdit = can(user.roles, "keuangan") || can(user.roles, "uditch");
  const sp = await searchParams;
  const db = await getDb();
  const month = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : "";
  const term = `%${(sp.q ?? "").trim()}%`;
  const rows = await db.all<Row>(sql`
    select id, number, note_date, customer_name, po_number, driver_name, plate, items, pickup, is_internal from ops_delivery_notes
    where issuer = 'ibn' and (${month} = '' or substr(note_date, 1, 7) = ${month})
      and (number like ${term} or customer_name like ${term} or coalesce(po_number, '') like ${term} or coalesce(driver_name, '') like ${term})
    order by note_date desc, seq desc limit 500`);
  const editing = canEdit && sp.id ? await db.query.deliveryNotes.findFirst({ where: eq(schema.deliveryNotes.id, sp.id) }) : undefined;
  const showForm = canEdit && (sp.baru || editing);
  const [signers, products, m] = showForm ? await Promise.all([documentSigners(db), productNames(db), db.get<{ s: number }>(sql`select coalesce(max(seq), 0) s from ops_delivery_notes where issuer = 'ibn'`)]) : [[], [], undefined];
  const value: DeliveryNoteValue = editing
    ? {
        id: editing.id, issuer: "ibn", number: editing.number, noteDate: editing.noteDate, poNumber: editing.poNumber ?? "", terms: editing.terms ?? "", customerName: editing.customerName, customerPhone: editing.customerPhone ?? "",
        address: editing.address ?? "", note: editing.note ?? "", items: noteLines(editing.items).map((l) => ({ name: l.name, quantity: String(l.quantity), unit: l.unit, remark: l.remark ?? "" })),
        driverName: editing.pickup ? "" : editing.driverName ?? "", plate: editing.plate ?? "", pickup: editing.pickup, isInternal: editing.isInternal, signerId: editing.signerId ? String(editing.signerId) : "", signerName: editing.signerName ?? "",
      }
    : { issuer: "ibn", number: "", noteDate: today(), poNumber: "", terms: "", customerName: "", customerPhone: "", address: "", note: "", items: [{ name: "", quantity: "", unit: "pcs", remark: "" }], driverName: "", plate: "", pickup: false, isInternal: false, signerId: "", signerName: "" };
  return (
    <ZahirPage title="Surat Jalan IBN" sub="CV. Istana Bangun Nusantara · proyek U-Ditch · tanpa harga, cetak Lembar Asli + Copy" hub="/anak-usaha/menu/uditch" actions={<>
        {canEdit && <Link href="/anak-usaha/surat-jalan-ibn?baru=1" className="btn btn-blue btn-sm">+ Surat jalan IBN</Link>}
      </>}>
      {sp.ok && <p className="alert alert-ok">Surat jalan tersimpan.</p>}
      {showForm && (
        <section className="zd-card" style={{ marginBottom: 16 }}>
          <h2>{editing ? `Ubah ${editing.number}` : "Surat jalan IBN baru"}</h2>
          <DeliveryNoteForm key={editing?.id ?? "baru"} initial={value} signers={signers} products={products} nextNumber={deliveryNoteNumber(Number(m?.s ?? 0) + 1, "ibn")} />
          <p className="small"><Link href="/anak-usaha/surat-jalan-ibn">Tutup form</Link></p>
        </section>
      )}
      <form className="filter-bar" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Cari nomor, penerima, PO, sopir" aria-label="Cari" />
        <input type="month" name="bulan" defaultValue={month} aria-label="Bulan" />
        <button className="btn btn-ghost btn-sm">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Kepada</th><th>No. PO</th><th>Barang</th><th>Sopir / plat</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const lines = noteLines(JSON.parse(r.items || "[]"));
              return (
                <tr key={r.id}>
                  <td><b>{r.number}</b>{r.is_internal ? <div className="small muted">internal</div> : null}</td>
                  <td>{r.note_date}</td>
                  <td>{r.customer_name}</td>
                  <td>{r.po_number || "-"}</td>
                  <td className="small">{lines.map((l) => `${l.name} ${l.quantity.toLocaleString("id-ID")} ${l.unit}`).join(" · ")}</td>
                  <td>{r.pickup ? "Diambil pelanggan" : [r.driver_name, r.plate].filter(Boolean).join(" · ") || "-"}</td>
                  <td className="small">
                    <Link href={`/akuntansi/cetak/surat-jalan-manual/${r.id}`}>Cetak</Link>
                    {canEdit && <> · <Link href={`/anak-usaha/surat-jalan-ibn?id=${r.id}`}>Ubah</Link> · <ActionButton action={deleteDeliveryNote.bind(null, r.id)} label="Hapus" confirmText={`Hapus surat jalan ${r.number}?`} className="link-btn" /></>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7} className="muted">Belum ada surat jalan IBN.</td></tr>}
          </tbody>
        </table>
      </div>
    </ZahirPage>
  );
}
