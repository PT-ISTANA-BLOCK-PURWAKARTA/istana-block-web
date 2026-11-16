/**
 * Konstanta, tipe, dan pembantu murni (client + server) untuk modul Biaya Armada.
 * Tidak boleh mengimpor modul server/DB agar aman diimpor oleh komponen client.
 */

export const FLEET_START_DATE = "2026-11-07";

export const FLEET_KINDS = [
  { key: "sewa", label: "Sewa armada", group: "Pendapatan", income: true },
  { key: "pendapatan", label: "Pendapatan lain", group: "Pendapatan", income: true },
  { key: "solar", label: "Solar", group: "Operasional", income: false },
  { key: "uangjalan", label: "Uang jalan / makan", group: "Operasional", income: false },
  { key: "etoll", label: "Tol & parkir", group: "Operasional", income: false },
  { key: "preman", label: "Kuli / preman / timbangan", group: "Operasional", income: false },
  { key: "kawal", label: "Kawal / surat jalan", group: "Operasional", income: false },
  { key: "bongkar", label: "Bongkar / crane / muat", group: "Operasional", income: false },
  { key: "servis", label: "Servis & las", group: "Perawatan", income: false },
  { key: "tambahan", label: "Biaya tambahan servis", group: "Perawatan", income: false },
  { key: "part", label: "Suku cadang", group: "Perawatan", income: false },
  { key: "oli", label: "Oli", group: "Perawatan", income: false },
  { key: "ban", label: "Ban & velg", group: "Perawatan", income: false },
  { key: "surat", label: "KIR, pajak & STNK", group: "Administrasi", income: false },
  { key: "lain", label: "Lainnya", group: "Administrasi", income: false },
] as const;

export type FleetKind = (typeof FLEET_KINDS)[number]["key"];
export const FLEET_KIND_KEYS = FLEET_KINDS.map((k) => k.key) as readonly FleetKind[];
export const FLEET_KIND_BY_KEY = Object.fromEntries(FLEET_KINDS.map((k) => [k.key, k])) as Record<
  FleetKind,
  (typeof FLEET_KINDS)[number]
>;

export function isIncome(kind: string): boolean {
  return FLEET_KIND_BY_KEY[kind as FleetKind]?.income === true;
}

export const EXPENSE_KINDS = FLEET_KINDS.filter((k) => !k.income);
export const MAINTENANCE_KINDS = new Set<string>(["servis", "tambahan", "part", "oli", "ban"]);

/** Sub kategori per jenis pengeluaran / pendapatan armada. */
export const FLEET_SUBCATEGORIES: Record<string, readonly string[]> = {
  sewa: ["Sewa kirim IB", "Sewa luar / borongan", "Sewa harian", "Lainnya"],
  pendapatan: ["Komisi / bagi hasil", "Jasa bongkar / angkut", "Penjualan ban / part bekas", "Klaim / penggantian", "Lainnya"],
  solar: ["BBM / Solar", "Pertalite / Pertamax", "AdBlue / additive", "Lainnya"],
  uangjalan: ["Uang makan", "Uang jalan", "Uang menginap", "Uang saku tambahan", "Lainnya"],
  etoll: ["E-Toll", "Parkir", "Retribusi", "Lainnya"],
  preman: ["Kuli bongkar", "Preman / keamanan", "Timbangan / jembatan", "Lainnya"],
  kawal: ["Kawal polisi / dishub", "Surat jalan", "Lainnya"],
  bongkar: ["Sewa crane / forklift", "Tenaga bongkar", "Alat bantu muat", "Lainnya"],
  servis: ["Ganti oli & filter", "Servis mesin", "Rem & kopling", "Kaki-kaki / per", "Kelistrikan / aki", "AC / kabin", "Las & bak / karoseri", "Body & cat", "Lainnya"],
  tambahan: ["Jasa mekanik luar", "Derek / evakuasi", "Cuci & steam", "Ongkir ambil barang", "Lainnya"],
  part: ["Filter (oli/solar/udara)", "Kampas rem & kopling", "Bearing / seal / baut", "Selang / belt / gasket", "Lampu & kelistrikan", "Lainnya"],
  oli: ["Oli mesin", "Oli transmisi", "Oli gardan", "Grease / gemuk", "Minyak rem / power steering", "Lainnya"],
  ban: ["Ban baru", "Vulkanisir", "Ban dalam & marset", "Tambal / tubeless", "Velg & baut roda", "Spooring / balancing", "Lainnya"],
  surat: ["Perpanjang STNK / pajak", "Uji KIR", "Asuransi", "BBN / mutasi", "Lainnya"],
  lain: ["Perlengkapan truk (terpal/tali/dongkrak)", "ATK / administrasi", "Lainnya"],
};

export const SUBCATEGORIES = FLEET_SUBCATEGORIES;
export const OTHER_INCOME_SUBCATEGORIES = FLEET_SUBCATEGORIES.pendapatan;

