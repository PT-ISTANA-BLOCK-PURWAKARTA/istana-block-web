// Cetak Surat Penawaran (A4 tegak) mengikuti format surat Istana Block di app lama; TTD penanda tangan otomatis.
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PrintDoc } from "@/components/erp/PrintDoc";
import { getDb, schema } from "@/db";
import { requireAnyModule } from "@/lib/auth";
import { imageUrl } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak surat penawaran", robots: { index: false } };
export const dynamic = "force-dynamic";

type Item = { name: string; size?: string | null; note?: string | null; unit: string; price: number; quantity?: number | null };
type Term = { label: string; lines: string[] };
const rupiah = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
const longDate = (d: Date) => d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

function Meta({ rows }: { rows: [string, string | null | undefined][] }) {
  return <table className="qmeta"><tbody>{rows.filter(([, v]) => v).map(([k, v]) => <tr key={k}><td className="k">{k}</td><td>:</td><td>{v}</td></tr>)}</tbody></table>;
}

export default async function CetakPenawaran({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dari?: string }> }) {
  await requireAnyModule("keuangan", "operasional");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
  if (!q) notFound();
  const [site, signer] = await Promise.all([getSettings(), q.signerId ? db.query.users.findFirst({ where: eq(schema.users.id, q.signerId) }) : undefined]);
  const items = (q.items ?? []) as unknown as Item[];
  const terms = (q.terms ?? []) as unknown as Term[];
  const withQty = items.some((i) => i.quantity);
  const total = items.reduce((s, i) => s + (i.quantity ?? 0) * i.price, 0);
  const sig = imageUrl(signer?.signatureKey);
  const back = sp.dari === "ops" ? "/operasional/penawaran" : `/akuntansi/dokumen/penawaran/${q.id}`;
  return (
    <PrintDoc site={site} title="SURAT PENAWARAN" subtitle={q.number} back={back}>
      <div className="qhead">
        <div>
          <Meta rows={[["Nama Proyek", q.projectName], ["Alamat", q.projectCity]]} />
          <h2 className="qtitle">SURAT PENAWARAN</h2>
          <Meta rows={[["Kepada", q.customerName], ["Alamat", q.customerAddress], ...(q.attnName ? [["U.p. (PIC)", q.attnName], ["No. HP", q.attnPhone || q.customerPhone]] as [string, string | null][] : [["No. HP", q.customerPhone]] as [string, string | null][]), ["Pekerjaan", q.work], ["Lokasi", q.location]]} />
        </div>
        <div><Meta rows={[["No. Surat", q.number], ["Tanggal", longDate(q.quoteDate)], ["Nama Bank", q.bankName], ["No. Rek", q.bankAccount]]} /></div>
      </div>
      <table className="qitems">
        <thead><tr><th style={{ width: 28 }}>NO</th><th>JENIS BARANG / PEKERJAAN</th>{withQty && <th>VOLUME</th>}<th>SATUAN</th><th>HARGA</th>{withQty && <th>JUMLAH</th>}</tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="c">{i + 1}</td>
              <td><b>{it.name}</b>{it.size && <><br />Uk : {it.size}</>}{it.note && <><br /><i>{it.note}</i></>}</td>
              {withQty && <td className="r">{it.quantity ? it.quantity.toLocaleString("id-ID") : "-"}</td>}
              <td className="c">{it.unit}</td>
              <td className="r">{rupiah(it.price)}</td>
              {withQty && <td className="r">{it.quantity ? rupiah(it.quantity * it.price) : "-"}</td>}
            </tr>
          ))}
          {withQty && total > 0 && <tr className="total"><td /><td colSpan={4} className="r">TOTAL</td><td className="r">{rupiah(total)}</td></tr>}
        </tbody>
      </table>
      {terms.length > 0 && (
        <div>
          <p className="qnote">CATATAN / KETERANGAN :</p>
          <table className="qmeta qterms"><tbody>
            {terms.flatMap((t, ti) => (t.lines.length ? t.lines : [""]).map((line, i) => (
              <tr key={`${ti}-${i}`}><td className="k">{i === 0 ? t.label : ""}</td><td>{i === 0 && t.label ? ":" : ""}</td><td>{line}</td></tr>
            )))}
          </tbody></table>
        </div>
      )}
      <div className="qsigns">
        <div>
          <div className="sign-title">Hormat kami,<br />PT. ISTANA BLOCK PURWAKARTA</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="sign-img">{sig && <img src={sig} alt="" />}</div>
          <div className="sign-name">{q.signerName || "(…....................)"}</div>
          <div>{q.signerTitle ?? ""}</div>
        </div>
        <div>
          <div className="sign-title">Disetujui,<br />{q.customerName}</div>
          <div className="sign-img" />
          <div className="sign-name">{q.attnName ? `(${q.attnName})` : "(…....................)"}</div>
          <div>{q.customerSignTitle ?? "PENANGGUNG JAWAB"}</div>
        </div>
      </div>
    </PrintDoc>
  );
}
