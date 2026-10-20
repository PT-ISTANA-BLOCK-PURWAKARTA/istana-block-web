import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHead, RangeForm } from "@/components/erp/ui";
import { onlyOwnReceipts, wibRange } from "@/components/ops/receipts/util";
import { SupplierBoard } from "@/components/ops/supplier/SupplierBoard";
import { toSupplierRow } from "@/components/ops/supplier/summaries";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { isDate, monthStart, today, yearStart } from "@/lib/erp/util";
import { listReceiptSources, listReceipts } from "@/lib/ops/receipts";
import { GOOD_SILT_PERCENT, MAX_SILT_PERCENT } from "@/lib/ops/shared/sand";
import { can } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import "../barang-masuk/barang-masuk.css";
import "./bahan-baku.css";

export const metadata = { title: "Bahan baku & supplier" };

/** Awal bulan, dua bulan sebelum bulan `end` (rentang "3 bulan"). */
function threeMonthsStart(end: string) {
  let year = Number(end.slice(0, 4));
  let month = Number(end.slice(5, 7)) - 2;
  if (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export default async function BahanBaku({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const me = await requirePerm("lihat_barang_masuk", "nilai_mutu", "nilai_kirim", "nilai_harga");
  // Satpam hanya mencatat; analisis supplier bukan untuknya.
  if (onlyOwnReceipts(me.roles)) redirect("/operasional/barang-masuk");
  const sp = await searchParams;
  const canRateQuality = can(me.roles, "nilai_mutu");
  const canRateDelivery = can(me.roles, "nilai_kirim");
  const canRatePrice = can(me.roles, "nilai_harga");

  const end = today();
  const presets = [
    ["Bulan ini", monthStart(end)],
    ["3 bulan", threeMonthsStart(end)],
    ["Tahun ini", yearStart(end)],
  ] as const;
  let from = isDate(sp.from) ? sp.from : presets[1][1];
  let to = isDate(sp.to) ? sp.to : end;
  if (from > to) [from, to] = [to, from];

  const db = await getDb();
  const [found, sources, site] = await Promise.all([
    listReceipts(db, { ...wibRange(from, to), category: "bahan_baku" }),
    canRateDelivery ? listReceiptSources(db) : null,
    getSettings(),
  ]);
  const company = [
    (site.legal_name || site.company_name || "").toUpperCase(),
    site.address,
    [site.phone_office, site.phone || site.whatsapp].filter(Boolean).join(" · ") && `Telp. ${[site.phone_office, site.phone || site.whatsapp].filter(Boolean).join(" · ")}`,
    site.email,
  ].filter(Boolean);

  return (
    <>
      <PageHead
        title="Tier list, inventory & pengiriman"
        sub={`Data dari barang masuk satpam (pasir, abu batu, screening, split) dan uji lumpur. QC menilai tier kualitas, kantor menilai kecepatan pengiriman (Lambat / Standard / Cepat), pimpinan menilai harga (Mahal / Sedang / Affordable). Ketiganya digabung menjadi nilai overall. Patokan kadar lumpur: ≤ ${GOOD_SILT_PERCENT}% bagus, maksimal ${MAX_SILT_PERCENT}%.`}
      />
      <RangeForm
        from={from}
        to={to}
        extra={
          <nav className="seg" aria-label="Rentang cepat">
            {presets.map(([label, start]) => (
              <Link key={label} href={`/operasional/bahan-baku?from=${start}&to=${end}`} aria-current={from === start && to === end ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
        }
      />
      <SupplierBoard
        rows={found.map(toSupplierRow)}
        from={from}
        to={to}
        company={company}
        canRateQuality={canRateQuality}
        canRateDelivery={canRateDelivery}
        canRatePrice={canRatePrice}
        expeditions={sources?.expeditions ?? []}
        tags={sources?.tags ?? []}
      />
    </>
  );
}
