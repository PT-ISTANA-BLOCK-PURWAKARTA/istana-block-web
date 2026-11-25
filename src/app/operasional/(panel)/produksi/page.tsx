// Hasil produksi — susunan & tampilan seperti app.kirimistanablock.com ("Pendapatan produksi harian"):
// tombol input, periode cepat + filter jenis produk, kartu per produk (Grade A / Grade B / Reject), adukan cor bersama,
// cat genteng, pemakaian semen per hari, ketidaksesuaian (TTD), kendala, lalu detail per catatan.
import "@/components/ops/home/home.css";
import "./produksi.css";
import Link from "next/link";
import { ackRejectLeader, ackRejectManager } from "@/app/operasional/actions/stock";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { Ok, Rp } from "@/components/erp/ui";
import { ProductionExcel } from "@/components/ops/production/ProductionExcel";
import { hasilText, hasNonconformity, summarizeIssues, sum, totalQty, type ProdRow } from "@/components/ops/production/summary";
import { Icon } from "@/components/panel/Icon";
import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { listConversions } from "@/lib/erp/stock-ops";
import { addDays, formatQty, isDate, tgl, today } from "@/lib/erp/util";
import { listBatches, listProductions, productionAccess, productionValues } from "@/lib/ops/production";
import { guessLine, METHOD_LABEL } from "@/lib/ops/production-lines";

export const metadata = { title: "Hasil produksi" };

