"use client";

// Form Kas Keluar / Kas Masuk gaya Zahir: Akun Kas, Penerima/Dari (Data Nama), Cek No., Tanggal, Sebesar, Proyek (Data Proyek),
// Memo, tabel Alokasi Dana (Kode · Nama Akun · Nilai · Job), tombol Hapus Baris · Batal · Rekam Draft · Rekam.
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveCash } from "@/app/akuntansi/actions/ledger";
import { quickContact } from "@/app/akuntansi/actions/master";
import { DateField, Select } from "@/components/ui";
import { Icon } from "@/components/panel/Icon";
import { CONTACT_ZAHIR_TYPE } from "@/lib/erp/accounting";
import { formatAmount, parseRupiah } from "@/lib/erp/util";
import { PickerDialog } from "./PickerDialog";
import type { PickAccount } from "./LinesEditor";

export type ZContact = { id: string; code: string; name: string; kind: keyof typeof CONTACT_ZAHIR_TYPE };
export type ZProject = { id: string; code: string; name: string; customer: string };
export type ZLine = { accountId: string; amount: string; projectId: string; memo: string };

type Picker = null | { type: "nama" } | { type: "proyek" } | { type: "akun"; row: number } | { type: "job"; row: number };

export function ZahirCashForm({
  kind,
  head,
  lines,
  cashAccounts,
  accounts,
  contacts: initialContacts,
  projects,
  nextNumber,
}: {
  kind: "masuk" | "keluar";
  head: { id?: string; number?: string; date: string; accountId?: string; contactId?: string | null; projectId?: string | null; memo?: string; status?: string };
  lines: ZLine[];
  cashAccounts: PickAccount[];
  accounts: PickAccount[];
  contacts: ZContact[];
  projects: ZProject[];
  nextNumber: string;
}) {
  const blank = (): ZLine => ({ accountId: "", amount: "", projectId: "", memo: "" });
  const [contacts, setContacts] = useState(initialContacts);
  const [contactId, setContactId] = useState(head.contactId ?? "");
  const [projectId, setProjectId] = useState(head.projectId ?? "");
  const [memo, setMemo] = useState(head.memo ?? "");
  const [rows, setRows] = useState<ZLine[]>(() => [...lines, blank()]);
  const [cur, setCur] = useState(0);
  const [picker, setPicker] = useState<Picker>(null);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<ZContact["kind"]>(kind === "keluar" ? "karyawan" : "pelanggan");
  const [addErr, setAddErr] = useState("");
  const [adding, startAdd] = useTransition();

  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const contact = contacts.find((c) => c.id === contactId);
  const total = rows.reduce((s, r) => s + parseRupiah(r.amount), 0);
  const prefix = kind === "keluar" ? "Pengeluaran" : "Penerimaan";
  const who = kind === "keluar" ? "Penerima" : "Dari";

  const update = (i: number, patch: Partial<ZLine>) =>
    setRows((rs) => {
      const next = rs.map((r, j) => (j === i ? { ...r, ...patch } : r));
      // Selalu sisakan satu baris kosong di bawah, seperti tabel Zahir.
      const last = next[next.length - 1];
      return last.accountId || last.amount ? [...next, blank()] : next;
    });

  const pickContact = (id: string, added?: ZContact) => {
    const c = added ?? contacts.find((x) => x.id === id);
    setContactId(id);
    // Memo otomatis "Pengeluaran, NAMA " bila memo masih kosong / masih isian otomatis.
    if (c && (!memo.trim() || /^(Pengeluaran|Penerimaan),\s*[^,]*\s*$/.test(memo) || memo.trim() === prefix)) setMemo(`${prefix}, ${c.name} `);
    setPicker(null);
  };

  const json = JSON.stringify(
    rows
      .filter((r) => r.accountId || parseRupiah(r.amount))
      .map((r) => ({ accountId: r.accountId, amount: parseRupiah(r.amount), projectId: r.projectId || null, memo: r.memo })),
  );

  const addContact = () =>
    startAdd(async () => {
      setAddErr("");
      const r = await quickContact(newName, newKind);
      if ("error" in r) return setAddErr(r.error);
      const c = r as ZContact;
      setContacts((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, c]));
      setNewName("");
      pickContact(c.id, c);
    });

  return (
    <ActionForm action={saveCash}>
      {head.id && <input type="hidden" name="id" value={head.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="lines" value={json} />
      <div className="zk">
        <div className="zk-title">
          <h1><Icon name={kind === "keluar" ? "pay" : "receive"} size={22} /> {kind === "keluar" ? "Kas Keluar" : "Kas Masuk"}</h1>
          {head.status === "draft" && <span className="badge badge-warn">Draft</span>}
          <Link href={`/akuntansi/kas?jenis=${kind}`} className="btn btn-ghost btn-sm zk-list">Daftar {kind === "keluar" ? "Kas Keluar" : "Kas Masuk"}</Link>
        </div>

        <div className="zk-head">
          <label className="zk-l" htmlFor="zk-acc" style={{ gridArea: "al" }}>Akun Kas :</label>
          <div className="zk-acc" style={{ gridArea: "acc" }}><Select id="zk-acc" name="accountId" defaultValue={head.accountId ?? cashAccounts[0]?.id} required options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))} /></div>

          <label className="zk-l" htmlFor="zk-who" style={{ gridArea: "wl" }}>{who} :</label>
          <div className="zk-pick" style={{ gridArea: "who" }}>
            <input id="zk-who" readOnly value={contact ? contact.name : ""} placeholder="(pilih nama)" onClick={() => setPicker({ type: "nama" })} />
            <button type="button" className="zk-pickbtn" aria-label={`Pilih ${who}`} onClick={() => setPicker({ type: "nama" })}><Icon name="list" size={16} /></button>
          </div>

          <label className="zk-l" htmlFor="zk-no" style={{ gridArea: "nl" }}>Cek No. :</label>
          <input id="zk-no" name="number" style={{ gridArea: "no" }} defaultValue={head.number ?? nextNumber} maxLength={30} />

          <label className="zk-l" htmlFor="zk-proj" style={{ gridArea: "pl" }}>Proyek :</label>
          <div className="zk-pick" style={{ gridArea: "proj" }}>
            <input id="zk-proj" readOnly value={projById.get(projectId)?.code ?? ""} onClick={() => setPicker({ type: "proyek" })} />
            <button type="button" className="zk-pickbtn" aria-label="Pilih proyek" onClick={() => setPicker({ type: "proyek" })}><Icon name="list" size={16} /></button>
          </div>

          <label className="zk-l" htmlFor="zk-date" style={{ gridArea: "dl" }}>Tanggal :</label>
          <div style={{ gridArea: "date" }}><DateField id="zk-date" name="date" defaultValue={head.date} required /></div>

          <span className="zk-l" style={{ gridArea: "sl" }}>Sebesar :</span>
          <output className="zk-amt" style={{ gridArea: "amt" }} aria-live="polite">{total ? `Rp${formatAmount(total)}` : ""}</output>

          <label className="zk-l" htmlFor="zk-memo" style={{ gridArea: "ml" }}>Memo :</label>
          <input id="zk-memo" name="memo" style={{ gridArea: "memo" }} value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} />
        </div>

        <h2 className="zk-sub">Alokasi Dana :</h2>
        <div className="zk-grid" role="table" aria-label="Alokasi dana">
          <div className="zk-row zk-th" role="row">
            <span role="columnheader">Kode</span><span role="columnheader">Nama Akun</span>
            <span role="columnheader" className="num">Nilai ({kind === "keluar" ? "Dr" : "Cr"})</span><span role="columnheader">Job</span>
          </div>
          {rows.map((r, i) => {
            const a = accById.get(r.accountId);
            return (
              <div key={i} role="row" className={`zk-row${i === cur ? " is-cur" : ""}`} onFocusCapture={() => setCur(i)} onClick={() => setCur(i)}>
                <button type="button" className="zk-cell" onClick={() => setPicker({ type: "akun", row: i })} aria-label={`Kode akun baris ${i + 1}`}>{a?.code ?? ""}</button>
                <button type="button" className="zk-cell zk-name" onClick={() => setPicker({ type: "akun", row: i })} aria-label={`Nama akun baris ${i + 1}`}>{a?.name ?? ""}</button>
                <input className="zk-cell num" inputMode="numeric" aria-label={`Nilai baris ${i + 1}`} value={r.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                  onBlur={(e) => { const n = parseRupiah(e.target.value); if (n) update(i, { amount: formatAmount(n) }); }} />
                <button type="button" className="zk-cell" onClick={() => setPicker({ type: "job", row: i })} aria-label={`Job baris ${i + 1}`}>{projById.get(r.projectId)?.code ?? ""}</button>
              </div>
            );
          })}
        </div>

        <div className="zk-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => { const n = rs.filter((_, j) => j !== cur); return n.length && !(n[n.length - 1].accountId || n[n.length - 1].amount) ? n : [...n, blank()]; })}>Hapus Baris</button>
          <span className="zk-total">Total <b>Rp{formatAmount(total)}</b></span>
          <Link href={`/akuntansi/kas?jenis=${kind}`} className="btn btn-ghost btn-sm">Batal</Link>
          <SubmitButton className="btn btn-ghost btn-sm" name="mode" value="draft" pendingText="Menyimpan…">Rekam Draft</SubmitButton>
          <SubmitButton className="btn btn-blue btn-sm" name="mode" value="rekam" pendingText="Merekam…">Rekam</SubmitButton>
        </div>
      </div>

      <PickerDialog
        open={picker?.type === "nama"}
        title="Data Nama"
        columns={["ID", "Nama", "Tipe"]}
        rows={contacts.map((c) => ({ id: c.id, cells: [c.code || "-", c.name, CONTACT_ZAHIR_TYPE[c.kind] ?? c.kind] }))}
        selectedId={contactId}
        onPick={(id) => pickContact(id)}
        onClose={() => setPicker(null)}
        clearLabel="Kosongkan"
        extra={
          <div className="zp-new">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama baru…" aria-label="Nama baru"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newName.trim()) addContact(); } }} />
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as ZContact["kind"])} aria-label="Tipe nama baru">
              <option value="pelanggan">Customer</option><option value="pemasok">Vendor</option><option value="karyawan">Employee</option>
            </select>
            <button type="button" className="btn btn-ghost btn-sm" disabled={adding || newName.trim().length < 2} onClick={addContact}>{adding ? "…" : "Baru"}</button>
            {addErr && <span className="text-bahaya small">{addErr}</span>}
          </div>
        }
      />
      <PickerDialog
        open={picker?.type === "proyek" || picker?.type === "job"}
        title="Data Proyek"
        columns={["ID", "Deskripsi", "Pelanggan"]}
        rows={projects.map((p) => ({ id: p.id, cells: [p.code, p.name, p.customer || "N/A"] }))}
        selectedId={picker?.type === "job" ? rows[picker.row]?.projectId : projectId}
        clearLabel="Tanpa proyek"
        onPick={(id) => { if (picker?.type === "job") update(picker.row, { projectId: id }); else setProjectId(id); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <PickerDialog
        open={picker?.type === "akun"}
        title="Daftar Akun (Perkiraan)"
        columns={["Kode", "Nama Akun"]}
        rows={accounts.map((a) => ({ id: a.id, cells: [a.code, a.name] }))}
        selectedId={picker?.type === "akun" ? rows[picker.row]?.accountId : null}
        onPick={(id) => { if (picker?.type === "akun") update(picker.row, { accountId: id }); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
    </ActionForm>
  );
}
