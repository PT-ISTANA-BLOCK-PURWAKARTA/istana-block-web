// Pengambilan data Rekap ISO dari route handler JSON (khusus klien): dipakai ekspor Excel dan kolom bulanan.
import type { IsoRow } from "@/lib/ops/iso-core";
import { FORM_BY_CODE, type IsoCode } from "@/lib/ops/shared/isoForms";
import type { DayRange, IsoOverview } from "@/lib/ops/shared/isoRecap";
import { sortRows } from "./sortRows";

const ENDPOINT = "/operasional/rekap-iso/data";

async function getJson<T>(params: Record<string, string>): Promise<T> {
  const response = await fetch(`${ENDPOINT}?${new URLSearchParams(params)}`, { credentials: "same-origin", cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error ?? "Gagal mengambil data.");
  return body;
}

export const fetchOverview = (range: DayRange) => getJson<IsoOverview>({ kind: "overview", from: range.from, to: range.to });

/** Semua baris satu form (server mengirim bertahap per 300 baris). */
export async function fetchAllRows(code: IsoCode, range: DayRange) {
  const rows: IsoRow[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page: { rows: IsoRow[]; nextOffset: number | null } = await getJson({ kind: "rows", code, from: range.from, to: range.to, offset: String(offset) });
    rows.push(...page.rows);
    offset = page.nextOffset;
  }
  return sortRows(FORM_BY_CODE[code], rows);
}
