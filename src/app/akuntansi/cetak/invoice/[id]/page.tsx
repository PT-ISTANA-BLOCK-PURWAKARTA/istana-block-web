// Cetak invoice / faktur (A4 tegak) format FAKTUR Istana Block app lama: dua halaman UTAMA (biru) + COPY (abu), cap LUNAS otomatis.
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/erp/PrintButton";
import { getDb, schema } from "@/db";
import { requireAnyModule } from "@/lib/auth";
import { imageUrl } from "@/lib/format";
import { EIB_BANK, INVOICE_NOTE, invoiceTotals, issuerOf, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak invoice", robots: { index: false } };
export const dynamic = "force-dynamic";

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
const pct = (v: number) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
const longDate = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function CetakInvoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dari?: string }> }) {
  await requireAnyModule("keuangan", "operasional", "anak");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
  if (!inv) notFound();
  const [site, signer] = await Promise.all([getSettings(), inv.signerId ? db.query.users.findFirst({ where: eq(schema.users.id, inv.signerId) }) : undefined]);
  const items = inv.items as unknown as InvoiceLine[];
  const t = invoiceTotals(items, inv.ppnPercent, inv.downPaymentPercent, inv.downPaymentAmount);
  const issuer = issuerOf(inv.issuer);
  const eib = inv.issuer === "eib";
  const cars = eib && items.some((i) => i.plateNumber || i.driverName);
  const bankName = eib ? EIB_BANK.name : inv.bankName, bankAccount = eib ? EIB_BANK.account : inv.bankAccount;
  const sig = imageUrl(signer?.signatureKey);
  const totals: [string, number][] = [["Total", t.total], ...(inv.ppnPercent ? [[`PPN ${pct(inv.ppnPercent)}`, t.ppn] as [string, number]] : []), ["Grand Total", t.grandTotal],
    ...(t.downPayment !== null ? [[inv.downPaymentAmount || !inv.downPaymentPercent ? "Uang Muka" : `Uang Muka ${pct(inv.downPaymentPercent)}`, t.downPayment] as [string, number], ["Sisa", t.remaining ?? 0] as [string, number]] : [])];
  const back = sp.dari === "ops" ? "/operasional/faktur-jual" : `/akuntansi/dokumen/invoice/${inv.id}`;
  const company = inv.issuer === "ibn" ? "CV. ISTANA BANGUN NUSANTARA" : eib ? "EKSPEDISI IB" : site.legal_name || site.company_name || "PT. Istana Block Purwakarta";
  const page = (label: string, copy: boolean) => (
    <article key={label} className={`print-page inv-page${copy ? " inv-copy" : ""}`}>
      {inv.issuer !== "polos" && (
        <header className="print-head">
          <div className="print-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {inv.issuer === "ib" && <img src="/brand/logo-istana-block.webp" alt="" width={147} height={44} />}
            <div><b>{company}</b>{site.address && <div>Office : {site.address}</div>}{(site.phone_office || site.phone) && <div>Phone : {[site.phone_office, site.phone || site.whatsapp].filter(Boolean).join(" · ")}</div>}</div>
          </div>
        </header>
      )}
      <div className="ihead">
        <table className="imeta"><tbody>
          <tr><td className="k">No Faktur</td><td>:</td><td><b>{inv.number}</b></td></tr>
          {inv.poNumber && <tr><td className="k">No PO</td><td>:</td><td>{inv.poNumber}</td></tr>}
          {inv.driverName && <tr><td className="k">Sopir</td><td>:</td><td>{inv.driverName}</td></tr>}
          {inv.plate && <tr><td className="k">No Polisi</td><td>:</td><td>{inv.plate}</td></tr>}
          {inv.route && <tr><td className="k">Rute</td><td>:</td><td>{inv.route}</td></tr>}
        </tbody></table>
        <div className="ibox">
          <div className="ititle">FAKTUR : {label}</div>
          <table className="imeta"><tbody>
            <tr><td className="k">Tanggal</td><td>:</td><td>{longDate(inv.invoiceDate)}</td></tr>
            <tr><td className="k">Kepada</td><td>:</td><td>{inv.customerName}</td></tr>
            {inv.customerAddress && <tr><td className="k">Alamat</td><td>:</td><td className="pre">{inv.customerAddress}</td></tr>}
            {inv.customerPhone && <tr><td className="k">No Tlp</td><td>:</td><td>{inv.customerPhone}</td></tr>}
          </tbody></table>
        </div>
      </div>
      <table className="iitems">
        <thead><tr><th style={{ width: 70 }}>Banyaknya</th><th style={{ width: 60 }}>Satuan</th>{cars && <th style={{ width: 130 }}>Mobil / Sopir</th>}<th>{eib ? "Uraian Jasa" : "Nama Barang"}</th><th style={{ width: 120 }}>Harga Satuan (Rp)</th><th style={{ width: 130 }}>Jumlah (Rp)</th></tr></thead>
        <tbody>
          {items.map((it, i) => <tr key={i}><td className="c">{Number(it.quantity).toLocaleString("id-ID")}</td><td className="c">{it.unit}</td>{cars && <td>{[it.plateNumber, it.driverName].filter(Boolean).join(" · ")}</td>}<td>{it.name}</td><td className="r">{rp(it.price)}</td><td className="r">{rp(it.quantity * it.price)}</td></tr>)}
          {Array.from({ length: Math.max(0, 3 - items.length) }, (_, i) => <tr key={`e${i}`} className="empty"><td /><td />{cars && <td />}<td /><td /><td /></tr>)}
        </tbody>
      </table>
      <div className="ifoot">
        <div>
          <p className="inote">CATATAN :</p>
          {inv.note && <p className="itext pre">{inv.note}</p>}
          {!eib && <div className="iframe"><b>PERHATIAN</b><br /><i>{INVOICE_NOTE}</i></div>}
          {bankAccount && <div className="iframe"><b>VIA TRANSFER</b><br /><i>{(bankName ?? "").replace(/^BCA\s+A\/N\s+/i, "")}</i><br /><b>{bankName?.match(/^\S+/)?.[0] ?? ""} No. {bankAccount}</b></div>}
        </div>
        <div className="itotalwrap">
          {inv.status === "lunas" && <div className="istamp"><b>LUNAS</b>{inv.paidAt && <small>{inv.paidAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jakarta" })}</small>}</div>}
          <table className="itotal"><tbody>{totals.map(([l, v]) => <tr key={l} className={l === "Grand Total" || l === "Sisa" ? "strong" : ""}><td>{l}</td><td className="r">{rp(v)}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div className="qsigns">
        <div><div className="sign-title">Tanda Terima</div><div className="sign-img" /><div>(Nama Jelas)</div></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div><div className="sign-title">Hormat Kami,</div><div className="sign-img">{sig && <img src={sig} alt="" />}</div><div className="sign-name">{inv.signerName || ""}</div></div>
      </div>
      {inv.issuer === "ib" && <p className="iiso">ISO 9001:2015</p>}
    </article>
  );
  return (
    <div className="print-wrap">
      <div className="print-tools no-print"><a href={back} className="btn btn-ghost btn-sm">← Kembali</a><PrintButton label="Cetak / simpan PDF" /></div>
      {page("UTAMA", false)}
      {page("COPY", true)}
      <p className="no-print small muted" style={{ textAlign: "center" }}>{issuer.label} · halaman 1 untuk pelanggan, halaman 2 arsip kantor.</p>
    </div>
  );
}
