"use client";

// Buku Besar gaya Zahir: Search di kanan atas; nama akun (klik = Daftar Akun) · Grafik · Update · Filter; tabel histori
// transaksi satu akun (Tanggal, Tp, No Referensi, Catatan, Debit, Kredit, Saldo, Job); ringkasan Saldo Awal / Saldo Akhir /
// Jumlah / Mutasi; lalu "Grafik Buku Besar Saldo Berjalan" setengah layar di bawah, lalu Cetak · Perincian · Tutup.
// Grafik hanya tampil pada tampilan awal (bulan berjalan tanpa pencarian). Begitu filter tanggal atau pencarian dipakai,
// grafik disembunyikan dan tabel memakai seluruh tinggi; tombol Grafik tetap bisa memunculkannya.
// Klik baris = pilih, klik ganda / Perincian = buka dokumen asal.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatAmount, tgl } from "@/lib/erp/util";
import type { Cell, Column } from "@/lib/styledExcel";
import { BackButton } from "./BackButton";
import { BalanceChart } from "./BalanceChart";
import { CashFilter } from "./CashFilter";
import { PickerDialog, type PickerRow } from "./PickerDialog";

export type BukuBesarRow = { key: string; date: string; tp: string; number: string; memo: string; note: string; contact: string; debit: number; credit: number; balance: number; job: string; href: string };

