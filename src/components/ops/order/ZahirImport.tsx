"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkInvoices, importFromInvoice } from "@/app/operasional/actions/orders";
import { DateField, Select } from "@/components/ui";
import { formatAmount, formatQty, tgl } from "@/lib/erp/util";
import {
  addressLooksLikeName,
  appUnit,
  documentLabel,
  invoiceToOrder,
  isPickup,
  matchJob,
  needsPaymentConfirmation,
  parseZahirFp3,
  paymentStatus,
  type ZahirInvoice,
} from "@/lib/ops/shared/zahirInvoice";
import { PaymentBadge } from "./PaymentBadge";

type PickItem = { id: string; name: string; unit: string; kind: string };
type Opt = { id: string; label: string };
type Veh = Opt & { plate: string };

type Draft = {
  key: string;
  fileName: string;
  invoice: ZahirInvoice;
  include: boolean;
  customerName: string;
  customerPhone: string;
  address: string;
  mapsUrl: string;
  /** Jadwal kirim: dipakai sebagai "minta dikirim" PO dan tanggal surat jalan bila sopir dipilih. */
  date: string;
  notes: string;
  driverId: string;
  vehicleId: string;
  paymentConfirmed: boolean;
  /** Barang katalog terpilih per baris dokumen ("" = tidak cocok). */
  itemIds: string[];
  result?: { number: string; id: string; deliveryNumber: string | null } | { error: string };
};

const digits = (v: string) => v.replace(/\D/g, "").replace(/^62/, "0");
const money = (v: number | null) => (v === null ? "—" : formatAmount(v));

/**
 * Impor faktur/surat jalan Zahir (.fp3) menjadi PO. File dibaca dan diurai di browser (server hanya menerima hasilnya);
 * cek anti-dobel ke server; kantor memilih sopir/armada (terisi otomatis dari kolom job surat jalan).
 * Nominal Zahir hanya tampil untuk akun keuangan dan tidak pernah disimpan.
 */
