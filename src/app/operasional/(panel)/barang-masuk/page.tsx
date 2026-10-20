import Link from "next/link";
import { Ok, PageHead, RangeForm } from "@/components/erp/ui";
import { ReceiveForm } from "@/components/ops/receipts/ReceiveForm";
import { ReceiptList, type ReceiptCardRow } from "@/components/ops/receipts/ReceiptList";
import { isOffice, onlyOwnReceipts, wibNowLocal, wibRange } from "@/components/ops/receipts/util";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { addDays, isDate, monthStart, today } from "@/lib/erp/util";
import { listReceiptSources, listReceipts } from "@/lib/ops/receipts";
import { can } from "@/lib/roles";
import "./barang-masuk.css";

export const metadata = { title: "Barang masuk" };

type Params = { ok?: string; r?: string; uji?: string; from?: string; to?: string; jenis?: string; q?: string };

const TABS = [
  ["semua", "Semua"],
  ["bahan_baku", "Bahan baku"],
  ["lainnya", "Barang lain"],
] as const;

export default async function BarangMasuk({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requirePerm("barang_masuk", "lihat_barang_masuk");
  const sp = await searchParams;
  const roles = me.roles;
  const canCreate = can(roles, "barang_masuk");
  // Satpam melihat catatannya sendiri saja; kantor, QC, dan pimpinan melihat semuanya.
  const own = !can(roles, "lihat_barang_masuk") || onlyOwnReceipts(roles);
  const canRateDelivery = can(roles, "nilai_kirim");
  const canRatePrice = can(roles, "nilai_harga");
  const canTest = can(roles, "uji_pasir");

  const end = today();
  let from = isDate(sp.from) ? sp.from : own ? addDays(end, -6) : monthStart(end);
  let to = isDate(sp.to) ? sp.to : end;
  if (from > to) [from, to] = [to, from];
  const jenis = sp.jenis === "bahan_baku" || sp.jenis === "lainnya" ? sp.jenis : undefined;
  const q = (sp.q ?? "").trim().slice(0, 60);

  const db = await getDb();
  const [found, sources] = await Promise.all([
    listReceipts(db, { ...wibRange(from, to), category: jenis, onlyUserId: own ? me.id : undefined }),
    canCreate || canRateDelivery ? listReceiptSources(db) : null,
  ]);
  const needle = q.toLowerCase();
  const now = Date.now();
  const rows: ReceiptCardRow[] = found
    .filter((row) => !needle || [row.itemName, row.tag, row.supplier, row.quarry, row.vehiclePlate, row.driverName, row.deliveryNoteNo, row.expeditionName].filter(Boolean).join(" ").toLowerCase().includes(needle))
    .map((row) => ({ ...row, canDelete: isOffice(roles) || (row.createdBy === me.id && now - row.createdAt.getTime() <= 24 * 3600_000) }));

  const tabHref = (value: string) => {
    const p = new URLSearchParams({ from, to });
    if (value !== "semua") p.set("jenis", value);
    if (q) p.set("q", q);
    return `/operasional/barang-masuk?${p}`;
  };
  const ujiId = sp.uji && /^[\w-]{8,64}$/.test(sp.uji) ? sp.uji : null;

  return (
    <>
      <PageHead
        title={own ? "Terima barang" : "Barang masuk"}
        sub="Satpam mencatat setiap barang yang datang beserta jumlah dan fotonya. Bahan baku (pasir, abu batu, screening, split) lanjut diuji lumpur, dinilai tier oleh QC, dan pengirimannya dinilai kantor. Catatan ini tidak mengubah stok; stok tetap lewat Pembelian di Keuangan."
      />
      <Ok ok={sp.ok} />
      {ujiId && canTest && (
        <p className="rcv-next">
          <Link href={`/operasional/uji-pasir?barang=${encodeURIComponent(ujiId)}`} className="btn btn-blue btn-sm">Mulai uji lumpur untuk barang ini</Link>
        </p>
      )}

      {canCreate && sources && (
        <details className="rcv-formbox" open={own}>
          <summary className="btn btn-ghost btn-sm">Catat barang masuk</summary>
          <ReceiveForm key={sp.r ?? "baru"} nowLocal={wibNowLocal()} sources={sources} />
        </details>
      )}

      <RangeForm
        from={from}
        to={to}
        extra={
          <>
            {jenis && <input type="hidden" name="jenis" value={jenis} />}
            <div className="field grow">
              <label htmlFor="rcv-q">Cari</label>
              <input id="rcv-q" name="q" defaultValue={q} placeholder="Barang, supplier, plat, sopir…" />
            </div>
            <nav className="seg" aria-label="Jenis barang">
              {TABS.map(([value, label]) => (
                <Link key={value} href={tabHref(value)} aria-current={(jenis ?? "semua") === value ? "page" : undefined}>{label}</Link>
              ))}
            </nav>
          </>
        }
      />

      {own && <h2 className="rcv-sub">Barang masuk yang saya catat</h2>}
      <ReceiptList
        rows={rows}
        from={from}
        to={to}
        canRateDelivery={canRateDelivery}
        canRatePrice={canRatePrice}
        canTest={canTest}
        showExcel={!own}
        expeditions={sources?.expeditions ?? []}
        tags={sources?.tags ?? []}
      />
    </>
  );
}
