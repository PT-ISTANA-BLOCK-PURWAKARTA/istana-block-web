"use client";

// Papan rekonsiliasi bank: impor file mutasi (CSV/Excel BCA), cocokkan otomatis/manual, bukukan mutasi bank yang
// belum ada di buku (biaya admin, bunga, dll.), dan simpan hasil rekonsiliasi.
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoMatch, bookFromBank, deleteBankLine, importBankLines, matchManual, saveRecon, unmatch } from "@/app/akuntansi/actions/bankRecon";
import { parseStatement, type ParsedStatement } from "@/lib/erp/bankStatement";
import { loadXlsx } from "@/lib/ops/excel";
import type { BankLineRow, BookLineRow } from "@/lib/erp/bankRecon";

const rp = (n: number) => Math.round(n).toLocaleString("id-ID");
const tgl = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" });

export function ReconBoard({
  accountId, accountName, from, to, bank, book, counters, bookBal, statementBal,
}: {
  accountId: string; accountName: string; from: string; to: string; bank: BankLineRow[]; book: BookLineRow[];
  counters: { id: string; label: string }[]; bookBal: number; statementBal: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [parsed, setParsed] = useState<(ParsedStatement & { file: string }) | null>(null);
  const [selBank, setSelBank] = useState<string | null>(null);
  const [selBook, setSelBook] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [booking, setBooking] = useState<string | null>(null);
  const [counter, setCounter] = useState(counters.find((c) => /admin|jasa bank/i.test(c.label))?.id ?? counters[0]?.id ?? "");
  const [memo, setMemo] = useState("");
  const [stmt, setStmt] = useState(statementBal != null ? String(statementBal) : "");
  const [note, setNote] = useState("");
  // Saldo dari file baru muncul setelah impor (props berubah): isi otomatis bila kolom masih kosong.
  useEffect(() => { if (statementBal != null) setStmt((cur) => (cur.trim() ? cur : String(statementBal))); }, [statementBal]);

  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) { after?.(); router.refresh(); }
    });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setMsg(null);
    try {
      const XLSX = await loadXlsx();
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", raw: false, cellDates: false });
      const table = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
      setParsed({ ...parseStatement(table, Number(to.slice(0, 4))), file: f.name });
    } catch (e) {
      setMsg({ error: `File tidak bisa dibaca: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  const bankOpen = bank.filter((b) => !b.matchedLineId);
  const bookOpen = book.filter((b) => !b.matched);
  const shownBank = onlyOpen ? bankOpen : bank;
  const sumIn = (xs: { amount: number }[]) => xs.filter((x) => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const sumOut = (xs: { amount: number }[]) => xs.filter((x) => x.amount < 0).reduce((a, x) => a - x.amount, 0);
  const S = stmt.trim() === "" ? null : Number(stmt.replace(/\./g, "").replace(",", "."));
  const adjBank = S == null || !Number.isFinite(S) ? null : S + sumIn(bookOpen) - sumOut(bookOpen);
  const adjBook = bookBal + sumIn(bankOpen) - sumOut(bankOpen);
  const diff = adjBank == null ? null : adjBank - adjBook;
  const selB = bank.find((b) => b.id === selBank);
  const selK = book.find((b) => b.id === selBook);
  const pairDiff = selB && selK ? selB.amount - selK.amount : null;
  const preview = useMemo(() => parsed?.lines.slice(0, 5) ?? [], [parsed]);

  return (
    <div className="rc">
      {msg && <p className={`alert ${msg.error ? "alert-error" : "alert-ok"}`} role="status">{msg.error ?? msg.ok}</p>}

      <section className="zd-card rc-import">
        <h2>1. Impor mutasi rekening koran <span className="small muted">{accountName}</span></h2>
        <p className="small muted">Unduh mutasi dari KlikBCA (CSV) atau e-statement/Excel, lalu pilih filenya. Baris yang sudah pernah diimpor tidak dobel; transaksi PEND (tertunda) dilewati.</p>
        <input type="file" accept=".csv,.xls,.xlsx,.txt" onChange={(e) => onFile(e.target.files?.[0])} disabled={pending} />
        {parsed && (
          <div className="rc-preview">
            <p className="small"><b>{parsed.file}</b>: {parsed.lines.length} baris terbaca{parsed.skipped ? `, ${parsed.skipped} baris dilewati (judul/saldo/PEND)` : ""}{parsed.accountNo ? ` · rekening ${parsed.accountNo}` : ""}{parsed.period ? ` · periode ${parsed.period.from} s/d ${parsed.period.to}` : ""}.</p>
            {parsed.warnings.map((w) => <p key={w} className="small text-warn">⚠ {w}</p>)}
            {preview.length > 0 && (
              <table className="compact"><tbody>{preview.map((l, i) => <tr key={i}><td>{tgl(l.date)}</td><td className="small">{l.description}</td><td className={`num ${l.amount < 0 ? "zr-neg" : ""}`}>{rp(l.amount)}</td></tr>)}</tbody></table>
            )}
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || !parsed.lines.length} onClick={() => run(() => importBankLines(accountId, parsed.lines), () => setParsed(null))}>
              {pending ? "Mengimpor…" : `Impor ${parsed.lines.length} baris & cocokkan otomatis`}
            </button>
          </div>
        )}
      </section>

      <section className="zd-card">
        <h2>
          2. Cocokkan mutasi bank dengan buku
          <span className="rc-tools">
            <label className="small"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Hanya yang belum cocok</label>
            <button type="button" className="btn btn-blue btn-sm" disabled={pending} onClick={() => run(() => autoMatch(accountId, from, to))}>Cocokkan otomatis</button>
          </span>
        </h2>
        <p className="small muted">Otomatis: jumlah & arah sama, tanggal selisih paling lama 3 hari. Manual: pilih satu baris di kiri dan satu di kanan, lalu tekan Pasangkan.</p>
        <div className="rc-cols">
          <div>
            <h3>Mutasi bank ({bankOpen.length} belum cocok dari {bank.length})</h3>
            <div className="admin-table"><table className="compact rc-table">
              <thead><tr><th /><th>Tanggal</th><th>Keterangan</th><th className="num">Masuk</th><th className="num">Keluar</th><th /></tr></thead>
              <tbody>
                {shownBank.map((b) => (
                  <tr key={b.id} className={`${selBank === b.id ? "is-sel" : ""}${b.matchedLineId ? " is-ok" : ""}`}>
                    <td>{!b.matchedLineId && <input type="radio" name="rc-bank" checked={selBank === b.id} onChange={() => setSelBank(b.id)} aria-label={`Pilih mutasi ${b.description}`} />}</td>
                    <td className="small">{tgl(b.date)}</td>
                    <td className="small">{b.description}{b.matchedLineId && <div className="rc-ok">✓ {b.matchNumber} ({b.matchDate ? tgl(b.matchDate) : ""})</div>}</td>
                    <td className="num">{b.amount > 0 ? rp(b.amount) : ""}</td>
                    <td className="num">{b.amount < 0 ? rp(-b.amount) : ""}</td>
                    <td className="rc-act">
                      {b.matchedLineId ? (
                        <button type="button" className="link-btn small" disabled={pending} onClick={() => run(() => unmatch(b.id))}>Lepas</button>
                      ) : (
                        <>
                          <button type="button" className="link-btn small" onClick={() => { setBooking(booking === b.id ? null : b.id); setMemo(b.description); }}>Bukukan</button>
                          <button type="button" className="link-btn small text-bahaya" disabled={pending} onClick={() => { if (confirm("Hapus baris mutasi ini?")) run(() => deleteBankLine(b.id)); }}>Hapus</button>
                        </>
                      )}
                    </td>
                  </tr>
                )).flatMap((row, i) => {
                  const b = shownBank[i];
                  return booking === b.id ? [row, (
                    <tr key={`${b.id}-book`} className="rc-bookrow"><td colSpan={6}>
                      <div className="rc-bookform">
                        <span className="small">Catat sebagai <b>{b.amount > 0 ? "Kas Masuk" : "Kas Keluar"}</b> {rp(Math.abs(b.amount))} ke rekening:</span>
                        <select value={counter} onChange={(e) => setCounter(e.target.value)} aria-label="Rekening lawan">
                          {counters.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Keterangan" aria-label="Keterangan" />
                        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !counter} onClick={() => run(() => bookFromBank(b.id, counter, memo), () => setBooking(null))}>Bukukan &amp; pasangkan</button>
                      </div>
                    </td></tr>
                  )] : [row];
                })}
                {!shownBank.length && <tr><td colSpan={6} className="muted">{bank.length ? "Semua mutasi sudah cocok. 🎉" : "Belum ada mutasi diimpor untuk periode ini."}</td></tr>}
              </tbody>
            </table></div>
          </div>
          <div>
            <h3>Buku ({bookOpen.length} belum cocok)</h3>
            <div className="admin-table"><table className="compact rc-table">
              <thead><tr><th /><th>Tanggal</th><th>No. &amp; keterangan</th><th className="num">Masuk</th><th className="num">Keluar</th></tr></thead>
              <tbody>
                {bookOpen.map((k) => (
                  <tr key={k.id} className={selBook === k.id ? "is-sel" : ""}>
                    <td><input type="radio" name="rc-book" checked={selBook === k.id} onChange={() => setSelBook(k.id)} aria-label={`Pilih ${k.number}`} /></td>
                    <td className="small">{tgl(k.date)}</td>
                    <td className="small"><b>{k.number}</b> {k.contactName ? `· ${k.contactName} ` : ""}<span className="muted">{k.memo}</span></td>
                    <td className="num">{k.amount > 0 ? rp(k.amount) : ""}</td>
                    <td className="num">{k.amount < 0 ? rp(-k.amount) : ""}</td>
                  </tr>
                ))}
                {!bookOpen.length && <tr><td colSpan={5} className="muted">Semua baris buku pada periode ini sudah cocok.</td></tr>}
              </tbody>
            </table></div>
          </div>
        </div>
        <div className="rc-pairbar">
          {selB && selK ? (
            <>
              <span className="small">Pasangkan <b>{selB.description.slice(0, 40)}</b> ({rp(selB.amount)}) ↔ <b>{selK.number}</b> ({rp(selK.amount)}){pairDiff ? <span className="text-bahaya"> · selisih {rp(pairDiff)}</span> : null}</span>
              <button type="button" className="btn btn-primary btn-sm" disabled={pending || pairDiff !== 0} onClick={() => run(() => matchManual(selB.id, [selK.id]), () => { setSelBank(null); setSelBook(null); })}>Pasangkan</button>
            </>
          ) : <span className="small muted">Pilih satu mutasi bank dan satu baris buku untuk dipasangkan manual.</span>}
        </div>
      </section>

      <section className="zd-card">
        <h2>3. Rekonsiliasi per {tgl(to)}</h2>
        <div className="rc-sum">
          <table className="compact">
            <tbody>
              <tr><td>Saldo menurut rekening koran</td><td className="num"><input className="num" value={stmt} onChange={(e) => setStmt(e.target.value)} placeholder="isi dari rekening koran" inputMode="numeric" aria-label="Saldo menurut rekening koran" /></td></tr>
              <tr><td>+ Penerimaan di buku belum masuk bank</td><td className="num">{rp(sumIn(bookOpen))}</td></tr>
              <tr><td>− Pengeluaran di buku belum keluar di bank</td><td className="num">{rp(sumOut(bookOpen))}</td></tr>
              <tr className="rc-strong"><td>Saldo bank setelah penyesuaian</td><td className="num">{adjBank == null ? "-" : rp(adjBank)}</td></tr>
              <tr><td>Saldo menurut buku</td><td className="num">{rp(bookBal)}</td></tr>
              <tr><td>+ Mutasi masuk bank belum dibukukan</td><td className="num">{rp(sumIn(bankOpen))}</td></tr>
              <tr><td>− Mutasi keluar bank belum dibukukan (admin, pajak, dll.)</td><td className="num">{rp(sumOut(bankOpen))}</td></tr>
              <tr className="rc-strong"><td>Saldo buku setelah penyesuaian</td><td className="num">{rp(adjBook)}</td></tr>
              <tr className={`rc-diff ${diff === 0 ? "is-zero" : diff == null ? "" : "is-off"}`}><td>Selisih</td><td className="num">{diff == null ? "-" : rp(diff)}</td></tr>
            </tbody>
          </table>
          <div className="rc-save">
            <p className="small muted">{diff === 0 ? "✓ Seimbang. Simpan sebagai bukti rekonsiliasi bulan ini." : "Selisih harus 0 sebelum disimpan. Bukukan mutasi bank yang belum ada di buku, atau periksa saldo rekening koran."}</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" aria-label="Catatan rekonsiliasi" />
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || diff !== 0 || S == null} onClick={() => run(() => saveRecon(accountId, to, S ?? 0, note))}>Simpan rekonsiliasi</button>
          </div>
        </div>
      </section>
    </div>
  );
}