export function ZahirImport({ drivers, vehicles, items, canFinance, canShip, today }: { drivers: Opt[]; vehicles: Veh[]; items: PickItem[]; canFinance: boolean; canShip: boolean; today: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dups, setDups] = useState<Record<string, { id: string; number: string }>>({});
  const [byPhone, setByPhone] = useState<Record<string, { id: string; number: string; externalRef: string | null }[]>>({});
  const file = useRef<HTMLInputElement>(null);

  const byName = useMemo(() => new Map(items.map((i) => [i.name.trim().toLowerCase(), i.id])), [items]);
  const hasOther = items.some((i) => i.kind === "lainnya");
  const itemOptions = useMemo(() => items.map((i) => ({ value: i.id, label: i.name, hint: i.unit })), [items]);
  const driverOptions = useMemo(() => drivers.map((d) => ({ value: d.id, label: d.label })), [drivers]);
  const vehicleOptions = useMemo(() => vehicles.map((v) => ({ value: v.id, label: v.label })), [vehicles]);

  const refsKey = drafts.map((d) => d.invoice.number).join("|");
  const phonesKey = Array.from(new Set(drafts.map((d) => digits(d.customerPhone)).filter((p) => p.length >= 5))).join("|");
  useEffect(() => {
    if (!refsKey) return;
    let live = true;
    checkInvoices(refsKey.split("|"), phonesKey ? phonesKey.split("|") : []).then((r) => {
      if (!live) return;
      setDups(r.byRef);
      setByPhone(r.byPhone);
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [refsKey, phonesKey]);

  const update = (key: string, patch: Partial<Draft>) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const draftFrom = (invoice: ZahirInvoice, fileName: string, index: number): Draft => {
    const order = invoiceToOrder(invoice);
    const match = matchJob(invoice.job, drivers.map((d) => ({ id: d.id, name: d.label })), vehicles.map((v) => ({ id: v.id, plate: v.plate })));
    return {
      key: `${fileName}-${invoice.number}-${index}`,
      fileName,
      invoice,
      include: !isPickup(invoice),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      mapsUrl: "",
      date: invoice.date && invoice.date > today ? invoice.date : today,
      notes: order.notes,
      driverId: canShip && match.driverId ? String(match.driverId) : "",
      vehicleId: canShip && match.vehicleId ? String(match.vehicleId) : "",
      paymentConfirmed: false,
      itemIds: invoice.items.map((it) => byName.get(it.name.trim().toLowerCase()) ?? ""),
    };
  };

  const readFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const added: Draft[] = [];
    const problems: string[] = [];
    for (const f of Array.from(list)) {
      try {
        const invoices = parseZahirFp3(await f.text());
        if (!invoices.length) throw new Error("Tidak ada faktur atau surat jalan di file ini");
        invoices.forEach((inv, i) => {
          if (drafts.some((d) => d.invoice.number === inv.number) || added.some((d) => d.invoice.number === inv.number)) return;
          added.push(draftFrom(inv, f.name, i));
        });
      } catch (e) {
        problems.push(`${f.name}: ${e instanceof Error ? e.message : "gagal dibaca"}`);
      }
    }
    setNotice(problems.length ? problems.join(" · ") : added.length ? `${added.length} dokumen terbaca.` : "Dokumen itu sudah ada di daftar.");
    setDrafts((l) => [...l, ...added]);
    if (file.current) file.current.value = "";
  };

  const isSj = (d: Draft) => d.invoice.kind === "surat_jalan";
  const payOf = (d: Draft) => paymentStatus(invoiceToOrder(d.invoice).payment);
  const done = (d: Draft) => !!d.result && "number" in d.result;
  const blockedByPayment = (d: Draft) => !isSj(d) && needsPaymentConfirmation(payOf(d)) && !d.paymentConfirmed;
  const pending = drafts.filter((d) => d.include && !dups[d.invoice.number] && !done(d));
  const ready = pending.filter((d) => !blockedByPayment(d));
  const waitingPayment = pending.length - ready.length;

  const submit = async () => {
    for (const d of ready) {
      if (d.customerName.trim().length < 2) return setNotice(`${d.invoice.number}: isi nama pelanggan.`);
      if (d.address.trim().length < 5) return setNotice(`${d.invoice.number}: isi alamat pengiriman.`);
      if (addressLooksLikeName(d.address)) return setNotice(`${d.invoice.number}: kolom alamat masih berisi nama orang. Isi alamat pengiriman yang benar.`);
      if (!d.invoice.items.length) return setNotice(`${d.invoice.number}: tidak ada barang.`);
      const bad = d.invoice.items.findIndex((_, i) => !d.itemIds[i] && !hasOther);
      if (bad >= 0) return setNotice(`${d.invoice.number}: pilih barang untuk "${d.invoice.items[bad].name}" (belum ada di Data barang).`);
    }
    if (ready.some((d) => !d.driverId) && canShip && !window.confirm("Ada dokumen yang belum dipilih sopirnya. PO tetap dibuat dan surat jalan bisa dijadwalkan nanti. Lanjutkan?")) return;
    setSaving(true);
    setNotice(null);
    let ok = 0;
    for (const d of ready) {
      const order = invoiceToOrder(d.invoice);
      const r = await importFromInvoice({
        externalRef: d.invoice.number,
        kind: d.invoice.kind,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        address: d.address,
        mapsUrl: d.mapsUrl,
        siteContact: d.invoice.contactPerson ?? "",
        customerRef: d.invoice.poNumber ?? "",
        date: d.invoice.date,
        requestedDate: d.date,
        notes: d.notes,
        items: d.invoice.items.map((it, i) => ({ name: it.name, qty: it.quantity, unit: appUnit(it.unit), price: it.price, itemId: d.itemIds[i] ?? "" })),
        payment: order.payment,
        paymentConfirmed: d.paymentConfirmed,
        driverId: d.driverId,
        vehicleId: d.vehicleId,
        deliveryDate: d.date,
      }).catch(() => ({ error: "Gagal menghubungi server. Periksa sinyal lalu coba lagi." }));
      if ("error" in r) update(d.key, { result: { error: r.error } });
      else {
        ok += 1;
        update(d.key, { result: r });
      }
    }
    setSaving(false);
    if (ok) setNotice(`${ok} PO dibuat dari Zahir.`);
    if (refsKey) checkInvoices(refsKey.split("|"), phonesKey ? phonesKey.split("|") : []).then((r) => setDups(r.byRef)).catch(() => undefined);
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <input ref={file} type="file" accept=".fp3" multiple hidden onChange={(e) => void readFiles(e.target.files)} />
      <button
        type="button"
        onClick={() => file.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void readFiles(e.dataTransfer.files);
        }}
        className="admin-card"
        style={{ border: "2px dashed var(--p-line-strong)", textAlign: "center", padding: "26px 16px", cursor: "pointer", background: "var(--p-head)" }}
      >
        <b style={{ display: "block", color: "var(--biru-tua)" }}>Pilih atau tarik file .fp3 ke sini</b>
        <span className="small muted">Bisa beberapa file sekaligus. Di Zahir: cetak surat jalan atau faktur, lalu simpan sebagai file laporan (.fp3).</span>
      </button>
      {notice && <p className="alert alert-ok" role="status" style={{ background: "var(--info-bg)", color: "var(--biru-tua)" }}>{notice}</p>}

      {drafts.map((d) => {
        const sj = isSj(d);
        const dup = dups[d.invoice.number];
        const created = d.result && "number" in d.result ? d.result : null;
        const failed = d.result && "error" in d.result ? d.result.error : null;
        const locked = !!dup || !!created;
        const pickup = isPickup(d.invoice);
        const pay = payOf(d);
        const others = (byPhone[digits(d.customerPhone)] ?? []).filter((o) => o.externalRef !== d.invoice.number);
        return (
          <section key={d.key} className="admin-card stack" style={{ gap: 12, opacity: dup && !created ? 0.75 : 1 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "flex-start" }}>
              <label className="check" style={{ alignItems: "flex-start" }}>
                <input type="checkbox" checked={d.include && !locked} disabled={locked} onChange={(e) => update(d.key, { include: e.target.checked })} />
                <span>
                  <b>{documentLabel(d.invoice.number)}</b>
                  <span className="small muted" style={{ display: "block" }}>
                    {d.invoice.date ? tgl(d.invoice.date) : "tanggal tidak terbaca"}
                    {!sj && canFinance ? ` · ${d.invoice.terms ?? "-"} · total ${money(d.invoice.total)}` : ""} · {d.fileName}
                  </span>
                </span>
              </label>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {created ? (
                  <Link href={`/operasional/pesanan/${created.id}`} className="badge badge-on">{created.number}{created.deliveryNumber ? ` · ${created.deliveryNumber}` : ""}</Link>
                ) : dup ? (
                  <Link href={`/operasional/pesanan/${dup.id}`} className="badge badge-off">Sudah dibuat: {dup.number}</Link>
                ) : (
                  <span className={`badge ${sj ? "badge-on" : "badge-info"}`}>{sj ? "Surat jalan" : "Faktur"}</span>
                )}
                {!created && <button type="button" className="link-btn" onClick={() => setDrafts((l) => l.filter((x) => x.key !== d.key))} aria-label={`Buang ${d.invoice.number}`}>Buang</button>}
              </span>
            </div>

            {!locked && pickup && <p className="flag flag-info small">Diambil sendiri oleh pelanggan (di Zahir: {d.invoice.job.join(" / ")}). Tidak perlu tugas sopir, jadi tidak dicentang. Centang bila tetap mau dibuatkan PO.</p>}

            {!locked && !sj && (
              <div className="stack" style={{ gap: 6 }}>
                <p className={`flag ${pay === "lunas" ? "flag-info" : "flag-warn"} small`} style={{ margin: 0 }}>
                  <PaymentBadge status={pay} long />{" "}
                  {d.invoice.terms ?? ""}
                  {canFinance && d.invoice.balance !== null ? ` · saldo ${money(d.invoice.balance)}` : ""}
                  {d.invoice.dueDate ? ` · jatuh tempo ${tgl(d.invoice.dueDate)}` : ""}
                </p>
                {needsPaymentConfirmation(pay) && (
                  <label className="check">
                    <input type="checkbox" checked={d.paymentConfirmed} onChange={(e) => update(d.key, { paymentConfirmed: e.target.checked })} />
                    <span>Pembayaran sudah diterima atau sudah disetujui untuk dikirim <span className="help">Nama Anda tercatat sebagai yang menyetujui. Lebih aman: impor surat jalannya setelah pelanggan bayar.</span></span>
                  </label>
                )}
              </div>
            )}

            {!locked && others.length > 0 && (
              <p className="flag flag-warn small">
                Pelanggan ini masih punya PO aktif: {others.map((o) => `${o.number}${o.externalRef ? ` (${documentLabel(o.externalRef)})` : ""}`).join(", ")}. Pastikan bukan pengiriman yang sama (faktur dan surat jalan dari satu penjualan cukup satu PO).
              </p>
            )}

            <div className="admin-table">
              <table className="compact">
                <thead><tr><th>Dokumen Zahir</th><th className="num">Jumlah</th>{canFinance && <th className="num">Harga</th>}<th style={{ minWidth: 220 }}>Barang di PO</th></tr></thead>
                <tbody>
                  {d.invoice.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.name}</td>
                      <td className="num">{it.quantity === null ? "—" : formatQty(it.quantity)} {it.unit}</td>
                      {canFinance && <td className="num">{money(it.price)}</td>}
                      <td>
                        {locked ? (
                          <span className="small muted">{items.find((x) => x.id === d.itemIds[i])?.name ?? "Lainnya"}</span>
                        ) : (
                          <Select
                            aria-label={`Barang untuk ${it.name}`}
                            options={itemOptions}
                            value={d.itemIds[i] ?? ""}
                            onChange={(v) => update(d.key, { itemIds: d.itemIds.map((x, n) => (n === i ? v : x)) })}
                            searchable
                            placeholder={hasOther ? "Tidak cocok → dicatat sebagai Lainnya" : "Pilih barang…"}
                            menuWidth={280}
                          />
                        )}
                        {!locked && !d.itemIds[i] && <span className={`small ${hasOther ? "muted" : "text-bahaya"}`} style={{ display: "block", marginTop: 2 }}>{hasOther ? "Nama Zahir disimpan di deskripsi baris." : "Belum cocok dengan Data barang."}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!locked && (
              <>
                <div className="form-grid cols-4">
                  <div className="field span-2"><label htmlFor={`n-${d.key}`}>Nama pelanggan</label><input id={`n-${d.key}`} value={d.customerName} onChange={(e) => update(d.key, { customerName: e.target.value })} /></div>
                  <div className="field span-2"><label htmlFor={`p-${d.key}`}>Nomor WhatsApp <span className="help">untuk mencocokkan pelanggan yang sudah ada</span></label><input id={`p-${d.key}`} inputMode="tel" value={d.customerPhone} onChange={(e) => update(d.key, { customerPhone: e.target.value })} placeholder="08xxxxxxxxxx" /></div>
                  <div className="field span-3">
                    <label htmlFor={`a-${d.key}`}>Alamat pengiriman</label>
                    <textarea id={`a-${d.key}`} rows={2} value={d.address} onChange={(e) => update(d.key, { address: e.target.value })} style={{ minHeight: 64 }} aria-invalid={addressLooksLikeName(d.address)} />
                    {addressLooksLikeName(d.address) && <span className="small text-bahaya">Kolom alamat di Zahir berisi &quot;{d.invoice.address ?? "-"}&quot; (nama orang, bukan alamat). Isi alamat pengiriman yang benar.</span>}
                  </div>
                  <div className="field"><label htmlFor={`d-${d.key}`}>Jadwal kirim</label><DateField id={`d-${d.key}`} value={d.date} onChange={(v) => update(d.key, { date: v })} /></div>
                  <div className="field span-4"><label htmlFor={`m-${d.key}`}>Tautan Google Maps <span className="help">opsional</span></label><input id={`m-${d.key}`} type="url" value={d.mapsUrl} onChange={(e) => update(d.key, { mapsUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" /></div>
                  <div className="field span-4"><label htmlFor={`c-${d.key}`}>Catatan <span className="help">terlihat sopir, jangan tulis harga</span></label><input id={`c-${d.key}`} value={d.notes} onChange={(e) => update(d.key, { notes: e.target.value })} /></div>
                </div>
                {canShip && (
                  <div className="form-grid cols-4" style={{ background: "var(--oranye-muda)", borderRadius: 10, padding: 12 }}>
                    <div className="field span-2"><label htmlFor={`dr-${d.key}`}>Sopir <span className="help">kosongkan bila dijadwalkan nanti</span></label><Select id={`dr-${d.key}`} options={driverOptions} value={d.driverId} onChange={(v) => update(d.key, { driverId: v })} placeholder="Pilih sopir (atau nanti)" /></div>
                    <div className="field span-2"><label htmlFor={`vh-${d.key}`}>Armada <span className="help">opsional</span></label><Select id={`vh-${d.key}`} options={vehicleOptions} value={d.vehicleId} onChange={(v) => update(d.key, { vehicleId: v })} placeholder="Pilih kendaraan" /></div>
                    {sj && d.invoice.job.length > 0 && !pickup && <p className="small muted span-4" style={{ margin: 0 }}>Di surat jalan: {d.invoice.job.join(" / ")}{d.driverId || d.vehicleId ? " (sudah dipilih otomatis, periksa lagi)" : ""}.</p>}
                  </div>
                )}
              </>
            )}
            {failed && <p className="alert alert-error" role="alert">{failed}</p>}
          </section>
        );
      })}

      {waitingPayment > 0 && <p className="flag flag-warn small">{waitingPayment} faktur belum lunas tidak ikut dibuat sebelum konfirmasi pembayaran dicentang.</p>}
      {drafts.length > 0 && (
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={saving || !ready.length} onClick={() => void submit()}>
            {saving ? "Membuat PO…" : `Buat ${ready.length} PO${canShip && ready.some((d) => d.driverId) ? " & tugaskan sopir" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
