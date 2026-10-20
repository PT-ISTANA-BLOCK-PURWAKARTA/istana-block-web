"use client";

import { useMemo, useState } from "react";
import { Kpis } from "@/components/erp/ui";
import { Icon } from "@/components/panel/Icon";
import { DeliveryDialog, OverallBadge, PriceChip, PriceDialog, SpeedChip, receiptOverall } from "@/components/ops/receipts/ReceiptRatings";
import { berkasUrl, whenFull } from "@/components/ops/receipts/util";
import { fmt } from "@/lib/ops/shared/format";
import { DELIVERY_MODE_LABELS, GOOD_SILT_PERCENT, MAX_SILT_PERCENT, SAND_TIERS, TIER_LABELS, siltLevel, sourceLabel, type SandTier } from "@/lib/ops/shared/sand";
import { GRADES, SCORE_WEIGHTS, gradeOf, overallScore } from "@/lib/ops/shared/score";
import { OverallBars, OverallCurve, type RankItem } from "./ScoreCharts";
import { QualityDialog } from "./QualityDialog";
import { exportSupplierExcel, printSupplierSummary } from "./exports";
import {
  NO_TAG, average, buildSummaries, curveData, levelOf, materialKey, modeSummary, partsOf, pts, qty, ranked, share, silts, sourceKey, summarizeGroups, summarizeMonths, tagKey, tagOf,
  type GroupSummary, type Note, type SupplierRow,
} from "./summaries";

const LEVEL_CLASS = { bagus: "ok", cukup: "warn", lewat: "bad" } as const;

function TierBadge({ tier, confirmed = true }: { tier: SandTier | null; confirmed?: boolean }) {
  if (!tier) return <span className="sup-tier tier-none">Tier belum dinilai</span>;
  return <span className={`sup-tier tier-${tier}${confirmed ? "" : " is-suggest"}`}>Tier {tier} · {TIER_LABELS[tier]}{confirmed ? "" : " (saran)"}</span>;
}

const TierDot = ({ tier }: { tier: SandTier | null }) => (tier ? <span className={`sup-tier tier-${tier}`}>{tier}</span> : <span className="muted small">-</span>);

