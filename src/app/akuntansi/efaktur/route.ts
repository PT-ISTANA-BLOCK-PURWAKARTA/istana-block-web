// Ekspor faktur penjualan ber-PPN ke CSV format impor e-Faktur DJP (baris FK, LT, OF).
// Nomor seri faktur pajak (NSFP) diisi manual di aplikasi e-Faktur bila kolom NOMOR_FAKTUR kosong.
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { isDate, today } from "@/lib/erp/util";

const q = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const npwpDigits = (s: string) => (s ?? "").replace(/\D/g, "").padEnd(15, "0").slice(0, 16) || "000000000000000";

export async function GET(req: Request) {
  await requireModule("keuangan");
  const url = new URL(req.url);
  const to = isDate(url.searchParams.get("to") ?? "") ? url.searchParams.get("to")! : today();
  const from = isDate(url.searchParams.get("from") ?? "") ? url.searchParams.get("from")! : `${to.slice(0, 7)}-01`;
  const db = await getDb();
  const invs = await db.all<{ id: string; number: string; date: string; subtotal: number; discount: number; ongkir: number; tax: number; name: string; npwp: string; address: string }>(sql`
    select i.id, i.number, i.date, i.subtotal, i.discount, i.ongkir, i.tax, c.name, c.npwp, c.address
      from fin_invoices i join fin_contacts c on c.id = i.contact_id where i.void = 0 and i.tax > 0 and i.date >= ${from} and i.date <= ${to} order by i.date, i.number`);
  const lines = await db.all<{ invoiceId: string; code: string | null; name: string; qty: number; price: number; amount: number }>(sql`
    select l.invoice_id invoiceId, it.code, coalesce(it.name, l.description) name, l.qty, l.price, l.amount
      from fin_invoice_lines l left join fin_items it on it.id = l.item_id where l.invoice_id in (select id from fin_invoices where void = 0 and tax > 0 and date >= ${from} and date <= ${to})`);
  const out: string[] = [
    "FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI,KODE_DOKUMEN_PENDUKUNG",
    "LT,NPWP,NAMA,JALAN,BLOK,NOMOR,RT,RW,KECAMATAN,KELURAHAN,KABUPATEN,PROPINSI,KODE_POS,NOMOR_TELEPON",
    "OF,KODE_OBJEK,NAMA,HARGA_SATUAN,JUMLAH_BARANG,HARGA_TOTAL,DISKON,DPP,PPN,TARIF_PPNBM,PPNBM",
  ];
  for (const i of invs) {
    const dpp = Number(i.subtotal) - Number(i.discount) + Number(i.ongkir);
    const d = i.date;
    out.push(["FK", "01", "0", "", Number(d.slice(5, 7)), d.slice(0, 4), `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`, npwpDigits(i.npwp), q(i.name), q(i.address || "-"), dpp, Number(i.tax), 0, "", 0, 0, 0, 0, q(i.number), ""].join(","));
    const ls = lines.filter((l) => l.invoiceId === i.id);
    const sum = ls.reduce((s, l) => s + Number(l.amount), 0) || 1;
    for (const l of ls) {
      const lineDpp = Math.round((Number(l.amount) / sum) * dpp);
      out.push(["OF", q(l.code ?? ""), q(l.name), Number(l.price), Number(l.qty), Number(l.amount), 0, lineDpp, Math.round((lineDpp * Number(i.tax)) / (dpp || 1)), 0, 0].join(","));
    }
  }
  return new Response("﻿" + out.join("\r\n") + "\r\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="efaktur-${from}-sd-${to}.csv"` },
  });
}
