import Link from "next/link";
import { berkasUrl, elapsed, whenText } from "@/components/ops/receipts/util";
import { EditSandButton } from "./EditSandButton";
import { SandAckBar, type AckTodo } from "./SandAckBar";
import { Icon } from "@/components/panel/Icon";
import type { SandTestRow } from "@/lib/ops/sand";
import { fmt } from "@/lib/ops/shared/format";
import { DECISION_LABELS, SILT_LEVEL_LABELS, siltLevel, sourceLabel, type SiltLevel } from "@/lib/ops/shared/sand";
import { testerName } from "./util";

const LEVEL_CLASS: Record<SiltLevel, string> = { bagus: "ok", cukup: "warn", lewat: "bad" };
const DECISION_BADGE = { diterima: "badge-on", ditolak: "badge-danger", diterima_bersyarat: "badge-warn" } as const;

/** Rata-rata kadar lumpur per supplier / quarry dari uji yang sudah selesai. */
function statsBySource(rows: SandTestRow[]) {
  const map = new Map<string, { count: number; total: number; rejected: number }>();
  for (const row of rows) {
    if (row.status !== "selesai" || row.siltPercent === null) continue;
    const key = sourceLabel(row);
    const entry = map.get(key) ?? { count: 0, total: 0, rejected: 0 };
    entry.count += 1;
    entry.total += row.siltPercent;
    if (row.decision === "ditolak") entry.rejected += 1;
    map.set(key, entry);
  }
  return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
}

/** TTD bertingkat: tiga lencana (Sekretaris, Manager in charge, Pimpinan) dengan nama + waktu. */
function AckBadges({ row }: { row: SandTestRow }) {
  const steps = [
    ["Sekretaris", row.secretaryAckName, row.secretaryAckAt],
    ["Manager in charge", row.managerAckName, row.managerAckAt],
    ["Pimpinan", row.leaderAckName, row.leaderAckAt],
  ] as const;
  return (
    <div className="sand-acks">
      {steps.map(([label, name, at]) =>
        name ? (
          <span key={label} className="sand-ack done">✓ {label}: {name}{at ? ` · ${whenText(at)}` : ""}</span>
        ) : (
          <span key={label} className="sand-ack">{label}: belum</span>
        ),
      )}
    </div>
  );
}

const before = (value: number | null) => (value === null ? "-" : `${fmt(value)}%`);

/** Riwayat "Ubah hasil": ringkasan perubahan terakhir; seluruh riwayat ada di tooltip. */
function EditNote({ row }: { row: SandTestRow }) {
  const history = row.editHistory;
  const last = history[history.length - 1];
  if (!last) return null;
  const title = history.map((e) => `${whenText(e.at * 1000)} · ${e.byName ?? "-"}: ${e.reason} (sebelumnya ${before(e.old.siltPercent)})`).join("\n");
  return (
    <p className="sand-edits" title={title}>
      Diubah {history.length}× · terakhir {whenText(last.at * 1000)} oleh {last.byName ?? "-"}: {last.reason} (sebelumnya {before(last.old.siltPercent)})
    </p>
  );
}

