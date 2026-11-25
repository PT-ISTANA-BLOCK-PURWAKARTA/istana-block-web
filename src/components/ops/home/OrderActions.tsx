// Tombol aksi per PO dengan nama, ikon (lucide), warna & urutan seperti kolom "Aksi" di app.kirimistanablock.com:
// Edit · Ubah tamu · Tugaskan/Ubah tugas · Sudah dimuat · Mulai perjalanan · Tambah/Lihat foto · Pasang titik/Edit lokasi ·
// Share ke tamu · Selesaikan · Batalkan status … · Batalkan · Hapus.
// Muat & mulai jalan langsung dari sini; sisanya membuka bagian di halaman detail.
import Link from "next/link";
import { LoadButton } from "@/components/ops/delivery/LoadButton";
import { Icon, type IconName } from "@/components/panel/Icon";

export type OrderActionRow = {
  orderId: string; orderStatus: string; contactId: string; mapsUrl: string;
  deliveryId: string | null; status: string | null; hasDriver: boolean; proofCount: number;
};

const I = ({ n }: { n: IconName }) => <Icon name={n} size={14} stroke={2} />;

function Btn({ href, icon, children, tone = "" }: { href: string; icon: IconName; children: React.ReactNode; tone?: string }) {
  return <Link href={href} className={`oa-btn ${tone}`}><I n={icon} />{children}</Link>;
}

export function OrderActions({ r, canOrders, canShip, canLoad, canComplete, back }: { r: OrderActionRow; canOrders: boolean; canShip: boolean; canLoad: boolean; canComplete: boolean; back: string }) {
  const st = r.status;
  const cancelled = r.orderStatus === "batal" || st === "batal";
  const done = st === "terkirim";
  const unassigned = !r.deliveryId || (st === "dijadwalkan" && !r.hasDriver);
  const po = `/operasional/pesanan/${r.orderId}`;
  const sj = r.deliveryId ? `/operasional/pengiriman/${r.deliveryId}` : null;
  const transit = st === "berangkat" || st === "tertunda";
  const revertLabel = done ? "Batalkan status Selesai" : transit ? "Batalkan Dalam perjalanan" : "Batalkan status Sampai";
  return (
    <div className="ohome-row-actions">
      {canOrders && !cancelled && unassigned && <Btn href={`${po}/ubah`} icon="pencil">Edit</Btn>}
      {canOrders && !cancelled && !done && !unassigned && <Btn href={`/operasional/pelanggan/${r.contactId}`} icon="userRound">Ubah tamu</Btn>}
      {canShip && !cancelled && !sj && <Btn href={`/operasional/pengiriman/baru?pesanan=${r.orderId}`} icon="userRound">Tugaskan</Btn>}
      {canShip && sj && (st === "dijadwalkan" || st === "dimuat") && <Btn href={`${sj}#tugaskan`} icon="userRound">{r.hasDriver ? "Ubah tugas" : "Tugaskan"}</Btn>}
      {(canShip || canLoad) && sj && st === "dijadwalkan" && r.hasDriver && <LoadButton id={r.deliveryId!} label={<><I n="packageCheck" />Sudah dimuat</>} className="oa-btn oa-sky" back={back} />}
      {canShip && sj && (st === "dimuat" || (st === "dijadwalkan" && r.hasDriver)) && <LoadButton id={r.deliveryId!} to="berangkat" label={<><I n="truckGo" />Mulai perjalanan</>} className="oa-btn oa-teal" back={back} />}
      {canShip && sj && !cancelled && <Btn href={`${sj}#bukti`} icon="imagePlus">{r.proofCount >= 4 ? "Foto lengkap (4/4)" : `Tambah foto (${r.proofCount}/4)`}</Btn>}
      {r.proofCount > 0 && sj && <Btn href={`${sj}#bukti`} icon="imagePlus">Lihat foto ({r.proofCount})</Btn>}
      {canOrders && !cancelled && !done && <Btn href={`${po}/ubah`} icon="mapPin" tone={r.mapsUrl ? "" : "oa-nopin"}>{r.mapsUrl ? "Edit lokasi" : "Pasang titik"}</Btn>}
      {sj && !cancelled && <Btn href={`${sj}#lacak`} icon="send" tone="oa-share">Share ke tamu</Btn>}
      {canComplete && sj && !cancelled && !done && <Btn href={`${sj}#aksi`} icon="checkCheck" tone="oa-green">Selesaikan</Btn>}
      {canComplete && sj && (done || st === "tiba" || transit) && <Btn href={`${sj}#aksi`} icon="undo" tone="oa-rose">{revertLabel}</Btn>}
      {canOrders && !cancelled && !done && <Btn href={`${po}#batal`} icon="ban" tone="oa-amber">Batalkan</Btn>}
      {canOrders && !cancelled && unassigned && <Btn href={`${po}#batal`} icon="trash" tone="oa-danger">Hapus</Btn>}
      {!canOrders && !canShip && <Btn href={sj ?? po} icon="chevron">Lihat</Btn>}
    </div>
  );
}
