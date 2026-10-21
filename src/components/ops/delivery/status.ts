// Alur status surat jalan (port inventori-ops). Murni: aman dipakai di server maupun klien, tanpa impor nilai dari DB.
//
// Urutan: dijadwalkan -> dimuat -> berangkat -> tiba -> terkirim. "tertunda" dan "batal" ada di luar urutan.
// Padanan inventori-ops: unassigned/assigned=dijadwalkan, ready=dimuat, in_transit=berangkat, arrived=tiba,
// delayed=tertunda, delivered=terkirim, cancelled=batal.
import type { DeliveryStatus } from "@/db/erp";

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  dijadwalkan: "Dijadwalkan",
  dimuat: "Sudah dimuat",
  berangkat: "Dalam perjalanan",
  tiba: "Tiba di lokasi",
  tertunda: "Tertunda",
  terkirim: "Terkirim",
  batal: "Batal",
};

/** Judul untuk notifikasi kantor & riwayat. */
export const STATUS_TITLE: Record<DeliveryStatus, string> = {
  dijadwalkan: "Dijadwalkan ulang",
  dimuat: "Sudah dimuat",
  berangkat: "Berangkat",
  tiba: "Tiba di lokasi",
  tertunda: "Tertunda",
  terkirim: "Terkirim",
  batal: "Dibatalkan",
};

export const STATUS_TONE: Record<DeliveryStatus, string> = {
  dijadwalkan: "badge-info",
  dimuat: "badge-info",
  berangkat: "badge-warn",
  tiba: "badge-warn",
  tertunda: "badge-danger",
  terkirim: "badge-on",
  batal: "badge-off",
};

/** Lima langkah progres yang ditampilkan ke sopir, kantor, dan pelanggan. */
export const FLOW_STEPS = ["dijadwalkan", "dimuat", "berangkat", "tiba", "terkirim"] as const satisfies readonly DeliveryStatus[];

/**
 * Stok & jurnal HPP terposting bila departed_at terisi dan status bukan dijadwalkan/dimuat/batal.
 * (Tertunda sebelum berangkat tidak terposting; tertunda di jalan tetap terposting.)
 */
export function isPosted(status: string, departedAt: unknown) {
  return Boolean(departedAt) && status !== "dijadwalkan" && status !== "dimuat" && status !== "batal";
}

/* Potongan SQL (alias tabel: d = ops_deliveries) agar semua kueri memakai definisi yang sama. */
/** Barang sudah keluar gudang: stok & jurnal terposting. */
export const SQL_POSTED = "(d.departed_at is not null and d.status not in ('dijadwalkan','dimuat','batal'))";
/** Truk sedang di jalan (berangkat, tiba, atau tertunda di jalan). */
export const SQL_ON_ROAD = "(d.status in ('berangkat','tiba','tertunda') and d.departed_at is not null)";
/** Barang masih di gudang: dijadwalkan atau sudah dimuat tetapi belum berangkat. */
export const SQL_AT_YARD = "(d.status in ('dijadwalkan','dimuat') or (d.status = 'tertunda' and d.departed_at is null))";
/** Belum selesai (bukan terkirim/batal). */
export const SQL_OPEN = "d.status in ('dijadwalkan','dimuat','berangkat','tiba','tertunda')";

type Progress = { status: string; loadedAt?: unknown; departedAt?: unknown; arrivedAt?: unknown };

/**
 * Posisi sopir dalam urutan langkah. Surat jalan "tertunda" dibaca dari jejak waktunya
 * (sudah tiba / sudah berangkat / sudah dimuat), supaya sopir bisa melanjutkan setelah kantor mencatat tunda.
 */
export function driverBase(d: Progress): DeliveryStatus {
  if (d.status === "tertunda") return d.arrivedAt ? "tiba" : d.departedAt ? "berangkat" : d.loadedAt ? "dimuat" : "dijadwalkan";
  return d.status as DeliveryStatus;
}

/** Langkah berikutnya yang boleh ditekan sopir, atau null bila sudah selesai/batal. */
export function driverNext(d: Progress): DeliveryStatus | null {
  const base = driverBase(d);
  const i = (FLOW_STEPS as readonly string[]).indexOf(base);
  if (i < 0 || i >= FLOW_STEPS.length - 1) return null;
  return FLOW_STEPS[i + 1];
}

export const DRIVER_STEP_LABEL: Record<string, string> = {
  dimuat: "Sudah dimuat",
  berangkat: "Berangkat",
  tiba: "Sudah tiba di lokasi",
  terkirim: "Tandai terkirim",
};
