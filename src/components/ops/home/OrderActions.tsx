// Tombol aksi per PO dengan nama & urutan seperti kolom "Aksi" di app.kirimistanablock.com:
// Edit · Ubah tamu · Tugaskan/Ubah tugas · Sudah dimuat · Mulai perjalanan · Foto · Lokasi · Bagikan · Selesaikan ·
// Kembalikan status · Batalkan · Hapus. Muat & mulai jalan langsung dari sini; sisanya membuka bagian di halaman detail.
import Link from "next/link";
import { LoadButton } from "@/components/ops/delivery/LoadButton";

export type OrderActionRow = {
  orderId: string; orderStatus: string; contactId: string; mapsUrl: string;
  deliveryId: string | null; status: string | null; hasDriver: boolean; proofCount: number;
};

export function OrderActions({ r, canOrders, canShip, canLoad, canComplete, back }: { r: OrderActionRow; canOrders: boolean; canShip: boolean; canLoad: boolean; canComplete: boolean; back: string }) {
  const st = r.status;
  const cancelled = r.orderStatus === "batal" || st === "batal";
  const done = st === "terkirim";
  const unassigned = !r.deliveryId || (st === "dijadwalkan" && !r.hasDriver);
  const po = `/operasional/pesanan/${r.orderId}`;
  const sj = r.deliveryId ? `/operasional/pengiriman/${r.deliveryId}` : null;
  const ghost = "btn btn-ghost btn-sm";
  return (
    <div className="ohome-row-actions">
      {canOrders && !cancelled && unassigned && <Link href={`${po}/ubah`} className={ghost}>✏️ Edit</Link>}
      {canOrders && !cancelled && !done && !unassigned && <Link href={`/operasional/pelanggan/${r.contactId}`} className={ghost}>👤 Ubah tamu</Link>}
      {canShip && !cancelled && !sj && <Link href={`/operasional/pengiriman/baru?pesanan=${r.orderId}`} className="btn btn-blue btn-sm">👤 Tugaskan</Link>}
      {canShip && sj && (st === "dijadwalkan" || st === "dimuat") && <Link href={`${sj}#tugaskan`} className={ghost}>👤 {r.hasDriver ? "Ubah tugas" : "Tugaskan"}</Link>}
      {(canShip || canLoad) && sj && st === "dijadwalkan" && r.hasDriver && <LoadButton id={r.deliveryId!} label="📦 Sudah dimuat" className="btn btn-primary btn-sm" back={back} />}
      {canShip && sj && (st === "dimuat" || (st === "dijadwalkan" && r.hasDriver)) && <LoadButton id={r.deliveryId!} to="berangkat" label="🚚 Mulai perjalanan" className="btn btn-teal btn-sm" back={back} />}
      {canShip && sj && !cancelled && <Link href={`${sj}#bukti`} className={ghost}>🖼️ {r.proofCount >= 4 ? "Foto lengkap (4/4)" : `Tambah foto (${r.proofCount}/4)`}</Link>}
      {r.proofCount > 0 && sj && <Link href={`${sj}#bukti`} className={ghost}>Lihat foto ({r.proofCount})</Link>}
      {canOrders && !cancelled && !done && <Link href={`${po}/ubah`} className={ghost}>📍 {r.mapsUrl ? "Ubah lokasi" : "Isi lokasi"}</Link>}
      {sj && !cancelled && <Link href={`${sj}#lacak`} className={ghost}>🔗 Bagikan</Link>}
      {canComplete && sj && (st === "berangkat" || st === "tiba" || st === "tertunda") && <Link href={`${sj}#aksi`} className="btn btn-primary btn-sm">✅ Selesaikan</Link>}
      {canShip && sj && (st === "dimuat" || st === "berangkat" || st === "tiba" || st === "terkirim") && <Link href={`${sj}#aksi`} className={ghost}>↩️ Kembalikan status</Link>}
      {canOrders && !cancelled && !done && <Link href={`${po}#batal`} className="btn btn-ghost btn-sm ohome-warn">⛔ Batalkan</Link>}
      {canOrders && !cancelled && unassigned && <Link href={`${po}#batal`} className="btn btn-ghost btn-sm ohome-danger">🗑️ Hapus</Link>}
      {!canOrders && !canShip && <Link href={sj ?? po} className={ghost}>Lihat</Link>}
    </div>
  );
}
