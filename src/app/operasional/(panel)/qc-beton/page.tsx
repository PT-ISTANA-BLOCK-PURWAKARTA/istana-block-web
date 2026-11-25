import Link from "next/link";
import { eq } from "drizzle-orm";
import { Ok, PageHead } from "@/components/erp/ui";
import { BetonMixTab, DowntimeTab, PavingMixView } from "@/components/ops/qc/BetonTabs";
import { QcPendingBanner } from "@/components/ops/qc/QcPendingBanner";
import { UjiTekanTab } from "@/components/ops/qc/UjiTekanTab";
import "@/components/ops/qc/qc.css";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { addDays, daysBetween, isDate, monthStart, today } from "@/lib/erp/util";
import { listDowntimes } from "@/lib/ops/downtime";
import { listMixDesigns, listMixLogs, listStrengthTests, qcCan, qcPending } from "@/lib/ops/qc";
import { can } from "@/lib/roles";

export const metadata = { title: "QC Beton" };

const BASE = "/operasional/qc-beton";
const TABS = [
  { key: "uji", label: "Uji mutu beton" },
  { key: "mix", label: "Mix desain beton" },
  { key: "kendala", label: "Kendala (NCR)" },
  { key: "terbuang", label: "Waktu terbuang" },
  { key: "bahan", label: "Permintaan bahan & alat" },
  { key: "paving", label: "Pekerjaan Paving (lihat)" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Rentang dari alamat (?from&to), bawaan awal bulan s/d hari ini, batas ±3 tahun. */
function rangeOf(now: string, sp: { from?: string; to?: string }) {
  let from = isDate(sp.from) ? sp.from : monthStart(now);
  let to = isDate(sp.to) ? sp.to : now;
  if (to < from) [from, to] = [to, from];
  if (daysBetween(from, to) > 1100) from = addDays(to, -1100);
  return { from, to };
}

/** Form ISO (kendala / permintaan bahan) diisi di Rekap ISO, sama seperti form F-IB lain. */
function IsoFormCard({ code, title, sub, from, to }: { code: string; title: string; sub: string; from: string; to: string }) {
  const href = `/operasional/rekap-iso?dari=${from}&sampai=${to}&tab=form&form=${code}`;
  return (
    <div className="admin-card">
      <h3 style={{ marginTop: 0 }}>{title} ({code})</h3>
      <p className="muted">{sub}</p>
      <div className="qc-row-actions">
        <Link href={href} className="btn btn-primary btn-sm">Buka form {code}</Link>
        <Link href={`${href}&aksi=tambah`} className="btn btn-ghost btn-sm">+ Isi baru</Link>
      </div>
    </div>
  );
}

export default async function QcBetonPage({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string; ok?: string }> }) {
  const me = await requirePerm("qc_beton", "setujui_qc", "ttd_pimpinan");
  const c = qcCan(me.roles, "beton");
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "uji";
  const now = today();
  const { from, to } = rangeOf(now, sp);
  const db = await getDb();
  const [pending, user] = await Promise.all([
    qcPending(me, db),
    c.approve || c.sign ? db.query.users.findFirst({ where: eq(schema.users.id, me.id) }) : undefined,
  ]);

  let body: React.ReactNode;
  if (tab === "uji") {
    body = <UjiTekanTab me={me} from={from} to={to} now={now} tests={await listStrengthTests(db, from, to, "beton")} scope="beton" tab="uji" />;
  } else if (tab === "mix") {
    const [designs, logs] = await Promise.all([listMixDesigns(db, "beton"), listMixLogs(db, from, to, undefined, "beton")]);
    body = <BetonMixTab me={me} from={from} to={to} now={now} designs={designs} logs={logs} />;
  } else if (tab === "terbuang") {
    body = <DowntimeTab me={me} from={from} to={to} now={now} rows={await listDowntimes(db, from, to)} canWrite={can(me.roles, "qc_beton")} />;
  } else if (tab === "kendala") {
    body = <IsoFormCard code="F-IB-15" title="Kendala / ketidaksesuaian" sub="Laporan kendala, ketidaksesuaian (NCR), dan tindakan korektif produksi beton." from={from} to={to} />;
  } else if (tab === "bahan") {
    body = <IsoFormCard code="F-IB-10" title="Permintaan bahan & alat" sub="Permintaan bahan baku & alat (internal) dari bagian produksi beton." from={from} to={to} />;
  } else {
    const [tests, logs] = await Promise.all([listStrengthTests(db, from, to, "paving"), listMixLogs(db, from, to, undefined, "paving")]);
    body = (
      <>
        <p className="flag flag-info qc-note"><span>Pekerjaan Team Leader Paving — hanya untuk dilihat, tidak bisa diisi atau diubah dari halaman QC Beton.</span></p>
        <h3>Uji kuat tekan paving</h3>
        <UjiTekanTab me={me} from={from} to={to} now={now} tests={tests} scope="paving" readOnly tab="paving" rangeBase={BASE} />
        <h3 style={{ marginTop: 24 }}>Mix desain harian paving ({logs.length})</h3>
        <PavingMixView logs={logs} />
      </>
    );
  }

  return (
    <>
      <PageHead title="Uji mutu beton precast & genteng" sub="Laporan uji mutu beton (precast & genteng beton), mix desain beton, laporan kendala / ketidaksesuaian, waktu terbuang, dan permintaan bahan & alat. Pekerjaan Team Leader Paving bisa dilihat di tab terakhir.">
        <Link href="/operasional/stok" className="btn btn-ghost btn-sm">Input stok (Stok barang)</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      <QcPendingBanner pending={pending} needsSignature={Boolean((c.approve || c.sign) && user && !user.signatureKey)} />
      <nav className="seg no-print" aria-label="Bagian QC Beton" style={{ marginBottom: 16, overflowX: "auto" }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`${BASE}?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined}>{t.label}</Link>
        ))}
      </nav>
      {body}
    </>
  );
}