/** Jenis biaya perjalanan standar yang diisi berbarengan dari satu surat jalan. */
export const TRIP_COSTS = [
  { key: "solar", label: "Solar / BBM" },
  { key: "uangjalan", label: "Uang makan / jalan" },
  { key: "etoll", label: "Tol & parkir" },
  { key: "preman", label: "Kuli / preman / timbangan" },
  { key: "kawal", label: "Kawal / surat jalan" },
  { key: "bongkar", label: "Bongkar / crane / muat" },
  { key: "lain", label: "Lain-lain perjalanan" },
] as const;

export function tripCostKey(k: string): string {
  return k.startsWith("trip:") ? k.slice(5) : k;
}

/** Biaya tambahan di luar suku cadang saat mencatat servis. */
export const SERVICE_EXTRAS = [
  { key: "jasa", label: "Jasa mekanik / bongkar pasang" },
  { key: "las", label: "Ongkos las / bubut" },
  { key: "derek", label: "Derek / evakuasi" },
  { key: "ongkir", label: "Ongkir / ambil barang" },
  { key: "tambahan", label: "Biaya tambahan lain" },
] as const;

export const FLEET_PLACES = ["Orang pabrik", "Bengkel luar"] as const;

export function placeOf(kind: string, p: string | null | undefined): string {
  if (p === "Orang pabrik" || p === "Bengkel luar") return p;
  return MAINTENANCE_KINDS.has(kind) ? "Bengkel luar" : "—";
}

export const RENT_PAYMENTS = ["Lunas", "DP", "Belum dibayar"] as const;

export const FLEET_FUNDS = [
  { key: "cepi", label: "Dana Cepi" },
  { key: "ib", label: "Dana IB" },
  { key: "uditch", label: "Dana U-Ditch" },
] as const;

export const FUNDS = FLEET_FUNDS;
export const FLEET_FUND_KEYS = FLEET_FUNDS.map((f) => f.key) as readonly string[];

export const FLEET_PAYMENTS = [
  "Cash (Cepi)",
  "Cash (Lina)",
  "Cash kantor",
  "Tarik tunai",
  "QRIS",
  "Transfer",
  "Tempo",
  "Transfer · tempo",
] as const;

export const PAYMENT_METHODS = FLEET_PAYMENTS;

export function isTempoPayment(payment: string | null | undefined): boolean {
  return !!payment && payment.toLowerCase().includes("tempo");
}

export function isCashPayment(payment: string | null | undefined): boolean {
  const p = (payment || "").toLowerCase();
  return p.startsWith("cash") || p.startsWith("tarik tunai") || p === "tunai";
}

export const MAX_FLEET_PHOTOS = 4;
export const APPROVAL_THRESHOLD = 3_000_000;
export const FLEET_APPROVAL_LIMIT = APPROVAL_THRESHOLD;

export function expenseNeedsApproval(kind: string, total: number): boolean {
  return !isIncome(kind) && total > APPROVAL_THRESHOLD;
}

export function isExpenseApproved(approvalStatus: string | null | undefined): boolean {
  return !approvalStatus || approvalStatus === "ok" || approvalStatus === "disetujui";
}

/** Hanya catatan yang disetujui (atau tidak perlu ACC) yang masuk hitungan keuangan. */
export function isCounted(r: { approvalStatus?: string | null }): boolean {
  return isExpenseApproved(r.approvalStatus);
}

export function isOnOrAfterFleetStart(entryDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(entryDate) && entryDate >= FLEET_START_DATE;
}

export function assertStart(entryDate: string): void {
  if (!isOnOrAfterFleetStart(entryDate)) {
    throw new Error(`Tanggal catatan tidak boleh sebelum ${FLEET_START_DATE}.`);
  }
}

export const FLEET_MECHANICS = ["Asep", "Supri", "Wanto", "Aji", "Adin"] as const;
export const FLEET_TOOLS = ["Bor", "Gerinda", "Kunci sok", "Kunci pas", "Kunci L", "Kunci Inggris", "Dongkrak", "Las"] as const;

export function plateOf(s: string | null | undefined): string {
  const m = String(s || "").toUpperCase().replace(/\s+/g, " ").match(/[A-Z]{1,2}\s*\d{1,5}\s*[A-Z]{0,3}/);
  return m ? m[0].replace(/[^A-Z0-9]/g, "") : "";
}

export function matchVehicle(
  plate: string,
  vehicles: ReadonlyArray<{ id: string; plate: string }>,
): string | null {
  const p = plateOf(plate);
  if (!p) return null;
  for (const v of vehicles) if (plateOf(v.plate) === p) return v.id;
  const num = p.match(/\d{3,5}/)?.[0];
  if (!num) return null;
  const hit = vehicles.filter((v) => plateOf(v.plate).includes(num));
  return hit.length === 1 ? hit[0].id : null;
}

