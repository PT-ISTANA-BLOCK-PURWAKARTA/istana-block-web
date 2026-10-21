// Cetak ringkasan (print browser) dan Excel multi-sheet halaman bahan baku. Hanya dipakai di klien.
import { berkasUrl, monthName, shortDate, wibDay } from "@/components/ops/receipts/util";
import { tglPanjang } from "@/lib/erp/util";
import { downloadWorkbook, type SheetData } from "@/lib/ops/excel";
import { fmt } from "@/lib/ops/shared/format";
import { DECISION_LABELS, DELIVERY_MODE_LABELS, GOOD_SILT_PERCENT, MAX_SILT_PERCENT, PRICE_LABELS, SAND_TIERS, SILT_LEVEL_LABELS, SPEED_LABELS, TIER_LABELS } from "@/lib/ops/shared/sand";
import { SCORE_WEIGHTS, gradeOf, overallScore } from "@/lib/ops/shared/score";
import { curveData, groupBy, levelOf, materialKey, partsOf, qty, ranked, round, share, type GroupSummary, type Note, type Summaries, type SupplierRow } from "./summaries";

/** "Standard (2,3/3)" untuk rata-rata penilaian tiga tingkat. */
export const levelText = (value: number | null, labels: Record<number, string>) =>
  value === null ? "-" : `${labels[Math.min(3, Math.max(1, Math.round(value)))]} (${fmt(value, 1)}/3)`;

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/* ------------------------------------------------------------------ cetak */

const PRINT_STYLE = `
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; }
  .company { text-align: center; } .company h1 { font-size: 15pt; margin: 0; } .company p { margin: 1px 0; font-size: 8.5pt; }
  h2 { text-align: center; font-size: 12pt; margin: 12px 0 2px; } .period { text-align: center; margin-bottom: 8px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #000; padding: 4px 5px; vertical-align: top; font-size: 8.5pt; }
  th { background: #eee; text-align: center; } td.c { text-align: center; } td.r { text-align: right; } small { color: #444; }
`;

