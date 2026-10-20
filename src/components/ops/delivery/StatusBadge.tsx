import type { DeliveryStatus } from "@/db/erp";
import { STATUS_LABEL, STATUS_TONE } from "./status";

/** Lencana status surat jalan (termasuk status baru: sudah dimuat, tiba, tertunda). */
export function DeliveryStatusBadge({ s }: { s: string }) {
  const k = s as DeliveryStatus;
  return <span className={`badge ${STATUS_TONE[k] ?? "badge-off"}`}>{STATUS_LABEL[k] ?? s}</span>;
}
