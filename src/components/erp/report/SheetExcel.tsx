"use client";

// Tombol "Unduh Excel" otomatis di setiap lembar laporan: mengambil semua tabel di lembar ini (baris detail apa adanya),
// angka format Indonesia (1.234.567 / (12.500) / -75.000) diubah menjadi angka Excel sungguhan.
import { useRef, useState } from "react";
import { downloadWorkbook, type SheetData } from "@/lib/ops/excel";

const num = (s: string): string | number => {
  const t = s.replace(/\s+/g, " ").trim();
  if (!/^\(?-?[\d.]+(,\d+)?\)?%?$/.test(t) || !/\d/.test(t)) return t;
  if (t.endsWith("%")) return t;
  const neg = t.startsWith("(") || t.startsWith("-");
  const v = Number(t.replace(/[()\-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? (neg ? -v : v) : t;
};
const cellText = (c: Element) => (c as HTMLElement).innerText.replace(/\n+/g, " · ").trim();

export function SheetExcel({ title, period }: { title: string; period: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <button
      ref={ref}
      type="button"
      className="btn btn-ghost btn-sm no-print sheet-excel"
      disabled={busy}
      onClick={async () => {
        const sheetEl = ref.current?.closest(".report-sheet");
        const tables = [...(sheetEl?.querySelectorAll("table") ?? [])];
        if (!tables.length) return;
        setBusy(true);
        try {
          const sheets: SheetData[] = tables.map((t, ti) => {
            const headRow = t.querySelector("thead tr:last-child");
            const heads = headRow ? [...headRow.children].map(cellText) : [];
            const bodyRows = [...t.querySelectorAll("tbody tr, tfoot tr")].map((tr) => {
              const out: string[] = [];
              for (const c of tr.children) {
                out.push(cellText(c));
                const span = Number((c as HTMLTableCellElement).colSpan || 1);
                for (let k = 1; k < span; k++) out.push("");
              }
              return out;
            });
            const width = Math.max(heads.length, ...bodyRows.map((r) => r.length));
            const columns = Array.from({ length: width }, (_, i) => ({ key: `c${i}`, header: heads[i] || " ", width: i === 0 ? 14 : i < 3 ? 34 : 16 }));
            const rows = bodyRows.map((r) => Object.fromEntries(r.map((v, i) => [`c${i}`, num(v)])));
            const cap = t.closest("section")?.querySelector("h2,h3")?.textContent?.trim();
            return { name: (cap || (tables.length > 1 ? `Tabel ${ti + 1}` : "Laporan")).replace(/[\\/?*[\]:]/g, " ").slice(0, 31), title: `PT. ISTANA BLOCK PURWAKARTA · ${title} · ${period}`, columns, rows };
          });
          const seen = new Map<string, number>();
          for (const s of sheets) { const n = seen.get(s.name) ?? 0; seen.set(s.name, n + 1); if (n) s.name = `${s.name.slice(0, 28)} ${n + 1}`; }
          await downloadWorkbook(`${title.replace(/[^\w\- ]+/g, " ").replace(/\s+/g, " ").trim()} ${period.replace(/^Periode\s*/i, "")}.xlsx`, sheets);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Menyiapkan…" : "Unduh Excel"}
    </button>
  );
}
