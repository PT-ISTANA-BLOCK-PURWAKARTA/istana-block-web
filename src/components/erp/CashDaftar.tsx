"use client";

// Daftar Kas Keluar / Kas Masuk / Transfer gaya Zahir: ← Kembali · Search · Update · Filter di atas, tabel histori,
// tombol Baru · Hapus (kiri bawah) dan Perincian · Cetak · Tutup (kanan bawah). Klik = pilih, klik ganda = buka.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCash } from "@/app/akuntansi/actions/ledger";
import { formatAmount, tgl } from "@/lib/erp/util";
import { BackButton } from "./BackButton";
import { CashFilter } from "./CashFilter";
import type { CashListRow } from "@/lib/erp/cashList";

const TITLE = { keluar: "Kas Keluar", masuk: "Kas Masuk", transfer: "Transfer Kas" } as const;

export function CashDaftar({ kind, rows, total, q, from, to }: { kind: keyof typeof TITLE; rows: CashListRow[]; total: number; q: string; from: string; to: string }) {
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const cur = rows.find((r) => r.key === sel);
  const who = kind === "masuk" ? "Dari" : kind === "keluar" ? "Penerima" : "Keterangan singkat";

  const hapus = () => {
    if (!cur) return;
    if (cur.zahir) return setErr(`${cur.number} berasal dari impor Zahir dan tidak bisa dihapus di sini.`);
    if (!window.confirm(`Hapus ${cur.number}? Jurnalnya ikut terhapus.`)) return;
    setErr("");
    start(async () => {
      try {
        const r = await deleteCash(cur.id);
        if (r && "error" in r && r.error) setErr(r.error);
      } catch {
        /* redirect setelah hapus */
      }
      router.refresh();
    });
  };

  return (
    <div className="zd">
      <div className="zd-top">
        <BackButton fallback="/akuntansi/menu/kas-bank" />
        <h1>{TITLE[kind]}</h1>
        <form method="get" className="zd-search" role="search">
          <input type="hidden" name="jenis" value={kind} />
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input type="search" name="q" defaultValue={q} placeholder="Search" aria-label="Cari nomor, nama, atau keterangan" />
        </form>
      </div>
      <div className="zd-tools">
        <span className="muted small">{tgl(from)} – {tgl(to)} · {rows.length.toLocaleString("id-ID")} transaksi</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.refresh()}>Update</button>
        <CashFilter jenis={kind} q={q} from={from} to={to} />
      </div>
      <div className="zd-table" role="grid" aria-label={`Daftar ${TITLE[kind]}`}>
        <div className="zd-row zd-th" role="row">
          <span role="columnheader">Tanggal</span><span role="columnheader">Referensi</span><span role="columnheader">{who}</span>
          <span role="columnheader">Keterangan</span><span role="columnheader" className="num">Nilai</span><span role="columnheader" aria-label="Status" />
        </div>
        {rows.map((r) => (
          <div
            key={r.key}
            role="row"
            aria-selected={r.key === sel}
            className={`zd-row${r.key === sel ? " is-sel" : ""}`}
            onClick={() => setSel(r.key)}
            onDoubleClick={() => router.push(r.href)}
          >
            <span>{tgl(r.date)}</span>
            <span className="zd-no">{r.number}</span>
            <span className="zd-party">{r.party}</span>
            <span className="zd-memo">{r.memo}</span>
            <span className="num tabular">Rp{formatAmount(r.amount)}</span>
            <span className="zd-st" title={r.draft ? "Draft (belum masuk jurnal)" : r.zahir ? "Impor Zahir" : "Terekam"}>{r.draft ? "Draft" : "✓"}</span>
          </div>
        ))}
        {!rows.length && <p className="muted" style={{ padding: 14 }}>Belum ada transaksi pada rentang ini. Pakai Filter untuk memilih tanggal lain.</p>}
      </div>
      <div className="zd-foot">
        <Link href={`/akuntansi/kas/baru?jenis=${kind}`} className="btn btn-blue btn-sm">Baru</Link>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!cur || busy} onClick={hapus}>{busy ? "Menghapus…" : "Hapus"}</button>
        {err && <span className="small text-bahaya" role="alert">{err}</span>}
        <span className="zd-total">Total <b>Rp{formatAmount(total)}</b></span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!cur} onClick={() => cur && router.push(cur.href)}>Perincian</button>
        {/* Baris terpilih → Bukti Kas (termasuk histori impor Zahir); tanpa pilihan → cetak daftar. */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title={cur ? `Cetak bukti ${cur.number}` : "Cetak daftar"}
          onClick={() => {
            if (!cur) return window.print();
            if (cur.draft) return setErr(`${cur.number} masih draft. Rekam dulu sebelum mencetak bukti kas.`);
            window.open(`/akuntansi/cetak/kas/${cur.id}`, "_blank");
          }}
        >
          Cetak
        </button>
        <Link href="/akuntansi/menu/kas-bank" className="btn btn-ghost btn-sm">Tutup</Link>
      </div>
    </div>
  );
}
