import Link from "next/link";
import { Ok, PageHead } from "@/components/erp/ui";
import { SpecsExcel } from "@/components/ops/specs/SpecsExcel";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { formatQty } from "@/lib/erp/util";
import { listSpecs } from "@/lib/ops/production";
import { LINE_LABEL, METHOD_LABEL, SPEC_LINES } from "@/lib/ops/production-lines";
import type { ProductionMethod } from "@/db/erp";
import "../produksi/produksi.css";

export const metadata = { title: "Spesifikasi produk" };

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requirePerm("spesifikasi_produk");
  const { ok } = await searchParams;
  const db = await getDb();
  const all = await listSpecs(db);
  const variantLabel = (v: string | null) => (v ? (METHOD_LABEL[v as ProductionMethod] ?? v) : "");
  const exportRows = SPEC_LINES.flatMap((l) =>
    all.filter(({ s }) => s.line === l).map(({ s, itemName }) => ({ line: LINE_LABEL[l], name: s.name, variant: variantLabel(s.variant), weightKg: s.weightKg, specs: Object.entries(s.specs ?? {}).map(([k, v]) => `${k}: ${v}`).join("; "), notes: s.notes, active: s.active, item: itemName ?? "" })),
  );
  return (
    <>
      <PageHead title="Spesifikasi produk" sub="Berat dan spesifikasi tiap ukuran. Pilihan ini jadi acuan saat mandor / QC menginput hasil produksi, beserta perkiraan berat total.">
        <SpecsExcel rows={exportRows} />
        <Link href="/operasional/cetak/spesifikasi-produk" className="btn btn-ghost btn-sm">Cetak</Link>
        <Link href="/operasional/spesifikasi-produk/baru" className="btn btn-primary btn-sm">+ Spesifikasi</Link>
      </PageHead>
      <Ok ok={ok} />
      {SPEC_LINES.map((l) => {
        const rows = all.filter(({ s }) => s.line === l);
        return (
          <div className="admin-table prd-rekap" key={l}>
            <table>
              <caption>{LINE_LABEL[l]} ({rows.length})</caption>
              <thead><tr><th>Ukuran / tipe</th><th>{l === "buis" ? "Metode" : "Varian"}</th><th className="num">Berat / buah</th><th>Spesifikasi</th><th>Barang di stok</th><th /></tr></thead>
              <tbody>
                {rows.map(({ s, itemName }) => (
                  <tr key={s.id} className={s.active ? undefined : "row-muted"}>
                    <td><b>{s.name}</b>{!s.active && <div className="small muted">nonaktif</div>}{s.notes && <div className="small muted">{s.notes}</div>}</td>
                    <td className="small">{variantLabel(s.variant) || "-"}</td>
                    <td className="num">{s.weightKg != null ? `${formatQty(s.weightKg)} kg` : "-"}</td>
                    <td className="small">{Object.entries(s.specs ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "-"}</td>
                    <td className="small">{itemName ?? "-"}</td>
                    <td><Link href={`/operasional/spesifikasi-produk/${s.id}`}>Ubah</Link></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="muted">Belum ada spesifikasi.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
