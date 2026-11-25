// Cetak surat pesanan barang ke pemasok (A4 tegak, kop perusahaan) — versi resmi eksternal dari F-IB-10.
import { notFound, redirect } from "next/navigation";
import { PrintDoc } from "@/components/erp/PrintDoc";
import { SignBlock } from "@/components/ops/qc/SignBlock";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { tglPanjang } from "@/lib/erp/util";
import { canPurchaseLetters, getPurchaseLetter } from "@/lib/ops/purchaseLetters";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak surat pesanan", robots: { index: false } };

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const qty = (n: number | null) => (n === null ? "-" : n.toLocaleString("id-ID", { maximumFractionDigits: 2 }));
const dayLong = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : d);

export default async function CetakSuratPesanan({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("iso", "pesanan");
  if (!canPurchaseLetters(me.roles)) redirect("/operasional");
  const { id } = await params;
  const db = await getDb();
  const [l, site] = await Promise.all([getPurchaseLetter(db, id), getSettings()]);
  if (!l) notFound();
  const draft = l.status === "draft";
  const lineTotal = (i: (typeof l.items)[number]) => i.total ?? (i.price !== null && i.quantity !== null ? i.price * i.quantity : null);
  const prices = l.showPrices && l.items.some((i) => i.price || i.total);
  const unitPrices = prices && l.items.some((i) => i.price);
  const total = l.items.reduce((s, i) => s + (lineTotal(i) ?? 0), 0);
  const receiver = [l.receiverName, l.receiverPhone].filter(Boolean).join(" · ");
  const pay = [l.paymentDays ? `Tempo ${l.paymentDays} hari setelah barang diterima` : null, l.payment].filter(Boolean).join(" · ");
  const meta: [string, string | null | undefined][] = [["Dikirim ke", l.deliveryTo], ["Dibutuhkan tanggal", dayLong(l.neededBy)], ["Penerima barang", receiver || null], ["Pembayaran", pay || null]];
  return (
    <PrintDoc site={site} title="SURAT PESANAN BARANG" subtitle={draft ? "DRAFT — belum bernomor resmi" : l.number} back="/operasional/surat-pesanan">
      <section className="print-meta">
        <div>
          <span className="pm-label">Kepada Yth.</span>
          <b>{l.supplierName}</b>
          {l.contactName ? <div>U.p. {l.contactName}{l.contactPhone ? ` (${l.contactPhone})` : ""}</div> : l.contactPhone ? <div>Telp/WA {l.contactPhone}</div> : null}
          {l.supplierAddress && <div>{l.supplierAddress}</div>}
          <div>di tempat</div>
        </div>
        <dl>
          <dt>Nomor</dt><dd>{draft ? "(draft)" : l.number}</dd>
          <dt>Lampiran</dt><dd>-</dd>
          <dt>Perihal</dt><dd>Surat Pesanan Barang</dd>
          <dt>Tanggal</dt><dd>Purwakarta, {tglPanjang(l.letterDate)}</dd>
        </dl>
      </section>
      <p>Dengan hormat,</p>
      <p>Bersama surat ini, {site.legal_name || site.company_name} bermaksud memesan barang dengan rincian sebagai berikut:</p>
      <table className="print-lines">
        <thead>
          <tr><th style={{ width: 28 }}>No</th><th>Nama barang / alat</th><th style={{ width: 70 }}>Jumlah</th><th style={{ width: 64 }}>Satuan</th>{unitPrices && <th style={{ width: 110 }}>Harga satuan</th>}{prices && <th style={{ width: 120 }}>Total harga</th>}<th>Keterangan</th></tr>
        </thead>
        <tbody>
          {l.items.map((i, n) => (
            <tr key={n}>
              <td className="num">{n + 1}</td><td><b>{i.name}</b></td><td className="num">{qty(i.quantity)}</td><td>{i.unit ?? ""}</td>
              {unitPrices && <td className="num">{i.price ? rupiah(i.price) : "-"}</td>}
              {prices && <td className="num"><b>{lineTotal(i) ? rupiah(lineTotal(i)!) : "-"}</b></td>}
              <td>{i.note ?? ""}</td>
            </tr>
          ))}
          {prices && total > 0 && (
            <tr><td /><td colSpan={unitPrices ? 4 : 3} className="num"><b>TOTAL</b></td><td className="num"><b>{rupiah(total)}</b></td><td /></tr>
          )}
        </tbody>
      </table>
      <section className="print-meta" style={{ marginTop: 8 }}>
        <dl>
          {meta.filter(([, v]) => v).map(([k, v]) => [<dt key={k + "t"}>{k}</dt>, <dd key={k + "d"}>{v}</dd>])}
        </dl>
      </section>
      {l.note && (
        <>
          <p><b>Catatan:</b></p>
          <ul>{l.note.split(/\n+/).filter(Boolean).map((line, n) => <li key={n}>{line}</li>)}</ul>
        </>
      )}
      <p style={{ textAlign: "justify" }}>
        Mohon konfirmasi ketersediaan barang{prices ? "" : ", harga,"} dan jadwal pengiriman kepada penerima barang di atas. Pengiriman harap disertai surat jalan / nota dengan mencantumkan nomor surat pesanan ini. Atas perhatian dan kerja samanya kami ucapkan terima kasih.
      </p>
      <div className="print-sign" style={{ ["--sign-cols" as string]: 2 }}>
        <div>
          <SignBlock label={`Hormat kami, ${(site.legal_name || site.company_name).toUpperCase()}`} name={l.signerName} at={l.updatedAt} imageKey={l.signerSignatureKey} />
          <div className="small">{l.signerTitle ?? ""}</div>
        </div>
        <div>
          <SignBlock label={`Diterima / disetujui, ${l.supplierName}`} name={null} />
          <div className="small">{l.contactName ?? ""}</div>
        </div>
      </div>
    </PrintDoc>
  );
}
