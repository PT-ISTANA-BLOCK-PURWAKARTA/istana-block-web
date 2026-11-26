"use client";

// Isian anggaran per akun × 12 bulan (seperti Anggaran di Zahir), dengan isi cepat dari realisasi tahun lalu atau rata-rata.
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveBudgets } from "@/app/akuntansi/actions/assets";

type Row = { id: string; code: string; name: string; section: string; budget: (number | null)[]; ref: number[]; actual: number[] };

const fmt = (n: number) => (n ? Math.round(n).toLocaleString("id-ID") : "");
const parse = (s: string) => { const v = Number(s.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, "")); return Number.isFinite(v) && s.trim() !== "" ? Math.round(v) : null; };

export function BudgetGrid({ rows: initial, periods, months, refLabel, refHint }: { rows: Row[]; periods: string[]; months: string[]; refLabel: string; refHint: string }) {
  const [rows, setRows] = useState(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [pct, setPct] = useState("0");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const visible = useMemo(() => (showAll ? rows : rows.filter((r) => r.budget.some((v) => v) || r.ref.some((v) => v) || r.actual.some((v) => v))), [rows, showAll]);
  const setCell = (id: string, i: number, v: number | null) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, budget: r.budget.map((x, j) => (j === i ? v : x)) } : r)));
    setDirty((d) => new Set(d).add(`${id}|${i}`));
  };
  const fillRow = (id: string, values: (number | null)[]) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, budget: values } : r)));
    setDirty((d) => { const n = new Set(d); values.forEach((_, i) => n.add(`${id}|${i}`)); return n; });
  };
  const fillAllFromRef = () => {
    const k = 1 + (Number(pct.replace(",", ".")) || 0) / 100;
    const n = new Set(dirty);
    setRows((rs) => rs.map((r) => ({ ...r, budget: r.budget.map((v, i) => { if (v || !r.ref[i]) return v; n.add(`${r.id}|${i}`); return Math.round(r.ref[i] * k); }) })));
    setDirty(n);
  };
  const save = () => {
    const changes = [...dirty].map((key) => { const [id, i] = key.split("|"); const r = rows.find((x) => x.id === id)!; return { accountId: id, period: periods[Number(i)], amount: r.budget[Number(i)] }; });
    if (!changes.length) { setMsg({ ok: "Tidak ada perubahan." }); return; }
    start(async () => {
      const res = await saveBudgets(changes);
      setMsg(res);
      if (!res.error) { setDirty(new Set()); router.refresh(); }
    });
  };
  const sections = [...new Set(visible.map((r) => r.section))];
  return (
    <div className="bg">
      <div className="bg-tools">
        <label className="check"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Tampilkan semua akun</label>
        <span className="bg-fill">
          Isi sel kosong dari {refLabel} +<input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" aria-label="Kenaikan persen" />%
          <button type="button" className="btn btn-ghost btn-sm" onClick={fillAllFromRef}>Isi</button>
        </span>
        <span className="bg-save">
          {msg?.error && <span className="small text-bahaya">{msg.error}</span>}
          {msg?.ok && <span className="small text-ok">{msg.ok}</span>}
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={save}>{pending ? "Menyimpan…" : `Simpan anggaran${dirty.size ? ` (${dirty.size})` : ""}`}</button>
        </span>
      </div>
      <p className="small muted">{refHint} Angka abu-abu kecil di bawah sel = realisasi. Tombol ↦ menyalin bulan pertama ke semua bulan; Σ/12 membagi rata total {refLabel}.</p>
      <div className="admin-table bg-wrap">
        <table className="bg-table">
          <thead><tr><th className="bg-acc">Rekening</th>{months.map((m) => <th key={m} className="num">{m}</th>)}<th className="num">Total</th><th /></tr></thead>
          {sections.map((s) => (
            <tbody key={s}>
              <tr className="bg-sec"><td colSpan={months.length + 3}>{s}</td></tr>
              {visible.filter((r) => r.section === s).map((r) => {
                const total = r.budget.reduce<number>((a, v) => a + (v ?? 0), 0);
                const actualTotal = r.actual.reduce((a, v) => a + v, 0);
                return (
                  <tr key={r.id}>
                    <td className="bg-acc"><b>{r.code}</b> {r.name}</td>
                    {r.budget.map((v, i) => (
                      <td key={i} className={dirty.has(`${r.id}|${i}`) ? "is-dirty" : undefined}>
                        <input value={fmt(v ?? 0)} inputMode="numeric" aria-label={`${r.name} ${months[i]}`} onChange={(e) => setCell(r.id, i, parse(e.target.value))} />
                        {r.actual[i] ? <small>{fmt(r.actual[i])}</small> : null}
                      </td>
                    ))}
                    <td className="num"><b>{fmt(total)}</b>{actualTotal ? <small>{fmt(actualTotal)}</small> : null}</td>
                    <td className="nowrap">
                      <button type="button" className="link-btn" title="Salin bulan pertama ke semua bulan" onClick={() => fillRow(r.id, r.budget.map(() => r.budget[0]))}>↦</button>{" "}
                      <button type="button" className="link-btn" title={`Bagi rata total ${refLabel}`} onClick={() => { const t = r.ref.reduce((a, v) => a + v, 0); fillRow(r.id, r.budget.map(() => Math.round(t / 12) || null)); }}>Σ/12</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
