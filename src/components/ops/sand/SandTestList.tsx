import Link from "next/link";
import { berkasUrl, elapsed, whenText } from "@/components/ops/receipts/util";
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

/** Daftar hasil uji lumpur (kartu) + rata-rata per supplier. Komponen server. */
export function SandTestList({ rows, showStats }: { rows: SandTestRow[]; showStats: boolean }) {
  if (!rows.length) return <div className="admin-card"><p className="muted">Belum ada hasil uji pada periode ini.</p></div>;
  const stats = showStats ? statsBySource(rows) : [];
  const now = Date.now();
  return (
    <>
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
                </div>
              </div>
              {row.status === "selesai" && (
                <div className="rcv-actions">
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