/** Daftar hasil uji lumpur (kartu) + rata-rata per supplier + TTD bertingkat + ubah hasil. Komponen server. */
export function SandTestList({
  rows,
  showStats,
  ack,
  canEdit,
}: {
  rows: SandTestRow[];
  showStats: boolean;
  /** Izin TTD pengguna ini; kosong = tanpa tombol TTD massal. */
  ack?: { sekretaris: boolean; manager: boolean; pimpinan: boolean };
  /** Boleh mengubah hasil baris ini (dihitung server dari peran, TTD, dan umur data). */
  canEdit?: (row: SandTestRow) => boolean;
}) {
  if (!rows.length) return <div className="admin-card"><p className="muted">Belum ada hasil uji pada periode ini.</p></div>;
  const stats = showStats ? statsBySource(rows) : [];
  const now = Date.now();
  const done = rows.filter((row) => row.status === "selesai");
  const todos: AckTodo[] = ack
    ? [
        { level: "sekretaris", label: "Sekretaris", ids: ack.sekretaris ? done.filter((row) => !row.secretaryAckName).map((row) => row.id) : [] },
        { level: "manager", label: "Manager in charge", ids: ack.manager ? done.filter((row) => row.secretaryAckName && !row.managerAckName).map((row) => row.id) : [] },
        { level: "pimpinan", label: "Pimpinan", ids: ack.pimpinan ? done.filter((row) => row.managerAckName && !row.leaderAckName).map((row) => row.id) : [] },
      ]
    : [];
  return (
    <>
      <SandAckBar todos={todos} />
      {stats.length > 0 && (
        <div className="admin-card rcv-summary">
          <div className="card-head"><h2>Rata-rata kadar lumpur per supplier / quarry</h2></div>
          <div className="rcv-chips">
            {stats.map(([supplier, s]) => (
              <span key={supplier} className={`rcv-sum-chip sand-avg-${LEVEL_CLASS[siltLevel(s.total / s.count)]}`}>
                <b>{supplier}</b> {fmt(s.total / s.count)}% · {s.count} uji{s.rejected ? ` · ${s.rejected} ditolak` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="rcv-grid">
        {rows.map((row) => {
          const level = row.siltPercent === null ? null : siltLevel(row.siltPercent, row.maxSiltPercent);
          const photos = [row.startPhotoKey, row.photoKey].filter((key): key is string => Boolean(key));
          return (
            <article key={row.id} className="rcv-card sand-test">
              <div className="rcv-top">
                <div className="rcv-title">
                  <b>{sourceLabel(row)}</b>
                  <div className="small muted">
                    {row.tag ? <span className="sand-tag">{row.tag}</span> : null}
                    {row.sandType} · {whenText(row.testedAt)}
                  </div>
                </div>
                {row.decision ? <span className={`badge ${DECISION_BADGE[row.decision]}`}>{DECISION_LABELS[row.decision]}</span> : <span className="badge badge-warn">Mengendap</span>}
              </div>
              <div className="sand-test-body">
                <div className="rcv-photos sand-test-photos">
                  {photos.map((key) => (
                    <a key={key} href={berkasUrl(key)} target="_blank" rel="noreferrer" className="rcv-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={berkasUrl(key)} alt="Foto uji" loading="lazy" />
                    </a>
                  ))}
                  {!photos.length && <span className="rcv-thumb sand-draft-none"><Icon name="sand" size={26} /></span>}
                </div>
                <div className="sand-test-main">
                  {level && row.siltPercent !== null ? (
                    <>
                      <p className={`sand-pct silt-${LEVEL_CLASS[level]}`}>
                        {fmt(row.siltPercent)}%
                        <span className="small muted"> lumpur {fmt(row.siltHeight)} {row.readingUnit} / pasir {fmt(row.sandHeight)} {row.readingUnit}</span>
                      </p>
                      <p className={`small silt-${LEVEL_CLASS[level]}`}><b>{SILT_LEVEL_LABELS[level]}</b></p>
                    </>
                  ) : (
                    <p className="small text-warn">Belum ada hasil — sampel sedang mengendap ({elapsed(row.testedAt, now)})</p>
                  )}
                  <p className="small muted">
                    {[row.vehiclePlate, row.quantity ? `${fmt(row.quantity)} ${row.unit ?? ""}`.trim() : null, `oleh ${testerName(row)}`].filter(Boolean).join(" · ")}
                  </p>
                  {row.notes && <p className="small">{row.notes}</p>}
                  <EditNote row={row} />
                  {row.status === "selesai" && <AckBadges row={row} />}
                </div>
              </div>
              {row.status === "selesai" && (
                <div className="rcv-actions">
                  {canEdit?.(row) && (
                    <EditSandButton
                      row={{
                        id: row.id, sandType: row.sandType, supplier: row.supplier, quarry: row.quarry, readingUnit: row.readingUnit, sandHeight: row.sandHeight, siltHeight: row.siltHeight,
                        siltPercent: row.siltPercent, decision: row.decision, signed: [row.secretaryAckName, row.managerAckName, row.leaderAckName].filter((name): name is string => Boolean(name)),
                      }}
                    />
                  )}
                  <Link href={`/operasional/cetak/uji-pasir/${row.id}`} target="_blank" className="btn btn-ghost btn-sm">Cetak label</Link>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
