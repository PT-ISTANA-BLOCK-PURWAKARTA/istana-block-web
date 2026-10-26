import Link from "next/link";
import { Kpis, Ok, PageHead } from "@/components/erp/ui";
import { LeadWorkspace } from "@/components/ops/customers/LeadWorkspace";
import { DateField } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { addDays, isDate, monthStart, today as todayWib, yearStart } from "@/lib/erp/util";
import {
  isChip, LEAD_CHIPS, loadLeads, matchChip, matchQuery, oneDecimal, REASON_META, summarizeLeads, type LeadChip,
} from "@/lib/ops/customer-leads";
import "./rekap-pelanggan.css";

export const metadata = { title: "Rekap Pelanggan" };

type SP = { dari?: string; sampai?: string; status?: string; q?: string; ok?: string };

const MAX_ROWS = 500;
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

function url(from: string, to: string, chip: LeadChip, q: string) {
  const p = new URLSearchParams({ dari: from, sampai: to });
  if (chip !== "semua") p.set("status", chip);
  if (q) p.set("q", q);
  return `/operasional/rekap-pelanggan?${p.toString()}`;
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePerm("rekap_pelanggan");
  const sp = await searchParams;
  const now = todayWib();
  const from = isDate(sp.dari) ? sp.dari : yearStart(now);
  const to = isDate(sp.sampai) ? sp.sampai : now;
  const chip: LeadChip = isChip(sp.status) ? sp.status : "semua";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const bad = from > to;

  const all = bad ? [] : await loadLeads(from, to);
  const s = summarizeLeads(all);
  const filtered = all.filter((r) => matchChip(r, chip) && matchQuery(r, q));
  const shown = filtered.slice().reverse().slice(0, MAX_ROWS); // terbaru di atas

  const prevMonthEnd = addDays(monthStart(now), -1);
  const presets = [
    { label: "Bulan ini", from: monthStart(now), to: now },
    { label: "Bulan lalu", from: monthStart(prevMonthEnd), to: prevMonthEnd },
    { label: "Tahun ini", from: yearStart(now), to: now },
    { label: "Semua", from: "2020-01-01", to: now },
  ];

  const stars = Math.round(((s.avg.service ?? 0) + (s.avg.quality ?? 0) + (s.avg.speed ?? 0)) / ([s.avg.service, s.avg.quality, s.avg.speed].filter((x) => x !== null).length || 1));
  const hasAvg = s.avg.service !== null || s.avg.quality !== null || s.avg.speed !== null;

  const satisfiedSub = s.rated
    ? `${s.satisfied} dari ${s.rated} dinilai${s.avgScore !== null ? ` · bintang rata² ${s.avgScore}/100` : ""}${s.complaints ? ` · ${s.complaints} komplain (${s.ungetback} belum di-get back)` : ""}`
    : `${s.membeli} pembeli belum dinilai`;

  return (
    <>
      <PageHead
        title="Konsumen & penilaian pembeli"
        sub="Konsumen dari iklan Google Ads dan sumber lain: siapa yang membeli, nilai penjualannya, alasan yang tidak membeli, dan penilaian pembeli untuk layanan, kualitas, dan kecepatan (1–5 bintang). Kepuasan pembeli otomatis masuk Sasaran Mutu no. 16."
      />
      <Ok ok={sp.ok} />

      <form className="filter-bar" method="get">
        <div className="field"><label htmlFor="rp-dari">Dari tanggal</label><DateField id="rp-dari" name="dari" defaultValue={from} required /></div>
        <div className="field"><label htmlFor="rp-sampai">Sampai tanggal</label><DateField id="rp-sampai" name="sampai" defaultValue={to} required /></div>
        <div className="field grow">
          <label htmlFor="rp-q">Cari</label>
          <input id="rp-q" name="q" defaultValue={q} placeholder="Cari nama, WA, produk..." maxLength={100} />
        </div>
        {chip !== "semua" && <input type="hidden" name="status" value={chip} />}
        <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        <div className="presets">
          {presets.map((p) => (
            <Link key={p.label} href={url(p.from, p.to, chip, q)} aria-current={p.from === from && p.to === to ? "page" : undefined}>{p.label}</Link>
          ))}
        </div>
      </form>
      {bad && <p className="alert alert-warn" role="status" style={{ marginBottom: 16 }}>Tanggal “Dari” harus sebelum atau sama dengan “Sampai”.</p>}

      <Kpis
        items={[
          { label: "Konsumen", value: s.total, sub: "bertanya / dihubungi" },
          { label: "Membeli", value: s.membeli, sub: s.closingPct === null ? "-" : `closing ${s.closingPct}%`, tone: "ok" },
          { label: "Nilai penjualan", value: s.saleValue ? rp(s.saleValue) : "-", sub: "dari konsumen yang membeli" },
          { label: "Follow up", value: s.followUp, sub: "perlu dihubungi lagi", tone: s.followUp ? "warn" : undefined },
          { label: "Pembeli puas", value: s.satisfiedPct === null ? "-" : `${s.satisfiedPct}%`, sub: satisfiedSub, tone: s.ungetback ? "bad" : undefined },
        ]}
      />

      <div className="rp-cards">
        <div className="admin-card">
          <h2 className="rp-h">Alasan tidak membeli</h2>
          <div className="rp-pills">
            {REASON_META.map((m) => (
              <span key={m.code} className="rp-pill" title={m.hint}><b>{s.reasons[m.code]}</b> {m.label}</span>
            ))}
          </div>
        </div>
        <div className="admin-card">
          <h2 className="rp-h">Rata-rata penilaian pembeli (1–5)</h2>
          {hasAvg ? (
            <div className="rp-avg">
              <span className="stars" aria-hidden="true">{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span>
              <span>Layanan <b>{oneDecimal(s.avg.service)}</b></span>
              <span>Kualitas <b>{oneDecimal(s.avg.quality)}</b></span>
              <span>Kecepatan <b>{oneDecimal(s.avg.speed)}</b></span>
            </div>
          ) : (
            <p className="muted small">Belum ada pembeli yang dinilai.</p>
          )}
        </div>
      </div>

      <nav className="seg rp-chips" aria-label="Filter status">
        {LEAD_CHIPS.map((c) => (
          <Link key={c.key} href={url(from, to, c.key, q)} aria-current={c.key === chip ? "page" : undefined}>{c.label}</Link>
        ))}
      </nav>

      <LeadWorkspace rows={shown} totalFiltered={filtered.length} maxRows={MAX_ROWS} exportArgs={{ from, to, chip, q }} today={now} />
    </>
  );
}
