"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { cancelOrder, deleteOrder } from "@/app/operasional/actions/orders";

/** Batalkan atau hapus pesanan: keduanya wajib alasan (3-500 huruf) dan dicatat. */
export function OrderDanger({ id, number, canCancel, canDelete }: { id: string; number: string; canCancel: boolean; canDelete: boolean }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {canCancel && (
        <details className="danger-zone">
          <summary>Batalkan pesanan</summary>
          <ActionForm action={cancelOrder} className="stack" style={{ gap: 10, paddingTop: 10 }}>
            <input type="hidden" name="id" value={id} />
            <div className="field">
              <label htmlFor="po-cancel-reason">Alasan pembatalan</label>
              <textarea id="po-cancel-reason" name="reason" rows={2} required minLength={3} maxLength={500} placeholder="mis. pelanggan membatalkan, salah input, dobel dengan PO lain" style={{ minHeight: 64 }} />
            </div>
            <p className="small muted">Jadwal kirim yang belum berangkat ikut dibatalkan dan sopirnya diberi tahu. Pesanan yang sudah ada barang berangkat atau terkirim tidak bisa dibatalkan dari sini.</p>
            <div><SubmitButton className="btn btn-ghost btn-sm" pendingText="Membatalkan…">Batalkan {number}</SubmitButton></div>
          </ActionForm>
        </details>
      )}
      {canDelete && (
        <details className="danger-zone">
          <summary>Hapus pesanan</summary>
          <ActionForm action={deleteOrder} className="stack" style={{ gap: 10, paddingTop: 10 }}>
            <input type="hidden" name="id" value={id} />
            <div className="field">
              <label htmlFor="po-delete-reason">Alasan penghapusan</label>
              <textarea id="po-delete-reason" name="reason" rows={2} required minLength={3} maxLength={500} placeholder="mis. salah input, PO uji coba" style={{ minHeight: 64 }} />
            </div>
            <p className="small muted">Pesanan dihapus permanen dan jejaknya (nomor, pelanggan, alasan, isi pesanan) tersimpan di tab “Dihapus”. Hanya bisa bila tidak ada surat jalan yang berangkat atau terkirim, tanpa foto bukti, dan belum difaktur.</p>
            <div><SubmitButton className="link-btn" pendingText="Menghapus…">Hapus {number} permanen</SubmitButton></div>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
