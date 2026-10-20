import Link from "next/link";
import { Kpis } from "@/components/erp/ui";
import { FORM_BY_CODE, ISO_CODES, type IsoCode } from "@/lib/ops/shared/isoForms";
import { dashboardItems, formatNumber, monthsInRange, type DayRange, type IsoOverview } from "@/lib/ops/shared/isoRecap";
import { RecapTable } from "./RecapTable";
import { isoUrl } from "./url";

/** Tab Ringkasan: peringatan, angka dashboard, dan tabel rekap per form (kolom per bulan diambil klien). */
export function SummaryTab({ overview, range, visible }: { overview: IsoOverview; range: DayRange; visible: IsoCode[] }) {
  const alerts = [
    overview.machine.overdueNow ? { code: "F-IB-06" as IsoCode, text: `${overview.machine.overdueNow} jadwal kalibrasi/maintenance TERLAMBAT` } : null,
    overview.machine.soonNow ? { code: "F-IB-06" as IsoCode, text: `${overview.machine.soonNow} jadwal jatuh tempo ≤ 7 hari` } : null,
    overview.machine.openNow ? { code: "F-IB-07" as IsoCode, text: `${overview.machine.openNow} kerusakan mesin masih Open` } : null,
    overview.ncr.openNow ? { code: "F-IB-15" as IsoCode, text: `${overview.ncr.openNow} NCR / keluhan masih Open` } : null,
    overview.meetings.overdueNow ? { code: "F-IB-14" as IsoCode, text: `${overview.meetings.overdueNow} tindak lanjut rapat TERLAMBAT` } : null,
  ].filter((item): item is { code: IsoCode; text: string } => item !== null && visible.includes(item.code));

  const items = dashboardItems(overview).map((item) => ({
    label: item.label,
    value: formatNumber(item.value, item.format),
    sub: item.hint,
    tone: (item.key === "mesin" && (item.value ?? 0) > 0 ? "bad" : item.key === "ncr" && (item.value ?? 0) > 0 ? "warn" : undefined) as "bad" | "warn" | undefined,
  }));

  const months = monthsInRange(range);
  const showMonthly = months.length > 1 && months.length <= 12;
  const links: Partial<Record<IsoCode, string>> = {};
  for (const code of ISO_CODES) if (visible.includes(code)) links[code] = isoUrl({ range, tab: "form", code });

  return (
    <div className="stack" style={{ gap: 16 }}>
      {alerts.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <b>Perlu tindakan</b>
          <div className="iso-alerts">
            {alerts.map((alert) => (
              <Link key={alert.text} href={isoUrl({ range, tab: "form", code: alert.code })} className="flag flag-warn" style={{ flexDirection: "column", gap: 0, textDecoration: "none" }}>
                <b>{alert.text}</b>
                <span className="small">{alert.code} {FORM_BY_CODE[alert.code].short} →</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <Kpis items={items} />
      <RecapTable overview={overview} months={showMonthly ? months : []} links={links} />
    </div>
  );
}
