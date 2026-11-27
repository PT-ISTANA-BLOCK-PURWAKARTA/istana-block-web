"use client";

// Impor saldo awal piutang/hutang per faktur: unggah CSV/Excel Zahir → pratinjau & validasi (uji coba) → cocokkan kontak → simpan.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commitOpening, previewOpening, type OpeningPreview } from "@/app/akuntansi/actions/openingImport";
import { agingBucket, type OpeningKind } from "@/lib/erp/openingImport";
import { loadXlsx } from "@/lib/ops/excel";

const rp = (n: number) => (n < 0 ? `(${Math.abs(Math.round(n)).toLocaleString("id-ID")})` : Math.round(n).toLocaleString("id-ID"));
const dmy = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const BUCKETS = ["Belum jatuh tempo", "1–30 hari", "31–60 hari", "61–90 hari", "> 90 hari"];

export function OpeningImport({ kind, defaultAsOf }: { kind: OpeningKind; defaultAsOf: string }) {
  const router = useRouter();
  const [asOf, setAsOf] = useState(defaultAsOf);
  const [file, setFile] = useState<{ name: string; table: unknown[][] } | null>(null);
  const [pv, setPv] = useState<OpeningPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [acceptDiff, setAcceptDiff] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const who = kind === "piutang" ? "pelanggan" : "pemasok";

  const run = (f = file, map = mapping, day = asOf) => {
    if (!f) return;
    setMsg(null);
    start(async () => {
      const r = await previewOpening({ kind, asOf: day, fileName: f.name, table: f.table }, map);
      if ("error" in r) { setPv(null); setMsg({ error: r.error }); } else setPv(r);
    });
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    const XLSX = await loadXlsx();
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true, raw: f.name.toLowerCase().endsWith(".csv") });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "", raw: true });
    const next = { name: f.name, table: table.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c))) };
    setFile(next);
    setMapping({});
    run(next, {});
  };
  const save = () => {
    if (!file || !pv) return;
    setMsg(null);
    start(async () => {
      const r = await commitOpening({ kind, asOf, fileName: file.name, table: file.table, mapping, acceptDiff, reason });
      if ("error" in r) setMsg({ error: r.error });
      else { setMsg({ ok: r.ok }); setPv(null); setFile(null); router.refresh(); }
    });
  };

  const buckets = [0, 0, 0, 0, 0];
  for (const r of pv?.rows ?? []) if (!r.exists && r.balance > 0) buckets[agingBucket(r.dueDate, asOf)] += r.balance;
  const unmatched = pv?.groups.filter((g) => !g.contactId) ?? [];
  const willSave = pv ? pv.rows.filter((r) => !r.exists).length : 0;

  return (
    <section className="zd-card">
      <h2>1. Unggah file Zahir</h2>
      <p className="small muted">
        Ekspor dari Zahir laporan <b>{kind === "piutang" ? "Piutang Usaha Per Pelanggan – Rincian" : "Rincian Hutang"}</b> ke Excel/CSV.
        Kolom yang dibaca: Kode, Nama {who}, Tanggal, Jatuh Tempo, Tp, No. Ref/No. Faktur, Sisa (opsional: Nilai, Mata Uang). Judul kolom boleh di baris mana saja; baris “Saldo”/“Total” dilewati.
      </p>
      <div className="form-grid">
        <div className="field"><label htmlFor="op-asof">Tanggal posisi saldo</label><input id="op-asof" type="date" value={asOf} onChange={(e) => { setAsOf(e.target.value); if (file) run(file, mapping, e.target.value); }} /></div>
        <div className="field"><label htmlFor="op-file">File (.xlsx / .xls / .csv)</label><input id="op-file" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void pick(e.target.files?.[0])} /></div>
      </div>
      {pending && <p className="small muted">Memproses…</p>}
      {msg?.error && <p className="alert alert-error">{msg.error}</p>}
      {msg?.ok && <p className="alert alert-ok">{msg.ok}</p>}

      {pv && (
        <>
          <h2 style={{ marginTop: 18 }}>2. Pratinjau &amp; validasi <span className="small muted">(uji coba — belum disimpan)</span></h2>
          {pv.errors.length > 0 && (
            <div className="alert alert-error"><b>{pv.errors.length} masalah di file:</b><ul>{pv.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul></div>
          )}
          <div className="kpis">
            <div className="kpi"><span>Faktur terbuka di file</span><b>{pv.rows.length}</b></div>
            <div className="kpi"><span>Total sisa di file</span><b>{rp(pv.total)}</b></div>
            <div className="kpi"><span>Saldo akun {kind === "piutang" ? "Piutang" : "Hutang"} Usaha per {dmy(asOf)}</span><b>{rp(pv.glBalance)}</b></div>
            <div className="kpi"><span>Selisih</span><b style={{ color: pv.difference ? "var(--bahaya, #c62828)" : "var(--hijau, #2e7d32)" }}>{pv.difference ? rp(pv.difference) : "Cocok"}</b></div>
          </div>
          {pv.existing > 0 && <p className="small">{pv.existing} faktur sudah pernah diimpor dan akan dilewati (anti-dobel: nomor Zahir + {who}).</p>}
          <p className="small">Umur (hari lewat jatuh tempo per {dmy(asOf)}): {BUCKETS.map((b, i) => `${b} ${rp(buckets[i])}`).join(" · ")}</p>

          <h3 className="form-sub">Pencocokan {who} ({pv.groups.length}) {unmatched.length > 0 && <span className="badge badge-warn">{unmatched.length} belum cocok → dibuat baru kecuali dipilih</span>}</h3>
          <div className="admin-table">
            <table className="compact">
              <thead><tr><th>Kode Zahir</th><th>Nama di file</th><th className="num">Faktur</th><th className="num">Sisa</th><th>Di aplikasi</th></tr></thead>
              <tbody>
                {pv.groups.map((g) => (
                  <tr key={g.key}>
                    <td>{g.code || "-"}</td>
                    <td>{g.name}</td>
                    <td className="num">{g.rows}</td>
                    <td className="num">{rp(g.total)}</td>
                    <td>
                      <select value={mapping[g.key] ?? g.contactId ?? "baru"} onChange={(e) => { const m = { ...mapping, [g.key]: e.target.value }; setMapping(m); run(file, m); }} aria-label={`Kontak untuk ${g.name}`}>
                        <option value="baru">+ Buat {who} baru “{g.name}”</option>
                        {pv.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      {g.matchedBy && <span className="small muted"> cocok lewat {g.matchedBy}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="form-sub">Faktur</h3>
          <div className="admin-table" style={{ maxHeight: 420, overflow: "auto" }}>
            <table className="compact">
              <thead><tr><th>Baris</th><th>No. faktur</th><th>{who[0].toUpperCase() + who.slice(1)}</th><th>Tanggal</th><th>Jatuh tempo</th><th className="num">Sisa</th><th>Umur</th><th /></tr></thead>
              <tbody>
                {pv.rows.map((r) => (
                  <tr key={`${r.groupKey}${r.number}`} className={r.exists ? "muted" : ""}>
                    <td>{r.line}</td><td>{r.number}</td><td>{r.name}</td><td>{dmy(r.date)}</td><td>{dmy(r.dueDate)}</td>
                    <td className="num">{rp(r.balance)}</td><td className="small">{r.balance > 0 ? BUCKETS[agingBucket(r.dueDate, asOf)] : "lebih bayar"}</td><td className="small">{r.exists ? "sudah ada" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ marginTop: 18 }}>3. Simpan</h2>
          <p className="small muted">Faktur saldo awal <b>tidak membuat jurnal</b> — saldo akun sudah ada di buku besar. Yang dibuat hanya rincian per faktur, ditandai “Saldo awal Zahir”, dan bisa dilunasi lewat {kind === "piutang" ? "Pembayaran Piutang Usaha" : "Pembayaran Hutang Usaha"}.</p>
          {pv.difference !== 0 && (
            <div className="form-grid">
              <div className="field full"><label className="check"><input type="checkbox" checked={acceptDiff} onChange={(e) => setAcceptDiff(e.target.checked)} /> Simpan dengan selisih {rp(pv.difference)}</label></div>
              <div className="field full"><label htmlFor="op-reason">Alasan selisih (tercatat di Jejak Audit)</label><textarea id="op-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. saldo akun termasuk uang muka / faktur yang dibayar setelah tanggal posisi" /></div>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-primary" disabled={pending || pv.errors.length > 0 || !willSave || (pv.difference !== 0 && (!acceptDiff || reason.trim().length < 10))} onClick={save}>
              Simpan {willSave} faktur saldo awal
            </button>
          </div>
        </>
      )}
    </section>
  );
}