/** Keterangan terbaru (maks. 2) + jumlah sisanya. */
function NotesCell({ notes }: { notes: Note[] }) {
  if (!notes.length) return <span className="muted">—</span>;
  return (
    <div className="sup-notes small">
      {notes.slice(0, 2).map((note, index) => <p key={index}>“{note.text}” <span className="muted">{new Date(note.at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit", timeZone: "Asia/Jakarta" })}</span></p>)}
      {notes.length > 2 && <p className="muted">+{notes.length - 2} keterangan lain (lihat Excel)</p>}
    </div>
  );
}

function CheckChip({ checked, label, count, onClick }: { checked: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={checked} className={`sup-check${checked ? " on" : ""}`} onClick={onClick}>
      <span className="sup-check-box">{checked ? "✓" : ""}</span>
      {label} <span className="muted small">{count}</span>
    </button>
  );
}

function InventoryTable({ title, groups }: { title: string; groups: GroupSummary[] }) {
  return (
    <div>
      <h3 className="sup-h3">{title}</h3>
      <div className="admin-table">
        <table className="sup-wide">
          <thead>
            <tr><th>Nama</th><th className="num">Rit</th><th className="num">Jumlah</th><th className="num">Lumpur rata²</th><th>Tier</th><th>Terakhir datang</th></tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <td>
                  <b className={g.label === NO_TAG ? "muted" : ""}>{g.label}</b>
                  <span className="sup-sub small muted">{g.sources.join(", ")}</span>
                </td>
                <td className="num">{g.count}</td>
                <td className="num">
                  <b>{qty(g.rows)}</b>
                  {g.missingQuantity ? <span className="sup-sub small text-warn">{g.missingQuantity} tanpa jumlah</span> : null}
                </td>
                <td className={`num ${g.avgSilt === null ? "muted" : `silt-${LEVEL_CLASS[siltLevel(g.avgSilt)]}`}`}>{g.avgSilt === null ? "belum diuji" : `${fmt(g.avgSilt)}%`}</td>
                <td><TierDot tier={g.tier} /></td>
                <td className="small muted">{whenFull(g.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Pending = "qc" | "kantor" | "harga";

/**
 * Papan bahan baku & supplier: nilai overall (kualitas 40 + kecepatan 30 + harga 30), tier list QC, inventory per
 * bahan/tag/bulan, vendor pengiriman, daftar kiriman dengan tombol penilaian sesuai izin. Seluruh agregasi
 * dihitung di browser dari baris yang dikirim server.
 */
export function SupplierBoard({
  rows: allRows,
  from,
  to,
  company,
  canRateQuality,
  canRateDelivery,
  canRatePrice,
  expeditions,
  tags,
}: {
  rows: SupplierRow[];
  from: string;
  to: string;
  company: string[];
  canRateQuality: boolean;
  canRateDelivery: boolean;
  canRatePrice: boolean;
  expeditions: string[];
  tags: string[];
}) {
  // Centang bahan baku dan/atau tag untuk menyaring seluruh halaman; kosong = semua.
  const [checkedMaterials, setCheckedMaterials] = useState<string[]>([]);
  const [checkedTags, setCheckedTags] = useState<string[]>([]);
  const [filter, setFilter] = useState<{ source?: string; pending?: Pending }>({});
  const [rating, setRating] = useState<{ id: string; kind: "quality" | "delivery" | "price" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]);

  const materialOptions = useMemo(() => summarizeGroups(allRows, materialKey, (row) => row.itemName), [allRows]);
  const tagOptions = useMemo(() => summarizeGroups(allRows, tagKey, tagOf), [allRows]);
  const rows = useMemo(
    () => allRows.filter((row) => (!checkedMaterials.length || checkedMaterials.includes(materialKey(row))) && (!checkedTags.length || checkedTags.includes(tagKey(row)))),
    [allRows, checkedMaterials, checkedTags],
  );
  const summaries = useMemo(() => buildSummaries(rows), [rows]);
  const { materials, tags: tagGroups, sources, vendors } = summaries;
  const months = useMemo(() => summarizeMonths(rows), [rows]);
  // Warna kurva mengikuti supplier (urut nama dari seluruh data), bukan peringkatnya.
  const orderOf = useMemo(() => {
    const keys = [...new Set(allRows.map(sourceKey))].sort();
    return (key: string) => keys.indexOf(key);
  }, [allRows]);
  const curve = useMemo(() => curveData(rows, sources, orderOf), [rows, sources, orderOf]);
  const rankList = useMemo(() => ranked(sources), [sources]);
  const rankItems: RankItem[] = useMemo(() => rankList.map((s) => ({ key: s.key, label: s.label, overall: s.overall!, parts: s.parts, count: s.scored, complete: s.complete })), [rankList]);

  const totals = useMemo(() => {
    const speeds = rows.flatMap((row) => (row.speedRating ? [row.speedRating] : []));
    const tested = rows.filter((row) => row.siltPercent !== null);
    return {
      avgSilt: average(silts(rows)),
      tested: tested.length,
      good: rows.filter((row) => levelOf(row) === "bagus").length,
      overLimit: rows.filter((row) => levelOf(row) === "lewat").length,
      rejected: rows.filter((row) => row.status === "ditolak").length,
      speedAvg: average(speeds),
      overall: overallScore(partsOf(rows)).overall,
      pendingQc: rows.filter((row) => !row.tierConfirmed).length,
      pendingOffice: rows.filter((row) => !row.speedRating).length,
      pendingPrice: rows.filter((row) => !row.priceRating).length,
    };
  }, [rows]);

  const visible = rows.filter(
    (row) => (!filter.source || sourceKey(row) === filter.source) && (filter.pending !== "qc" || !row.tierConfirmed) && (filter.pending !== "kantor" || !row.speedRating) && (filter.pending !== "harga" || !row.priceRating),
  );
  const filterLabel = filter.source ? sources.find((s) => s.key === filter.source)?.label : null;
  const subject = rating ? allRows.find((row) => row.id === rating.id) ?? null : null;
  const pickSource = (key: string) => setFilter({ ...filter, source: filter.source === key ? undefined : key });
  const pendingButton = (kind: Pending, label: string, count: number) => (
    <button type="button" className={`btn btn-sm ${filter.pending === kind ? "btn-blue" : "btn-ghost"}`} onClick={() => setFilter({ ...filter, pending: filter.pending === kind ? undefined : kind })}>
      {label} ({count})
    </button>
  );

  function run(action: () => void | Promise<void>) {
    setError(null);
    Promise.resolve()
      .then(action)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memproses"));
  }

  return (
    <>
      <div className="rcv-toolbar">
        <button type="button" className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => run(() => printSupplierSummary(summaries, from, to, company))}>Cetak ringkasan</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => run(() => exportSupplierExcel(summaries, from, to))}>Unduh Excel</button>
        {error && <span className="small text-bahaya" role="alert">{error}</span>}
      </div>

      {(materialOptions.length > 1 || tagOptions.length > 1) && (
        <div className="admin-card sup-filters">
          {materialOptions.length > 1 && (
            <div className="sup-filter-row">
              <span className="sup-filter-label">Bahan baku</span>
              <CheckChip checked={!checkedMaterials.length} label="Semua" count={allRows.length} onClick={() => setCheckedMaterials([])} />
              {materialOptions.map((m) => <CheckChip key={m.key} checked={checkedMaterials.includes(m.key)} label={m.label} count={m.count} onClick={() => setCheckedMaterials(toggle(checkedMaterials, m.key))} />)}
            </div>
          )}
          {tagOptions.length > 1 && (
            <div className="sup-filter-row">
              <span className="sup-filter-label">Tag</span>
              <CheckChip checked={!checkedTags.length} label="Semua" count={allRows.length} onClick={() => setCheckedTags([])} />
              {tagOptions.map((t) => <CheckChip key={t.key} checked={checkedTags.includes(t.key)} label={t.label} count={t.count} onClick={() => setCheckedTags(toggle(checkedTags, t.key))} />)}
            </div>
          )}
        </div>
      )}

      {!rows.length ? (
        <div className="admin-card"><p className="muted">Belum ada bahan baku masuk pada periode / filter ini. Data muncul otomatis setelah satpam mencatat barang masuk.</p></div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          <Kpis
            items={[
              { label: "Bahan baku datang", value: `${rows.length} rit`, sub: qty(rows) },
              { label: "Kadar lumpur rata-rata", value: totals.avgSilt === null ? "-" : `${fmt(totals.avgSilt)}%`, sub: `${totals.tested} diuji · ${share(totals.good, totals.tested)} bagus ≤ ${GOOD_SILT_PERCENT}%` },
              { label: `Lewat batas ${MAX_SILT_PERCENT}%`, value: `${totals.overLimit} kiriman`, sub: `${totals.rejected} ditolak`, tone: totals.overLimit ? "bad" : undefined },
              {
                label: "Nilai overall rata-rata",
                value: totals.overall === null ? "-" : `${totals.overall} · ${gradeOf(totals.overall)!.grade}`,
                sub: `${totals.pendingQc} belum tier QC · ${totals.pendingOffice} belum nilai kirim · ${totals.pendingPrice} belum nilai harga`,
              },
            ]}
          />

          {/* Nilai overall: tier list A–D, peringkat, kurva */}
          <section className="admin-card sup-section">
            <div>
              <h2>Nilai overall supplier / quarry</h2>
              <p className="small muted">
                Kualitas (tier QC) {SCORE_WEIGHTS.quality}% + kecepatan kirim {SCORE_WEIGHTS.speed}% + harga {SCORE_WEIGHTS.price}%, skala 0–100. Tier 1→100, 2→67, 3→33, 4→0; Cepat/Affordable→100, Standard/Sedang→50, Lambat/Mahal→0.
                Bila belum semua dinilai, nilai dihitung dari yang sudah ada (sementara).
              </p>
            </div>
            {!rankItems.length ? (
              <p className="flag flag-info">Belum ada penilaian kualitas, kecepatan, atau harga pada periode ini.</p>
            ) : (
              <>
                <div className="sup-tierlist">
                  {GRADES.map((grade) => {
                    const items = rankList.filter((s) => gradeOf(s.overall)!.grade === grade.grade);
                    return (
                      <div key={grade.grade} className="sup-tierrow">
                        <div className={`sup-tierhead grade-${grade.grade}`}>
                          <span className="sup-tiernum">{grade.grade}</span>
                          <span className="small">{grade.label} · {grade.min === 0 ? "<40" : `≥${grade.min}`}</span>
                        </div>
                        <div className="sup-tieritems">
                          {items.length ? (
                            items.map((s) => (
                              <button key={s.key} type="button" aria-pressed={filter.source === s.key} className={`sup-chipbtn${filter.source === s.key ? " is-active" : ""}`} onClick={() => pickSource(s.key)}>
                                <b>{s.label}</b> <b>{s.overall}</b>
                                {s.complete ? "" : <span className="small muted"> (sementara)</span>}
                                <span className="small muted">Kualitas {pts(s.parts.quality)} · Kecepatan {pts(s.parts.speed)} · Harga {pts(s.parts.price)}</span>
                              </button>
                            ))
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <h3 className="sup-h3">Peringkat nilai overall</h3>
                  <OverallBars items={rankItems} />
                </div>
                <div>
                  <h3 className="sup-h3">Kurva nilai overall per bulan{curve.series.length ? ` (${curve.series.length} supplier dengan penilaian terbanyak)` : ""}</h3>
                  {curve.months.length > 1 && curve.series.length ? (
                    <OverallCurve months={curve.months} series={curve.series} />
                  ) : (
                    <p className="flag flag-info">Kurva muncul bila periode berisi penilaian minimal 2 bulan — pilih &quot;3 bulan&quot; atau &quot;Tahun ini&quot;.</p>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="admin-card sup-section">
            <div>
              <h2>Rekap bahan baku masuk (inventory)</h2>
              <p className="small muted">Jumlah rit dan jumlah barang pada periode ini (termasuk yang ditolak).</p>
            </div>
            <InventoryTable title="Per bahan baku" groups={materials} />
            {tagGroups.length > 1 && <InventoryTable title="Per tag" groups={tagGroups} />}
            {months.length > 1 && (
              <div>
                <h3 className="sup-h3">Per bulan</h3>
                <div className="sup-months">
                  {months.map((m) => (
                    <div key={m.key} className="sup-month">
                      <b>{m.label}</b>
                      <p>{m.rows.length} rit · {qty(m.rows)}</p>
                      <p className="small muted">{m.byMaterial.map((g) => `${g.label}: ${g.count} rit / ${qty(g.rows)}`).join(" · ")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="admin-card sup-section">
            <div>
              <h2>Tier list kualitas (QC)</h2>
              <p className="small muted">Tier supplier = tier yang paling sering pada kirimannya (penilaian QC; bila belum dinilai, saran dari hasil uji lumpur). Klik nama untuk melihat kirimannya di bawah.</p>
            </div>
            <div className="sup-tierlist">
              {SAND_TIERS.map((tier) => {
                const items = sources.filter((s) => s.tier === tier);
                return (
                  <div key={tier} className="sup-tierrow">
                    <div className={`sup-tierhead tier-${tier}`}>
                      <span className="sup-tiernum">{tier}</span>
                      <span className="small">{TIER_LABELS[tier]}</span>
                    </div>
                    <div className="sup-tieritems">
                      {items.length ? (
                        items.map((s) => (
                          <button key={s.key} type="button" aria-pressed={filter.source === s.key} className={`sup-chipbtn tier-chip-${tier}${filter.source === s.key ? " is-active" : ""}`} onClick={() => pickSource(s.key)}>
                            <b>{s.label}</b>
                            <span className="small muted">{s.materials.join(", ")} · {s.count} rit{s.avgSilt !== null ? ` · lumpur ${fmt(s.avgSilt)}%` : ""}</span>
                          </button>
                        ))
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {sources.some((s) => !s.tier) && <p className="small muted">Belum bertier (belum diuji &amp; belum dinilai QC): {sources.filter((s) => !s.tier).map((s) => s.label).join(", ")}</p>}
          </section>

          <section className="admin-card sup-section">
            <h2>Ringkasan &amp; keterangan per supplier / quarry</h2>
            <div className="admin-table">
              <table className="sup-wide sup-wide-xl">
                <thead>
                  <tr>
                    <th>#</th><th>Supplier / quarry</th><th>Tier</th><th className="num">Rit</th><th className="num">Lumpur rata²</th><th>Bagus ≤{GOOD_SILT_PERCENT}%</th><th>&gt;{MAX_SILT_PERCENT}%</th>
                    <th>Kecepatan</th><th>Harga</th><th>Overall</th><th>Keterangan QC terbaru</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s, i) => (
                    <tr key={s.key} className="sup-top">
                      <td className="muted">{i + 1}</td>
                      <td>
                        <b>{s.label}</b>
                        <span className="sup-sub small muted">{s.materials.join(", ")}{s.unrated ? ` · ${s.unrated} belum dinilai QC` : ""}</span>
                        <span className="sup-sub small muted">{[s.viaQuarry ? `${s.viaQuarry}× armada quarry` : null, s.viaExpedition ? `${s.viaExpedition}× ekspedisi` : null].filter(Boolean).join(", ")}</span>
                      </td>
                      <td><TierDot tier={s.tier} /></td>
                      <td className="num">{s.count}<span className="sup-sub small muted">{qty(s.rows)}</span></td>
                      <td className={`num ${s.avgSilt === null ? "muted" : `silt-${LEVEL_CLASS[siltLevel(s.avgSilt)]}`}`}>
                        <b>{s.avgSilt === null ? "-" : `${fmt(s.avgSilt)}%`}</b>
                        {s.minSilt !== null && <span className="sup-sub small muted">{fmt(s.minSilt)}–{fmt(s.maxSilt)}%</span>}
                      </td>
                      <td className="num">{share(s.good, s.tested)}</td>
                      <td className={`num ${s.overLimit ? "silt-bad" : "muted"}`}>{s.overLimit}</td>
                      <td><SpeedChip value={s.speedAvg} /></td>
                      <td><PriceChip value={s.priceAvg} /></td>
                      <td><OverallBadge score={s.overall} complete={s.complete} /></td>
                      <td><NotesCell notes={s.notes} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card sup-section">
            <h2>Kecepatan &amp; keterangan pengiriman per vendor</h2>
            <div className="sup-modes">
              {(["quarry", "ekspedisi"] as const).map((mode) => {
                const m = modeSummary(rows, mode);
                return (
                  <div key={mode} className="sup-mode">
                    <b className="small">{DELIVERY_MODE_LABELS[mode].toUpperCase()}</b>
                    <p><b>{m.count}</b> rit <SpeedChip value={m.speedAvg} /></p>
                    <p className="small muted">{m.speedCount ? `${share(m.onTime, m.speedCount)} standard / cepat (dari ${m.speedCount} dinilai)` : "belum ada penilaian kecepatan"}</p>
                  </div>
                );
              })}
            </div>
            <div className="admin-table">
              <table className="sup-wide">
                <thead>
                  <tr><th>Vendor</th><th>Jenis</th><th className="num">Rit</th><th>Kecepatan</th><th>Lambat</th><th>Keterangan pengiriman terbaru</th></tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.key} className="sup-top">
                      <td><b>{v.name}</b><span className="sup-sub small muted">{v.sources.join(", ")}</span></td>
                      <td className="small muted">{v.mode ? DELIVERY_MODE_LABELS[v.mode] : "Belum diisi"}</td>
                      <td className="num">{v.count}</td>
                      <td><SpeedChip value={v.speedAvg} /></td>
                      <td className={`num ${v.late ? "silt-bad" : "muted"}`}>{v.late}</td>
                      <td><NotesCell notes={v.notes} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="sup-listhead">
            <h2>Daftar bahan baku datang{filterLabel ? ` · ${filterLabel}` : ""}</h2>
            <div className="rcv-actions">
              {filter.source && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilter({ ...filter, source: undefined })}>Semua supplier</button>}
              {pendingButton("qc", "Belum tier QC", totals.pendingQc)}
              {pendingButton("kantor", "Belum nilai kirim", totals.pendingOffice)}
              {pendingButton("harga", "Belum nilai harga", totals.pendingPrice)}
            </div>
          </div>
          <div className="rcv-grid">
            {visible.map((row) => {
              const level = levelOf(row);
              const photo = row.test?.photoKey ?? row.photoKeys[0] ?? row.test?.startPhotoKey ?? null;
              const score = receiptOverall(row);
              return (
                <article key={row.id} className="rcv-card sup-card">
                  <div className="sup-card-row">
                    {photo && (
                      <a href={berkasUrl(photo)} target="_blank" rel="noreferrer" className="rcv-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={berkasUrl(photo)} alt="Foto" loading="lazy" />
                      </a>
                    )}
                    <div className="sup-card-main">
                      <div className="rcv-top">
                        <div className="rcv-title">
                          <b>{sourceLabel(row)}</b>
                          <div className="small muted">
                            {row.tag ? <span className="sup-tag">{row.tag}</span> : null}
                            <b>{row.itemName}</b> · {whenFull(row.receivedAt)}
                            {row.vehiclePlate ? ` · ${row.vehiclePlate}` : ""}
                            {row.quantity ? ` · ${fmt(row.quantity)} ${row.unit}` : ""}
                          </div>
                        </div>
                        {row.siltPercent !== null && level ? (
                          <b className={`sup-silt silt-${LEVEL_CLASS[level]}`}>{fmt(row.siltPercent)}%</b>
                        ) : (
                          <span className="small muted sup-silt-none"><Icon name="sand" size={14} /> {row.test?.status === "draft" ? "mengendap" : "belum diuji"}</span>
                        )}
                      </div>
                      <div className="rcv-chips">
                        <TierBadge tier={row.tier} confirmed={row.tierConfirmed} />
                        {row.hasBrangkal ? <span className="sup-pill">brangkal</span> : null}
                        {row.status === "ditolak" && <span className="badge badge-danger">ditolak</span>}
                        <OverallBadge score={score.overall} complete={score.complete} />
                      </div>
                      <p className="small muted sup-line">
                        <span>{row.deliveryMode ? (row.deliveryMode === "ekspedisi" ? `${row.expeditionName ?? "Ekspedisi"} (ekspedisi pihak ketiga)` : "Armada quarry / supplier") : "Pengirim belum diisi"}</span>
                        <SpeedChip value={row.speedRating} />
                        <PriceChip value={row.priceRating} />
                      </p>
                      {(row.qualityNote || row.deliveryNote || row.priceNote) && (
                        <div className="small sup-quotes">
                          {row.qualityNote && <span>QC: “{row.qualityNote}”{row.qualityByName ? ` — ${row.qualityByName}` : ""} </span>}
                          {row.deliveryNote && <span>Pengiriman: “{row.deliveryNote}”{row.deliveryByName ? ` — ${row.deliveryByName}` : ""} </span>}
                          {row.priceNote && <span>Harga: “{row.priceNote}”{row.priceByName ? ` — ${row.priceByName}` : ""}</span>}
                        </div>
                      )}
                      {(canRateQuality || canRateDelivery || canRatePrice) && (
                        <div className="rcv-actions">
                          {canRateQuality && <button type="button" className={`btn btn-sm ${row.tierConfirmed ? "btn-ghost" : "btn-blue"}`} onClick={() => setRating({ id: row.id, kind: "quality" })}>{row.tierConfirmed ? "Ubah tier" : "Nilai tier (QC)"}</button>}
                          {canRateDelivery && <button type="button" className={`btn btn-sm ${row.speedRating ? "btn-ghost" : "btn-blue"}`} onClick={() => setRating({ id: row.id, kind: "delivery" })}>{row.speedRating ? "Ubah nilai kirim" : "Nilai pengiriman"}</button>}
                          {canRatePrice && <button type="button" className={`btn btn-sm ${row.priceRating ? "btn-ghost" : "btn-blue"}`} onClick={() => setRating({ id: row.id, kind: "price" })}>{row.priceRating ? "Ubah harga" : "Nilai harga"}</button>}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!visible.length && <p className="muted" style={{ textAlign: "center", padding: 16 }}>Tidak ada kiriman sesuai filter.</p>}
        </div>
      )}

      {subject && rating?.kind === "quality" && <QualityDialog row={subject} onClose={() => setRating(null)} />}
      {subject && rating?.kind === "delivery" && <DeliveryDialog row={subject} expeditions={expeditions} tags={tags} onClose={() => setRating(null)} />}
      {subject && rating?.kind === "price" && <PriceDialog row={subject} onClose={() => setRating(null)} />}
    </>
  );
}
