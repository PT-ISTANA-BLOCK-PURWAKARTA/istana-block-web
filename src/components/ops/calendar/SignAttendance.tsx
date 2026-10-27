"use client";

import { signAttendance } from "@/app/operasional/actions/calendar";
import { ConfirmAction } from "@/components/erp/ConfirmAction";

/** Peserta menandatangani kehadirannya sendiri (setelah acara dimulai). Sudah TTD = tanda centang. */
export function SignAttendance({ eventId, signed }: { eventId: string; signed: boolean }) {
  if (signed) return <span className="small text-sukses">✓ Anda sudah TTD hadir</span>;
  return <ConfirmAction className="btn btn-blue btn-sm" action={signAttendance.bind(null, eventId)} label="Tanda tangani kehadiran" confirmText="Tanda tangani kehadiran Anda pada acara ini?" />;
}