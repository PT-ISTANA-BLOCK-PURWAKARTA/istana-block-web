import Link from "next/link";
import { formatAmount, today } from "@/lib/erp/util";

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="admin-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted" style={{ marginTop: 4 }}>{sub}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </div>
  );
}

export function Ok({ ok }: { ok?: string }) {
  if (!ok) return null;
  return (
    <p className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>
      {ok === "dihapus" ? "Data dihapus." : ok.startsWith("~") ? ok.slice(1) : `“${ok}” tersimpan.`}
    </p>
  );
}

export function Rp({ n, strong }: { n: number; strong?: boolean }) {
  const s = formatAmount(n);
  return <span className={`tabular${n < 0 ? " text-bahaya" : ""}`}>{strong ? <b>{s}</b> : s}</span>;
}

const TONE: Record<string, string> = {
  lunas: "badge-on",
  terkirim: "badge-on",
  selesai: "badge-on",
  dikonfirmasi: "badge-info",
  dijadwalkan: "badge-info",
  berangkat: "badge-warn",
  dikirim_sebagian: "badge-warn",
  sebagian: "badge-warn",
  "belum lunas": "badge-warn",
  "jatuh tempo": "badge-danger",
  batal: "badge-off",
  draft: "badge-off",
};
const LABEL: Record<string, string> = { dikirim_sebagian: "Dikirim sebagian", dikonfirmasi: "Dikonfirmasi", dijadwalkan: "Dijadwalkan", berangkat: "Dalam perjalanan", terkirim: "Terkirim", selesai: "Selesai", batal: "Batal", draft: "Draf" };

export function Status({ s }: { s: string }) {
  return <span className={`badge ${TONE[s] ?? "badge-off"}`}>{LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1)}</span>;
}

/** Status bayar faktur/tagihan. */
export function payStatus(d: { total: number; paid: number; dueDate: string }) {
  if (d.paid >= d.total) return "lunas";
  if (d.dueDate < today()) return "jatuh tempo";
  return d.paid > 0 ? "sebagian" : "belum lunas";
}

/** Form GET rentang tanggal (laporan & daftar). */
export function RangeForm({ from, to, extra, single }: { from?: string; to: string; extra?: React.ReactNode; single?: boolean }) {
  return (
    <form className="filter-bar" method="get">
      {!single && (
        <div className="field">
          <label htmlFor="f-from">Dari</label>
          <input id="f-from" name="from" type="date" defaultValue={from} />
        </div>
      )}
      <div className="field">
        <label htmlFor="f-to">{single ? "Per tanggal" : "Sampai"}</label>
        <input id="f-to" name="to" type="date" defaultValue={to} />
      </div>
      {extra}
      <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
    </form>
  );
}

export function Empty({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="muted" style={{ padding: 24 }}>{children}</td>
    </tr>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="back-link">← {children}</Link>
  );
}

export type Kpi = { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string; tone?: "warn" | "bad" | "ok" };

/** Deretan angka ringkas dalam satu panel bergaris (bukan kartu terpisah). */
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="kpis">
      {items.map((k) => {
        const cls = `kpi${k.tone ? ` is-${k.tone}` : ""}`;
        const body = (
          <>
            <span className="k-label">{k.label}</span>
            <span className="k-value">{k.value}</span>
            {k.sub && <span className="k-sub">{k.sub}</span>}
          </>
        );
        return k.href ? (
          <Link key={k.label} href={k.href} className={cls}>{body}</Link>
        ) : (
          <div key={k.label} className={cls}>{body}</div>
        );
      })}
    </div>
  );
}