export function kindOfItem(text: string): FleetKind {
  const s = text.toLowerCase();
  if (/\bsewa\b/.test(s)) return "sewa";
  if (/pendapatan|komisi|bagi hasil|klaim/.test(s)) return "pendapatan";
  if (/solar|bbm|bensin|pertalite|pertamax|dexlite/.test(s)) return "solar";
  if (/uang\s*(jalan|makan)|makan\s*supir|inap|saku/.test(s)) return "uangjalan";
  if (/e[\s-]?toll|etoll|\btol\b|parkir|retribusi/.test(s)) return "etoll";
  if (/preman|kuli|timbangan|pungli|keamanan/.test(s)) return "preman";
  if (/kawal|dishub|polisi|surat\s*jalan/.test(s)) return "kawal";
  if (/bongkar|crane|forklift|muat/.test(s)) return "bongkar";
  if (/\bban\b|vulkanisir|tambal|velg|pentil|marset|ban dalam/.test(s)) return "ban";
  if (/\boli\b|gemuk|grease/.test(s)) return "oli";
  if (/stnk|\bkir\b|pajak|asuransi|uji\s*kir/.test(s)) return "surat";
  if (/\blas\b|servis|service|ganti\s*oli|bongkar\s*mesin|mekanik|derek|cuci|steam/.test(s)) return "servis";
  if (
    /kampas|filter|bearing|baut|selang|lampu|aki|dinamo|karet|kabel|busi|seal|radiator|klakson|spion|kaca|wiper|pegas|per\b|as\s*roda|kopling|rem|pompa|fan\s*belt|v-belt|terpal|tali|dongkrak|part/.test(
      s,
    )
  ) {
    return "part";
  }
  return "lain";
}

export function paymentOf(s: string | null | undefined): string {
  const t = String(s || "").trim();
  if (!t) return "Transfer";
  if (/cepi/i.test(t)) return "Cash (Cepi)";
  if (/lina/i.test(t)) return "Cash (Lina)";
  if (/kantor/i.test(t)) return "Cash kantor";
  if (/tarik/i.test(t)) return "Tarik tunai";
  if (/qris/i.test(t)) return "QRIS";
  if (/transfer.*tempo|tempo.*transfer/i.test(t)) return "Transfer · tempo";
  if (/tempo/i.test(t)) return "Tempo";
  if (/transfer/i.test(t)) return "Transfer";
  return t;
}

export function berkasUrl(keyOrUrl: string): string {
  if (!keyOrUrl) return "";
  if (keyOrUrl.startsWith("/") || keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    return keyOrUrl;
  }
  return `/operasional/berkas/${keyOrUrl.replace(/^\/+/, "")}`;
}

export interface RecapRow {
  vehicleId: string | null;
  vehicleLabel: string;
  sewa: number;
  pendapatan: number;
  operasional: number;
  perawatan: number;
  admin: number;
  totalBiaya: number;
  net: number;
  count: number;
}

export function recapByVehicle(
  rows: ReadonlyArray<{
    vehicleId: string | null;
    vehicleLabel: string;
    kind: string;
    total: number;
    approvalStatus?: string | null;
  }>,
  vehicles: ReadonlyArray<{ id: string; plate: string; name: string }>,
): RecapRow[] {
  const byVeh = new Map<string, { id: string | null; label: string }>();
  for (const v of vehicles) byVeh.set(v.id, { id: v.id, label: `${v.plate} · ${v.name}` });

  const acc = new Map<string, RecapRow>();
  for (const r of rows) {
    if (!isCounted(r)) continue;
    const key = r.vehicleId ? `v:${r.vehicleId}` : `u:${r.vehicleLabel || "Umum"}`;
    let row = acc.get(key);
    if (!row) {
      const v = r.vehicleId ? byVeh.get(r.vehicleId) : null;
      row = {
        vehicleId: r.vehicleId,
        vehicleLabel: v ? v.label : r.vehicleLabel || "Umum / semua kendaraan",
        sewa: 0,
        pendapatan: 0,
        operasional: 0,
        perawatan: 0,
        admin: 0,
        totalBiaya: 0,
        net: 0,
        count: 0,
      };
      acc.set(key, row);
    }
    row.count += 1;
    if (r.kind === "sewa") {
      row.sewa += r.total;
    } else if (r.kind === "pendapatan") {
      row.pendapatan += r.total;
    } else {
      const grp = FLEET_KIND_BY_KEY[r.kind as FleetKind]?.group;
      if (grp === "Operasional") row.operasional += r.total;
      else if (grp === "Perawatan") row.perawatan += r.total;
      else row.admin += r.total;
      row.totalBiaya += r.total;
    }
    row.net = row.sewa + row.pendapatan - row.totalBiaya;
  }

  return [...acc.values()].sort((a, b) => b.totalBiaya - a.totalBiaya || b.sewa - a.sewa);
}

export function fundLabelOf(key: string | null | undefined): string {
  return FLEET_FUNDS.find((f) => f.key === key)?.label || key || "Dana IB";
}

export function todayWib(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
