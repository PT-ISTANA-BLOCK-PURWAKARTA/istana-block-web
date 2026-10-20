import type { CronContext } from "./types";

/** 07.00-07.04 WIB: ingatkan QC & pemilik bila ada jadwal F-IB-06 terlambat/segera, NCR Open lewat target, atau tindak lanjut rapat terlambat. */
export async function remindIsoSchedules(_c: CronContext): Promise<void> {
  // TODO (subagen ISO): gerbang 07:00 WIB; cek iso_records; push ke QC & pemilik, url /operasional/rekap-iso.
}
