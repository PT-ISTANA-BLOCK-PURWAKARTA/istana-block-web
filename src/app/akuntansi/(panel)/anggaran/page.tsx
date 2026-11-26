// Anggaran (Zahir: Buku Besar → Anggaran): isian per rekening per bulan untuk laba rugi atau neraca.
import Link from "next/link";
import { BudgetGrid } from "@/components/erp/BudgetGrid";
import { PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { BS_GROUPS, MONTHS_ID, PL_GROUPS, actualByMonth, loadBudgets, periodsOfYear } from "@/lib/erp/budget";
import { loadAccounts } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Anggaran" };
export const dynamic = "force-dynamic";

export default async function Anggaran({ searchParams }: { searchParams: Promise<{ tahun?: string; jenis?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const year = Number(sp.tahun) >= 2020 && Number(sp.tahun) <= 2100 ? Number(sp.tahun) : Number(today().slice(0, 4));
  const kind = sp.jenis === "neraca" ? "neraca" : "lr";
  const db = await getDb();
  const acc = await loadAccounts(db);
  const groups = kind === "lr" ? PL_GROUPS : BS_GROUPS;
  const accounts = acc.rows.filter((a) => groups.includes(a.group) && a.active).sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || a.code.localeCompare(b.code));
  const periods = periodsOfYear(year);
  const prev = periodsOfYear(year - 1);
  const [budgets, actual, prevActual] = await Promise.all([loadBudgets(db, periods[0], periods[11]), actualByMonth(db, acc.rows, kind, periods), actualByMonth(db, acc.rows, kind, prev)]);
  // Pembanding: realisasi tahun lalu; bila kosong (data mulai Juni 2026), rata-rata realisasi tahun ini yang sudah berjalan.
  const hasPrev = [...prevActual.values()].some((m) => [...m.values()].some((v) => v));
  const now = today().slice(0, 7);
  const rows = accounts.map((a) => {
    const act = periods.map((p) => actual.get(a.id)?.get(p) ?? 0);
    const done = periods.filter((p) => p < now && (actual.get(a.id)?.has(p) ?? false));
    const avg = done.length ? done.reduce((s, p) => s + (actual.get(a.id)?.get(p) ?? 0), 0) / done.length : 0;
    const ref = hasPrev ? prev.map((p) => prevActual.get(a.id)?.get(p) ?? 0) : periods.map(() => Math.round(avg));
    return { id: a.id, code: a.code, name: a.name, section: GROUP_LABEL[a.group], budget: periods.map((p) => budgets.get(a.id)?.get(p) ?? null), ref, actual: act };
  });
  const tab = (k: string, label: string) => <Link href={`/akuntansi/anggaran?tahun=${year}&jenis=${k}`} aria-current={k === kind ? "page" : undefined}>{label}</Link>;
  return (
    <>
      <PageHead title={`Anggaran ${year}`} sub="Target per rekening per bulan. Laba rugi = target mutasi bulan itu; neraca = target saldo akhir bulan. Bandingkan di laporan Anggaran vs Realisasi.">
        <Link href={`/akuntansi/anggaran?tahun=${year - 1}&jenis=${kind}`} className="btn btn-ghost btn-sm">‹ {year - 1}</Link>
        <Link href={`/akuntansi/anggaran?tahun=${year + 1}&jenis=${kind}`} className="btn btn-ghost btn-sm">{year + 1} ›</Link>
        <Link href={`/akuntansi/laporan/anggaran?jenis=${kind}&dari=${year}-01&sampai=${year}-12`} className="btn btn-blue btn-sm">Anggaran vs Realisasi</Link>
      </PageHead>
      <nav className="zt-tabs">{tab("lr", "Laba Rugi")}{tab("neraca", "Neraca")}</nav>
      <BudgetGrid
        key={`${year}-${kind}`}
        rows={rows}
        periods={periods}
        months={MONTHS_ID}
        refLabel={hasPrev ? `realisasi ${year - 1}` : "rata-rata realisasi"}
        refHint={hasPrev ? `Pembanding: realisasi ${year - 1} pada bulan yang sama.` : `Belum ada realisasi ${year - 1}, jadi pembandingnya rata-rata realisasi bulanan ${year} yang sudah berjalan.`}
      />
    </>
  );
}
