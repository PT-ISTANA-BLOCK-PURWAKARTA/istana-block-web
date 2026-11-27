import "server-only";
// Data Operasional (tabel yang sama dengan istanablock.com/operasional) dibaca untuk tampilan lihat + analisa di Keuangan.
import { sql } from "drizzle-orm";
import type { DB } from "./server";

export type OpsKind = "penawaran" | "order" | "pengiriman" | "invoice" | "barang-masuk" | "rencana";
export type OpsRow = { id: string; date: string; number: string; party: string; items: string; qty: number; unit: string; value: number; status: string; extra: string[] };

export const OPS: Record<OpsKind, { title: string; sub: string; party: string; valueLabel: string | null; extra: string[]; statuses: Record<string, string> }> = {
  penawaran: { title: "Penawaran Harga", sub: "Surat penawaran ke calon pelanggan (dibuat di Operasional).", party: "Pelanggan", valueLabel: "Nilai penawaran", extra: ["Pekerjaan / lokasi", "Dibuat oleh"], statuses: { draft: "Draft", terkirim: "Terkirim", diterima: "Diterima", ditolak: "Ditolak" } },
  order: { title: "Order Penjualan (PO)", sub: "Pesanan pelanggan beserta barangnya (dibuat di Operasional / Gudang). Nilai diambil dari invoice yang terkait PO.", party: "Pelanggan", valueLabel: "Nilai (dari invoice)", extra: ["Pembayaran", "Alamat kirim"], statuses: { dikonfirmasi: "Dikonfirmasi", dikirim_sebagian: "Dikirim sebagian", terkirim: "Terkirim", batal: "Batal" } },
  pengiriman: { title: "Pengiriman Barang", sub: "Surat jalan / pengiriman per PO: sopir, armada dan status.", party: "Pelanggan", valueLabel: null, extra: ["Sopir", "Armada", "Selesai"], statuses: { dijadwalkan: "Dijadwalkan", dimuat: "Dimuat", berangkat: "Berangkat", tiba: "Tiba", terkirim: "Terkirim", batal: "Batal" } },
  invoice: { title: "Invoice Penjualan (Operasional)", sub: "Invoice/nota penjualan IB & IBN yang dibuat di Operasional (app lama).", party: "Pelanggan", valueLabel: "Nilai invoice", extra: ["Penerbit", "Dibayar", "Sisa"], statuses: { draft: "Draft", dp: "DP", lunas: "Lunas", batal: "Batal" } },
  "barang-masuk": { title: "Penerimaan Barang", sub: "Barang/bahan baku yang datang ke pabrik (dicatat satpam & gudang).", party: "Pemasok", valueLabel: null, extra: ["Kategori", "Kendaraan", "Mutu (tier)"], statuses: { diterima: "Diterima", ditolak: "Ditolak", menunggu: "Menunggu" } },
  rencana: { title: "Rencana Pesanan", sub: "Pesanan mendatang / proyek yang belum menjadi PO.", party: "Pelanggan", valueLabel: "Perkiraan nilai", extra: ["Proyek", "Dibuat oleh"], statuses: { rencana: "Rencana", aktif: "Aktif", jadi_po: "Sudah jadi PO", selesai: "Selesai", batal: "Batal" } },
};
export const isOpsKind = (s: string): s is OpsKind => s in OPS;

type JItem = { name?: string; quantity?: number; qty?: number; price?: number; unit?: string };
const parseItems = (s: string | null) => { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? (a as JItem[]) : []; } catch { return []; } };
const itemsText = (a: JItem[]) => a.map((i) => `${i.name ?? ""}${i.quantity ?? i.qty ? ` ${(i.quantity ?? i.qty)!.toLocaleString("id-ID")}${i.unit ? ` ${i.unit}` : ""}` : ""}`).join("; ");
const itemsValue = (a: JItem[]) => a.reduce((s, i) => s + Number(i.quantity ?? i.qty ?? 0) * Number(i.price ?? 0), 0);
const day = (sec: number | null) => (sec ? new Date(sec * 1000 + 7 * 3600e3).toISOString().slice(0, 10) : "");

