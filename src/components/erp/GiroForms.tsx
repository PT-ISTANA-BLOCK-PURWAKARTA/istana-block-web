"use client";

// Form giro baru dan tombol pencairan / penolakan giro.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Select } from "@/components/ui";
import { clearGiro, rejectGiro, saveGiro } from "@/app/akuntansi/actions/returnsGiro";

type Opt = { value: string; label: string };

export function GiroForm({ kind, contacts, date }: { kind: "masuk" | "keluar"; contacts: Opt[]; date: string }) {
  return (
    <ActionForm action={saveGiro} className="stack" style={{ gap: 18 }}>
      <input type="hidden" name="kind" value={kind} />
      <section className="form-section">
        <div className="form-grid">
          <div className="field"><label htmlFor="g-c">{kind === "masuk" ? "Dari pelanggan" : "Untuk pemasok"}</label><Select id="g-c" name="contactId" options={contacts} searchable required /></div>
          <div className="field"><label htmlFor="g-n">Nomor giro / cek</label><input id="g-n" name="giroNo" required placeholder="mis. BG 123456" /></div>
          <div className="field"><label htmlFor="g-b">Bank</label><input id="g-b" name="bank" placeholder="mis. BCA KCP Purwakarta" /></div>
          <div className="field"><label htmlFor="g-a">Nominal (Rp)</label><input id="g-a" name="amount" inputMode="numeric" required /></div>
          <div className="field"><label htmlFor="g-i">{kind === "masuk" ? "Tanggal diterima" : "Tanggal diterbitkan"}</label><input id="g-i" type="date" name="issueDate" defaultValue={date} required /></div>
          <div className="field"><label htmlFor="g-d">Jatuh tempo</label><input id="g-d" type="date" name="dueDate" required /></div>
          <div className="field full"><label className="check"><input type="checkbox" name="allocate" defaultChecked /> Lunasi {kind === "masuk" ? "faktur penjualan" : "tagihan pembelian"} terlama otomatis (sisanya jadi uang muka)</label></div>
          <div className="field full"><label htmlFor="g-note">Catatan</label><input id="g-note" name="note" /></div>
        </div>
        <p className="help">{kind === "masuk" ? "Dicatat sebagai penerimaan ke rekening “Giro Masuk (Belum Cair)”. Saat bank mencairkan, klik Cairkan untuk memindahkan ke rekening bank." : "Dicatat sebagai pembayaran dari “Giro Keluar (Belum Cair)”. Saat bank mendebet rekening, klik Cairkan."}</p>
      </section>
      <div className="form-actions"><SubmitButton>Simpan giro</SubmitButton></div>
    </ActionForm>
  );
}

export function GiroActions({ id, banks, today, status }: { id: string; banks: Opt[]; today: string; status: string }) {
  const [date, setDate] = useState(today);
  const [bank, setBank] = useState(banks[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => { const r = await fn(); setMsg(r); router.refresh(); });
  if (status !== "beredar") return null;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="form-grid">
        <div className="field"><label htmlFor="gc-d">Tanggal cair</label><input id="gc-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label htmlFor="gc-b">Rekening bank</label><Select id="gc-b" value={bank} onChange={setBank} options={banks} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => clearGiro(id, date, bank))}>{pending ? "Memproses…" : "Cairkan giro"}</button>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan ditolak (opsional)" aria-label="Alasan ditolak" style={{ minWidth: 240 }} />
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { if (window.confirm("Tandai giro ditolak/batal? Penerimaan/pembayarannya dihapus dan tagihan kembali terbuka.")) run(() => rejectGiro(id, note)); }}>Giro ditolak / batal</button>
      </div>
      {msg?.error && <p className="small text-bahaya">{msg.error}</p>}
      {msg?.ok && <p className="small text-ok">{msg.ok}</p>}
    </div>
  );
}
