import { PrintDoc } from "@/components/erp/PrintDoc";
import "@/components/ops/qc/qc.css";
import { getDb } from "@/db";
import type { ProductionMethod } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { formatQty } from "@/lib/erp/util";
import { listSpecs } from "@/lib/ops/production";
import { LINE_LABEL, METHOD_LABEL, SPEC_LINES } from "@/lib/ops/production-lines";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak spesifikasi produk", robots: { index: false } };

// Spesifikasi & Berat Produk, A4 landscape; hanya spesifikasi aktif, satu bagian per kategori.
export default async function CetakSpesifikasi() {
  await requirePerm("spesifikasi_produk");
  const db = await getDb();
  const [site, all] = await Promise.all([getSettings(), listSpecs(db)]);
  const rows = all.filter(({ s }) => s.active);
  const lines = SPEC_LINES.filter((l) => rows.some(({ s }) => s.line === l));
  const variantLabel = (v: string | null) => (v ? (METHOD_LABEL[v as ProductionMethod] ?? v) : "");
  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div className="qc-doc qc-landscape">
        <PrintDoc site={site} title="SPESIFIKASI & BERAT PRODUK" back="/operasional/spesifikasi-produk">
          {lines.length === 0 && <p>Belum ada spesifikasi aktif.</p>}
          {lines.map((l) => (
            <div key={l} style={{ marginBottom: 14, breakInside: "avoid" }}>
              <h3 style={{ margin: "8px 0 4px", fontSize: 14 }}>{LINE_LABEL[l].toUpperCase()}</h3>
              <table className="qc-grid">
                <thead><tr><th>NO</th><th>UKURAN / TIPE</th><th>{l === "buis" ? "METODE" : "VARIAN"}</th><th>BERAT / BUAH</th><th>SPESIFIKASI</th><th>CATATAN</th></tr></thead>
                <tbody>
                  {rows.filter(({ s }) => s.line === l).map(({ s }, i) => (
                    <tr key={s.id}>
                      <td className="c">{i + 1}</td>
                      <td>{s.name}</td>
                      <td>{variantLabel(s.variant)}</td>
                      <td className="r">{s.weightKg != null ? `${formatQty(s.weightKg)} kg` : ""}</td>
                      <td>{Object.entries(s.specs ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td>
                      <td>{s.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="qc-legend">Ukuran U-Ditch &amp; cover dalam centimeter. Dimensi dapat disesuaikan permintaan.</p>
        </PrintDoc>
      </div>
    </>
  );
}
