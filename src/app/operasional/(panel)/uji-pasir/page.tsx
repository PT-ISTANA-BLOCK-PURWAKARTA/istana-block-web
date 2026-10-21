import { eq } from "drizzle-orm";
import { Ok, PageHead, RangeForm } from "@/components/erp/ui";
import { wibNowLocal, wibRange } from "@/components/ops/receipts/util";
import { DraftList } from "@/components/ops/sand/DraftList";
import { SandExcel } from "@/components/ops/sand/SandExcel";
import { SandTestList } from "@/components/ops/sand/SandTestList";
import { StartForm } from "@/components/ops/sand/StartForm";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { isDate, monthStart, today } from "@/lib/erp/util";
import { listReceiptsForTesting, type ReceiptForTesting } from "@/lib/ops/receipts";
import { listSandDrafts, listSandTests } from "@/lib/ops/sand";
import { GOOD_SILT_PERCENT, MAX_SILT_PERCENT } from "@/lib/ops/shared/sand";
import { can } from "@/lib/roles";
import "../barang-masuk/barang-masuk.css";
import "./uji-pasir.css";

export const metadata = { title: "Uji lumpur pasir" };

type Params = { ok?: string; u?: string; barang?: string; from?: string; to?: string };

export default async function UjiPasir({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requirePerm("uji_pasir", "lihat_uji_pasir");
  const sp = await searchParams;
  const canSubmit = can(me.roles, "uji_pasir");
  const canView = can(me.roles, "lihat_uji_pasir");

  const end = today();
  let from = isDate(sp.from) ? sp.from : monthStart(end);
  let to = isDate(sp.to) ? sp.to : end;
  if (from > to) [from, to] = [to, from];
  const preselect = sp.barang && /^[\w-]{8,64}$/.test(sp.barang) ? sp.barang : null;

  const db = await getDb();
  const [all, mine, drafts, receipts] = await Promise.all([
    canView ? listSandTests(db, wibRange(from, to)) : null,
    // Tanpa izin lihat: hanya uji milik sendiri 7 hari terakhir, agar penguji yakin datanya sudah masuk.
    !canView && canSubmit ? listSandTests(db, { from: new Date(Date.now() - 7 * 86400_000), to: new Date(Date.now() + 12 * 3600_000), onlyUserId: me.id }) : null,
    canSubmit ? listSandDrafts(db, me.id) : null,
    canSubmit ? listReceiptsForTesting(db) : null,
  ]);

  // Barang dari tautan (?barang=…) tetap bisa dipilih walau sudah lewat 3 hari.
  let choices: ReceiptForTesting[] = receipts ?? [];
  if (canSubmit && preselect && !choices.some((item) => item.id === preselect)) {
    const row = await db.query.goodsReceipts.findFirst({ where: eq(schema.goodsReceipts.id, preselect) });
    if (row && row.category === "bahan_baku") {
      choices = [{ id: row.id, receivedAt: row.receivedAt, itemName: row.itemName, tag: row.tag, supplier: row.supplier, quarry: row.quarry, vehiclePlate: row.vehiclePlate, quantity: row.quantity, unit: row.unit, testStatus: null }, ...choices];
    }
  }

  return (
    <>
      <PageHead
        title="Kadar lumpur bahan baku"
        sub={`Satpam menguji pasir yang datang; QC menguji abu batu, screening, split, dan lainnya. Simpan sebagai draft saat sampel mulai mengendap, lalu isi hasil + foto setelah 1–3 jam. Patokan ≤ ${GOOD_SILT_PERCENT}% bagus, maksimal ${MAX_SILT_PERCENT}%.`}
      />
      <Ok ok={sp.ok} />

      {canSubmit && drafts && (
        <DraftList
          drafts={drafts.map((d) => ({ id: d.id, sandType: d.sandType, tag: d.tag, supplier: d.supplier, quarry: d.quarry, vehiclePlate: d.vehiclePlate, testedAt: d.testedAt, startPhotoKey: d.startPhotoKey, readingUnit: d.readingUnit, notes: d.notes }))}
          serverNow={Date.now()}
        />
      )}
      {canSubmit && (
        <details className="rcv-formbox" open>
          <summary className="btn btn-ghost btn-sm">Mulai uji lumpur</summary>
          <StartForm key={sp.u ?? "baru"} receipts={choices} preselect={preselect} nowLocal={wibNowLocal()} />
        </details>
      )}

      {canView && all ? (
        <>
          <RangeForm from={from} to={to} />
          <div className="rcv-toolbar"><SandExcel rows={all} from={from} to={to} /></div>
          <SandTestList rows={all} showStats />
        </>
      ) : (
        canSubmit && (
          <>
            <h2 className="rcv-sub">Uji saya (7 hari terakhir)</h2>
            <SandTestList rows={(mine ?? []).filter((row) => row.status === "selesai")} showStats={false} />
          </>
        )
      )}
    </>
  );
}
