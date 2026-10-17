/** Periode laporan: pilihan cepat, pembanding, dan label yang mudah dibaca. Aman dipakai di klien. */
import { addDays, monthStart, today } from "./util";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const parts = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), d: Number(d.slice(8, 10)) });
const pad = (n: number) => String(n).padStart(2, "0");

export function monthEnd(date: string) {
  const { y, m } = parts(date);
  return addDays(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`, -1);
}

/** Geser tanggal n bulan (hari dipotong ke akhir bulan bila perlu). */
export function addMonths(date: string, n: number) {
  const { y, m, d } = parts(date);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const end = Number(monthEnd(`${ny}-${pad(nm)}-01`).slice(8, 10));
  return `${ny}-${pad(nm)}-${pad(Math.min(d, end))}`;
}

export function yearEnd(date: string) {
  return `${date.slice(0, 4)}-12-31`;
}

/** "Oktober 2026", "1–17 Oktober 2026", "1 Agustus – 17 Oktober 2026", "1 Des 2025 – 17 Jan 2026". */
export function periodLabel(from: string, to: string) {
  const a = parts(from);
  const b = parts(to);
  if (a.y === b.y && a.m === b.m) {
    if (a.d === 1 && to === monthEnd(to)) return `${BULAN[a.m - 1]} ${a.y}`;
    return a.d === b.d ? `${a.d} ${BULAN[a.m - 1]} ${a.y}` : `${a.d}–${b.d} ${BULAN[a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y) {
    if (a.d === 1 && a.m === 1 && b.m === 12 && b.d === 31) return `Tahun ${a.y}`;
    return `${a.d} ${BULAN[a.m - 1]} – ${b.d} ${BULAN[b.m - 1]} ${a.y}`;
  }
  return `${a.d} ${BLN[a.m - 1]} ${a.y} – ${b.d} ${BLN[b.m - 1]} ${b.y}`;
}

export const monthName = (date: string) => BULAN[parts(date).m - 1];
export const monthShort = (date: string) => BLN[parts(date).m - 1];

/**
 * Periode pembanding yang adil: bila mulai tanggal 1, bandingkan dengan rentang hari yang sama
 * pada bulan-bulan sebelumnya (1–17 Okt ↔ 1–17 Sep); selain itu geser sepanjang jumlah harinya.
 */
export function previousPeriod(from: string, to: string) {
  const a = parts(from);
  if (a.d === 1) {
    const months = (parts(to).y - a.y) * 12 + (parts(to).m - a.m) + 1;
    const pf = addMonths(from, -months);
    const fullMonths = to === monthEnd(to);
    const pt = fullMonths ? monthEnd(addMonths(to, -months)) : addMonths(to, -months);
    return { from: pf, to: pt };
  }
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  return { from: addDays(from, -days), to: addDays(to, -days) };
}

export type Preset = { key: string; label: string; from?: string; to: string };

/** Pilihan cepat untuk laporan berperiode (laba rugi, penjualan, arus kas, buku besar). */
export function rangePresets(base = today()): Preset[] {
  const ms = monthStart(base);
  const lastMonth = addMonths(ms, -1);
  return [
    { key: "bulan-ini", label: "Bulan ini", from: ms, to: base },
    { key: "bulan-lalu", label: "Bulan lalu", from: lastMonth, to: monthEnd(lastMonth) },
    { key: "3-bulan", label: "3 bulan terakhir", from: addMonths(ms, -2), to: base },
    { key: "tahun-ini", label: "Tahun ini", from: `${base.slice(0, 4)}-01-01`, to: base },
    { key: "tahun-lalu", label: "Tahun lalu", from: `${Number(base.slice(0, 4)) - 1}-01-01`, to: `${Number(base.slice(0, 4)) - 1}-12-31` },
  ];
}

/** Pilihan cepat untuk laporan per tanggal (neraca, neraca saldo, umur piutang/hutang). */
export function asOfPresets(base = today()): Preset[] {
  const ms = monthStart(base);
  return [
    { key: "hari-ini", label: "Hari ini", to: base },
    { key: "akhir-bulan-lalu", label: "Akhir bulan lalu", to: addDays(ms, -1) },
    { key: "akhir-tahun-lalu", label: "Akhir tahun lalu", to: `${Number(base.slice(0, 4)) - 1}-12-31` },
  ];
}

/** n bulan terakhir yang berakhir di bulan `to` (untuk grafik tren). */
export function trailingMonths(to: string, n: number) {
  const last = monthStart(to);
  return Array.from({ length: n }, (_, i) => {
    const from = addMonths(last, i - (n - 1));
    const end = i === n - 1 ? to : monthEnd(from);
    return { from, to: end, label: monthShort(from), long: `${monthName(from)} ${from.slice(0, 4)}` };
  });
}
