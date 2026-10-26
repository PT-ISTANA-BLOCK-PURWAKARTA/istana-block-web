import { eq } from "drizzle-orm";
import { Ok, PageHead, RangeForm } from "@/components/erp/ui";
import { isOffice, wibNowLocal, wibRange } from "@/components/ops/receipts/util";
import { DraftList } from "@/components/ops/sand/DraftList";
import { SandExcel } from "@/components/ops/sand/SandExcel";
import { SandTestList } from "@/components/ops/sand/SandTestList";
import { SkippedList } from "@/components/ops/sand/SkippedList";
import { StartForm } from "@/components/ops/sand/StartForm";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { isDate, monthStart, today } from "@/lib/erp/util";
import { listReceiptsForTesting, type ReceiptForTesting } from "@/lib/ops/receipts";
import { listSandDrafts, listSandTests, listSkippedReceipts, type SandTestRow } from "@/lib/ops/sand";
import { GOOD_SILT_PERCENT, MAX_SILT_PERCENT } from "@/lib/ops/shared/sand";
import { can } from "@/lib/roles";
import "../barang-masuk/barang-masuk.css";
import "./uji-pasir.css";

export const metadata = { title: "Uji lumpur pasir" };

type Params = { ok?: string; u?: string; barang?: string; from?: string; to?: string };

export default async function UjiPasir({ searchParams }: { searchParams: Promise<Params> }) {
  const me = await requirePerm("uji_pasir", "lihat_uji_pasir", "ttd_sekretaris");
  const sp = await searchParams;
  const canSubmit = can(me.roles, "uji_pasir");
  const canView = can(me.roles, "lihat_uji_pasir") || can(me.roles, "ttd_sekretaris");

  const end = today();
  let from = isDate(sp.from) ? sp.from : monthStart(end);
  let to = isDate(sp.to) ? sp.to : end;
  if (from > to) [from, to] = [to, from];
  const preselect = sp.barang && /^[\w-]{8,64}$/.test(sp.barang) ? sp.barang : null;

  const db = await getDb();
  const last3Days = { from: new Date(Date.now() - 3 * 86400_000), to: new Date(Date.now() + 12 * 3600_000) };
  const [all, mine, drafts, receipts, skippedRange, skippedRecent] = await Promise.all([
    canView ? listSandTests(db, wibRange(from, to)) : null,
    // Tanpa izin lihat: hanya uji milik sendiri 7 hari terakhir, agar penguji yakin datanya sudah masuk.
    !canView && canSubmit ? listSandTests(db, { from: new Date(Date.now() - 7 * 86400_000), to: new Date(Date.now() + 12 * 3600_000), onlyUserId: me.id }) : null,
    canSubmit ? listSandDrafts(db, me.id) : null,
    canSubmit ? listReceiptsForTesting(db) : null,
    canView ? listSkippedReceipts(db, wibRange(from, to)) : null,
    canSubmit ? listSkippedReceipts(db, last3Days) : null,
  ]);

  // Ubah hasil: kantor kapan saja; QC / satpam selama Manager & Pimpinan belum TTD (satpam hanya 24 jam sejak selesai).
  const canEdit = (row: SandTestRow) => {
    if (!canSubmit || row.status !== "selesai") return false;
    if (isOffice(me.roles)) return true;
    if (row.managerAckName || row.leaderAckName) return false;
    return me.roles.includes("qc") || (me.roles.includes("satpam") && row.completedAt !== null && Date.now() - new Date(row.completedAt).getTime() < 24 * 3600_000);
  };
  const ack = { sekretaris: can(me.roles, "ttd_sekretaris"), manager: can(me.roles, "setujui_qc"), pimpinan: can(me.roles, "ttd_pimpinan") };

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
          {skippedRange && <SkippedList rows={skippedRange} canCancel={canSubmit} title="Tanpa uji lumpur (di-skip) pada periode ini" />}
          <SandTestList rows={all} showStats ack={ack} canEdit={canEdit} />
        </>
      ) : (
        canSubmit && (
          <>
            <h2 className="rcv-sub">Uji saya (7 hari terakhir)</h2>
            {skippedRecent && <SkippedList rows={skippedRecent} canCancel title="Uji lumpur dilewati (3 hari terakhir)" />}
            <SandTestList rows={(mine ?? []).filter((row) => row.status === "selesai")} showStats={false} canEdit={canEdit} />
          </>
        )
      )}
    </>
  );
}
