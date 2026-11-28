// Arsip surat jalan manual (app lama) — Operasional hanya melihat. Surat jalan baru dibuat Keuangan dari invoice;
// Operasional menugaskan sopir & armada di menu Pengiriman.
import Link from "next/link";
import { desc, ne } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { noteLines } from "@/lib/erp/deliveryNote";

export const metadata = { title: "Surat jalan" };

export default async function SuratJalan() {
  await opsAccess();
  const db = await getDb();
  // Surat Jalan IBN (U-Ditch) terpisah dari IB: hanya di Anak Perusahaan.
  const rows = await db.select().from(schema.deliveryNotes).where(ne(schema.deliveryNotes.issuer, "ibn")).orderBy(desc(schema.deliveryNotes.noteDate), desc(schema.deliveryNotes.number));
  return (
    <>
      <PageHead title="Surat jalan" sub="Lihat saja. Surat jalan dibuat Keuangan dari invoice; penugasan sopir & armada di menu Pengiriman.">
        <Link href="/operasional/pengiriman" className="btn btn-blue btn-sm">Penugasan sopir</Link>
      </PageHead>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Pelanggan</th><th>PO</th><th>Barang</th><th>Sopir / plat</th><th>Catatan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>{r.noteDate}</td>
                <td>{r.customerName}</td>
                <td>{r.orderPoNumber || r.poNumber || "-"}</td>
                <td className="small">{noteLines(r.items).map((l) => `${l.name} ${l.quantity.toLocaleString("id-ID")} ${l.unit}`).join(" · ")}</td>
                <td>{[r.driverName, r.plate].filter(Boolean).join(" · ") || "-"}</td>
                <td>{r.pickup ? "diambil sendiri" : r.isInternal ? "internal" : r.issuer === "ibn" ? "IBN" : "-"}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">Belum ada surat jalan.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
