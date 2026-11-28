"use client";

// Daftar invoice anak perusahaan gaya Zahir (Invoice Angkutan / Invoice U-Ditch): ← Kembali · Search · Update · Filter di atas,
// tabel histori, Baru · total · Perincian · Cetak · Tutup di bawah. Klik = pilih, klik ganda = buka.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatAmount, tgl } from "@/lib/erp/util";
import { BackButton } from "./BackButton";
import { CashFilter } from "./CashFilter";

export type AnakInvoiceRow = { id: string; number: string; date: string; customer: string; info: string; total: number; paid: number; status: string; statusLabel: string };

export function AnakInvoiceDaftar({
  title,
  path,
  hub,
  infoLabel,
  rows,
  q,
  from,
  to,
  canEdit,
}: {
  title: string;
  /** Halaman daftar ini, mis. /anak-usaha/invoice-uditch (detail = path/id, baru = path/baru). */
  path: string;
  /** Menu bagiannya (Tutup / Kembali bila dibuka langsung). */
  hub: string;
  infoLabel: string;
  rows: AnakInvoiceRow[];
  q: string;
  from: string;
  to: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(null);
  const cur = rows.find((r) => r.id === sel);
  const live = rows.filter((r) => r.status !== "batal");
  const total = live.reduce((s, r) => s + r.total, 0);
  const paid = live.reduce((s, r) => s + r.paid, 0);
  return (
    <div className="zd ai">
      <div className="zd-top">
        <BackButton fallback={hub} />
        <h1>{title}</h1>
        <form method="get" action={path} className="zd-search" role="search">
          {from && <input type="hidden" name="from" value={from} />}
          {to && <input type="hidden" name="to" value={to} />}
          <input type="search" name="q" defaultValue={q} placeholder="Search" aria-label="Cari nomor, pelanggan, atau keterangan" />
        </form>
      </div>
      <div className="zd-tools">
        <span className="muted small">
          {from || to ? `${from ? tgl(from) : "Awal"} – ${to ? tgl(to) : "sekarang"}` : "Semua tanggal"} · {rows.length.toLocaleString("id-ID")} invoice{q && ` · cari “${q}”`}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.refresh()}>Update</button>
        <CashFilter action={path} q={q} from={from} to={to} />
      </div>
      <div className="zd-table" role="grid" aria-label={`Daftar ${title}`}>
        <div className="zd-row ai-row zd-th" role="row">
          <span role="columnheader">Tanggal</span>
          <span role="columnheader">No. Invoice</span>
          <span role="columnheader">Pelanggan</span>
          <span role="columnheader" className="ai-info">{infoLabel}</span>
          <span role="columnheader" className="num">Total</span>
          <span role="columnheader" className="num">Dibayar</span>
          <span role="columnheader">Status</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            role="row"
            aria-selected={r.id === sel}
            className={`zd-row ai-row${r.id === sel ? " is-sel" : ""}`}
            onClick={() => setSel(r.id)}
            onDoubleClick={() => router.push(`${path}/${r.id}`)}
          >
            <span>{tgl(r.date)}</span>
            <span className="zd-no">{r.number}</span>
            <span className="zd-party" title={r.customer}>{r.customer}</span>
            <span className="ai-info" title={r.info}>{r.info}</span>
            <span className="num tabular">Rp{formatAmount(r.total)}</span>
            <span className="num tabular">{r.paid ? `Rp${formatAmount(r.paid)}` : "—"}</span>
            <span className={`ai-st ai-${r.status}`}>{r.statusLabel}</span>
          </div>
        ))}
        {!rows.length && <p className="muted" style={{ padding: 14 }}>{q ? `Tidak ada invoice yang cocok dengan “${q}”.` : "Belum ada invoice pada rentang ini."}</p>}
      </div>
      <div className="zd-foot">
        {canEdit && <Link href={`${path}/baru`} className="btn btn-blue btn-sm">Baru</Link>}
        <span className="zd-total">
          Total <b>Rp{formatAmount(total)}</b> · Dibayar <b>Rp{formatAmount(paid)}</b> · Sisa <b>Rp{formatAmount(Math.max(0, total - paid))}</b>
        </span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!cur} onClick={() => cur && router.push(`${path}/${cur.id}`)}>Perincian</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!cur} onClick={() => cur && window.open(`/akuntansi/cetak/invoice/${cur.id}`, "_blank")}>Cetak</button>
        <Link href={hub} className="btn btn-ghost btn-sm">Tutup</Link>
      </div>
    </div>
  );
}
