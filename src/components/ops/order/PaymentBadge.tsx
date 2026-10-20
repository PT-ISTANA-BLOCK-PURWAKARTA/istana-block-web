import { PAYMENT_LABELS, type PaymentStatus } from "@/lib/ops/shared/zahirInvoice";

const TONE: Record<PaymentStatus, string> = { lunas: "badge-on", belum_lunas: "badge-danger", tempo: "badge-warn", tidak_diketahui: "badge-off" };
const SHORT: Record<PaymentStatus, string> = { lunas: "Lunas", belum_lunas: "Belum lunas", tempo: "Tempo", tidak_diketahui: "Bayar ?" };

/** Lencana status bayar PO (dari faktur Zahir). Nominal tidak pernah disimpan, jadi aman ditampilkan ke semua peran kantor. */
export function PaymentBadge({ status, long = false }: { status: string | null | undefined; long?: boolean }) {
  if (!status || !(status in TONE)) return null;
  const s = status as PaymentStatus;
  return <span className={`badge ${TONE[s]}`} title={PAYMENT_LABELS[s]}>{long ? PAYMENT_LABELS[s] : SHORT[s]}</span>;
}
