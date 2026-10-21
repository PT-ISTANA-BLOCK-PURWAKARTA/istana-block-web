// Baca faktur penjualan & surat jalan Zahir yang disimpan sebagai file cetak FastReport (.fp3, XML).
// Nilai dibaca berdasarkan rumus kolom di template laporan (mis. "[Nomor Faktur]", "SJ-[Nomor Faktur]",
// "[Nama Barang][Deskripsi]"), bukan posisi, sehingga tetap terbaca walau tata letak diubah.
// Hanya halaman "LEMBAR ASLI" yang dipakai.

export type ZahirItem = { quantity: number | null; name: string; unit: string; price: number | null; subtotal: number | null };
export type ZahirDocumentKind = "faktur" | "surat_jalan";
export type ZahirInvoice = {
  kind: ZahirDocumentKind;
  /** Kolom "Nama Sopir & Nomor Polisi" surat jalan (job Zahir), mis. ["ASEP", "T 9116 DE"] atau ["DIAMBIL", "DIAMBIL"]. */
  job: string[];
  number: string; poNumber: string | null; date: string | null; terms: string | null;
  customerName: string; contactPerson: string | null; phone: string | null; address: string | null;
  notes: string | null; total: number | null; downPayment: number | null; balance: number | null; dueDate: string | null; items: ZahirItem[];
};

