"use client";

import { useState } from "react";
import { downloadWorkbook, type SheetData } from "@/lib/ops/excel";
import { CATEGORY_LABEL, categoryLabel, round2, sum, summarizeIssues, summarizeProducts, type ProdRow } from "./summary";

const dateOf = (d: string) => new Date(`${d}T00:00:00`);
const unitLabel = (name: string, unit: string) => (unit ? `${name} (${unit})` : name);

/** Unduh rekap hasil produksi: per produk, per hari, kendala, dan detail (4 sheet). */
export function ProductionExcel({ rows, from, to }: { rows: ProdRow[]; from: string; to: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const products = summarizeProducts(rows);
      const issues = summarizeIssues(rows);
      const days = [...new Set(rows.map((r) => r.date))].sort();
      const colKey = (i: number) => `p${i}`;
      const sheets: SheetData[] = [
        {
          name: "Per produk",
          title: `REKAP HASIL PRODUKSI PER PRODUK ${from} s/d ${to}`,
          columns: [
            { key: "no", header: "No", width: 5 },
            { key: "category", header: "Kategori", width: 10 },
            { key: "product", header: "Produk", width: 34 },
            { key: "days", header: "Hari produksi", width: 14 },
            { key: "issueDays", header: "Hari ada kendala", width: 16 },
            { key: "qty", header: "Jumlah jadi", width: 14 },
            { key: "unit", header: "Satuan", width: 10 },
            { key: "boards", header: "Papan", width: 10 },
            { key: "rejects", header: "Reject", width: 10 },
          ],
          rows: products.map((p, i) => ({ no: i + 1, category: categoryLabel(p.category), product: p.name, days: p.days.size, issueDays: p.issueDays.size, qty: round2(p.qty), unit: p.unit, boards: p.boards || "", rejects: p.rejects || "" })),
        },
        {
          name: "Per hari",
          title: `REKAP HASIL PRODUKSI PER HARI ${from} s/d ${to}`,
          columns: [{ key: "date", header: "Tanggal", width: 12 }, ...products.map((p, i) => ({ key: colKey(i), header: `${unitLabel(p.name, p.unit)}${p.category ? ` · ${CATEGORY_LABEL[p.category]}` : ""}`, width: 18 }))],
          rows: days.map((d) => {
            const items = rows.filter((r) => r.date === d);
            const row: Record<string, unknown> = { date: dateOf(d) };
            products.forEach((p, i) => {
              const q = sum(items.filter((r) => r.category === p.category).flatMap((r) => r.hasil.filter((h) => h.itemId === p.itemId).map((h) => h.qty)));
              row[colKey(i)] = q ? round2(q) : "";
            });
            return row;
          }),
        },
        {
          name: "Kendala",
          title: `REKAP KENDALA PRODUKSI ${from} s/d ${to}`,
          columns: [
            { key: "no", header: "No", width: 5 },
            { key: "issue", header: "Kendala", width: 26 },
            { key: "count", header: "Kali tercatat", width: 14 },
            { key: "days", header: "Hari", width: 8 },
            { key: "products", header: "Produk", width: 40 },
            { key: "last", header: "Terakhir", width: 12 },
            { key: "note", header: "Keterangan terbaru", width: 50 },
          ],
          rows: issues.map((x, i) => ({ no: i + 1, issue: x.issue, count: x.count, days: x.days, products: x.products.join(", "), last: x.last ? dateOf(x.last) : "", note: x.note })),
        },
        {
          name: "Detail",
          title: `DETAIL HASIL PRODUKSI ${from} s/d ${to}`,
          columns: [
            { key: "no", header: "No", width: 5 },
            { key: "date", header: "Tanggal", width: 12 },
            { key: "number", header: "Nomor", width: 16 },
            { key: "category", header: "Kategori", width: 10 },
            { key: "batch", header: "Kode batch", width: 16 },
            { key: "leader", header: "Ketua regu", width: 18 },
            { key: "hasil", header: "Hasil", width: 44 },
            { key: "total", header: "Jumlah", width: 12 },
            { key: "target", header: "Target", width: 10 },
            { key: "boards", header: "Papan", width: 10 },
            { key: "rejects", header: "Reject", width: 10 },
            { key: "cement", header: "Semen (sak)", width: 12 },
            { key: "issues", header: "Kendala", width: 30 },
            { key: "note", header: "Catatan", width: 40 },
            { key: "pic", header: "Pencatat", width: 18 },
            { key: "photo", header: "Foto", width: 40 },
          ],
          rows: rows.map((r, i) => ({
            no: i + 1,
            date: dateOf(r.date),
            number: r.number,
            category: categoryLabel(r.category),
            batch: r.batchCode ?? "",
            leader: r.leader ?? "",
            hasil: r.hasil.map((h) => `${h.name} ${round2(h.qty)} ${h.unit}`.trim()).join("; "),
            total: round2(sum(r.hasil.map((h) => h.qty))),
            target: r.target ?? "",
            boards: r.boards ?? "",
            rejects: r.rejects ?? "",
            cement: r.cementBags ?? "",
            issues: r.issues.join(", "),
            note: r.note,
            pic: r.createdByName ?? "",
            photo: r.photoKey ? `${window.location.origin}/operasional/berkas/${r.photoKey}` : "",
          })),
        },
      ];
      await downloadWorkbook(`Hasil-Produksi_${from}_sd_${to}.xlsx`, sheets, { dateNF: "dd/mm/yyyy" });
    } catch {
      setErr("Gagal membuat berkas Excel. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-form" style={{ gap: 8 }}>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !rows.length} onClick={run}>{busy ? "Menyiapkan…" : "Unduh Excel"}</button>
      {err && <span className="small text-bahaya" role="alert">{err}</span>}
    </span>
  );
}
