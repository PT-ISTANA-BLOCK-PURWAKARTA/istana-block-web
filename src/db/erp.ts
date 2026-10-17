/**
 * Skema modul /keuangan (pembukuan berpasangan ala Zahir) dan /operasional (PO & pengiriman).
 *
 * Konvensi:
 * - ID teks (UUID) supaya satu dokumen beserta baris & jurnalnya bisa disimpan dalam satu batch D1 (atomik).
 * - Uang: bilangan bulat rupiah. Kuantitas: real (m², m³, pcs).
 * - Tanggal transaksi: teks "YYYY-MM-DD" (tanggal bisnis WIB), bukan timestamp.
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const created = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
};
const createdBy = () => integer("created_by");

/* ---------------------------------------------------------------- Akun (bagan akun) */

export const accountGroups = [
  "kas_bank",
  "piutang",
  "persediaan",
  "aset_lancar_lain",
  "aset_tetap",
  "akum_penyusutan",
  "hutang_usaha",
  "hutang_lain",
  "modal",
  "pendapatan",
  "hpp",
  "beban",
  "pendapatan_lain",
  "beban_lain",
] as const;
export type AccountGroup = (typeof accountGroups)[number];

export const accounts = sqliteTable(
  "fin_accounts",
  {
    id: id(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    group: text("grp").$type<AccountGroup>().notNull(),
    /** Penanda akun bawaan yang dipakai jurnal otomatis (mis. "piutang", "ppn_keluaran"). */
    systemKey: text("system_key"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    note: text("note").notNull().default(""),
    ...created,
  },
  (t) => [uniqueIndex("fin_accounts_code_uq").on(t.code), uniqueIndex("fin_accounts_system_uq").on(t.systemKey)],
);

/* ---------------------------------------------------------------- Kontak & barang */

export const contactKinds = ["pelanggan", "pemasok", "keduanya"] as const;
export type ContactKind = (typeof contactKinds)[number];

export const contacts = sqliteTable(
  "fin_contacts",
  {
    id: id(),
    kind: text("kind").$type<ContactKind>().notNull().default("pelanggan"),
    name: text("name").notNull(),
    company: text("company").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    address: text("address").notNull().default(""),
    npwp: text("npwp").notNull().default(""),
    /** Termin bayar default (hari). */
    termDays: integer("term_days").notNull().default(0),
    note: text("note").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...created,
  },
  (t) => [index("fin_contacts_name_idx").on(t.name)],
);

export const itemKinds = ["barang_jadi", "bahan_baku", "jasa", "lainnya"] as const;
export type ItemKind = (typeof itemKinds)[number];

export const items = sqliteTable(
  "fin_items",
  {
    id: id(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: text("kind").$type<ItemKind>().notNull().default("barang_jadi"),
    unit: text("unit").notNull().default("pcs"),
    sellPrice: integer("sell_price").notNull().default(0),
    /** Harga beli terakhir/standar, dipakai sebagai default di faktur pembelian. */
    buyPrice: integer("buy_price").notNull().default(0),
    trackStock: integer("track_stock", { mode: "boolean" }).notNull().default(true),
    minStock: real("min_stock").notNull().default(0),
    /** Opsional: produk di website yang terkait. */
    productId: integer("product_id"),
    /** Opsional: akun pendapatan khusus; kosong = otomatis dari jenis barang. */
    revenueAccountId: text("revenue_account_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    note: text("note").notNull().default(""),
    ...created,
  },
  (t) => [uniqueIndex("fin_items_code_uq").on(t.code)],
);

/* ---------------------------------------------------------------- Jurnal */

export const journalSources = ["manual", "faktur", "penerimaan", "pembelian", "pembayaran", "kas", "pengiriman", "produksi", "penyesuaian"] as const;
export type JournalSource = (typeof journalSources)[number];

export const journals = sqliteTable(
  "fin_journals",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    memo: text("memo").notNull().default(""),
    source: text("source").$type<JournalSource>().notNull().default("manual"),
    sourceId: text("source_id"),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [index("fin_journals_date_idx").on(t.date), index("fin_journals_source_idx").on(t.source, t.sourceId)],
);

export const journalLines = sqliteTable(
  "fin_journal_lines",
  {
    id: id(),
    journalId: text("journal_id").notNull(),
    date: text("date").notNull(),
    accountId: text("account_id").notNull(),
    debit: integer("debit").notNull().default(0),
    credit: integer("credit").notNull().default(0),
    memo: text("memo").notNull().default(""),
    contactId: text("contact_id"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("fin_jl_journal_idx").on(t.journalId), index("fin_jl_account_idx").on(t.accountId, t.date)],
);

/* ---------------------------------------------------------------- Operasional: armada, sopir, pesanan, pengiriman */

export const vehicles = sqliteTable(
  "ops_vehicles",
  {
    id: id(),
    plate: text("plate").notNull(),
    name: text("name").notNull().default(""),
    capacity: text("capacity").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    note: text("note").notNull().default(""),
    /** ID perangkat GPS di truk (IMEI atau ID yang dikirim perangkat/gateway). */
    gpsDeviceId: text("gps_device_id"),
    ...created,
  },
  (t) => [uniqueIndex("ops_vehicles_gps_device").on(t.gpsDeviceId)],
);

export const positionSources = ["gps", "hp"] as const;
export type PositionSource = (typeof positionSources)[number];

/** Riwayat posisi truk: dari perangkat GPS atau HP sopir selama mengantar. */
export const positions = sqliteTable(
  "ops_positions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vehicleId: text("vehicle_id").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    /** km/jam */
    speed: real("speed"),
    heading: real("heading"),
    accuracy: real("accuracy"),
    /** Waktu posisi direkam (unix detik). */
    at: integer("at").notNull(),
    receivedAt: integer("received_at").notNull(),
    source: text("source", { enum: positionSources }).notNull().default("gps"),
    /** Pengguna (sopir) yang mengirim dari HP. */
    userId: integer("user_id"),
  },
  (t) => [index("ops_positions_vehicle_at").on(t.vehicleId, t.at)],
);

export const drivers = sqliteTable("ops_drivers", {
  id: id(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  note: text("note").notNull().default(""),
  ...created,
});

export const orderStatuses = ["draft", "dikonfirmasi", "dikirim_sebagian", "terkirim", "selesai", "batal"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const orders = sqliteTable(
  "ops_orders",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    contactId: text("contact_id").notNull(),
    /** Nomor PO dari pelanggan (bila ada). */
    customerRef: text("customer_ref").notNull().default(""),
    project: text("project").notNull().default(""),
    address: text("address").notNull().default(""),
    mapsUrl: text("maps_url").notNull().default(""),
    siteContact: text("site_contact").notNull().default(""),
    requestedDate: text("requested_date"),
    status: text("status").$type<OrderStatus>().notNull().default("dikonfirmasi"),
    ongkir: integer("ongkir").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    taxable: integer("taxable", { mode: "boolean" }).notNull().default(false),
    note: text("note").notNull().default(""),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("ops_orders_number_uq").on(t.number), index("ops_orders_status_idx").on(t.status, t.date)],
);

export const orderLines = sqliteTable(
  "ops_order_lines",
  {
    id: id(),
    orderId: text("order_id").notNull(),
    itemId: text("item_id").notNull(),
    description: text("description").notNull().default(""),
    qty: real("qty").notNull(),
    unit: text("unit").notNull().default(""),
    price: integer("price").notNull().default(0),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("ops_ol_order_idx").on(t.orderId)],
);

export const deliveryStatuses = ["dijadwalkan", "berangkat", "terkirim", "batal"] as const;
export type DeliveryStatus = (typeof deliveryStatuses)[number];

export const deliveries = sqliteTable(
  "ops_deliveries",
  {
    id: id(),
    number: text("number").notNull(),
    orderId: text("order_id").notNull(),
    date: text("date").notNull(),
    vehicleId: text("vehicle_id"),
    driverId: text("driver_id"),
    status: text("status").$type<DeliveryStatus>().notNull().default("dijadwalkan"),
    departedAt: integer("departed_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    receivedBy: text("received_by").notNull().default(""),
    proofKey: text("proof_key"),
    note: text("note").notNull().default(""),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("ops_deliveries_number_uq").on(t.number), index("ops_deliveries_date_idx").on(t.date, t.status), index("ops_deliveries_order_idx").on(t.orderId)],
);

export const deliveryLines = sqliteTable(
  "ops_delivery_lines",
  {
    id: id(),
    deliveryId: text("delivery_id").notNull(),
    orderLineId: text("order_line_id").notNull(),
    itemId: text("item_id").notNull(),
    qty: real("qty").notNull(),
  },
  (t) => [index("ops_dl_delivery_idx").on(t.deliveryId), index("ops_dl_orderline_idx").on(t.orderLineId)],
);

/* ---------------------------------------------------------------- Persediaan */

export const stockSources = ["pengiriman", "produksi", "pembelian", "penyesuaian", "saldo_awal"] as const;
export type StockSource = (typeof stockSources)[number];

export const stockMoves = sqliteTable(
  "inv_stock_moves",
  {
    id: id(),
    itemId: text("item_id").notNull(),
    date: text("date").notNull(),
    /** Positif = masuk, negatif = keluar. */
    qty: real("qty").notNull(),
    /** Nilai rupiah pergerakan (bertanda sama dengan qty), dasar harga pokok rata-rata. */
    value: integer("value").notNull().default(0),
    source: text("source").$type<StockSource>().notNull(),
    sourceId: text("source_id"),
    note: text("note").notNull().default(""),
    ...created,
  },
  (t) => [index("inv_sm_item_idx").on(t.itemId, t.date), index("inv_sm_source_idx").on(t.source, t.sourceId)],
);

export const productions = sqliteTable("inv_productions", {
  id: id(),
  number: text("number").notNull(),
  date: text("date").notNull(),
  /** Upah/overhead produksi yang dibebankan ke nilai barang jadi. */
  laborCost: integer("labor_cost").notNull().default(0),
  note: text("note").notNull().default(""),
  createdBy: createdBy(),
  ...created,
});

export const productionLines = sqliteTable(
  "inv_production_lines",
  {
    id: id(),
    productionId: text("production_id").notNull(),
    /** "hasil" = barang jadi yang dihasilkan, "bahan" = bahan baku terpakai. */
    role: text("role").$type<"hasil" | "bahan">().notNull(),
    itemId: text("item_id").notNull(),
    qty: real("qty").notNull(),
  },
  (t) => [index("inv_pl_prod_idx").on(t.productionId)],
);

export const adjustments = sqliteTable("inv_adjustments", {
  id: id(),
  number: text("number").notNull(),
  date: text("date").notNull(),
  itemId: text("item_id").notNull(),
  qty: real("qty").notNull(),
  /** Nilai per satuan untuk penambahan; pengurangan memakai harga pokok rata-rata. */
  unitCost: integer("unit_cost").notNull().default(0),
  reason: text("reason").notNull().default(""),
  createdBy: createdBy(),
  ...created,
});

/* ---------------------------------------------------------------- Penjualan */

export const invoices = sqliteTable(
  "fin_invoices",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    dueDate: text("due_date").notNull(),
    contactId: text("contact_id").notNull(),
    orderId: text("order_id"),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    ongkir: integer("ongkir").notNull().default(0),
    taxable: integer("taxable", { mode: "boolean" }).notNull().default(false),
    taxRate: real("tax_rate").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull().default(0),
    /** Disimpan ulang setiap ada penerimaan, untuk daftar & status cepat. */
    paid: integer("paid").notNull().default(0),
    note: text("note").notNull().default(""),
    void: integer("void", { mode: "boolean" }).notNull().default(false),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("fin_invoices_number_uq").on(t.number), index("fin_invoices_contact_idx").on(t.contactId, t.date), index("fin_invoices_order_idx").on(t.orderId)],
);

export const invoiceLines = sqliteTable(
  "fin_invoice_lines",
  {
    id: id(),
    invoiceId: text("invoice_id").notNull(),
    itemId: text("item_id"),
    orderLineId: text("order_line_id"),
    accountId: text("account_id").notNull(),
    description: text("description").notNull().default(""),
    qty: real("qty").notNull(),
    unit: text("unit").notNull().default(""),
    price: integer("price").notNull().default(0),
    amount: integer("amount").notNull().default(0),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("fin_il_invoice_idx").on(t.invoiceId), index("fin_il_orderline_idx").on(t.orderLineId)],
);

export const receipts = sqliteTable(
  "fin_receipts",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    contactId: text("contact_id").notNull(),
    /** Akun kas/bank penerima, atau akun uang muka pelanggan saat memakai deposit. */
    accountId: text("account_id").notNull(),
    amount: integer("amount").notNull(),
    memo: text("memo").notNull().default(""),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("fin_receipts_number_uq").on(t.number), index("fin_receipts_contact_idx").on(t.contactId)],
);

export const receiptAllocations = sqliteTable(
  "fin_receipt_allocations",
  {
    id: id(),
    receiptId: text("receipt_id").notNull(),
    invoiceId: text("invoice_id").notNull(),
    amount: integer("amount").notNull(),
  },
  (t) => [index("fin_ra_receipt_idx").on(t.receiptId), index("fin_ra_invoice_idx").on(t.invoiceId)],
);

/* ---------------------------------------------------------------- Pembelian */

export const bills = sqliteTable(
  "fin_bills",
  {
    id: id(),
    number: text("number").notNull(),
    supplierRef: text("supplier_ref").notNull().default(""),
    date: text("date").notNull(),
    dueDate: text("due_date").notNull(),
    contactId: text("contact_id").notNull(),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    taxable: integer("taxable", { mode: "boolean" }).notNull().default(false),
    taxRate: real("tax_rate").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull().default(0),
    paid: integer("paid").notNull().default(0),
    note: text("note").notNull().default(""),
    void: integer("void", { mode: "boolean" }).notNull().default(false),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("fin_bills_number_uq").on(t.number), index("fin_bills_contact_idx").on(t.contactId, t.date)],
);

export const billLines = sqliteTable(
  "fin_bill_lines",
  {
    id: id(),
    billId: text("bill_id").notNull(),
    itemId: text("item_id"),
    accountId: text("account_id").notNull(),
    description: text("description").notNull().default(""),
    qty: real("qty").notNull(),
    unit: text("unit").notNull().default(""),
    price: integer("price").notNull().default(0),
    amount: integer("amount").notNull().default(0),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("fin_bl_bill_idx").on(t.billId)],
);

export const payments = sqliteTable(
  "fin_payments",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    contactId: text("contact_id").notNull(),
    accountId: text("account_id").notNull(),
    amount: integer("amount").notNull(),
    memo: text("memo").notNull().default(""),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("fin_payments_number_uq").on(t.number), index("fin_payments_contact_idx").on(t.contactId)],
);

export const paymentAllocations = sqliteTable(
  "fin_payment_allocations",
  {
    id: id(),
    paymentId: text("payment_id").notNull(),
    billId: text("bill_id").notNull(),
    amount: integer("amount").notNull(),
  },
  (t) => [index("fin_pa_payment_idx").on(t.paymentId), index("fin_pa_bill_idx").on(t.billId)],
);

/* ---------------------------------------------------------------- Kas & bank */

export const cashKinds = ["masuk", "keluar", "transfer"] as const;
export type CashKind = (typeof cashKinds)[number];

export const cashTxns = sqliteTable(
  "fin_cash_txns",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    kind: text("kind").$type<CashKind>().notNull(),
    /** Akun kas/bank yang menerima (masuk) atau mengeluarkan (keluar / sumber transfer). */
    accountId: text("account_id").notNull(),
    /** Hanya untuk transfer: akun kas/bank tujuan. */
    toAccountId: text("to_account_id"),
    contactId: text("contact_id"),
    amount: integer("amount").notNull().default(0),
    memo: text("memo").notNull().default(""),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("fin_cash_number_uq").on(t.number), index("fin_cash_date_idx").on(t.date)],
);

export const cashLines = sqliteTable(
  "fin_cash_lines",
  {
    id: id(),
    cashId: text("cash_id").notNull(),
    accountId: text("account_id").notNull(),
    amount: integer("amount").notNull(),
    memo: text("memo").notNull().default(""),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("fin_cl_cash_idx").on(t.cashId)],
);

/* ---------------------------------------------------------------- Penomoran */

export const sequences = sqliteTable("sys_sequences", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

export type Account = typeof accounts.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Journal = typeof journals.$inferSelect;
export type JournalLine = typeof journalLines.$inferSelect;
