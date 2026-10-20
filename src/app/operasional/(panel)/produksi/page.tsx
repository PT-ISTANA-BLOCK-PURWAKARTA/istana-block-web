import Link from "next/link";
import { Kpis, Ok, PageHead, RangeForm, Rp } from "@/components/erp/ui";
import { ProductionExcel } from "@/components/ops/production/ProductionExcel";
import { categoryLabel, hasilText, summarizeIssues, summarizeProducts, sum, totalQty } from "@/components/ops/production/summary";
import { Select } from "@/components/ui";
import { getDb } from "@/db";
import { addDays, formatQty, isDate, tgl, today } from "@/lib/erp/util";
import { listProductions, productionAccess, productionValues } from "@/lib/ops/production";
import "./produksi.css";

export const metadata = { title: "Hasil produksi" };

export default async function Produksi({ searchParams }: { searchParams: Promise<{ ok?: string; from?: string; to?: string; kategori?: string }> }) {
  const acc = await productionAccess();
  const sp = await searchParams;
  const t = today();
  const fieldOnly = !acc.hasStok && !acc.canFinance;
  let from = isDate(sp.from) ? sp.from : fieldOnly ? addDays(t, -6) : `${t.slice(0, 8)}01`;
  let to = isDate(sp.to) ? sp.to : t;
  if (from > to) [from, to] = [to, from];
  const category = sp.kategori === "precast" || sp.kategori === "paving" ? sp.kategori : null;

  const db = await getDb();
  const [rows, values] = await Promise.all([
    listProductions(db, acc, { from, to, category }),
    acc.canFinance ? productionValues(db, { from, to }) : Promise.resolve(new Map<string, number>()),
  ]);
  const products = summarizeProducts(rows);
  const issues = summarizeIssues(rows);
  const issueDays = new Set(rows.filter((r) => r.issues.length).map((r) => r.date)).size;
  const href = (f: string, to2: string) => `/operasional/produksi?from=${f}&to=${to2}${category ? `&kategori=${category}` : ""}`;
  const presets = [
    ["7 hari", addDays(t, -6), t],
    ["Bulan ini", `${t.slice(0, 8)}01`, t],
    ["Tahun ini", `${t.slice(0, 4)}-01-01`, t],
  ] as const;
  const pct = (r: (typeof rows)[number]) => (r.target ? ` · ${Math.round((totalQty(r) / r.target) * 100)}% target` : "");

  return (
    <>
      <PageHead title="Hasil produksi" sub="Barang jadi masuk gudang; bahan baku yang terpakai keluar. Mandor mencatat precast, QC mencatat paving.">
        <ProductionExcel rows={rows} from={from} to={to} />
        {acc.canEdit && <Link href="/operasional/produksi/baru" className="btn btn-primary btn-sm">+ Hasil produksi</Link>}
      </PageHead>
      <Ok ok={sp.ok} />

      <nav className="prd-seg seg" aria-label="Rentang cepat">
        {presets.map(([label, f, tt]) => (
          <Link key={label} href={href(f, tt)} aria-current={from === f && to === tt ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <RangeForm
        from={from}
        to={to}
        extra={
          <div className="field">
            <label htmlFor="f-kat">Kategori</label>
            <Select id="f-kat" name="kategori" defaultValue={category ?? ""} options={[{ value: "", label: "Semua" }, { value: "precast", label: "Precast" }, { value: "paving", label: "Paving" }]} />
          </div>
        }
      />

      <Kpis
        items={[
          { label: "Catatan produksi", value: rows.length },
          { label: "Papan", value: formatQty(sum(rows.map((r) => r.boards))) || "0" },
          { label: "Reject", value: formatQty(sum(rows.map((r) => r.rejects))) || "0" },
          { label: "Hari ada kendala", value: issueDays, tone: issueDays ? "warn" : undefined },
        ]}
      />

      {products.length > 0 && (
        <div className="admin-table prd-rekap">
          <table>
            <caption>Rekap per produk</caption>
            <thead><tr><th>Kategori</th><th>Produk</th><th className="num">Hari</th><th className="num">Jumlah jadi</th><th className="num">Papan</th><th className="num">Reject</th><th className="num">Hari kendala</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.key}>
                  <td className="small muted">{categoryLabel(p.category)}</td>
                  <td><b>{p.name}</b></td>
                  <td className="num">{p.days.size}</td>
                  <td className="num"><b>{formatQty(p.qty)}</b> {p.unit}</td>
                  <td className="num">{p.boards ? formatQty(p.boards) : "-"}</td>
                  <td className="num">{p.rejects ? formatQty(p.rejects) : "-"}</td>
                  <td className="num">{p.issueDays.size || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {issues.length > 0 && (
        <div className="admin-table prd-rekap">
          <table>
            <caption>Rekap kendala produksi</caption>
            <thead><tr><th>Kendala</th><th className="num">Kali</th><th className="num">Hari</th><th>Produk</th><th>Terakhir</th></tr></thead>
            <tbody>
              {issues.map((x) => (
                <tr key={x.issue}>
                  <td><b>{x.issue}</b></td>
                  <td className="num">{x.count}</td>
                  <td className="num">{x.days}</td>
                  <td className="small">{x.products.join(", ")}</td>
                  <td className="small">{tgl(x.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-table prd-table">
        <table>
          <caption>Catatan produksi</caption>
          <thead>
            <tr>
              <th>Nomor</th><th>Tanggal</th><th>Hasil</th><th>Ketua regu</th><th className="num">Papan</th><th className="num">Reject</th><th>Kendala</th><th>Pencatat</th>
              {acc.canFinance && <th className="num">Nilai</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/operasional/produksi/${r.id}`}><b>{r.number}</b></Link>
                  <div className="prd-code">{categoryLabel(r.category)}{r.batchCode ? ` · ${r.batchCode}` : ""}</div>
                </td>
                <td>{tgl(r.date)}</td>
                <td className="small">{hasilText(r, formatQty)}<span className="muted">{pct(r)}</span></td>
                <td className="small">{r.leader ?? "-"}</td>
                <td className="num">{r.boards != null ? formatQty(r.boards) : "-"}</td>
                <td className="num">{r.rejects != null ? formatQty(r.rejects) : "-"}</td>
                <td>{r.issues.length ? <div className="prd-issues">{r.issues.map((i) => <span key={i} className="prd-issue-chip">{i}</span>)}</div> : <span className="muted">-</span>}</td>
                <td className="small muted">{r.createdByName ?? "-"}</td>
                {acc.canFinance && <td className="num"><Rp n={values.get(r.id) ?? 0} /></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={acc.canFinance ? 9 : 8} className="muted" style={{ padding: 24 }}>Belum ada catatan produksi pada periode ini.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="prd-cards">
        {rows.map((r) => (
          <Link key={r.id} href={`/operasional/produksi/${r.id}`} className="prd-card">
            <div className="prd-card-top">
              <b>{tgl(r.date)}</b>
              <span className="prd-card-qty">{formatQty(totalQty(r))}</span>
            </div>
            <p className="small">{hasilText(r, formatQty)}</p>
            <div className="prd-card-meta">
              <span>{categoryLabel(r.category)}{r.batchCode ? ` · ${r.batchCode}` : ""}</span>
              {r.leader && <span>Ketua regu {r.leader}</span>}
              {r.boards != null && <span>Papan {formatQty(r.boards)}</span>}
              {r.rejects != null && <span>Reject {formatQty(r.rejects)}</span>}
              {acc.canFinance && <span><Rp n={values.get(r.id) ?? 0} /></span>}
            </div>
            {r.issues.length > 0 && <div className="prd-issues">{r.issues.map((i) => <span key={i} className="prd-issue-chip">{i}</span>)}</div>}
          </Link>
        ))}
        {rows.length === 0 && <p className="muted" style={{ padding: 16 }}>Belum ada catatan produksi pada periode ini.</p>}
      </div>
    </>
  );
}