/** Baris data operasional pada rentang tanggal (inklusif). */
export async function loadOps(db: DB, kind: OpsKind, from: string, to: string): Promise<OpsRow[]> {
  const f = Math.floor(Date.parse(`${from}T00:00:00+07:00`) / 1000), t = Math.floor(Date.parse(`${to}T24:00:00+07:00`) / 1000);
  if (kind === "penawaran") {
    const rows = await db.all<{ id: string; number: string; d: number; customer_name: string; work: string | null; location: string | null; project_name: string | null; items: string; status: string; created_by_name: string | null }>(sql`
      select id, number, quote_date d, customer_name, work, location, project_name, items, status, created_by_name from ops_quotations where quote_date >= ${f} and quote_date < ${t} order by quote_date desc`);
    return rows.map((r) => { const it = parseItems(r.items); return { id: r.id, date: day(r.d), number: r.number, party: r.customer_name, items: itemsText(it), qty: 0, unit: "", value: itemsValue(it), status: r.status, extra: [[r.work ?? r.project_name, r.location].filter(Boolean).join(" · "), r.created_by_name ?? ""] }; });
  }
  if (kind === "order") {
    const rows = await db.all<{ id: string; number: string; date: string; customer: string | null; status: string; ongkir: number; discount: number; payment_status: string | null; address: string; items: string | null; value: number; qty: number }>(sql`
      select o.id, o.number, o.date, c.name customer, o.status, o.ongkir, o.discount, o.payment_status, o.address,
             (select group_concat(l.description || ' ' || l.qty || ' ' || l.unit, '; ') from ops_order_lines l where l.order_id = o.id) items,
             (select coalesce(sum(l.qty * l.price), 0) from ops_order_lines l where l.order_id = o.id) value,
             (select coalesce(sum(l.qty), 0) from ops_order_lines l where l.order_id = o.id) qty
        from ops_orders o left join fin_contacts c on c.id = o.contact_id where o.date >= ${from} and o.date <= ${to} order by o.date desc, o.number desc`);
    // Harga tidak disimpan di baris PO (app lama) → nilai diambil dari invoice yang menyebut PO ini bila ada.
    const invs = await db.all<{ order_id: string; items: string; ppn_percent: number | null; shipments: string | null }>(sql`select order_id, items, ppn_percent, shipments from ops_sales_invoices where status <> 'batal' and (order_id is not null or shipments like '%orderId%')`);
    const invValue = new Map<string, number>();
    for (const iv of invs) {
      const v = Math.round(itemsValue(parseItems(iv.items)) * (1 + Number(iv.ppn_percent ?? 0) / 100));
      const ids = new Set<string>(iv.order_id ? [String(iv.order_id)] : []);
      try { for (const s of JSON.parse(iv.shipments || "[]") as { orderId?: number | string }[]) if (s.orderId != null) ids.add(String(s.orderId)); } catch { /* abaikan */ }
      const share = ids.size ? v / ids.size : 0;
      for (const id of ids) invValue.set(id, (invValue.get(id) ?? 0) + share);
    }
    return rows.map((r) => {
      const own = Number(r.value) + Number(r.ongkir) - Number(r.discount);
      return { id: r.id, date: r.date, number: r.number, party: r.customer ?? "-", items: r.items ?? "", qty: Number(r.qty), unit: "", value: own > 0 ? own : Math.round(invValue.get(r.id) ?? 0), status: r.status, extra: [r.payment_status ?? "-", r.address] };
    });
  }
  if (kind === "pengiriman") {
    const rows = await db.all<{ id: string; number: string; date: string; po: string | null; customer: string | null; driver: string | null; plate: string | null; status: string; delivered_at: number | null; items: string | null }>(sql`
      select d.id, d.number, d.date, o.number po, c.name customer, dr.name driver, v.plate, d.status, d.delivered_at,
             (select group_concat(l.description || ' ' || coalesce(l.loaded_qty, l.qty) || ' ' || l.unit, '; ') from ops_order_lines l where l.order_id = d.order_id) items
        from ops_deliveries d left join ops_orders o on o.id = d.order_id left join fin_contacts c on c.id = o.contact_id
        left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
       where d.date >= ${from} and d.date <= ${to} order by d.date desc, d.number desc`);
    return rows.map((r) => ({ id: r.id, date: r.date, number: `${r.number}${r.po ? ` · ${r.po}` : ""}`, party: r.customer ?? "-", items: r.items ?? "", qty: 0, unit: "", value: 0, status: r.status, extra: [r.driver ?? "-", r.plate ?? "-", r.delivered_at ? day(r.delivered_at) : ""] }));
  }
  if (kind === "invoice") {
    const rows = await db.all<{ id: string; number: string; d: number; customer_name: string; items: string; ppn_percent: number | null; status: string; paid_amount: number | null; issuer: string | null }>(sql`
      select id, number, invoice_date d, customer_name, items, ppn_percent, status, paid_amount, issuer from ops_sales_invoices where invoice_date >= ${f} and invoice_date < ${t} order by invoice_date desc, seq desc`);
    return rows.map((r) => { const it = parseItems(r.items); const base = itemsValue(it); const value = Math.round(base * (1 + Number(r.ppn_percent ?? 0) / 100)); const paid = Number(r.paid_amount ?? 0); return { id: r.id, date: day(r.d), number: r.number, party: r.customer_name, items: itemsText(it), qty: 0, unit: "", value, status: r.status, extra: [(r.issuer ?? "ib").toUpperCase(), paid ? paid.toLocaleString("id-ID") : "-", r.status === "lunas" ? "0" : Math.max(0, value - paid).toLocaleString("id-ID")] }; });
  }
  if (kind === "barang-masuk") {
    const rows = await db.all<{ id: string; d: number; item_name: string; tag: string | null; supplier: string | null; quarry: string | null; quantity: number | null; unit: string | null; status: string; category: string; vehicle_plate: string | null; tier: number | null; delivery_note_no: string | null }>(sql`
      select id, received_at d, item_name, tag, supplier, quarry, quantity, unit, status, category, vehicle_plate, tier, delivery_note_no from ops_goods_receipts where received_at >= ${f} and received_at < ${t} order by received_at desc`);
    return rows.map((r) => ({ id: r.id, date: day(r.d), number: r.delivery_note_no || `BM-${r.id}`, party: r.supplier || r.quarry || "-", items: [r.item_name, r.tag].filter(Boolean).join(" · "), qty: Number(r.quantity ?? 0), unit: r.unit ?? "", value: 0, status: r.status, extra: [r.category.replace(/_/g, " "), r.vehicle_plate ?? "-", r.tier ? `Tier ${r.tier}` : "-"] }));
  }
  const rows = await db.all<{ id: string; customer_name: string; project: string | null; expected_date: number; items: string; status: string; created_by_name: string | null }>(sql`
    select id, customer_name, project, expected_date, items, status, created_by_name from ops_planned_orders where expected_date >= ${f} and expected_date < ${t} order by expected_date`);
  return rows.map((r) => { const it = parseItems(r.items); return { id: r.id, date: day(Number(r.expected_date)), number: r.project && /^SO\d/.test(r.project) ? r.project : `RP-${r.id.slice(0, 6)}`, party: r.customer_name, items: itemsText(it), qty: 0, unit: "", value: itemsValue(it), status: r.status, extra: [r.project ?? "-", r.created_by_name ?? "-"] }; });
}