const PATH = "/akuntansi/laporan/buku-besar";
const longDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function BukuBesarView({
  account,
  accounts,
  rows,
  opening,
  closing,
  debitUp,
  from,
  to,
  q,
  filtered,
  points,
}: {
  account: { id: string; code: string; name: string };
  accounts: PickerRow[];
  rows: BukuBesarRow[];
  opening: number;
  closing: number;
  /** true = debit menambah saldo (aset/beban). */
  debitUp: boolean;
  from: string;
  to: string;
  q: string;
  /** Filter tanggal atau pencarian sedang dipakai → grafik awalnya disembunyikan. */
  filtered: boolean;
  points: { date: string; balance: number }[];
}) {
  const router = useRouter();
  const [chart, setChart] = useState(!filtered);
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const cur = rows.find((r) => r.key === sel);
  const sum = useMemo(() => rows.reduce((s, r) => ({ d: s.d + r.debit, c: s.c + r.credit }), { d: 0, c: 0 }), [rows]);
  const mutasi = debitUp ? sum.d - sum.c : sum.c - sum.d;
  const range = `from=${from}&to=${to}`;
  const [xl, setXl] = useState("");

  // Unduh Excel rapi (kop perusahaan, garis tebal, angka berformat) dari baris yang sedang tampil.
  const unduhExcel = async () => {
    setXl("busy");
    try {
      const X = await import("@/lib/styledExcel");
      const wb = await X.newWorkbook();
      const ws = X.addSheet(wb, "Buku Besar");
      const cols: Column[] = [
        { header: "No", width: 5, align: "center" },
        { header: "Tanggal", width: 11, align: "center" },
        { header: "Tp", width: 5, align: "center" },
        { header: "No Referensi", width: 15 },
        { header: "Catatan", width: 50 },
        { header: "Nama", width: 22 },
        { header: "Debit", width: 15, numFmt: X.RP },
        { header: "Kredit", width: 15, numFmt: X.RP },
        { header: "Saldo", width: 16, numFmt: X.RP },
        { header: "Job", width: 10 },
      ];
      const head = await X.addLetterhead(wb, ws, cols.length, "Buku Besar", `${account.name} (${account.code}) · ${longDay(from)} – ${longDay(to)}${q ? ` · cari "${q}"` : ""}`);
      const b = (value: number | string | null): Cell => ({ value, bold: true });
      const data: Cell[][] = [
        [null, null, null, null, b("Saldo Awal"), null, null, null, b(opening), null],
        ...rows.map((r, i): Cell[] => [i + 1, X.excelDay(r.date), r.tp, r.number, r.memo, r.contact, r.debit || null, r.credit || null, r.balance, r.job]),
        [null, null, null, null, b(q ? "Jumlah (hasil cari)" : "Jumlah"), null, b(sum.d), b(sum.c), q ? null : b(closing), null],
      ];
      const end = X.addTable(ws, head, cols, data, { dateFormat: "dd/mm/yyyy" });
      X.addSummary(ws, end + 1, 7, 9, [["Saldo Awal", opening], ["Saldo Akhir", closing], ["Mutasi", mutasi]]);
      ws.pageSetup.printTitlesRow = `${head}:${head}`;
      await X.saveWorkbook(wb, `Buku Besar ${account.code} ${account.name} ${from} sd ${to}.xlsx`);
      setXl("");
    } catch (e) {
      setXl(e instanceof Error ? e.message : "Gagal membuat Excel.");
    }
  };

  return (
    <div className={`zd bb${chart ? " has-chart" : ""}`}>
      <div className="zd-top">
        <BackButton fallback="/akuntansi/menu/buku-besar" />
        <h1>Buku Besar</h1>
        <form method="get" action={PATH} className="zd-search" role="search">
          <input type="hidden" name="akun" value={account.id} />
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input type="search" name="q" defaultValue={q} placeholder="Search" aria-label="Cari nomor, catatan, nama, atau job" />
        </form>
      </div>
      <div className="zd-tools">
        <button type="button" className="bb-acc" onClick={() => setPick(true)} title="Pilih akun lain">
          <b>{account.name}</b> <span className="muted">{account.code}</span> <span aria-hidden>▾</span>
        </button>
        <span className="muted small">
          {tgl(from)} – {tgl(to)} · {rows.length.toLocaleString("id-ID")} transaksi{q && ` · cari “${q}”`}
        </span>
        <button type="button" className={`btn btn-ghost btn-sm${chart ? " is-on" : ""}`} aria-pressed={chart} onClick={() => setChart((v) => !v)} title="Tampilkan / sembunyikan grafik saldo berjalan">Grafik</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.refresh()}>Update</button>
        <CashFilter action={PATH} hidden={{ akun: account.id }} q={q} from={from} to={to} />
      </div>
      <div className="zd-table bb-table" role="grid" aria-label={`Buku besar ${account.name}`}>
        <div className="zd-row bb-row zd-th" role="row">
          <span role="columnheader">Tanggal</span>
          <span role="columnheader">Tp</span>
          <span role="columnheader">No Referensi</span>
          <span role="columnheader" className="bb-memo">Catatan</span>
          <span role="columnheader" className="num">Debit</span>
          <span role="columnheader" className="num">Kredit</span>
          <span role="columnheader" className="num">Saldo</span>
          <span role="columnheader">Job</span>
          <span role="columnheader" className="num bb-mut">Mutasi</span>
        </div>
        {rows.map((r) => {
          const up = debitUp ? r.debit - r.credit : r.credit - r.debit;
          return (
            <div
              key={r.key}
              role="row"
              aria-selected={r.key === sel}
              className={`zd-row bb-row${r.key === sel ? " is-sel" : ""}`}
              onClick={() => setSel(r.key)}
              onDoubleClick={() => router.push(r.href)}
            >
              <span>{tgl(r.date)}</span>
              <span>{r.tp}</span>
              <span className="zd-no">{r.number}</span>
              <span className="bb-memo" title={[r.memo, r.note, r.contact].filter(Boolean).join(" · ")}>
                {r.memo}
                {r.contact && <small className="bb-contact"> · {r.contact}</small>}
              </span>
              <span className="num tabular">{formatAmount(r.debit, { blankZero: true })}</span>
              <span className="num tabular">{formatAmount(r.credit, { blankZero: true })}</span>
              <span className={`num tabular${r.balance < 0 ? " bb-neg" : ""}`}>{formatAmount(r.balance)}</span>
              <span>{r.job}</span>
              <span className={`num tabular bb-mut${up < 0 ? " bb-neg" : ""}`}>{up < 0 ? "−" : "+"}{formatAmount(Math.abs(up))}</span>
            </div>
          );
        })}
        {!rows.length && (
          <p className="muted" style={{ padding: 14 }}>
            {q ? `Tidak ada transaksi yang cocok dengan “${q}”.` : "Tidak ada transaksi pada periode ini. Pakai Filter untuk memilih tanggal lain."}
          </p>
        )}
      </div>
      <div className="bb-sum">
        <dl>
          <dt>Saldo Awal</dt>
          <dd>Rp{formatAmount(opening)}</dd>
          <dt>Saldo Akhir</dt>
          <dd className={closing < 0 ? "bb-neg" : undefined}>Rp{formatAmount(closing)}</dd>
        </dl>
        <dl>
          <dt>{q ? "Jumlah (hasil cari)" : "Jumlah"}</dt>
          <dd title="Debit">Rp{formatAmount(sum.d)}</dd>
          <dd title="Kredit">Rp{formatAmount(sum.c)}</dd>
          <dt>Mutasi</dt>
          <dd className={mutasi < 0 ? "bb-neg" : undefined}>Rp{formatAmount(mutasi)}</dd>
          <dd />
        </dl>
      </div>
      {chart && (
        <section className="bb-chart" aria-label="Grafik Buku Besar Saldo Berjalan">
          <div className="bb-chart-head">
            <h2>Grafik Buku Besar Saldo Berjalan</h2>
            <span>{longDay(points[0]?.date ?? from)} – {longDay(to)}</span>
          </div>
          <div className="bb-chart-box">
            <BalanceChart fill points={points} label={`Saldo berjalan ${account.name} per hari, ${tgl(from)} – ${tgl(to)}`} />
          </div>
        </section>
      )}
      <div className="zd-foot">
        <button type="button" className="btn btn-ghost btn-sm" disabled={xl === "busy"} onClick={unduhExcel} title="Unduh Excel berkop perusahaan dari baris yang tampil">
          {xl === "busy" ? "Menyiapkan…" : "Unduh Excel"}
        </button>
        {xl && xl !== "busy" && <span className="small text-bahaya" role="alert">{xl}</span>}
        <span className="zd-total" aria-hidden />
        <a className="btn btn-blue btn-sm" href={`/akuntansi/laporan/buku-besar-mutasi?akun=${account.id}&${range}`} target="_blank" rel="noopener" title="Cetak format Zahir (Buku Besar - Mutasi)">Cetak</a>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!cur} onClick={() => cur && router.push(cur.href)}>Perincian</button>
        <Link href="/akuntansi/menu/buku-besar" className="btn btn-ghost btn-sm">Tutup</Link>
      </div>
      <PickerDialog
        open={pick}
        title="Daftar Akun (Perkiraan)"
        columns={["Kode", "Nama Akun", "Kelompok"]}
        rows={accounts}
        selectedId={account.id}
        onPick={(id) => {
          setPick(false);
          if (id && id !== account.id) router.push(`${PATH}?akun=${encodeURIComponent(id)}&${range}`);
        }}
        onClose={() => setPick(false)}
      />
    </div>
  );
}