/** Cetak lewat bingkai tersembunyi di halaman yang sama (tidak terhalang pemblokir pop-up, juga di HP). */
function printHtml(title: string, body: string) {
  document.getElementById("sup-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "sup-print-frame";
  frame.title = title;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_STYLE}</style></head><body>${body}</body></html>`);
  doc.close();
  setTimeout(() => { frame.contentWindow!.focus(); frame.contentWindow!.print(); }, 200);
}

const latest = (notes: Note[]) => notes.slice(0, 3).map((note) => `${esc(note.text)} (${shortDate(note.at)})`).join("<br>");

export function printSupplierSummary({ rows, materials, tags, sources, vendors }: Summaries, from: string, to: string, company: string[]) {
  const header = `<div class="company"><h1>${esc(company[0] ?? "")}</h1>${company.slice(1).map((line) => `<p>${esc(line)}</p>`).join("")}</div>`;
  const groupTable = (title: string, groups: GroupSummary[]) =>
    `<h2>${title}</h2><table><thead><tr><th>NO</th><th>NAMA</th><th>RIT</th><th>JUMLAH</th><th>LUMPUR RATA²</th><th>TIER</th><th>SUPPLIER / QUARRY</th></tr></thead><tbody>${groups
      .map((g, i) => `<tr><td class="c">${i + 1}</td><td>${esc(g.label)}</td><td class="c">${g.count}</td><td class="r">${esc(qty(g.rows))}</td><td class="r">${g.avgSilt === null ? "-" : `${fmt(g.avgSilt)}%`}</td><td class="c">${g.tier ? `${g.tier} · ${TIER_LABELS[g.tier]}` : "-"}</td><td>${esc(g.sources.join(", "))}</td></tr>`)
      .join("")}<tr><td></td><td><b>JUMLAH</b></td><td class="c"><b>${rows.length}</b></td><td class="r"><b>${esc(qty(rows))}</b></td><td colspan="3"></td></tr></tbody></table>`;
  const overallRows = ranked(sources)
    .map((s, i) => `<tr><td class="c">${i + 1}</td><td>${esc(s.label)}</td><td class="c"><b>${s.overall}</b></td><td class="c">${gradeOf(s.overall)!.grade} · ${gradeOf(s.overall)!.label}</td><td class="c">${round(s.parts.quality, 0)}</td><td class="c">${round(s.parts.speed, 0)}</td><td class="c">${round(s.parts.price, 0)}</td><td class="c">${s.complete ? "Lengkap" : "Sementara"}</td></tr>`)
    .join("");
  const tierRows = SAND_TIERS.map(
    (tier) => `<tr><td><b>Tier ${tier}</b><br>${TIER_LABELS[tier]}</td><td>${sources.filter((s) => s.tier === tier).map((s) => `${esc(s.label)} (${s.count}×${s.avgSilt === null ? "" : ` · ${fmt(s.avgSilt)}%`})`).join(", ") || "-"}</td></tr>`,
  ).join("");
  const sourceRows = sources
    .map((s, i) => `<tr><td class="c">${i + 1}</td><td>${esc(s.label)}<br><small>${esc(s.materials.join(", "))}</small></td><td class="c">${s.tier ?? "-"}</td><td class="c">${s.count}</td><td class="r">${esc(qty(s.rows))}</td><td class="r">${s.avgSilt === null ? "-" : `${fmt(s.avgSilt)}%`}</td><td class="c">${share(s.good, s.tested)}</td><td class="c">${s.overLimit}</td><td class="c">${esc(levelText(s.speedAvg, SPEED_LABELS))}</td><td class="c">${esc(levelText(s.priceAvg, PRICE_LABELS))}</td><td>${latest(s.notes)}</td></tr>`)
    .join("");
  const vendorRows = vendors
    .map((v, i) => `<tr><td class="c">${i + 1}</td><td>${esc(v.name)}</td><td>${v.mode ? DELIVERY_MODE_LABELS[v.mode] : "-"}</td><td class="c">${v.count}</td><td class="c">${esc(levelText(v.speedAvg, SPEED_LABELS))}</td><td class="c">${v.late}</td><td>${latest(v.notes)}</td></tr>`)
    .join("");
  const body = `${header}<h2>RINGKASAN BAHAN BAKU, TIER &amp; PENGIRIMAN</h2><div class="period">Periode : ${tglPanjang(from).toUpperCase()} - ${tglPanjang(to).toUpperCase()} · ${rows.length} kiriman · patokan lumpur bagus ≤ ${GOOD_SILT_PERCENT}%, maks ${MAX_SILT_PERCENT}%</div>
    <h2>NILAI OVERALL SUPPLIER (KUALITAS ${SCORE_WEIGHTS.quality}% + KECEPATAN ${SCORE_WEIGHTS.speed}% + HARGA ${SCORE_WEIGHTS.price}%)</h2><table><thead><tr><th>PERINGKAT</th><th>SUPPLIER / QUARRY</th><th>NILAI</th><th>GRADE</th><th>KUALITAS</th><th>KECEPATAN</th><th>HARGA</th><th>STATUS</th></tr></thead><tbody>${overallRows || `<tr><td colspan="8" class="c">Belum ada penilaian</td></tr>`}</tbody></table>
    ${groupTable("REKAP PER BAHAN BAKU", materials)}${tags.length > 1 ? groupTable("REKAP PER TAG", tags) : ""}
    <h2>TIER LIST KUALITAS SUPPLIER / QUARRY (PENILAIAN QC)</h2><table><thead><tr><th style="width:22%">TIER</th><th>SUPPLIER / QUARRY</th></tr></thead><tbody>${tierRows}</tbody></table>
    <h2>RINGKASAN PER SUPPLIER / QUARRY</h2><table><thead><tr><th>NO</th><th>SUPPLIER / QUARRY</th><th>TIER</th><th>RIT</th><th>JUMLAH</th><th>LUMPUR RATA²</th><th>BAGUS ≤${GOOD_SILT_PERCENT}%</th><th>&gt;${MAX_SILT_PERCENT}%</th><th>KECEPATAN</th><th>HARGA</th><th>KETERANGAN QC</th></tr></thead><tbody>${sourceRows}</tbody></table>
    <h2>RINGKASAN VENDOR PENGIRIMAN (PENILAIAN KANTOR)</h2><table><thead><tr><th>NO</th><th>VENDOR</th><th>JENIS</th><th>RIT</th><th>KECEPATAN RATA²</th><th>LAMBAT</th><th>KETERANGAN PENGIRIMAN</th></tr></thead><tbody>${vendorRows}</tbody></table>`;
  printHtml("Ringkasan bahan baku", body);
}

/* ------------------------------------------------------------------ Excel */

/** Satu sheet dari daftar objek: judul kolom = kunci objek pertama. Kosong → dilewati. */
function sheetOf(name: string, title: string, rows: Record<string, unknown>[]): SheetData | null {
  if (!rows.length) return null;
  return { name, title, columns: Object.keys(rows[0]).map((key) => ({ key, header: key })), rows };
}

export async function exportSupplierExcel({ rows, materials, tags, sources, vendors }: Summaries, from: string, to: string) {
  const origin = window.location.origin;
  const units = [...new Set(rows.map((row) => row.unit))];
  const unitColumns = (items: SupplierRow[]) =>
    Object.fromEntries(units.map((unit) => [`Jumlah (${unit})`, items.filter((row) => row.unit === unit).reduce((sum, row) => sum + (row.quantity ?? 0), 0) || ""]));
  const groupRows = (groups: GroupSummary[]) =>
    groups.map((g, i) => ({
      No: i + 1, Nama: g.label, Rit: g.count, ...unitColumns(g.rows), "Tanpa jumlah": g.missingQuantity, "Lumpur rata-rata (%)": round(g.avgSilt), Tier: g.tier ?? "",
      "Keterangan tier": g.tier ? TIER_LABELS[g.tier] : "", "Terakhir datang": g.last, "Supplier / quarry": g.sources.join(", "),
    }));
  const days = [...groupBy(rows, (row) => wibDay(row.receivedAt)).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const notes = (list: { label: string; notes: Note[] }[]) =>
    list.flatMap((item) => item.notes.map((note) => ({ Tanggal: note.at, Nama: item.label, Kiriman: note.source, Keterangan: note.text, "Dinilai oleh": note.by ?? "" })));
  const curve = curveData(rows, sources, () => 0);

  const sheets = [
    sheetOf(
      "Nilai overall",
      `Nilai overall supplier (kualitas ${SCORE_WEIGHTS.quality}% + kecepatan ${SCORE_WEIGHTS.speed}% + harga ${SCORE_WEIGHTS.price}%, skala 0-100)`,
      ranked(sources).map((s, i) => ({
        Peringkat: i + 1, "Supplier / quarry": s.label, "Nilai overall": s.overall, Grade: gradeOf(s.overall)!.grade, "Keterangan grade": gradeOf(s.overall)!.label,
        "Nilai kualitas": round(s.parts.quality, 0), "Nilai kecepatan": round(s.parts.speed, 0), "Nilai harga": round(s.parts.price, 0), "Tier (QC)": s.tier ?? "",
        Kecepatan: levelText(s.speedAvg, SPEED_LABELS), Harga: levelText(s.priceAvg, PRICE_LABELS), "Kiriman dinilai": s.scored, Status: s.complete ? "Lengkap" : "Sementara",
      })),
    ),
    sheetOf(
      "Kurva per bulan",
      "Kurva nilai overall per bulan",
      curve.months.length > 1 ? curve.months.map((month, index) => ({ Bulan: monthName(month), ...Object.fromEntries(curve.series.map((item) => [item.label, item.values[index] ?? ""])) })) : [],
    ),
    sheetOf("Per bahan baku", "Rekap per bahan baku", groupRows(materials)),
    sheetOf("Per tag", "Rekap per tag", tags.length > 1 ? groupRows(tags) : []),
    sheetOf(
      "Tier supplier",
      "Tier per supplier / quarry (QC)",
      sources.map((s, i) => ({
        Peringkat: i + 1, "Supplier / quarry": s.label, "Bahan baku": s.materials.join(", "), Tier: s.tier ?? "", "Keterangan tier": s.tier ? TIER_LABELS[s.tier] : "Belum dinilai", Rit: s.count, ...unitColumns(s.rows),
        Diuji: s.tested, "Lumpur rata-rata (%)": round(s.avgSilt), "Lumpur min (%)": s.minSilt ?? "", "Lumpur maks (%)": s.maxSilt ?? "", [`Bagus ≤${GOOD_SILT_PERCENT}%`]: s.good, [`Lewat >${MAX_SILT_PERCENT}%`]: s.overLimit,
        Ditolak: s.rejected, "Tier 1": s.tiers[1], "Tier 2": s.tiers[2], "Tier 3": s.tiers[3], "Tier 4": s.tiers[4], "Belum dinilai QC": s.unrated, Kecepatan: levelText(s.speedAvg, SPEED_LABELS),
        Harga: levelText(s.priceAvg, PRICE_LABELS), "Nilai overall": s.overall ?? "", "Via armada quarry": s.viaQuarry, "Via ekspedisi": s.viaExpedition, "Keterangan terbaru": s.notes[0]?.text ?? "",
      })),
    ),
    sheetOf(
      "Vendor pengiriman",
      "Vendor pengiriman (kantor)",
      vendors.map((v, i) => ({
        No: i + 1, Vendor: v.name, Jenis: v.mode ? DELIVERY_MODE_LABELS[v.mode] : "Belum diisi", Rit: v.count, "Kecepatan rata-rata": levelText(v.speedAvg, SPEED_LABELS), Dinilai: v.speedCount, Lambat: v.late,
        "Bahan yang diangkut": v.sources.join(", "), "Keterangan terbaru": v.notes[0]?.text ?? "",
      })),
    ),
    sheetOf("Ket. supplier", "Keterangan material / supplier (QC)", notes(sources)),
    sheetOf("Ket. pengiriman", "Keterangan pengiriman (kantor)", notes(vendors.map((v) => ({ label: v.name, notes: v.notes })))),
    sheetOf(
      "Inventory harian",
      "Inventory harian",
      days.map(([day, items]) => ({
        Tanggal: new Date(`${day}T00:00:00+07:00`), Rit: items.length, Jumlah: qty(items),
        ...Object.fromEntries(materials.map((m) => [m.label, qty(items.filter((row) => materialKey(row) === m.key)).replace(/^-$/, "")])),
      })),
    ),
    sheetOf(
      "Detail kiriman",
      "Detail kiriman",
      rows.map((row, i) => {
        const score = overallScore(partsOf([row]));
        const level = levelOf(row);
        return {
          No: i + 1, Tanggal: new Date(row.receivedAt), "Bahan baku": row.itemName, Tag: row.tag ?? "", Supplier: row.supplier ?? "", Quarry: row.quarry ?? "", "Plat truk": row.vehiclePlate ?? "",
          Jumlah: row.quantity ?? "", Satuan: row.unit, Status: row.status === "ditolak" ? "Ditolak" : "Diterima", "Kadar lumpur (%)": row.siltPercent ?? "",
          "Hasil uji": level ? SILT_LEVEL_LABELS[level] : row.test?.status === "draft" ? "Mengendap" : "Belum diuji", Keputusan: row.test?.decision ? DECISION_LABELS[row.test.decision] : "", Brangkal: row.hasBrangkal ? "Banyak" : "",
          Tier: row.tier ?? "", "Keterangan tier": row.tier ? TIER_LABELS[row.tier] : "", "Status tier": row.tierConfirmed ? "Dinilai QC" : row.tier ? "Saran sistem" : "Belum", "Keterangan QC": row.qualityNote ?? "",
          "Dinilai QC oleh": row.qualityByName ?? "", "Dikirim oleh": row.deliveryMode ? DELIVERY_MODE_LABELS[row.deliveryMode] : "", Ekspedisi: row.expeditionName ?? "",
          Kecepatan: row.speedRating ? SPEED_LABELS[row.speedRating] : "", "Keterangan pengiriman": row.deliveryNote ?? "", "Dinilai kantor oleh": row.deliveryByName ?? "",
          Harga: row.priceRating ? PRICE_LABELS[row.priceRating] : "", "Keterangan harga": row.priceNote ?? "", "Dinilai harga oleh": row.priceByName ?? "",
          "Nilai overall": score.overall ?? "", Grade: score.overall === null ? "" : gradeOf(score.overall)!.grade, "Dicatat oleh": row.createdByName ?? "",
          Foto: row.photoKeys.map((key) => `${origin}${berkasUrl(key)}`).join(" "),
        };
      }),
    ),
  ].filter((sheet): sheet is SheetData => sheet !== null);

  await downloadWorkbook(`Bahan-Baku_${from}_sd_${to}.xlsx`, sheets);
}