/** Jenis produk seperti filter di app lama (label sama). */
const LINES: [string, string][] = [["paving", "Paving"], ["genteng", "Genteng Beton"], ["buis", "Buis Beton"], ["tutup_buis", "Tutup Buis Beton"], ["kanstin", "Kanstin"], ["uditch", "U-Ditch"], ["tutup_uditch", "Tutup U-Ditch"], ["greffel", "Greffel"], ["grass", "Grass Block"], ["lainnya", "Lainnya"]];
const LINE_NAME = Object.fromEntries(LINES) as Record<string, string>;
const lineOfRow = (r: ProdRow) => r.hasil[0]?.line ?? (r.hasil[0] ? guessLine(r.hasil[0].name) : null) ?? (r.category === "paving" ? "paving" : "lainnya");
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayMonth = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function Produksi({ searchParams }: { searchParams: Promise<{ ok?: string; from?: string; to?: string; lini?: string }> }) {
  const acc = await productionAccess();
  const sp = await searchParams;
  const t = today();
  const office = acc.hasStok || acc.canFinance;
  let from = isDate(sp.from) ? sp.from : office ? `${t.slice(0, 8)}01` : addDays(t, -6);
  let to = isDate(sp.to) ? sp.to : t;
  if (from > to) [from, to] = [to, from];
  const line = LINES.some(([k]) => k === sp.lini) ? sp.lini! : null;

  const db = await getDb();
  const [all, values, batches, conversions, deleted] = await Promise.all([
    listProductions(db, acc, { from, to }),
    acc.canFinance ? productionValues(db, { from, to }) : Promise.resolve(new Map<string, number>()),
    listBatches(db, { from, to }),
    listConversions(db, { from, to }, 200),
    db.get<{ n: number }>(sql`select count(*) n from inv_production_deletions where work_date >= ${from} and work_date <= ${to}`),
  ]);
  const rows = line ? all.filter((r) => lineOfRow(r) === line) : all;
  const issues = summarizeIssues(rows);
  const href = (p: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ from, to, lini: line, ...p })) if (v) q.set(k, v);
    return `/operasional/produksi?${q}`;
  };
  const presets = [
    ["Hari ini", t, t],
    ["Kemarin", addDays(t, -1), addDays(t, -1)],
    ["7 hari", addDays(t, -6), t],
    ["Bulan ini", `${t.slice(0, 8)}01`, t],
  ] as const;

  // Kartu per produk (barang hasil).
  type Card = { itemId: string; name: string; unit: string; line: string; method: string | null; paving: boolean; qty: number; gradeB: number; rejects: number; boards: number; days: Set<string>; leaders: Set<string>; mix: boolean };
  const cards = new Map<string, Card>();
  for (const r of rows) {
    r.hasil.forEach((h, i) => {
      const c = cards.get(h.itemId) ?? { itemId: h.itemId, name: h.name, unit: h.unit, line: h.line ?? guessLine(h.name) ?? lineOfRow(r), method: r.method, paving: r.category === "paving", qty: 0, gradeB: 0, rejects: 0, boards: 0, days: new Set<string>(), leaders: new Set<string>(), mix: false };
      c.qty += h.qty;
      if (i === 0) { c.gradeB += r.gradeB ?? 0; c.rejects += r.rejects ?? 0; c.boards += r.boards ?? 0; }
      c.days.add(r.date);
      if (r.leader?.trim()) c.leaders.add(r.leader.trim());
      if (r.mixLogId) c.mix = true;
      cards.set(h.itemId, c);
    });
  }
  const productCards = [...cards.values()].sort((a, b) => LINES.findIndex(([k]) => k === a.line) - LINES.findIndex(([k]) => k === b.line) || a.name.localeCompare(b.name, "id"));

  // Adukan cor bersama.
  const batchDocs = rows.filter((r) => r.batchId);
  const batchIds = new Set(batchDocs.map((r) => r.batchId));
  const batchBags = sum(batches.filter((b) => batchIds.has(b.id)).map((b) => b.cementBags));
  const batchDone = sum(batchDocs.map((r) => totalQty(r)));

  // Pemakaian semen per hari: adukan cor dihitung sekali per adukan; lainnya dari semen per catatan; paving curah (kg) terpisah.
  const cementDays = [...new Set(rows.map((r) => r.date))].sort().reverse().map((d) => {
    const dayRows = rows.filter((r) => r.date === d);
    const byGroup = new Map<string, number>();
    for (const r of dayRows) if (!r.batchId && r.cementBags) byGroup.set(LINE_NAME[lineOfRow(r)] ?? "Lainnya", (byGroup.get(LINE_NAME[lineOfRow(r)] ?? "Lainnya") ?? 0) + r.cementBags);
    const dayBatches = batches.filter((b) => batchIds.has(b.id) && dayRows.some((r) => r.batchId === b.id));
    const cor = sum(dayBatches.map((b) => b.cementBags));
    if (cor) byGroup.set("Adukan cor", (byGroup.get("Adukan cor") ?? 0) + cor);
    return { day: d, byGroup, kg: sum(dayRows.map((r) => r.cementKg)), leaders: [...new Set(dayRows.flatMap((r) => (r.leader?.trim() ? [r.leader.trim()] : [])))].join(", ") };
  }).filter((d) => d.byGroup.size || d.kg);
  const cementGroups = [...new Set(cementDays.flatMap((d) => [...d.byGroup.keys()]))];
  const cementKg = sum(cementDays.map((d) => d.kg));

  // Ketidaksesuaian (Grade B / reject) dan TTD bertingkat Manager in charge -> Pimpinan.
  const nc = rows.filter(hasNonconformity);
  const needManager = nc.filter((r) => !r.rejectManager);
  const needLeader = nc.filter((r) => r.rejectManager && !r.rejectLeader);

  // Cat genteng (natural -> warna).
  const showPaint = conversions.length > 0 && (!line || line === "genteng");
  const paintGroups = new Map<string, { to: string; total: number; days: Set<string> }>();
  for (const { c, toName } of conversions) {
    const g = paintGroups.get(toName ?? "-") ?? { to: toName ?? "-", total: 0, days: new Set<string>() };
    g.total += c.qty;
    g.days.add(c.date);
    paintGroups.set(toName ?? "-", g);
  }

  const action = (r: ProdRow) =>
    r.batchId ? (
      <Link href={`/operasional/produksi/adukan/${r.batchId}`} className="prd-tag" title="Satu adukan semen untuk beberapa produk">Adukan cor{r.canChange ? " · ubah" : ""}</Link>
    ) : r.mixLogId ? (
      <span className="prd-tag" title="Ubah lewat menu QC → Mix desain harian">Dari mix desain</span>
    ) : r.canChange ? (
      <Link href={`/operasional/produksi/${r.id}/ubah`} className="oa-btn" aria-label={`Ubah ${r.number}`}><Icon name="pencil" size={14} stroke={2} />Ubah</Link>
    ) : null;

  return (
    <div className="ohome">
      <header className="ohome-head">
        <div>
          <p className="ohome-kicker"><Icon name="factory" size={14} /> Hasil produksi</p>
          <h1>Pendapatan produksi harian</h1>
          <p className="ohome-lead"><b>Mandor</b> menginput Genteng Beton, Buis Beton (tumbuk / cor / tulangan), Tutup Buis, Kanstin, U-Ditch, Tutup U-Ditch, Greffel, dll.; <b>QC</b> menginput paving. PIC bisa mencatat <b>kendala</b> (mesin trouble, listrik padam, dll.) beserta keterangannya. Kantor melihat rekap &amp; Excel.</p>
        </div>
        {acc.canEdit && (
          <div className="ohome-actions">
            {acc.categories.includes("precast") && <Link href="/operasional/produksi/adukan/baru" className="oa-btn"><Icon name="stack" size={15} /> Input beberapa produk (adukan cor)</Link>}
            {acc.categories.includes("precast") && <Link href="/operasional/stok/cat-genteng" className="oa-btn">🖌️ Cat genteng</Link>}
            <Link href="/operasional/produksi/baru" className="btn btn-primary btn-sm">+ Input hasil {acc.categories.length === 1 ? (acc.categories[0] === "paving" ? "paving" : "precast") : "produksi"}</Link>
          </div>
        )}
      </header>
      <Ok ok={sp.ok} />

      <div className="prd-filter">
        <form method="get" className="prd-filter-range">
          {presets.map(([label, f, tt]) => <Link key={label} href={href({ from: f, to: tt })} className={`oa-btn${from === f && to === tt ? " is-on" : ""}`}>{label}</Link>)}
          <input type="date" name="from" defaultValue={from} aria-label="Dari tanggal" />
          <span className="muted">s/d</span>
          <input type="date" name="to" defaultValue={to} aria-label="Sampai tanggal" />
          {line && <input type="hidden" name="lini" value={line} />}
          <button type="submit" className="oa-btn">Tampilkan</button>
        </form>
        <nav className="prd-lines" aria-label="Jenis produk">
          <Link href={href({ lini: null })} aria-current={!line ? "page" : undefined}>Semua</Link>
          {LINES.map(([k, label]) => <Link key={k} href={href({ lini: k })} aria-current={line === k ? "page" : undefined}>{label}</Link>)}
        </nav>
        <div className="prd-filter-out"><ProductionExcel rows={rows} from={from} to={to} /></div>
      </div>

      <Link href="/operasional/target-produksi" className="prd-target-link"><span>🎯 Target produksi &amp; capaian</span><span className="small">Buka halaman Target Produksi →</span></Link>
      {acc.canEdit && (deleted?.n ?? 0) > 0 && <Link href="/operasional/hapus-produksi" className="prd-target-link is-muted"><span>🗑️ Catatan yang dihapus ({deleted?.n})</span><span className="small">Lihat riwayat hapus →</span></Link>}

      {!rows.length ? (
        <section className="ohome-card"><p className="muted" style={{ textAlign: "center", margin: 0, padding: 16 }}>Belum ada hasil produksi pada periode ini.</p></section>
      ) : (
        <>
          <div className="prd-pcards">
            {productCards.map((c) => (
              <article key={c.itemId} className="ohome-card prd-pcard">
                <p className="prd-pkicker">{LINE_NAME[c.line] ?? "Lainnya"}{c.method ? ` · ${METHOD_LABEL[c.method as keyof typeof METHOD_LABEL] ?? c.method}` : ""}</p>
                <p className="prd-pname">{c.name}</p>
                <p className="prd-pqty">{formatQty(c.qty)} {c.unit} <span>{c.paving ? "Grade A" : "jadi"}</span></p>
                <div className="prd-tiles">
                  <div className="t-a"><span>{c.paving ? "Grade A" : "Jadi"}</span><b>{formatQty(c.qty)}</b></div>
                  {c.paving && <div className="t-b"><span>Grade B</span><b>{formatQty(c.gradeB)}</b></div>}
                  <div className="t-r"><span>Reject</span><b>{formatQty(c.rejects)}</b></div>
                </div>
                <p className="small muted">Produksi {[...c.days].sort().map(dayMonth).join(", ")}{c.boards ? ` · ${formatQty(c.boards)} papan` : ""}{c.mix ? " · otomatis dari mix desain" : ""}</p>
                {c.leaders.size > 0 && <p className="small prd-leaders">Grup: {[...c.leaders].join(", ")}</p>}
              </article>
            ))}
          </div>

          {batchDocs.length > 0 && (
            <p className="prd-batchinfo"><b>Adukan cor bersama:</b> {batchIds.size} adukan · {formatQty(batchBags)} sak semen · {formatQty(batchDone)} pcs (Buis cor / tulangan, U-Ditch, Kanstin){batchDone > 0 && batchBags > 0 ? ` · ≈ ${formatQty(Math.round((batchBags / batchDone) * 1000) / 1000)} sak / pcs` : ""}</p>
          )}

          {showPaint && (
            <section className="ohome-card">
              <div className="ohome-card-head">
                <div><h2>🖌️ Cat genteng beton ({formatQty(sum(conversions.map((x) => x.c.qty)))} pcs)</h2><p className="small muted">Genteng natural yang dicat — mengurangi stok natural, menambah stok warna</p></div>
              </div>
              <div className="prd-paint">
                {[...paintGroups.values()].map((g) => (
                  <div key={g.to}><p className="small muted">Genteng Beton · dicat</p><p><b>{g.to}</b></p><p className="prd-pqty">{formatQty(g.total)} pcs</p><p className="small muted">Dicat {[...g.days].sort().map(dayMonth).join(", ")}</p></div>
                ))}
              </div>
              <ul className="prd-paint-list">
                {conversions.map(({ c, fromName, toName, unit, by }) => (
                  <li key={c.id}>{shortDay(c.date)} · {fromName} → {toName} · <b>{formatQty(c.qty)} {unit}</b>{by ? ` · ${by}` : ""}{c.note ? ` · ${c.note}` : ""}</li>
                ))}
              </ul>
            </section>
          )}

          {cementDays.length > 0 && (
            <details className="ohome-card prd-fold" open>
              <summary><b>Pemakaian semen per hari</b></summary>
              <p className="small muted">Adukan cor (U-Ditch, Kanstin, Buis vibrasi) dihitung sekali per adukan; produk lain dari semen yang diisi per produk.</p>
              <div className="admin-table">
                <table className="compact">
                  <thead><tr><th>Hari</th><th>Grup / leader</th>{cementGroups.map((g) => <th key={g} className="num">{g}</th>)}<th className="num">Total sak</th>{cementKg > 0 && <th className="num">Paving curah (kg)</th>}</tr></thead>
                  <tbody>
                    {cementDays.map((d) => (
                      <tr key={d.day}><td><b>{shortDay(d.day)}</b></td><td className="small">{d.leaders || "-"}</td>{cementGroups.map((g) => <td key={g} className="num">{d.byGroup.get(g) ? formatQty(d.byGroup.get(g)!) : <span className="muted">-</span>}</td>)}<td className="num"><b>{formatQty(sum([...d.byGroup.values()]))}</b></td>{cementKg > 0 && <td className="num">{d.kg ? formatQty(d.kg) : <span className="muted">-</span>}</td>}</tr>
                    ))}
                    <tr className="prd-total"><td>Total</td><td />{cementGroups.map((g) => <td key={g} className="num">{formatQty(sum(cementDays.map((d) => d.byGroup.get(g))))}</td>)}<td className="num">{formatQty(sum(cementDays.map((d) => sum([...d.byGroup.values()]))))} sak</td>{cementKg > 0 && <td className="num">{formatQty(cementKg)}</td>}</tr>
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {nc.length > 0 && (
            <details className="ohome-card prd-fold" open={needManager.length + needLeader.length > 0}>
              <summary><b>Reject &amp; grade B ({nc.length})</b> <span className="small muted">Grade B (masih dijual) &amp; reject (tidak dijual)</span></summary>
              <ul className="prd-nc-list">
                {nc.map((r) => (
                  <li key={r.id}>
                    <div>
                      <Link href={`/operasional/produksi/${r.id}`}><b>{hasilText(r, formatQty)}</b></Link> <span className="small muted">{shortDay(r.date)}</span>
                      <div className="small muted">{(r.rejects ?? 0) > 0 && <>Reject {formatQty(r.rejects)} · </>}{(r.gradeB ?? 0) > 0 && <>Grade B {formatQty(r.gradeB)}</>}{r.note ? ` · ${r.note}` : ""}</div>
                    </div>
                    <div className="prd-nc-sign small">
                      <span className={r.rejectManager ? "text-ok" : "muted"}>{r.rejectManager ? `✓ Manager in charge: ${r.rejectManager.name ?? "-"}` : "Manager in charge: belum"}</span>
                      <span className={r.rejectLeader ? "text-ok" : "muted"}>{r.rejectLeader ? `✓ Pimpinan: ${r.rejectLeader.name ?? "-"}` : "Pimpinan: belum"}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="ohome-actions">
                {acc.canSignManager && needManager.length > 0 && <ConfirmAction className="btn btn-primary btn-sm" action={ackRejectManager.bind(null, needManager.map((r) => r.id))} label={`TTD Manager in charge (${needManager.length})`} confirmText={`Tandatangani ${needManager.length} ketidaksesuaian sebagai Manager in charge?`} />}
                {acc.canSignLeader && needLeader.length > 0 && <ConfirmAction className="btn btn-primary btn-sm" action={ackRejectLeader.bind(null, needLeader.map((r) => r.id))} label={`TTD Pimpinan (${needLeader.length})`} confirmText={`Setujui ${needLeader.length} ketidaksesuaian sebagai Pimpinan?`} />}
                <Link href={`/operasional/cetak/ketidaksesuaian-produksi?from=${from}&to=${to}`} className="oa-btn">Dokumen ketidaksesuaian</Link>
              </div>
            </details>
          )}

          {issues.length > 0 && (
            <section className="ohome-card">
              <p className="prd-issues-title">⚠ Kendala produksi periode ini</p>
              <div className="prd-issue-cards">
                {issues.map((x) => <span key={x.issue}><b>{x.issue}</b> <span className="small">{x.count}× · {x.days} hari</span><span className="small muted">{x.products.join(", ")} · terakhir {shortDay(x.last)}</span></span>)}
              </div>
            </section>
          )}

          <section className="ohome-card prd-detail-cards">
            <p className="prd-label">Detail ({rows.length})</p>
            {rows.map((r) => (
              <div key={r.id} className="prd-dcard">
                <div className="prd-dtop">
                  <div><Link href={`/operasional/produksi/${r.id}`}><b>{r.hasil.map((h) => h.name).join(" + ") || "-"}</b></Link><p className="small muted">{shortDay(r.date)}{r.leader ? ` · ${r.leader}` : ""}{r.gradeB ? ` · B ${formatQty(r.gradeB)}` : ""}{r.rejects ? ` · reject ${formatQty(r.rejects)}` : ""}{r.cementBags ? ` · ${formatQty(r.cementBags)} sak` : r.cementKg ? ` · ${formatQty(r.cementKg)} kg` : ""}</p></div>
                  <p className="prd-dqty">{formatQty(totalQty(r))} <span>{r.hasil[0]?.unit}</span>{r.target ? <span className="prd-pct">{Math.round((totalQty(r) / r.target) * 100)}% target</span> : null}</p>
                </div>
                {(r.issues.length > 0 || r.note) && <p className="small text-warn">{r.issues.map((i) => `⚠ ${i}`).join(" ")}{r.note ? ` ${r.note}` : ""}</p>}
                <div className="prd-dfoot">{r.photoKey ? <a href={`/operasional/berkas/${r.photoKey}`} target="_blank" rel="noopener noreferrer" className="small">Lihat foto</a> : <span />}{action(r)}</div>
              </div>
            ))}
          </section>

          <section className="ohome-card prd-table-card">
            <div className="admin-table">
              <table className="compact prd-table">
                <thead><tr><th>Tanggal</th><th>Produk</th><th className="num">Grade A (jadi)</th><th className="num" title="Hanya paving">Grade B (paving)</th><th className="num">Reject</th><th className="num">Semen</th><th>Foto</th><th>PIC</th>{acc.canFinance && <th className="num">Nilai</th>}<th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="small">{tgl(r.date)}</td>
                      <td>
                        <Link href={`/operasional/produksi/${r.id}`}><b>{r.hasil.map((h) => h.name).join(" + ") || "-"}</b></Link>
                        <div className="small muted">{LINE_NAME[lineOfRow(r)] ?? "Lainnya"}{r.batchCode ? <> · <span className="prd-code">{r.batchCode}</span></> : null}</div>
                        {r.leader && <div className="small muted">Leader: {r.leader}</div>}
                        {r.issues.length > 0 && <div className="prd-issues">{r.issues.map((i) => <span key={i} className="prd-issue-chip">⚠ {i}</span>)}</div>}
                        {r.note && <div className="small muted">{r.note}</div>}
                      </td>
                      <td className="num">{formatQty(totalQty(r))} {r.hasil[0]?.unit}{r.boards ? <div className="small muted">{formatQty(r.boards)} papan</div> : null}{r.target ? <div className="small muted">target {formatQty(r.target)} · {Math.round((totalQty(r) / r.target) * 100)}%</div> : null}</td>
                      <td className="num">{r.category === "paving" || r.gradeB ? formatQty(r.gradeB ?? 0) : <span className="muted" title="Grade B hanya untuk paving">—</span>}</td>
                      <td className="num">{formatQty(r.rejects ?? 0)}</td>
                      <td className="num">{r.cementKg ? <>{formatQty(r.cementKg)} kg<div className="small muted">curah</div></> : r.cementBags ? <>{formatQty(r.cementBags)} sak{totalQty(r) ? <div className="small muted">≈ {formatQty(Math.round((r.cementBags / totalQty(r)) * 1000) / 1000)} sak/{r.hasil[0]?.unit}</div> : null}</> : <span className="muted">-</span>}</td>
                      <td>{r.photoKey ? <a href={`/operasional/berkas/${r.photoKey}`} target="_blank" rel="noopener noreferrer"><img src={`/operasional/berkas/${r.photoKey}`} alt={`Foto ${r.number}`} className="prd-thumb" loading="lazy" /></a> : <span className="muted">-</span>}</td>
                      <td className="small">{r.createdByName ?? "-"}</td>
                      {acc.canFinance && <td className="num"><Rp n={values.get(r.id) ?? 0} /></td>}
                      <td>{action(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
