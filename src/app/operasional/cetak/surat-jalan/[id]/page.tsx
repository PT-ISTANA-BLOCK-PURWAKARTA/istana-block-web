import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PrintDoc, Sign } from "@/components/erp/PrintDoc";
import { getDb, schema } from "@/db";
import { deliveryItems, opsAccess } from "@/lib/erp/ops";
import { formatQty, tglPanjang } from "@/lib/erp/util";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak surat jalan", robots: { index: false } };

export default async function CetakSuratJalan({ params }: { params: Promise<{ id: string }> }) {
  await opsAccess();
  const { id } = await params;
  const db = await getDb();
  const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
  if (!d) notFound();
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) });
  const [site, contact, vehicle, driver, items] = await Promise.all([
    getSettings(),
    order ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, order.contactId) }) : undefined,
    d.vehicleId ? db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, d.vehicleId) }) : undefined,
    d.driverId ? db.query.drivers.findFirst({ where: eq(schema.drivers.id, d.driverId) }) : undefined,
    deliveryItems(db, [id]),
  ]);
  const lines = items.get(id) ?? [];
  return (
    <PrintDoc site={site} title="SURAT JALAN" subtitle={d.number} back={`/operasional/pengiriman/${d.id}`}>
      {d.status === "batal" && <p className="print-note" style={{ borderColor: "var(--bahaya)", color: "var(--bahaya)", fontWeight: 700 }}>DIBATALKAN — dokumen ini tidak berlaku.</p>}
      <section className="print-meta">
        <div>
          <span className="pm-label">Kirim ke</span>
          <b>{contact?.company || contact?.name}</b>
          {contact?.company && contact.name !== contact.company && <div>u.p. {contact.name}</div>}
          {order?.project && <div>Proyek: {order.project}</div>}
          <div className="pre">{order?.address || contact?.address}</div>
          {order?.siteContact ? <div>Kontak lokasi: {order.siteContact}</div> : contact?.phone && <div>Telp. {contact.phone}</div>}
        </div>
        <dl>
          <dt>Tanggal</dt><dd>{tglPanjang(d.date)}</dd>
          <dt>No. pesanan</dt><dd>{order?.number}</dd>
          {order?.customerRef && (<><dt>No. PO pelanggan</dt><dd>{order.customerRef}</dd></>)}
          <dt>Kendaraan</dt><dd>{vehicle ? `${vehicle.plate}${vehicle.name ? ` · ${vehicle.name}` : ""}` : "………………"}</dd>
          <dt>Sopir</dt><dd>{driver?.name ?? "………………"}</dd>
        </dl>
      </section>
      <table className="print-lines">
        <thead><tr><th style={{ width: 32 }}>No</th><th>Nama barang</th><th className="num">Qty</th><th>Satuan</th><th>Keterangan</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}><td>{i + 1}</td><td>{l.name}</td><td className="num"><b>{formatQty(l.qty)}</b></td><td>{l.unit}</td><td /></tr>
          ))}
        </tbody>
      </table>
      {(d.note || order?.note) && <p className="print-note pre">{[d.note, order?.note].filter(Boolean).join("\n")}</p>}
      <p className="small" style={{ fontSize: 12, color: "#444" }}>Barang telah diterima dalam keadaan baik dan jumlah yang sesuai. Mohon periksa sebelum menandatangani.</p>
      <Sign labels={["Hormat kami,", "Sopir,", "Penerima,"]} />
    </PrintDoc>
  );
}
