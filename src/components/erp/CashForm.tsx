"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { saveCash } from "@/app/akuntansi/actions/ledger";
import { CashEditor, type CRow } from "./CashEditor";
import type { PickAccount } from "./LinesEditor";
import { DateField, Select } from "@/components/ui";
import { ZahirWindow } from "./ZahirWindow";

export function CashForm({
  kind,
  head,
  lines,
  cashAccounts,
  otherAccounts,
  contacts,
}: {
  kind: "masuk" | "keluar" | "transfer";
  head: { id?: string; number?: string; date: string; accountId?: string; toAccountId?: string | null; contactId?: string | null; amount?: number; memo?: string };
  lines: CRow[];
  cashAccounts: PickAccount[];
  otherAccounts: PickAccount[];
  contacts: { id: string; name: string }[];
}) {
  const cashOptions = cashAccounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  return (
    <ActionForm action={saveCash}>
      <ZahirWindow
        title={kind === "masuk" ? "Kas Masuk" : kind === "keluar" ? "Kas Keluar" : "Transfer Kas"}
        icon={kind === "masuk" ? "receive" : kind === "keluar" ? "pay" : "adjust"}
        number={head.number}
        newHref={`/akuntansi/kas/baru?jenis=${kind}`}
        closeHref={head.id ? `/akuntansi/kas/${head.id}` : "/akuntansi/kas"}
        printHref={head.id ? `/akuntansi/kas/${head.id}` : null}
        status={head.id ? "Jurnal transaksi ini dibuat ulang saat disimpan." : "Nomor bukti dibuat otomatis saat disimpan."}
      >
      {head.id && <input type="hidden" name="id" value={head.id} />}
      <input type="hidden" name="kind" value={kind} />
      <section className="zw-head">
        <div className="zw-fields">
          <div className="field"><label htmlFor="cs-date">Tanggal</label><DateField id="cs-date" name="date" defaultValue={head.date} required /></div>
          <div className="field">
            <label htmlFor="cs-acc">{kind === "masuk" ? "Kas/Bank Penerima" : kind === "keluar" ? "Kas/Bank Pembayar" : "Dari Kas/Bank"}</label>
            <Select id="cs-acc" name="accountId" defaultValue={head.accountId ?? cashAccounts[0]?.id} required options={cashOptions} />
          </div>
          {kind === "transfer" ? (
            <>
              <div className="field">
                <label htmlFor="cs-to">Ke Kas/Bank</label>
                <Select id="cs-to" name="toAccountId" defaultValue={head.toAccountId ?? cashAccounts[1]?.id} required options={cashOptions} />
              </div>
              <div className="field"><label htmlFor="cs-amt">Jumlah</label><input id="cs-amt" name="amount" className="num" inputMode="numeric" defaultValue={head.amount || ""} required /></div>
            </>
          ) : (
            <div className="field span-2">
              <label htmlFor="cs-contact">Nama Alamat <span className="help">opsional</span></label>
              <Select id="cs-contact" name="contactId" defaultValue={head.contactId ?? ""} searchable placeholder="Tidak ada / umum" options={[{ value: "", label: "Tidak ada / umum" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
          )}
          <div className="field span-4"><label htmlFor="cs-memo">Keterangan</label><input id="cs-memo" name="memo" defaultValue={head.memo} placeholder={kind === "keluar" ? "mis. BBM truk B 9xxx, uang jalan sopir" : kind === "masuk" ? "mis. setoran modal, bunga bank" : "mis. setor tunai ke bank"} /></div>
        </div>
      </section>
      {kind !== "transfer" && (
        <section className="zw-grid">
          <CashEditor accounts={otherAccounts} initial={lines} kind={kind} />
        </section>
      )}
      </ZahirWindow>
    </ActionForm>
  );
}
