// Surat pesanan barang ke pemasok (eksternal) — dibuat kantor dari baris F-IB-10 Permintaan Bahan Baku & Alat.
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { deletePurchaseLetter } from "@/app/operasional/actions/purchaseLetters";
import { Ok, PageHead } from "@/components/erp/ui";
import { PurchaseLetterForm, type PurchaseLetterInitial } from "@/components/ops/purchase/PurchaseLetterForm";
import { QcActionButton } from "@/components/ops/qc/QcActionButton";
import "@/components/ops/qc/qc.css";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { tglPanjang, today } from "@/lib/erp/util";
import { canPurchaseLetters, getPurchaseLetter, listPurchaseLetters, purchaseLetterContacts, purchaseLetterSigners } from "@/lib/ops/purchaseLetters";
import { getSettings } from "@/lib/settings";
import { redirect } from "next/navigation";

export const metadata = { title: "Surat pesanan" };

const BASE = "/operasional/surat-pesanan";
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function SuratPesanan({ searchParams }: { searchParams: Promise<{ aksi?: string; id?: string; iso?: string; q?: string; ok?: string }> }) {
  const me = await requirePerm("iso", "pesanan");
  if (!canPurchaseLetters(me.roles)) redirect("/operasional");
  const sp = await searchParams;
  const db = await getDb();
  const [letters, contacts, signers] = await Promise.all([listPurchaseLetters(db), purchaseLetterContacts(db), purchaseLetterSigners(db)]);

  let editor: React.ReactNode = null;
  if (sp.aksi === "baru") {
    // Isi dari baris F-IB-10 yang dipilih (?iso=id1,id2).
    const ids = (sp.iso ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50);
    const rows = ids.length ? await db.select().from(schema.isoRecords).where(inArray(schema.isoRecords.id, ids)) : [];
    const site = await getSettings();
    const first = rows[0]?.data ?? {};
    const initial: PurchaseLetterInitial = {
      letterDate: today(), supplierName: s(first.pemasok), contactName: "", contactPhone: "", supplierAddress: "",
      items: rows.length ? rows.map((r) => ({ name: s(r.data.nama), quantity: s(r.data.jumlah), unit: s(r.data.satuan), price: s(r.data.hargaSatuan), total: "", note: s(r.data.tujuan) })) : [{ name: "", quantity: "", unit: "", price: "", total: "", note: "" }],
      showPrices: true, deliveryTo: `${site.legal_name || site.company_name}, ${site.address}`, neededBy: "", receiverName: me.name, receiverPhone: "",
      payment: "", paymentDays: "", note: "", isoKeys: rows.map((r) => `rec:${r.id}`), signerId: "", signerTitle: "",
    };
    editor = <PurchaseLetterForm initial={initial} contacts={contacts} signers={signers} back={BASE} />;
  } else if (sp.aksi === "ubah" && sp.id) {
    const l = await getPurchaseLetter(db, sp.id);
    if (l) {
      const initial: PurchaseLetterInitial = {
        id: l.id, draft: l.status === "draft", number: l.number, letterDate: l.letterDate, supplierName: l.supplierName, contactName: l.contactName ?? "", contactPhone: l.contactPhone ?? "", supplierAddress: l.supplierAddress ?? "",
        items: l.items.map((i) => ({ name: i.name, quantity: s(i.quantity), unit: i.unit ?? "", price: s(i.price), total: s(i.total), note: i.note ?? "" })),
        showPrices: l.showPrices, deliveryTo: l.deliveryTo ?? "", neededBy: l.neededBy ?? "", receiverName: l.receiverName ?? "", receiverPhone: l.receiverPhone ?? "",
        payment: l.payment ?? "", paymentDays: l.paymentDays ? String(l.paymentDays) : "", note: l.note ?? "", isoKeys: l.isoKeys, signerId: l.signerId ? String(l.signerId) : "", signerTitle: l.signerTitle ?? "",
      };
      editor = <PurchaseLetterForm initial={initial} contacts={contacts} signers={signers} back={BASE} />;
    }
  }

  const term = (sp.q ?? "").trim().toLowerCase();
  const shown = term ? letters.filter((l) => [l.number, l.supplierName, l.contactName ?? "", l.items.map((i) => i.name).join(" ")].join(" ").toLowerCase().includes(term)) : letters;

  return (
    <>
      <PageHead title="Surat pesanan barang" sub="Surat resmi ke pemasok (eksternal) dari permintaan bahan & alat F-IB-10. Buat dari tombol “Surat eksternal” di Rekap ISO → F-IB-10, atau kosong di sini.">
        <Link href={`${BASE}?aksi=baru`} className="btn btn-primary btn-sm">+ Surat pesanan</Link>
        <Link href="/operasional/rekap-iso?tab=form&form=F-IB-10" className="btn btn-ghost btn-sm">F-IB-10</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      {editor && <div style={{ marginBottom: 20 }}>{editor}</div>}
      <form className="filter-bar" method="get">
        <div className="field"><label htmlFor="pl-q">Cari nomor / pemasok / barang</label><input id="pl-q" name="q" defaultValue={sp.q ?? ""} /></div>
        <button type="submit" className="btn btn-blue btn-sm">Cari</button>
      </form>
      {!shown.length ? (
        <div className="admin-card muted">{letters.length ? "Tidak ada surat yang cocok." : "Belum ada surat pesanan."}</div>
      ) : (
        <div className="admin-table">
          <table className="compact">
            <thead><tr><th>Nomor</th><th>Tanggal</th><th>Kepada</th><th>Barang</th><th>Penanda tangan</th><th /></tr></thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id}>
                  <td>{l.status === "draft" ? <span className="badge badge-warn">Draft</span> : <b>{l.number}</b>}</td>
                  <td>{tglPanjang(l.letterDate)}</td>
                  <td>{l.supplierName || "-"}{l.contactName && <div className="small muted">U.p. {l.contactName}</div>}</td>
                  <td className="small">{l.items.map((i) => `${i.name}${i.quantity !== null ? ` ${i.quantity.toLocaleString("id-ID")} ${i.unit ?? ""}` : ""}`.trim()).join(", ")}</td>
                  <td className="small">{l.signerName ?? "-"}</td>
                  <td>
                    <div className="qc-row-actions">
                      <Link href={`/operasional/cetak/surat-pesanan/${l.id}`} target="_blank" className="btn btn-ghost btn-sm">Cetak</Link>
                      <Link href={`${BASE}?aksi=ubah&id=${l.id}`} className="btn btn-ghost btn-sm">{l.status === "draft" ? "Lanjutkan" : "Ubah"}</Link>
                      <QcActionButton className="link-btn" label="Hapus" confirmText={`Hapus surat ${l.status === "draft" ? "draft" : l.number}?`} action={deletePurchaseLetter.bind(null, l.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
