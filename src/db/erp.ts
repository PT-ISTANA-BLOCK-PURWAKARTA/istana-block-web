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
    /** Opsional: kelompok barang jadi (productLines) untuk pengelompokan Stok barang & pilihan form produksi. */
    productionLine: text("production_line").$type<ProductLine>(),
    /** Opsional: metode (khusus buis: tumbuk|cor|tulangan). */
    method: text("method").$type<ProductionMethod>(),
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
    /** Masa berlaku STNK & KIR (YYYY-MM-DD); peringatan di Ringkasan bila sisa <= 30 hari. */
    stnkExpiry: text("stnk_expiry"),
    kirExpiry: text("kir_expiry"),
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
  /** Nomor SIM & masa berlakunya (YYYY-MM-DD); peringatan di Ringkasan bila sisa <= 30 hari. */
  licenseNo: text("license_no"),
  licenseExpiry: text("license_expiry"),
  ...created,
});

/** Status pembayaran PO yang dibaca dari faktur/surat jalan Zahir (nominal sengaja tidak disimpan agar sopir tak melihat harga). */
export const paymentStatuses = ["lunas", "belum_lunas", "tempo", "tidak_diketahui"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

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
    /** Nomor faktur/surat jalan Zahir asal impor (anti-dobel). */
    externalRef: text("external_ref"),
    paymentStatus: text("payment_status").$type<PaymentStatus>(),
    /** Pengguna (users.id) yang mengonfirmasi status bayar belum_lunas/tidak_diketahui. */
    paymentConfirmedBy: integer("payment_confirmed_by"),
    paymentConfirmedAt: integer("payment_confirmed_at", { mode: "timestamp" }),
    /** Alasan pembatalan (3-500 huruf), pengguna pembatal (users.id), dan waktunya. */
    cancelReason: text("cancel_reason"),
    cancelledBy: integer("cancelled_by"),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("ops_orders_number_uq").on(t.number), index("ops_orders_status_idx").on(t.status, t.date), index("ops_orders_external_idx").on(t.externalRef)],
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

/**
 * Urutan alur: dijadwalkan -> dimuat -> berangkat -> tiba -> terkirim (tertunda & batal di luar urutan).
 * Padanan inventori-ops: unassigned/assigned=dijadwalkan, ready=dimuat, in_transit=berangkat, arrived=tiba,
 * delayed=tertunda, delivered=terkirim, cancelled=batal.
 */
