import Link from "next/link";
import { Ok, PageHead } from "@/components/erp/ui";
import { HarianTab } from "@/components/ops/qc/HarianTab";
import { weekRange } from "@/components/ops/qc/labels";
import { QcPendingBanner } from "@/components/ops/qc/QcPendingBanner";
import { RekapTab } from "@/components/ops/qc/RekapTab";
import { TemplateTab } from "@/components/ops/qc/TemplateTab";
import { UjiTekanTab } from "@/components/ops/qc/UjiTekanTab";
import "@/components/ops/qc/qc.css";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { addDays, daysBetween, isDate, monthStart, today, yearStart } from "@/lib/erp/util";
import { isPendingDesign, listMixDesigns, listMixLogs, listStrengthTests, qcCan, qcPending, qcRecap } from "@/lib/ops/qc";
import { eq } from "drizzle-orm";

export const metadata = { title: "QC" };

const TABS = [
  { key: "harian", label: "Mix desain harian" },
  { key: "uji-tekan", label: "Uji kuat tekan" },
  { key: "template", label: "Template" },
  { key: "rekap", label: "Rekap" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Rentang dari alamat (?from&to), dengan bawaan per tab dan batas ±3 tahun. */
function rangeOf(tab: TabKey, now: string, sp: { from?: string; to?: string }) {
  const def = tab === "harian" ? weekRange(now) : tab === "uji-tekan" ? { from: monthStart(now), to: now } : { from: yearStart(now), to: now };
  let from = isDate(sp.from) ? sp.from : def.from;
  let to = isDate(sp.to) ? sp.to : def.to;
  if (to < from) [from, to] = [to, from];
  if (daysBetween(from, to) > 1100) from = addDays(to, -1100);
  return { from, to };
}

export default async function QcPage({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string; ok?: string }> }) {
  const me = await requirePerm("qc", "setujui_qc", "ttd_pimpinan");
  const c = qcCan(me.roles);
  const sp = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "harian";
  const now = today();
  const { from, to } = rangeOf(tab, now, sp);
  const db = await getDb();
  const month = { from: monthStart(now), to: `${monthStart(now).slice(0, 7)}-31` };

  const [pending, designs, monthTests, user] = await Promise.all([
    qcPending(me, db),
    listMixDesigns(db),
    listStrengthTests(db, month.from, month.to),
    c.approve || c.sign ? db.query.users.findFirst({ where: eq(schema.users.id, me.id) }) : undefined,
  ]);

  // Data tab aktif.
  let body: React.ReactNode;
  if (tab === "harian") {
    const [logs, todayLogs] = await Promise.all([listMixLogs(db, from, to), c.input ? listMixLogs(db, now, now) : Promise.resolve([])]);
    const todayCounts: Record<string, number> = {};
    for (const l of todayLogs) todayCounts[l.layer] = (todayCounts[l.layer] ?? 0) + 1;
    body = <HarianTab me={me} from={from} to={to} now={now} logs={logs} designs={designs} todayCounts={todayCounts} />;
  } else if (tab === "uji-tekan") {
    body = <UjiTekanTab me={me} from={from} to={to} now={now} tests={await listStrengthTests(db, from, to)} />;
  } else if (tab === "template") {
    body = <TemplateTab me={me} designs={designs} />;
  } else {
    const [logs, tests] = await Promise.all([listMixLogs(db, from, to), listStrengthTests(db, from, to)]);
    body = <RekapTab recap={qcRecap(logs, tests, designs, { from, to })} from={from} to={to} now={now} />;
  }

  const monthCount = monthTests.length;
  const monthFailed = monthTests.flatMap((t) => t.samples).filter((s) => s.passed === false).length;
  const monthName = new Date(`${now}T00:00:00Z`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  const waitingDesigns = designs.filter(isPendingDesign).length;

  return (
    <>
      <PageHead title="QC & Produksi" sub="Pengimplementasian mix desain harian (badan & kepalaan), laporan hasil uji kuat tekan beton, dan template mix desain. Bisa dicetak sesuai format form dan diunduh ke Excel." />
      <Ok ok={sp.ok} />
      <QcPendingBanner pending={pending} needsSignature={Boolean((c.approve || c.sign) && user && !user.signatureKey)} />
      {monthCount ? (
        <p className="flag flag-info qc-note" style={{ background: "var(--ok-bg)", color: "var(--sukses)" }}>
          <span>Uji kuat tekan {monthName}: sudah {monthCount} laporan{monthFailed ? ` · ${monthFailed} benda uji belum memenuhi target` : ""}</span>
        </p>
      ) : (
        <p className="flag flag-warn qc-note">
          <span>Uji kuat tekan {monthName} <b>belum dilakukan</b> — jadwal uji sebulan sekali.</span>
        </p>
      )}
      <nav className="seg no-print" aria-label="Bagian QC" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`/operasional/qc?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined}>
            {t.label}
            {t.key === "template" && waitingDesigns ? ` (${waitingDesigns})` : ""}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}
