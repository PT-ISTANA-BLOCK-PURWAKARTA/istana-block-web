import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { PrintDoc } from "@/components/erp/PrintDoc";
import { hasNonconformity, totalQty } from "@/components/ops/production/summary";
import { periodText, qnum } from "@/components/ops/qc/labels";
import { SignBlock } from "@/components/ops/qc/SignBlock";
import "@/components/ops/qc/qc.css";
import { getDb, schema } from "@/db";
import { isDate, tgl } from "@/lib/erp/util";
import { listProductions, productionAccess } from "@/lib/ops/production";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak ketidaksesuaian produksi", robots: { index: false } };

// Laporan Ketidaksesuaian Produksi (Grade B & reject) per rentang tanggal, A4 landscape. ?from&to
export default async function CetakKetidaksesuaian({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const acc = await productionAccess();
  const sp = await searchParams;
  if (!isDate(sp.from) || !isDate(sp.to) || sp.to < sp.from) redirect("/operasional/produksi");
  const { from, to } = sp;
  const back = `/operasional/produksi?from=${from}&to=${to}`;
  const db = await getDb();
  const [site, all] = await Promise.all([getSettings(), listProductions(db, acc, { from, to })]);
  const rows = all.filter(hasNonconformity).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

  // Gambar TTD diambil dari tanda tangan akun penanda tangan; hanya tampil bila SEMUA baris sudah ditandatangani.
  const docs = rows.length ? await db.select({ id: schema.productions.id, m: schema.productions.rejectManagerBy, l: schema.productions.rejectLeaderBy }).from(schema.productions).where(inArray(schema.productions.id, rows.map((r) => r.id))) : [];
  const userIds = [...new Set(docs.flatMap((d) => [d.m, d.l]).filter((x): x is number => x != null))];
  const users = userIds.length ? await db.select({ id: schema.users.id, name: schema.users.name, key: schema.users.signatureKey }).from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  const keyOf = new Map(users.map((u) => [u.id, u.key]));
  const idOf = new Map(docs.map((d) => [d.id, d]));
  const latest = (pick: "rejectManager" | "rejectLeader") => {
    const signed = rows.filter((r) => r[pick]).sort((a, b) => b[pick]!.at - a[pick]!.at)[0];
    if (!signed) return null;
    const d = idOf.get(signed.id);
    return { name: signed[pick]!.name, at: new Date(signed[pick]!.at), key: keyOf.get((pick === "rejectManager" ? d?.m : d?.l) ?? -1) ?? null };
  };
  const allManager = rows.length > 0 && rows.every((r) => r.rejectManager);
  const allLeader = rows.length > 0 && rows.every((r) => r.rejectLeader);
  const mgr = allManager ? latest("rejectManager") : null;
  const ldr = allLeader ? latest("rejectLeader") : null;

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div className="qc-doc qc-landscape">
        <PrintDoc site={site} title="LAPORAN KETIDAKSESUAIAN PRODUKSI" subtitle={`Periode : ${periodText(from, to)}`} back={back}>
          <table className="qc-grid">
            <thead>
              <tr>
                <th>NO</th><th>TANGGAL</th><th>PRODUK</th><th>KODE BATCH</th><th>DIPRODUKSI<br /><small>(A + B + REJECT)</small></th><th>GRADE B<br /><small>(masih dijual)</small></th><th>REJECT<br /><small>(tidak dijual)</small></th><th>% REJECT</th><th>KENDALA / PENYEBAB</th><th>PIC</th><th>DIPERIKSA</th><th>DISETUJUI</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={12} className="c">Tidak ada ketidaksesuaian pada periode ini.</td></tr>}
              {rows.map((r, i) => {
                const made = totalQty(r) + (r.gradeB ?? 0) + (r.rejects ?? 0);
                return (
                  <tr key={r.id}>
                    <td className="c">{i + 1}</td>
                    <td>{tgl(r.date)}</td>
                    <td>{r.hasil.map((h) => `${h.name} ${qnum(h.qty)} ${h.unit}`).join("; ")}</td>
                    <td>{r.batchCode ?? ""}</td>
                    <td className="r">{qnum(made)}</td>
                    <td className="r">{qnum(r.gradeB)}</td>
                    <td className="r">{qnum(r.rejects)}</td>
                    <td className="r">{made > 0 && r.rejects ? `${(Math.round(((r.rejects ?? 0) / made) * 1000) / 10).toLocaleString("id-ID")}%` : ""}</td>
                    <td>{[...r.issues, r.note].filter(Boolean).join(" · ")}</td>
                    <td>{r.createdByName ?? ""}</td>
                    <td className="c">{r.rejectManager ? `✓ ${r.rejectManager.name ?? ""}` : ""}</td>
                    <td className="c">{r.rejectLeader ? `✓ ${r.rejectLeader.name ?? ""}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="qc-signs">
            <SignBlock label={"DIPERIKSA OLEH :\nManager in charge"} name={mgr?.name} at={mgr?.at} imageKey={mgr?.key} emptyNote={allManager ? undefined : "(belum ditandatangani semua)"} />
            <SignBlock label={"DISETUJUI OLEH :\nPimpinan"} name={ldr?.name} at={ldr?.at} imageKey={ldr?.key} emptyNote={allLeader ? undefined : "(belum ditandatangani semua)"} />
          </div>
          <p className="qc-legend">
            <b>Grade B</b> = reject yang masih bisa dijual · <b>Reject</b> = tidak bisa dijual · Ketidaksesuaian dicatat juga di form F-IB-15 (NCR) bila perlu tindakan korektif.
          </p>
        </PrintDoc>
      </div>
    </>
  );
}