export const deliveryStatuses = ["dijadwalkan", "dimuat", "berangkat", "tiba", "tertunda", "terkirim", "batal"] as const;
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
    /** Waktu "Sudah dimuat", berangkat, tiba di tujuan, terkirim; alasan bila tertunda. */
    loadedAt: integer("loaded_at", { mode: "timestamp" }),
    departedAt: integer("departed_at", { mode: "timestamp" }),
    arrivedAt: integer("arrived_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    delayReason: text("delay_reason"),
    /** Koreksi jam tiba (Sasaran Mutu pengiriman tepat waktu): jam tiba sebenarnya; arrived_at asli tetap tersimpan. Alasan min. 10 huruf. */
    arrivalCorrectedAt: integer("arrival_corrected_at", { mode: "timestamp" }),
    arrivalCorrectedBy: integer("arrival_corrected_by"),
    arrivalCorrectionMadeAt: integer("arrival_correction_made_at", { mode: "timestamp" }),
    arrivalCorrectionReason: text("arrival_correction_reason"),
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

export const stockSources = ["pengiriman", "produksi", "pembelian", "penyesuaian", "saldo_awal", "konversi"] as const;
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

/** Kategori hasil produksi lapangan: mandor mengisi precast, QC mengisi paving, kantor keduanya. */
export const productionCategories = ["precast", "paving"] as const;
export type ProductionCategory = (typeof productionCategories)[number];

export const productions = sqliteTable(
  "inv_productions",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    /** Upah/overhead produksi yang dibebankan ke nilai barang jadi. */
    laborCost: integer("labor_cost").notNull().default(0),
    note: text("note").notNull().default(""),
    /** Kolom lapangan (F-IB-02), kosong untuk dokumen lama. */
    category: text("category").$type<ProductionCategory>(),
    /** Kode batch otomatis "<prefix>-<yymmdd WIB>-<nn>", mis. PB-261005-01. */
    batchCode: text("batch_code"),
    leader: text("leader"),
    target: real("target"),
    cementBags: real("cement_bags"),
    /** Khusus paving: jumlah papan & produk gagal (reject). */
    boards: real("boards"),
    rejects: real("rejects"),
    /** Kendala produksi dari PIC, mis. "Mesin trouble"; rincian di note. */
    issues: text("issues", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** Kunci R2 foto produksi (folder produksi/). */
    photoKey: text("photo_key"),
    /** Mutu (setara app live): quantity hasil = Grade A (menambah stok); Grade B = reject masih dijual; rejects = tidak dijual. Keduanya hanya dicatat. */
    gradeB: real("grade_b"),
    /** Khusus buis: tumbuk|cor|tulangan. */
    method: text("method").$type<ProductionMethod>(),
    /** Semen curah (kg), khusus paving. */
    cementKg: real("cement_kg"),
    /** Adukan cor bersama (inv_production_batches.id); cement_bags dokumen ini dikosongkan agar rasio tak ganda. */
    batchId: text("batch_id"),
    /** Catatan mix desain (qc_mix_logs.id) asal baris paving otomatis. */
    mixLogId: text("mix_log_id"),
    /** TTD ketidaksesuaian (Grade B/reject): Manager in charge lalu Pimpinan; gambar TTD dari users.signature_key. */
    rejectManagerBy: integer("reject_manager_by"),
    rejectManagerAt: integer("reject_manager_at", { mode: "timestamp" }),
    rejectLeaderBy: integer("reject_leader_by"),
    rejectLeaderAt: integer("reject_leader_at", { mode: "timestamp" }),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [index("inv_productions_batch_idx").on(t.batchCode), index("inv_productions_adukan_idx").on(t.batchId)],
);

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

export const adjustments = sqliteTable(
  "inv_adjustments",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    itemId: text("item_id").notNull(),
    qty: real("qty").notNull(),
    /** Nilai per satuan untuk penambahan; pengurangan memakai harga pokok rata-rata. */
    unitCost: integer("unit_cost").notNull().default(0),
    reason: text("reason").notNull().default(""),
    /** Terisi bila penyesuaian ini selisih sebuah stok opname (inv_counts.id); dikelola dari dokumen opname. */
    countId: text("count_id"),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [index("inv_adj_count_idx").on(t.countId)],
);

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

/* ================================================================================================
 * Port inventori-ops (migrasi 0005): jejak PO, pelacakan publik, notifikasi, piket, QC, barang masuk,
 * uji pasir, kalender, rekap ISO, keamanan data. Aturan: lihat keputusan K1-K9 port operasional.
 * Kunci berkas (*_key) = kunci objek R2 (binding MEDIA), disajikan privat lewat /operasional/berkas/.
 * ============================================================================================== */

export type MaterialLine = { name: string; qty: number | null; unit: string };

/* ---------------------------------------------------------------- PO & pengiriman: jejak */

/** Jejak PO yang dihapus (snapshot ringkas untuk audit). */
export const orderDeletions = sqliteTable(
  "ops_order_deletions",
  {
    id: id(),
    orderId: text("order_id").notNull(),
    number: text("number").notNull(),
    customerName: text("customer_name").notNull().default(""),
    customerPhone: text("customer_phone").notNull().default(""),
    reason: text("reason").notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    deletedBy: integer("deleted_by"),
    deletedAt: integer("deleted_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("ops_order_deletions_at_idx").on(t.deletedAt), index("ops_order_deletions_number_idx").on(t.number)],
);

/** Riwayat perubahan status surat jalan. */
export const deliveryHistory = sqliteTable(
  "ops_delivery_history",
  {
    id: id(),
    deliveryId: text("delivery_id").notNull(),
    fromStatus: text("from_status").$type<DeliveryStatus>(),
    toStatus: text("to_status").$type<DeliveryStatus>().notNull(),
    /** users.id yang mengubah, atau ops_drivers.id bila sopir sendiri. */
    changedBy: integer("changed_by"),
    changedByDriver: text("changed_by_driver"),
    note: text("note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("ops_dh_delivery_idx").on(t.deliveryId, t.createdAt)],
);

export const proofKinds = ["photo", "signature", "document"] as const;
export type ProofKind = (typeof proofKinds)[number];
/** Maksimal foto bukti per surat jalan. */
export const MAX_DELIVERY_PROOFS = 4;

/** Foto bukti pengiriman (maks 4 per surat jalan); kolom lama ops_deliveries.proof_key tetap dibaca. */
export const deliveryProofs = sqliteTable(
  "ops_delivery_proofs",
  {
    id: id(),
    deliveryId: text("delivery_id").notNull(),
    kind: text("kind").$type<ProofKind>().notNull().default("photo"),
    fileKey: text("file_key").notNull(),
    originalName: text("original_name").notNull().default(""),
    createdBy: createdBy(),
    createdByDriver: text("created_by_driver"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("ops_dp_delivery_idx").on(t.deliveryId)],
);

/** Tautan lacak publik untuk tamu (/kiriman/[token]); yang disimpan hanya SHA-256 token. */
export const trackingLinks = sqliteTable(
  "ops_tracking_links",
  {
    id: id(),
    deliveryId: text("delivery_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" }),
    createdBy: createdBy(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("ops_tl_token_uq").on(t.tokenHash), index("ops_tl_delivery_idx").on(t.deliveryId)],
);

/* ---------------------------------------------------------------- Notifikasi & push */

/** po_baru = PO baru perlu diperiksa/menunggu dimuat; dimuat = sudah dimuat; status_kirim = perubahan status SJ (refId = id SJ). */
export const notificationKinds = ["po_baru", "dimuat", "status_kirim", "umum"] as const;
export type NotificationKind = (typeof notificationKinds)[number];

/** Notifikasi dalam aplikasi untuk kantor/gudang (refId = id PO atau SJ sesuai kind). */
export const notifications = sqliteTable(
  "ops_notifications",
  {
    id: id(),
    kind: text("kind").$type<NotificationKind>().notNull(),
    refId: text("ref_id").notNull().default(""),
    title: text("title").notNull(),
    message: text("message").notNull().default(""),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("ops_notif_read_idx").on(t.readAt, t.createdAt), index("ops_notif_ref_idx").on(t.kind, t.refId)],
);

/** Langganan Web Push per perangkat. */
export const pushSubscriptions = sqliteTable(
  "ops_push_subscriptions",
  {
    id: id(),
    userId: integer("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    ...created,
  },
  (t) => [uniqueIndex("ops_push_endpoint_uq").on(t.endpoint), index("ops_push_user_idx").on(t.userId)],
);

/* ---------------------------------------------------------------- Piket & keamanan data */

/** Piket per akun (pengganti Duty Phone): endedAt kosong = sedang piket. Shift basi > 24 jam ditutup otomatis. */
export const dutyShifts = sqliteTable(
  "ops_duty_shifts",
  {
    id: id(),
    userId: integer("user_id").notNull(),
    userName: text("user_name").notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    handoverNote: text("handover_note").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("ops_ds_user_idx").on(t.userId, t.endedAt), index("ops_ds_started_idx").on(t.startedAt)],
);

/** Log aktivitas: siapa, kapan, apa (tanpa password/PIN/foto). Id integer karena volumenya tinggi. */
export const activityLogs = sqliteTable(
  "ops_activity_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: integer("at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    userId: integer("user_id"),
    userName: text("user_name"),
    role: text("role"),
    /** Pola "modul.aksi", mis. "produksi.simpan". */
    action: text("action").notNull(),
    label: text("label").notNull(),
    summary: text("summary"),
    /** Isi permintaan yang sudah disamarkan, dipotong 2000 huruf. */
    details: text("details"),
    success: integer("success", { mode: "boolean" }).notNull().default(true),
    ip: text("ip"),
    device: text("device"),
  },
  (t) => [index("ops_al_at_idx").on(t.at), index("ops_al_user_idx").on(t.userId, t.at)],
);

/** Riwayat backup. */
export const backupRuns = sqliteTable(
  "ops_backup_runs",
  {
    id: id(),
    at: integer("at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    userId: integer("user_id"),
    userName: text("user_name"),
    folder: text("folder"),
    tables: integer("tables_count").notNull().default(0),
    rows: integer("rows_count").notNull().default(0),
    photos: integer("photos_count").notNull().default(0),
    newPhotos: integer("new_photos_count").notNull().default(0),
  },
  (t) => [index("ops_br_at_idx").on(t.at)],
);

/* ---------------------------------------------------------------- QC: mix desain & uji kuat tekan */

export const mixLayers = ["badan", "kepalaan", "lainnya"] as const;
export type MixLayer = (typeof mixLayers)[number];
/** gagal = sempat dipakai tapi hasilnya gagal; masuk rekapan bersama yang ditolak. */
export const mixDesignStatuses = ["diajukan", "disetujui", "ditolak", "gagal"] as const;
export type MixDesignStatus = (typeof mixDesignStatuses)[number];
export const checkStatuses = ["sesuai", "tidak_sesuai", "perlu_perbaikan"] as const;
export type CheckStatus = (typeof checkStatuses)[number];
/** Alur ACC: menunggu -> disetujui (TTD), atau revisi (dikembalikan ke QC dengan catatan). */
export const reviewStatuses = ["menunggu", "disetujui", "revisi"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

/** Template komposisi mix desain yang diajukan QC dan disetujui kantor. */
export const mixDesigns = sqliteTable(
  "qc_mix_designs",
  {
    id: id(),
    name: text("name").notNull(),
    layer: text("layer").$type<MixLayer>().notNull(),
    product: text("product").notNull(),
    materials: text("materials", { mode: "json" }).$type<MaterialLine[]>().notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status").$type<MixDesignStatus>().notNull().default("diajukan"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: createdBy(),
    approvedBy: integer("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    reviewNote: text("review_note"),
    /** Dipindah ke rekapan (tidak dipakai lagi/gagal): alasan, oleh siapa, kapan. */
    retiredReason: text("retired_reason"),
    retiredBy: integer("retired_by"),
    retiredAt: integer("retired_at", { mode: "timestamp" }),
    ...created,
  },
  (t) => [index("qc_md_status_idx").on(t.status, t.layer)],
);

/** Catatan harian penerapan mix desain per lapisan (badan/kepalaan). */
export const mixLogs = sqliteTable(
  "qc_mix_logs",
  {
    id: id(),
    workDate: text("work_date").notNull(),
    layer: text("layer").$type<MixLayer>().notNull(),
    product: text("product").notNull(),
    mixDesignId: text("mix_design_id"),
    approvedMaterials: text("approved_materials", { mode: "json" }).$type<MaterialLine[]>().notNull(),
    actualMaterials: text("actual_materials", { mode: "json" }).$type<MaterialLine[]>().notNull(),
    mixingCount: real("mixing_count"),
    boards: real("boards"),
    squareMeters: real("square_meters"),
    rejects: real("rejects"),
    /** Grade B (reject masih bisa dijual) dan belahan Hexagon setengah (buah, dari cetakan yang sama). */
    gradeB: real("grade_b"),
    halfPieces: real("half_pieces"),
    status: text("status").$type<CheckStatus>().notNull().default("sesuai"),
    notes: text("notes").notNull().default(""),
    reviewStatus: text("review_status").$type<ReviewStatus>().notNull().default("menunggu"),
    reviewNote: text("review_note"),
    createdBy: createdBy(),
    /** TTD "Diperiksa oleh" (manajer QC) saat disetujui. */
    managerSignedBy: integer("manager_signed_by"),
    managerSignedAt: integer("manager_signed_at", { mode: "timestamp" }),
    ...created,
  },
  (t) => [index("qc_ml_date_idx").on(t.workDate, t.layer)],
);

/** Laporan "Hasil Uji Kuat Tekan Beton" (kepala laporan + komposisi campuran). */
export const strengthTests = sqliteTable(
  "qc_strength_tests",
  {
    id: id(),
    reportDate: text("report_date").notNull(),
    companyName: text("company_name").notNull().default(""),
    address: text("address").notNull().default(""),
    /** Mutu beton, mis. "K-350". */
    concreteGrade: text("concrete_grade").notNull(),
    addressedTo: text("addressed_to").notNull().default(""),
    composition: text("composition", { mode: "json" }).$type<MaterialLine[]>().notNull(),
    notes: text("notes").notNull().default(""),
    reviewStatus: text("review_status").$type<ReviewStatus>().notNull().default("menunggu"),
    reviewNote: text("review_note"),
    createdBy: createdBy(),
    /** TTD "Diperiksa Lab Pengujian" saat disetujui; setelah itu TTD "Mengetahui Pimpinan". */
    labSignedBy: integer("lab_signed_by"),
    labSignedAt: integer("lab_signed_at", { mode: "timestamp" }),
    leaderSignedBy: integer("leader_signed_by"),
    leaderSignedAt: integer("leader_signed_at", { mode: "timestamp" }),
    ...created,
  },
  (t) => [index("qc_st_date_idx").on(t.reportDate)],
);

/** Benda uji dalam satu laporan uji kuat tekan (tanggal buat/uji = teks YYYY-MM-DD). */
export const strengthSamples = sqliteTable(
  "qc_strength_samples",
  {
    id: id(),
    testId: text("test_id").notNull(),
    position: integer("position").notNull().default(0),
    sampleName: text("sample_name").notNull(),
    madeAt: text("made_at"),
    testedAt: text("tested_at"),
    weightKg: real("weight_kg"),
    areaCm2: real("area_cm2"),
    maxLoadKn: real("max_load_kn"),
  },
  (t) => [index("qc_ss_test_idx").on(t.testId)],
);

/* ---------------------------------------------------------------- Barang masuk & uji lumpur pasir */

export const receiptCategories = ["bahan_baku", "lainnya"] as const;
export type ReceiptCategory = (typeof receiptCategories)[number];
export const receiptStatuses = ["diterima", "ditolak"] as const;
export type ReceiptStatus = (typeof receiptStatuses)[number];
/** Pengantar: armada quarry/supplier, ekspedisi pihak ketiga, atau diambil sendiri (armada Istana Block). */
export const deliveryModes = ["quarry", "ekspedisi", "sendiri"] as const;
export type DeliveryMode = (typeof deliveryModes)[number];
/** Maksimal foto per barang masuk. */
export const MAX_RECEIPT_PHOTOS = 3;

/**
 * Log fisik barang yang datang di gerbang (satpam). TIDAK memposting stok; stok tetap lewat Pembelian di /akuntansi.
 * Penilaian: tier kualitas (QC), kecepatan kirim (kantor), harga (pimpinan).
 * Tier 1 Bagus, 2 Banyak brangkal, 3 Banyak lumpur, 4 Brangkal & lumpur. Kecepatan 1 Lambat/2 Standard/3 Cepat. Harga 1 Mahal/2 Sedang/3 Affordable.
 */
export const goodsReceipts = sqliteTable(
  "ops_goods_receipts",
  {
    id: id(),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
    category: text("category").$type<ReceiptCategory>().notNull().default("bahan_baku"),
    itemName: text("item_name").notNull(),
    /** Tag rekap inventory, mis. "Pasir Cimalaka". */
    tag: text("tag"),
    supplier: text("supplier"),
    /** Asal tambang, mis. Cidadap. */
    quarry: text("quarry"),
    quantity: real("quantity"),
    unit: text("unit").notNull().default("m³"),
    vehiclePlate: text("vehicle_plate"),
    driverName: text("driver_name"),
    deliveryNoteNo: text("delivery_note_no"),
    deliveryMode: text("delivery_mode").$type<DeliveryMode>(),
    expeditionName: text("expedition_name"),
    /** Temuan satpam: banyak brangkal (batu besar) di muatan. */
    hasBrangkal: integer("has_brangkal", { mode: "boolean" }),
    status: text("status").$type<ReceiptStatus>().notNull().default("diterima"),
    /** Kunci R2 foto (folder penerimaan/), maks MAX_RECEIPT_PHOTOS. */
    photoKeys: text("photo_keys", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    notes: text("notes").notNull().default(""),
    tier: integer("tier"),
    qualityNote: text("quality_note"),
    qualityBy: integer("quality_by"),
    qualityAt: integer("quality_at", { mode: "timestamp" }),
    speedRating: integer("speed_rating"),
    deliveryNote: text("delivery_note"),
    deliveryBy: integer("delivery_by"),
    deliveryAt: integer("delivery_at", { mode: "timestamp" }),
    priceRating: integer("price_rating"),
    priceNote: text("price_note"),
    priceBy: integer("price_by"),
    priceAt: integer("price_at", { mode: "timestamp" }),
    /** Uji lumpur dilewati (skip): level kondisi lumpur, alasan, oleh siapa. Kosong = tidak di-skip. */
    testSkippedAt: integer("test_skipped_at", { mode: "timestamp" }),
    testSkipLevel: text("test_skip_level").$type<SkipLevel>(),
    testSkipReason: text("test_skip_reason"),
    testSkippedBy: integer("test_skipped_by"),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [index("ops_gr_date_idx").on(t.receivedAt), index("ops_gr_item_idx").on(t.itemName)],
);

export const sandTestStatuses = ["draft", "selesai"] as const;
export type SandTestStatus = (typeof sandTestStatuses)[number];
/** Satuan pembacaan: ml (gelas ukur lab) atau cm (botol + penggaris); rasio kadar lumpur sama. */
export const readingUnits = ["ml", "cm"] as const;
export type ReadingUnit = (typeof readingUnits)[number];
export const sandDecisions = ["diterima", "ditolak", "diterima_bersyarat"] as const;
export type SandDecision = (typeof sandDecisions)[number];
/** Batas kadar lumpur (%): <= 5 bagus, <= 10 cukup, > 10 lewat batas. */
export const MAX_SILT_PERCENT = 10;

/**
 * Uji kadar lumpur pasir: kadar = lumpur / (pasir + lumpur) x 100. Draft = sedang mengendap (foto awal);
 * selesai = pembacaan + foto akhir + keputusan.
 */
export const sandTests = sqliteTable(
  "qc_sand_tests",
  {
    id: id(),
    receiptId: text("receipt_id"),
    status: text("status").$type<SandTestStatus>().notNull().default("selesai"),
    testedAt: integer("tested_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    /** Sumber manual bila uji tidak terhubung ke barang masuk. */
    supplier: text("supplier"),
    quarry: text("quarry"),
    sandType: text("sand_type").notNull(),
    readingUnit: text("reading_unit").$type<ReadingUnit>().notNull().default("cm"),
    /** Tinggi endapan pasir & lumpur, dalam satuan readingUnit. */
    sandHeight: real("sand_height"),
    siltHeight: real("silt_height"),
    siltPercent: real("silt_percent"),
    maxSiltPercent: real("max_silt_percent").notNull().default(MAX_SILT_PERCENT),
    decision: text("decision").$type<SandDecision>(),
    startPhotoKey: text("start_photo_key"),
    photoKey: text("photo_key"),
    notes: text("notes").notNull().default(""),
    createdBy: createdBy(),
    completedBy: integer("completed_by"),
    /** TTD bertingkat Sekretaris -> Manager in charge -> Pimpinan (massal per daftar). Mengubah hasil mereset ketiganya. */
    secretaryAckBy: integer("secretary_ack_by"),
    secretaryAckAt: integer("secretary_ack_at", { mode: "timestamp" }),
    managerAckBy: integer("manager_ack_by"),
    managerAckAt: integer("manager_ack_at", { mode: "timestamp" }),
    leaderAckBy: integer("leader_ack_by"),
    leaderAckAt: integer("leader_ack_at", { mode: "timestamp" }),
    /** Riwayat "Ubah hasil": nilai lama + alasan (min. 5 huruf). */
    editHistory: text("edit_history", { mode: "json" }).$type<SandEdit[]>().notNull().default(sql`'[]'`),
    ...created,
  },
  (t) => [index("qc_sand_date_idx").on(t.testedAt), index("qc_sand_receipt_idx").on(t.receiptId), index("qc_sand_status_idx").on(t.status)],
);

/* ---------------------------------------------------------------- Kalender rapat/training */

export const calendarTypes = ["rapat", "training", "lainnya"] as const;
export type CalendarType = (typeof calendarTypes)[number];

export const calendarEvents = sqliteTable(
  "ops_calendar_events",
  {
    id: id(),
    title: text("title").notNull(),
    type: text("type").$type<CalendarType>().notNull().default("rapat"),
    startAt: integer("start_at", { mode: "timestamp" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp" }),
    location: text("location").notNull().default(""),
    description: text("description").notNull().default(""),
    /** Pengingat: menit sebelum mulai, mis. [1440, 60]. */
    reminderMinutes: text("reminder_minutes", { mode: "json" }).$type<number[]>().notNull().default(sql`'[]'`),
    /** Acara berulang dibuat sebagai beberapa acara dengan seriesId sama. */
    seriesId: text("series_id"),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [index("ops_ce_start_idx").on(t.startAt), index("ops_ce_series_idx").on(t.seriesId)],
);

export const calendarParticipants = sqliteTable(
  "ops_calendar_participants",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    userId: integer("user_id").notNull(),
    /** TTD hadir: diisi peserta sendiri (calendar.signAttendance). */
    attendanceSignedAt: integer("attendance_signed_at", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("ops_cp_event_user_uq").on(t.eventId, t.userId), index("ops_cp_user_idx").on(t.userId)],
);

/** Jadwal kirim pengingat (diproses cron tiap 5 menit); sentAt terisi setelah terkirim. */
export const calendarReminders = sqliteTable(
  "ops_calendar_reminders",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    minutesBefore: integer("minutes_before").notNull(),
    remindAt: integer("remind_at", { mode: "timestamp" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp" }),
  },
  (t) => [index("ops_cr_due_idx").on(t.sentAt, t.remindAt), index("ops_cr_event_idx").on(t.eventId)],
);

export type CalendarAttendee = { userId: number | null; name: string; present: boolean; score: string | null; note: string | null };
/** Lampiran hasil rapat; key = kunci R2 (folder kalender/). */
export type CalendarFile = { key: string; name: string; contentType: string; size: number };

/** Notulen rapat/training. Keputusan rapat disimpan sebagai baris F-IB-14 di iso_records (data._from = "event:<id>"). */
export const calendarResults = sqliteTable(
  "ops_calendar_results",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    leader: text("leader").notNull().default(""),
    category: text("category").notNull().default(""),
    summary: text("summary").notNull().default(""),
    attendees: text("attendees", { mode: "json" }).$type<CalendarAttendee[]>().notNull().default(sql`'[]'`),
    guests: text("guests").notNull().default(""),
    durationHours: real("duration_hours"),
    evaluation: text("evaluation").notNull().default(""),
    notes: text("notes").notNull().default(""),
    files: text("files", { mode: "json" }).$type<CalendarFile[]>().notNull().default(sql`'[]'`),
    filledBy: integer("filled_by"),
    filledByName: text("filled_by_name"),
    ...created,
  },
  (t) => [uniqueIndex("ops_cres_event_uq").on(t.eventId)],
);

/* ---------------------------------------------------------------- Rekap ISO */

/**
 * record = baris form yang diisi langsung; supplement = kolom pelengkap untuk baris dari data aplikasi
 * (sourceKey mis. "order:<id>"); objective = angka Sasaran Mutu F-IB-16 per bulan (sourceKey "YYYY-MM:no").
 */
export const isoRecordKinds = ["record", "supplement", "objective"] as const;
export type IsoRecordKind = (typeof isoRecordKinds)[number];
export type IsoValues = Record<string, string | number | null>;

export const isoRecords = sqliteTable(
  "iso_records",
  {
    id: id(),
    formCode: text("form_code").notNull(),
    kind: text("kind").$type<IsoRecordKind>().notNull().default("record"),
    /** Tanggal form (YYYY-MM-DD WIB) yang dibaca rekap per periode. */
    recordDate: text("record_date").notNull(),
    sourceKey: text("source_key"),
    /** Nomor dokumen, mis. NCR-2026-001. */
    number: text("number"),
    data: text("data", { mode: "json" }).$type<IsoValues>().notNull(),
    /** Riwayat nilai lama (mis. tanggal kalibrasi sebelumnya pada F-IB-06). */
    history: text("history", { mode: "json" }).$type<{ at: string; by: string; values: IsoValues }[]>().notNull().default(sql`'[]'`),
    createdBy: createdBy(),
    createdByName: text("created_by_name"),
    updatedByName: text("updated_by_name"),
    ...created,
  },
  (t) => [index("iso_form_date_idx").on(t.formCode, t.kind, t.recordDate), uniqueIndex("iso_form_source_uq").on(t.formCode, t.sourceKey)],
);

/* ================================================================================================
 * Setara app live (migrasi 0006): Rekap Pelanggan, stok opname & cat genteng (gabung ke stok web),
 * grade/adukan cor/spesifikasi produk, skip & TTD uji lumpur, koreksi jam tiba, TTD hadir kalender.
 * Kontrak untuk subagen fitur: lihat rekonstruksi-app-live/fondasi-setara.md.
 * ============================================================================================== */

/** Kelompok barang jadi (kunci "line" app live). Genteng/paving/buis dst. Dipakai fin_items.production_line & qc_product_specs.line. */
export const productLines = ["paving", "genteng", "buis", "tutup_buis", "kanstin", "uditch", "tutup_uditch", "greffel", "grass", "lainnya"] as const;
export type ProductLine = (typeof productLines)[number];
/** Metode Buis Beton. */
export const productionMethods = ["tumbuk", "cor", "tulangan"] as const;
export type ProductionMethod = (typeof productionMethods)[number];
/** Skip uji lumpur: kondisi lumpur yang diperkirakan tanpa uji. */
export const skipLevels = ["tidak", "sedikit", "sedang"] as const;
export type SkipLevel = (typeof skipLevels)[number];
export type SandEdit = {
  at: number;
  by: number | null;
  reason: string;
  old: { readingUnit: string; sandHeight: number | null; siltHeight: number | null; siltPercent: number | null; decision: string | null };
};

/* ---------------------------------------------------------------- Rekap Pelanggan */

export const leadStatuses = ["membeli", "follow_up", "tidak_membeli"] as const;
export type LeadStatus = (typeof leadStatuses)[number];
export const leadSources = ["Google Ads", "WhatsApp", "Instagram / Facebook", "Datang langsung", "Telepon", "Referensi", "Pelanggan lama", "Lainnya"] as const;
/** Alasan tidak membeli (kode tersimpan di ops_customer_leads.reasons). */
export const leadReasons = ["harga_mahal", "min_order", "luar_provinsi", "tidak_ada_info", "tidak_tersedia"] as const;
export type LeadReason = (typeof leadReasons)[number];
export const leadFeedbacks = ["puas", "komplain"] as const;
export type LeadFeedback = (typeof leadFeedbacks)[number];
export const getbackResults = ["puas", "tidak_puas"] as const;
export type GetbackResult = (typeof getbackResults)[number];

/**
 * Konsumen yang bertanya/membeli (iklan Google Ads dan sumber lain) + penilaian pembeli. Terpisah dari fin_contacts:
 * contact_id hanya tautan opsional ke pelanggan web. Baris impor Excel hanya presisi bulan (contact_date = tanggal 1).
 * import_key unik ("YYYY-MM|NO|nama") menjaga impor ulang tidak dobel dan tidak menimpa penilaian.
 */
export const customerLeads = sqliteTable(
  "ops_customer_leads",
  {
    id: id(),
    /** YYYY-MM-DD WIB. */
    contactDate: text("contact_date").notNull(),
    source: text("source").notNull().default("Google Ads"),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address"),
    product: text("product"),
    status: text("status").$type<LeadStatus>().notNull().default("follow_up"),
    /** Rupiah; hanya bermakna untuk status membeli. */
    saleValue: integer("sale_value"),
    priceNett: integer("price_nett"),
    priceOffer: integer("price_offer"),
    reasons: text("reasons", { mode: "json" }).$type<LeadReason[]>().notNull().default(sql`'[]'`),
    notes: text("notes"),
    /** Bintang 1-5 (null = belum dinilai). */
    ratingService: integer("rating_service"),
    ratingQuality: integer("rating_quality"),
    ratingSpeed: integer("rating_speed"),
    ratingNote: text("rating_note"),
    ratedBy: integer("rated_by"),
    ratedAt: integer("rated_at", { mode: "timestamp" }),
    feedback: text("feedback").$type<LeadFeedback>(),
    complaintDate: text("complaint_date"),
    complaintNote: text("complaint_note"),
    getbackDate: text("getback_date"),
    getbackNote: text("getback_note"),
    getbackResult: text("getback_result").$type<GetbackResult>(),
    getbackBy: integer("getback_by"),
    /** Tautan opsional ke pelanggan web (fin_contacts.id). */
    contactId: text("contact_id"),
    importKey: text("import_key"),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [
    index("ops_cl_date_idx").on(t.contactDate),
    index("ops_cl_status_idx").on(t.status, t.contactDate),
    uniqueIndex("ops_cl_import_uq").on(t.importKey),
    index("ops_cl_contact_idx").on(t.contactId),
  ],
);

/* ---------------------------------------------------------------- Stok opname & cat genteng (gabung ke stok web) */

/**
 * Dokumen stok opname. Saat disimpan, tiap baris yang selisih menghasilkan SATU inv_adjustments (count_id terisi)
 * + inv_stock_moves "penyesuaian" + jurnal "penyesuaian" (mekanisme stok/penyesuaian web). Tidak ada tabel stok kedua.
 * Stok sistem pada counted_at disimpan di baris (system_qty) sebagai bukti.
 */
export const stockCounts = sqliteTable(
  "inv_counts",
  {
    id: id(),
    number: text("number").notNull(),
    /** Tanggal bisnis (WIB) = tanggal penyesuaian yang diposting. */
    date: text("date").notNull(),
    /** Waktu hitung fisik (datetime). */
    countedAt: integer("counted_at", { mode: "timestamp" }).notNull(),
    note: text("note").notNull().default(""),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("inv_counts_number_uq").on(t.number), index("inv_counts_date_idx").on(t.date)],
);

export const stockCountLines = sqliteTable(
  "inv_count_lines",
  {
    id: id(),
    countId: text("count_id").notNull(),
    itemId: text("item_id").notNull(),
    /** Stok sistem saat disimpan. */
    systemQty: real("system_qty").notNull(),
    /** Jumlah fisik. diff = counted - system (diff 0: tidak ada penyesuaian). */
    countedQty: real("counted_qty").notNull(),
  },
  (t) => [index("inv_cl_count_idx").on(t.countId), index("inv_cl_item_idx").on(t.itemId)],
);

/**
 * Konversi barang 1:1 (cat genteng: natural -> hitam/merah). Memposting 2 inv_stock_moves source "konversi"
 * (keluar from_item, masuk to_item; nilai keluar = harga pokok rata-rata, nilai masuk = sama). Tanpa jurnal bila
 * kedua barang berakun persediaan sama (barang_jadi); tidak menambah "produksi".
 */
export const conversions = sqliteTable(
  "inv_conversions",
  {
    id: id(),
    number: text("number").notNull(),
    date: text("date").notNull(),
    /** Waktu kejadian (datetime-local) untuk riwayat. */
    movedAt: integer("moved_at", { mode: "timestamp" }).notNull(),
    fromItemId: text("from_item_id").notNull(),
    toItemId: text("to_item_id").notNull(),
    qty: real("qty").notNull(),
    note: text("note").notNull().default(""),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [uniqueIndex("inv_conv_number_uq").on(t.number), index("inv_conv_date_idx").on(t.date), index("inv_conv_from_idx").on(t.fromItemId), index("inv_conv_to_idx").on(t.toItemId)],
);

/* ---------------------------------------------------------------- Produksi: adukan cor bersama & spesifikasi produk */

/** Satu adukan semen untuk beberapa produk (Buis cor/tulangan, U-Ditch, Kanstin): tiap produk satu inv_productions.batch_id = id ini. */
export const productionBatches = sqliteTable(
  "inv_production_batches",
  {
    id: id(),
    date: text("date").notNull(),
    /** Total sak semen adukan ini (dicatat sekali di sini). */
    cementBags: real("cement_bags").notNull(),
    leader: text("leader"),
    note: text("note").notNull().default(""),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [index("inv_pb_date_idx").on(t.date)],
);

/** Spesifikasi & berat tiap ukuran/tipe produk; jadi pilihan di form produksi. line=buis: variant = metode. */
export const productSpecs = sqliteTable(
  "qc_product_specs",
  {
    id: id(),
    line: text("line").$type<ProductLine>().notNull(),
    name: text("name").notNull(),
    variant: text("variant"),
    weightKg: real("weight_kg"),
    /** Pasangan nama-nilai, mis. { Mutu: "K-350", Tebal: "70 mm" }. */
    specs: text("specs", { mode: "json" }).$type<Record<string, string>>().notNull().default(sql`'{}'`),
    notes: text("notes").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    /** Opsional: barang web (fin_items.id) yang dipakai produksi untuk spesifikasi ini. */
    itemId: text("item_id"),
    createdBy: createdBy(),
    ...created,
  },
  (t) => [index("qc_ps_line_idx").on(t.line, t.name), index("qc_ps_item_idx").on(t.itemId)],
);
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