/** Status bayar dari faktur. Harga/nominal hanya untuk kantor — tidak pernah dikirim ke sopir. */
export const PAYMENT_STATUSES = ["lunas", "belum_lunas", "tempo", "tidak_diketahui"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_LABELS: Record<PaymentStatus, string> = { lunas: "Lunas", belum_lunas: "Belum lunas", tempo: "Tempo", tidak_diketahui: "Status bayar tidak terbaca" };
export type InvoicePayment = { terms: string | null; total: number | null; downPayment: number | null; balance: number | null };

export function paymentStatus(payment: InvoicePayment): PaymentStatus {
  const balance = payment.balance ?? (payment.total !== null ? payment.total - (payment.downPayment ?? 0) : null);
  if (balance === null) return "tidak_diketahui";
  if (balance <= 0) return "lunas";
  // Cash/Tunai tapi masih ada saldo = tamu belum bayar. Termin tempo/kredit = memang dibayar belakangan.
  if (!payment.terms || /cash|tunai|cod|kontan/i.test(payment.terms)) return "belum_lunas";
  return "tempo";
}
/** Belum lunas / tidak terbaca: wajib dikonfirmasi kantor sebelum dibuat tugas pengiriman. */
export const needsPaymentConfirmation = (status: PaymentStatus) => status === "belum_lunas" || status === "tidak_diketahui";

const decode = (value: string) => value
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = (attrs: string, name: string) => { const match = attrs.match(new RegExp(`\\s${name}="([^"]*)"`)); return match ? decode(match[1]) : null; };
const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

/** "1.250,5" → 1250.5; "17.000" → 17000; "225" → 225. */
export function parseIdNumber(value: string | null | undefined) {
  const text = clean(value).replace(/[^\d.,-]/g, "");
  if (!/\d/.test(text)) return null;
  const number = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
/** "01 Okt 2026" / "01/10/2026" → "2026-10-01". */
export function parseIdDate(value: string | null | undefined) {
  const text = clean(value).toLowerCase();
  const named = text.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})$/);
  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const [day, month, year] = named ? [Number(named[1]), MONTHS[named[2]], Number(named[3])] : numeric ? [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])] : [0, 0, 0];
  if (!day || !month || !year || month > 12 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Nomor HP: hanya angka, awalan 62 → 0. */
export const cleanPhone = (value: string | null | undefined) => { const digits = (value ?? "").replace(/\D/g, ""); return digits ? digits.replace(/^62/, "0") : null; };

export function parseZahirFp3(xml: string): ZahirInvoice[] {
  if (!/<preparedreport[\s>]/i.test(xml)) throw new Error("Bukan file cetak Zahir/FastReport (.fp3)");
  // Rumus kolom tiap memo di template: Memo95 → "[Nomor Faktur]".
  const formulas = new Map<string, string>();
  for (const [, attrs] of xml.matchAll(/<TfrxMemoView((?:\s+[\w:.]+="[^"]*")*)\s*\/?>/g)) {
    const name = attr(attrs, "Name"), text = attr(attrs, "Text");
    if (name && text !== null) formulas.set(name, text);
  }
  // Objek di halaman cetak (m12) → nama di template ("Page0.Memo57").
  const sources = new Map<string, string>();
  for (const [, id, name] of xml.matchAll(/<(m\d+)\s+name="([^"]+)"\s*\/>/g)) sources.set(id, name);
  if (!formulas.size || !sources.size) throw new Error("Template faktur tidak ditemukan di file ini");

  const preview = xml.match(/<previewpages>([\s\S]*?)<\/previewpages>/)?.[1] ?? "";
  const objects = [...preview.matchAll(/<(m\d+)((?:\s+[\w:.]+="[^"]*")*)\s*\/?>/g)].flatMap(([, id, attrs]) => {
    const source = sources.get(id);
    const formula = source ? formulas.get(source.split(".").pop()!) : undefined;
    return source && formula !== undefined ? [{ page: source.split(".")[0], formula, value: attr(attrs, "u") ?? "" }] : [];
  });
  // Halaman template pertama yang berisi nomor dokumen = lembar asli (lembar copy diabaikan).
  const numberObject = objects.find(object => object.formula.includes("[Nomor Faktur]"));
  const originalPage = numberObject?.page;
  if (!originalPage) throw new Error("Nomor faktur / surat jalan tidak ditemukan — pastikan file adalah cetakan faktur atau surat jalan Zahir");
  const kind: ZahirDocumentKind = /^\s*SJ\b/i.test(numberObject!.formula) || objects.some(object => object.page === originalPage && /^\s*SURAT JALAN\s*$/i.test(object.formula)) ? "surat_jalan" : "faktur";

  const invoices: ZahirInvoice[] = [];
  let invoice = null as ZahirInvoice | null;
  let item = null as ZahirItem | null;
  const itemField = (key: keyof ZahirItem, value: string | number | null) => {
    if (!invoice) return;
    if (!item || (item[key] !== null && item[key] !== "")) { item = { quantity: null, name: "", unit: "", price: null, subtotal: null }; invoice.items.push(item); }
    (item as Record<keyof ZahirItem, unknown>)[key] = value;
  };
  for (const { page, formula, value } of objects) {
    if (page !== originalPage) continue;
    const text = clean(value);
    if (formula.includes("[Nomor Faktur]")) {
      if (!text || text === invoice?.number) continue;
      invoice = { kind, job: [], number: text, poNumber: null, date: null, terms: null, customerName: "", contactPerson: null, phone: null, address: null, notes: null, total: null, downPayment: null, balance: null, dueDate: null, items: [] };
      invoices.push(invoice);
      item = null;
      continue;
    }
    if (!invoice) continue;
    if (/MASTERNAMAJOB|MASTERDESKRIPSIJOB/.test(formula)) {
      invoice.job = text.split("/").map(part => clean(part)).filter(Boolean);
      continue;
    }
    if (formula.includes("[Nama Pembeli]")) {
      // Blok pelanggan: baris rumus menentukan arti tiap baris nilai (nama / kontak - telepon / alamat).
      const formulaLines = formula.split(/\r?\n/);
      const lines = value.split(/\r?\n/);
      formulaLines.forEach((line, index) => {
        if (line.includes("[Nama Pembeli]")) invoice!.customerName = clean(lines[index]);
        else if (/Telpon|Telepon|Phone/i.test(line)) {
          // "[Kontak Person] - [Telpon]": " - 0812 1026 3590" atau "Bu Rina - 0812 ...".
          const raw = lines[index] ?? "";
          const match = raw.match(/^(.*?)\s*-\s*(\+?\d[\d\s().-]*)\s*$/);
          invoice!.contactPerson = clean(match ? match[1] : "") || null;
          invoice!.phone = cleanPhone(match ? match[2] : raw);
        } else if (line.includes("[Alamat")) invoice!.address = lines.slice(index).map(clean).filter(Boolean).join(", ") || null;
      });
      continue;
    }
    switch (formula.trim()) {
      case "[Nomor PO]": invoice.poNumber = text || null; break;
      case "[Tanggal Transaksi]": invoice.date = parseIdDate(text); break;
      case "[Term Pembayaran]": invoice.terms = text || null; break;
      case "[Catatan]": invoice.notes = text || null; break;
      case "[Total Penjualan]": invoice.total = parseIdNumber(text); break;
      case "[Saldo Terhutang]": invoice.balance = parseIdNumber(text); break;
      case "[Uang Muka ]": case "[Uang Muka]": invoice.downPayment = parseIdNumber(text); break;
      case "[Jumlah Fraksi 1]": itemField("quantity", parseIdNumber(text)); break;
      case "[Nama Barang][Deskripsi]": case "[Nama Barang]": itemField("name", text); break;
      case "[Satuan Fraksi 1]": itemField("unit", text); break;
      case "[Harga Satuan]": itemField("price", parseIdNumber(text)); break;
      case "[Sub Total]": itemField("subtotal", parseIdNumber(text)); break;
      default: if (formula.includes("DUEDAYS")) invoice.dueDate = parseIdDate(text); break;
    }
  }
  return invoices.map(entry => ({ ...entry, items: entry.items.filter(row => row.name || row.quantity !== null) }));
}

/** Satuan Zahir → satuan aplikasi. */
export function appUnit(unit: string) {
  const value = unit.trim().toLowerCase();
  if (["pcs", "pc", "bh", "buah", "unit", "biji", "lbr", "lembar"].includes(value)) return "buah";
  if (["m2", "m²", "mtr2", "meter2"].includes(value)) return "m²";
  if (["m3", "m³", "kubik"].includes(value)) return "m³";
  if (["m", "mtr", "meter"].includes(value)) return "meter";
  if (["ton", "tn"].includes(value)) return "ton";
  return value || "buah";
}

export function categoryOf(name: string): "paving" | "genteng" | "batako" | "other" {
  const value = name.toLowerCase();
  if (/paving|grass\s*block|grassblock|bata\s*hdr|hexagon|cacing|uni\s*pave/.test(value)) return "paving";
  if (/genteng/.test(value)) return "genteng";
  if (/batako|bata\s*beton|hebel/.test(value)) return "batako";
  return "other";
}

/** Nama dokumen untuk label PO: "SJ-DO000600" → surat jalan, selain itu faktur. */
export const documentLabel = (ref: string) => /^SJ\b/i.test(ref) ? `Surat jalan Zahir ${ref}` : `Faktur Zahir ${ref}`;

/** Surat jalan dengan sopir "DIAMBIL": barang diambil sendiri oleh tamu, tidak perlu tugas sopir. */
export const isPickup = (invoice: ZahirInvoice) => invoice.job.some(part => /^(diambil|ambil|ambil sendiri|diambil sendiri)$/i.test(part));

/** Kolom alamat Zahir kadang berisi nama orang (mis. "BPK. FITRIYADI") — perlu dilengkapi kantor. */
export const addressLooksLikeName = (address: string | null | undefined) => {
  const value = clean(address);
  return !value || (/^(bpk|bapak|pak|ibu|bu|sdr|sdri|mas|mbak|hj?)\b\.?/i.test(value) && !/\d/.test(value) && value.split(" ").length <= 4);
};

/**
 * Cocokkan isi kolom "Nama Sopir & Nomor Polisi" surat jalan dengan data sopir & kendaraan aplikasi.
 * Id teks (UUID) atau angka; plat nomor memakai field `plate` (kolom ops_vehicles.plate).
 */
export function matchJob<D extends { id: string | number; name: string }, V extends { id: string | number; plate: string }>(job: string[], drivers: D[], vehicles: V[]): { driverId: D["id"] | null; vehicleId: V["id"] | null } {
  const plain = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const parts = job.map(plain).filter(part => part.length >= 3);
  const vehicle = vehicles.find(item => parts.includes(plain(item.plate)));
  const driver = drivers.find(item => parts.some(part => plain(item.name) === part))
    ?? drivers.find(item => plain(item.name).length >= 3 && parts.some(part => part.includes(plain(item.name)) || plain(item.name).includes(part)));
  return { driverId: driver?.id ?? null, vehicleId: vehicle?.id ?? null };
}

/**
 * Satu dokumen = satu PO (satu pengiriman). Beberapa barang digabung dalam satu baris barang,
 * mis. "GRASSBLOCK 6CM (225 buah) + KANSTIN (50 buah)", jumlah = total bila satuannya sama.
 */
export function invoiceToOrder(invoice: ZahirInvoice) {
  const items = invoice.items.map(row => ({ ...row, unit: appUnit(row.unit) }));
  const single = items.length === 1 ? items[0] : null;
  const units = new Set(items.map(row => row.unit));
  const sameUnit = units.size === 1 && items.every(row => row.quantity !== null);
  const fmt = (value: number | null) => value === null ? "-" : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return {
    customerName: invoice.customerName,
    customerPhone: invoice.phone ?? "",
    address: invoice.address ?? "",
    productName: single ? single.name : items.map(row => `${row.name} (${fmt(row.quantity)} ${row.unit})`).join(" + "),
    category: categoryOf(items.map(row => row.name).join(" ")),
    quantity: single ? single.quantity ?? 0 : sameUnit ? items.reduce((sum, row) => sum + (row.quantity ?? 0), 0) : 1,
    unit: single ? single.unit : sameUnit ? [...units][0] : "muatan",
    // Catatan PO terlihat oleh sopir: tanpa harga, total, saldo, maupun termin bayar.
    notes: [
      documentLabel(invoice.number), invoice.poNumber ? `PO pelanggan ${invoice.poNumber}` : null,
      invoice.contactPerson ? `Kontak: ${invoice.contactPerson}` : null, invoice.notes,
    ].filter(Boolean).join(" · "),
    payment: { terms: invoice.terms, total: invoice.total, downPayment: invoice.downPayment, balance: invoice.balance } satisfies InvoicePayment,
  };
}
