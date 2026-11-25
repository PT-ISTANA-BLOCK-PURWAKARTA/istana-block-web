import { PrintButton } from "@/components/erp/PrintButton";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import {
  buildWeeklyItemRecap,
  formatSlipQty,
  nextThursday,
  payPeriod,
  productionPay,
  REKAP_A5_STYLE,
  toDay,
} from "@/lib/ops/payslip";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak rekap barang gajian (A5)", robots: { index: false } };

const isDate = (v: string | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

const longDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function CetakRekapGaji({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; payday?: string }>;
}) {
  await requirePerm("keuangan");
  const sp = await searchParams;
  const today = toDay();
  const payday = isDate(sp.payday) ? sp.payday : isDate(sp.to) ? sp.to : nextThursday(today);
  const fallback = payPeriod("mingguan", payday);
  const from = isDate(sp.from) ? sp.from : fallback.from;
  const to = isDate(sp.to) ? sp.to : fallback.to;

  const db = await getDb();
  const [groups, site] = await Promise.all([productionPay(db, { from, to }), getSettings()]);
  const recap = buildWeeklyItemRecap(groups, { from, to, payday });
  const company = (site.legal_name || site.company_name || "ISTANA BLOCK PURWAKARTA").toUpperCase();
  const phones = [site.phone_office, site.phone || site.whatsapp].filter(Boolean).join(" · ");

  return (
    <div className="print-wrap">
      <style>{REKAP_A5_STYLE}</style>
      <div className="print-tools no-print" style={{ maxWidth: "148mm" }}>
        <a href="/akuntansi/gaji" className="btn btn-ghost btn-sm">
          ← Kembali ke Gaji
        </a>
        <PrintButton label="Cetak / Simpan PDF (A5)" />
      </div>

      <article className="rk-sheet">
        <header className="rk-head">
          <div className="rk-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-istana-block.webp" alt="" />
            <div>
              <b>{company}</b>
              {site.address && <span>{site.address}</span>}
              {phones && <span>Telp. {phones}</span>}
            </div>
          </div>
        </header>

        <h1 className="rk-title">REKAP BARANG GAJIAN PRODUKSI</h1>
        <p className="rk-meta">
          Gajian: <b>{longDate(payday)}</b>
          <br />
          Barang dihitung: <b>{longDate(from)}</b> s/d <b>{longDate(to)}</b>
        </p>

        {recap.groups.length === 0 ? (
          <p className="alert alert-warn">Belum ada hasil produksi atau cat genteng pada periode ini.</p>
        ) : (
          recap.groups.map((group) => (
            <table key={group.leader} className="rk-table">
              <thead>
                <tr>
                  <th colSpan={5}>{group.leader.toUpperCase()}</th>
                </tr>
                <tr>
                  <th style={{ width: 28 }} className="c">No</th>
                  <th>Barang</th>
                  <th style={{ width: 82 }} className="r">Jumlah</th>
                  <th style={{ width: 54 }} className="c">Satuan</th>
                  <th style={{ width: 46 }} className="c">Hari</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, idx) => (
                  <tr key={item.description}>
                    <td className="c">{idx + 1}</td>
                    <td>{item.description}</td>
                    <td className="r">
                      <b>{formatSlipQty(item.quantity)}</b>
                    </td>
                    <td className="c">{item.unit}</td>
                    <td className="c">{item.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))
        )}
      </article>
    </div>
  );
}
