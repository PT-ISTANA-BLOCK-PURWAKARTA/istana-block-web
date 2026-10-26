// Generator fixture backup sintetis aplikasi lama inventori-ops (meniru keluaran "Backup sekarang").
// Pakai: node scripts\migrasi-inventori-ops\fixture\buat-fixture.mjs   (Node 24, node:sqlite bawaan)
// Tanpa random / jam sistem: keluaran selalu sama.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = "C:/Users/Sarimusan/Downloads/PROJECTS/ISTANA_BLOCK_PURWAKARTA/istana-block-inventori-ops";
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "backup-contoh");
const STAMP = "2026-10-26_1000";

// ---- 1. DB sementara dari semua migrasi sumber, berurutan ----
const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
const migDir = path.join(SRC, "migrations");
for (const f of fs.readdirSync(migDir).filter(f => f.endsWith(".sql")).sort()) {
  db.exec(fs.readFileSync(path.join(migDir, f), "utf8").replaceAll("--> statement-breakpoint", ""));
}

// ---- helper ----
const wib = (d, h = 8, m = 0) => Date.UTC(2026, 9, d, h - 7, m); // Okt 2026, jam WIB -> ms epoch UTC
const J = v => JSON.stringify(v);
function ins(table, row) {
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map(c => row[c]));
}
const rows = (table, list) => list.forEach(r => ins(table, r));
const files = new Map(); // key KV -> {bytes}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const JPG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const PDF = Buffer.from("%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 72 72]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF\n");
const kv = (key, bytes) => { files.set(key, bytes); return `/files/${key}`; }; // balikan: URL seperti aslinya
const jpg = key => kv(key, JPG), png = key => kv(key, PNG);

// ---- 2. data contoh ----
const HASH = "pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ="; // hash palsu
const sigKey = png("signatures/7-1790400000001-sig7ab.png");

rows("users", [
  { id: 1, name: "Siti Customer Service", username: "cs", phone: null, email: "pemilik@uji.local", role: "superadmin", passwordHash: HASH, isActive: 1, lastSignedIn: wib(25, 9), createdAt: wib(1), updatedAt: wib(1), canCompleteOrders: 1, canViewSandTests: 1, canViewSummary: 1, canRatePrice: 1 },
  { id: 2, name: "Admin Kantor", username: "admin.kantor", phone: null, email: "admin@istana.test", role: "admin", passwordHash: HASH, isActive: 1, createdAt: wib(1), updatedAt: wib(1), canCompleteOrders: 1 },
  { id: 3, name: "Pak Mandor Dedi", username: "mandor", phone: null, email: null, role: "mandor", passwordHash: HASH, isActive: 1, createdAt: wib(1), updatedAt: wib(1) },
  { id: 4, name: "Satpam Gerbang", username: "satpam", phone: null, email: null, role: "satpam", passwordHash: HASH, isActive: 1, createdAt: wib(1), updatedAt: wib(1) },
  { id: 5, name: "Asep Saepudin", username: null, phone: "08110000 4101", email: null, role: "driver", passwordHash: HASH, isActive: 1, createdAt: wib(2), updatedAt: wib(2) },
  { id: 6, name: "Ujang Kurnia", username: null, phone: "+62 811-0000-4102", email: null, role: "driver", passwordHash: HASH, isActive: 1, createdAt: wib(2), updatedAt: wib(2) },
  { id: 7, name: "Lukman QC", username: "lukman", phone: null, email: "lukman@istana.test", role: "qc", passwordHash: HASH, isActive: 1, createdAt: wib(2), updatedAt: wib(2), canViewSandTests: 1, canApproveQc: 1, canSignAsLeader: 1, signatureUrl: sigKey, canRatePrice: 1 },
  { id: 8, name: "Rina Lab", username: "rina", phone: null, email: "rina@istana.test", role: "qc", passwordHash: HASH, isActive: 1, createdAt: wib(2), updatedAt: wib(2), canViewSandTests: 1 },
  { id: 9, name: "Bu O'Neil (akun nonaktif)", username: "admin.lama", phone: null, email: "ADMIN@istana.test", role: "admin", passwordHash: HASH, isActive: 0, failedAttempts: 5, lockedUntil: wib(20), mustChangePassword: 1, createdAt: wib(1), updatedAt: wib(15) },
]);
rows("sessions", [ // tabel sessions: hanya struktur di backup
  { tokenHash: "sess-hash-1", userId: 1, expiresAt: wib(30), userAgent: "Chrome", createdAt: wib(25) },
  { tokenHash: "sess-hash-2", userId: 2, expiresAt: wib(30), userAgent: "Edge", createdAt: wib(25) },
]);
rows("customers", [
  { id: 1, name: "PT Graha Asri Sentosa", phone: "+62 811-0000-2001", email: "keuangan@graha.test", notes: "Developer; cocok HP & nama pelanggan demo web (demo-ct-c01)", isActive: 1, createdAt: wib(3), updatedAt: wib(3) },
  { id: 2, name: "CV Karya Mandiri Konstruksi", phone: "081234567801", email: null, notes: "Nama sama dgn demo-ct-c05 tapi HP beda", isActive: 1, createdAt: wib(3), updatedAt: wib(3) },
  { id: 3, name: "Toko Bangunan Maju Jaya", phone: "+6281234567802", email: null, notes: "Alamat: Jl. 'Pahlawan'\nBaris kedua catatan", isActive: 1, createdAt: wib(4), updatedAt: wib(4) },
  { id: 4, name: "Pak Haji Oman", phone: "6281234567803", email: null, notes: null, isActive: 0, createdAt: wib(4), updatedAt: wib(10) },
]);
rows("customerAddresses", [
  { id: 1, customerId: 1, label: "Utama", recipientName: "Pak Rahmat", recipientPhone: "0811 0000 5663", addressText: "Kawasan pabrik, gerbang 2, Kotabaru, Karawang", city: "Karawang", province: "Jawa Barat", latitude: -6.39791, longitude: 107.42318, shareLocationUrl: "https://www.google.com/maps?q=-6.39791,107.42318", deliveryNotes: "Lapor satpam dulu", createdAt: wib(3), updatedAt: wib(3) },
  { id: 2, customerId: 1, label: "Gudang", recipientName: "Pak Ade", recipientPhone: null, addressText: "Perumahan Karya Hunian, Cikampek", city: "Karawang", province: "Jawa Barat", latitude: null, longitude: null, shareLocationUrl: null, deliveryNotes: null, createdAt: wib(3), updatedAt: wib(3) },
  { id: 3, customerId: 2, label: "Utama", recipientName: "Pak Udin", recipientPhone: "081234567801", addressText: "Cluster Permata Indah, Babakancikao, Purwakarta", city: "Purwakarta", province: "Jawa Barat", latitude: -6.51582, longitude: 107.47264, shareLocationUrl: null, deliveryNotes: null, createdAt: wib(3), updatedAt: wib(3) },
  { id: 4, customerId: 3, label: "Toko", recipientName: "Ibu Maju", recipientPhone: "+6281234567802", addressText: "Jl. Pahlawan No. 110, Cibatu", city: "Purwakarta", province: "Jawa Barat", latitude: -6.50967, longitude: 107.53565, shareLocationUrl: null, deliveryNotes: "Bongkar di belakang toko", createdAt: wib(4), updatedAt: wib(4) },
  { id: 5, customerId: 4, label: "Utama", recipientName: "Pak Haji Oman", recipientPhone: "6281234567803", addressText: "Gg. Mawar No. 67, Plered", city: "Purwakarta", province: "Jawa Barat", latitude: null, longitude: null, shareLocationUrl: null, deliveryNotes: null, createdAt: wib(4), updatedAt: wib(4) },
]);
rows("products", [
  { id: 1, sku: "PVG-0101", name: "Paving Block — Truepave / bata 21 × 10,5 cm", category: "paving", unit: "m²", defaultPrice: 85000, isActive: 1, createdAt: wib(1), updatedAt: wib(1) },
  { id: 2, sku: "KST-0402", name: "Kanstin KS 20", category: "other", unit: "buah", defaultPrice: 15000, isActive: 1, createdAt: wib(1), updatedAt: wib(1) },
  { id: 3, sku: "PVG-X01", name: "Paving Hexagon 20x20 (nama lama)", category: "paving", unit: "m²", defaultPrice: 88000, isActive: 1, createdAt: wib(1), updatedAt: wib(1) },
  { id: 4, sku: "BTK-001", name: "Batako Press 10x20x40", category: "batako", unit: "buah", defaultPrice: 4200, isActive: 1, createdAt: wib(1), updatedAt: wib(1) },
  { id: 5, sku: "GTG-X02", name: "genteng beton garuda", category: "genteng", unit: "pcs", defaultPrice: 4500, isActive: 1, createdAt: wib(1), updatedAt: wib(1) },
  { id: 6, sku: "OLD-001", name: "Pasir Cor (jasa)", category: "other", unit: "m³", defaultPrice: null, isActive: 0, createdAt: wib(1), updatedAt: wib(12) },
]);
rows("drivers", [
  { id: 1, userId: 5, name: "Asep Saepudin", phone: "0811 0000 4101", licenseNumber: "SIM-B1-0001", licenseExpiryDate: wib(1) + 400 * 86400000, isAvailable: 1, createdAt: wib(2), updatedAt: wib(2) },
  { id: 2, userId: 6, name: "Ujang Kurnia", phone: "+62 811-0000-4102", licenseNumber: null, licenseExpiryDate: null, isAvailable: 1, createdAt: wib(2), updatedAt: wib(2) },
  { id: 3, userId: null, name: "Dede Rahmat", phone: "08110000 4103", licenseNumber: "SIM-B1-0003", licenseExpiryDate: wib(1) + 20 * 86400000, isAvailable: 0, createdAt: wib(2), updatedAt: wib(14) },
]);
rows("vehicles", [
  { id: 1, plateNumber: "T 8417 BD", vehicleType: "Truk engkel", capacityNote: "± 7 ton", stnkExpiryDate: wib(1) + 200 * 86400000, kirExpiryDate: null, isActive: 1, createdAt: wib(2), updatedAt: wib(2) },
  { id: 2, plateNumber: "T8593BC", vehicleType: "Truk engkel", capacityNote: null, stnkExpiryDate: null, kirExpiryDate: null, isActive: 1, createdAt: wib(2), updatedAt: wib(2) },
  { id: 3, plateNumber: "t 9125 ab", vehicleType: "Colt diesel", capacityNote: "± 4,5 ton", stnkExpiryDate: null, kirExpiryDate: null, isActive: 1, createdAt: wib(2), updatedAt: wib(2) },
  { id: 4, plateNumber: "T 1234 ZZ", vehicleType: "Pickup", capacityNote: null, stnkExpiryDate: null, kirExpiryDate: null, isActive: 0, createdAt: wib(2), updatedAt: wib(13) },
]);

// Orders: satu per status order (+ satu 'in_delivery' lagi untuk delivery 'arrived')
const snap = a => J({ recipientName: a.r, addressText: a.t, city: a.c });
const A = { 1: { r: "Pak Rahmat", t: "Kawasan pabrik, gerbang 2, Kotabaru, Karawang", c: "Karawang" }, 2: { r: "Pak Ade", t: "Perumahan Karya Hunian, Cikampek", c: "Karawang" }, 3: { r: "Pak Udin", t: "Cluster Permata Indah, Babakancikao", c: "Purwakarta" }, 4: { r: "Ibu Maju", t: "Jl. Pahlawan No. 110, Cibatu", c: "Purwakarta" }, 5: { r: "Pak Haji Oman", t: "Gg. Mawar No. 67, Plered", c: "Purwakarta" } };
const O = [ // id, status, cust, addr, tgl, pay, ref
  [1, "draft", 1, 1, 20, null, null], [2, "confirmed", 2, 3, 21, "belum_lunas", null], [3, "preparing", 3, 4, 21, "tempo", "INV-0003"],
  [4, "ready_to_ship", 1, 2, 22, "lunas", "INV-0004"], [5, "assigned", 2, 3, 22, "lunas", null], [6, "in_delivery", 3, 4, 23, "belum_lunas", "INV-0006"],
  [7, "delivered", 1, 1, 18, "lunas", "INV-0007"], [8, "delayed", 2, 3, 24, "tidak_diketahui", null], [9, "cancelled", 4, 5, 19, null, null], [10, "in_delivery", 1, 2, 24, "tempo", null],
];
const itemsOf = {}; let itemId = 1;
for (const [id, status, cust, addr, d, pay, ref] of O) {
  const lines = id % 2 ? [[1, "Paving Block — Truepave / bata 21 × 10,5 cm", "m²", 40, 85000], [2, "Kanstin KS 20", "buah", 100, 15000]] : [[null, "Batako Press 10x20x40 (item lepas, tanpa produk)", "buah", 500, 4200]];
  const sub = lines.reduce((s, l) => s + l[3] * l[4], 0), fee = id % 3 ? 150000 : 0, disc = id === 7 ? 50000 : 0;
  ins("orders", { id, poNumber: `PO/2610/${String(id).padStart(4, "0")}`, customerId: cust, deliveryAddressId: addr, orderDate: wib(d), requestedDeliveryDate: wib(d + 2), status, subtotal: sub, deliveryFee: fee, discount: disc, totalAmount: sub + fee - disc, deliveryAddressSnapshot: snap(A[addr]), notes: id === 5 ? "Mohon bawa 'terpal'" : null, cancellationReason: status === "cancelled" ? "Pelanggan membatalkan; proyek ditunda" : null, cancelledBy: status === "cancelled" ? 2 : null, cancelledAt: status === "cancelled" ? wib(20, 14) : null, createdBy: 2, createdAt: wib(d), updatedAt: wib(d, 12), externalRef: ref, paymentStatus: pay, paymentConfirmedBy: pay === "lunas" ? "Admin Kantor" : null, paymentConfirmedAt: pay === "lunas" ? wib(d, 10) : null });
  for (const [pid, nm, unit, q, p] of lines) ins("orderItems", { id: itemId++, orderId: id, productId: pid, productNameSnapshot: nm, specificationSnapshot: pid === 1 ? "tebal 6 cm, abu" : null, quantity: q, unit, unitPrice: p, lineTotal: q * p, notes: null, createdAt: wib(d) });
}
// order yang sudah dihapus (hanya jejak audit; snapshot JSON)
ins("orderDeletionAudit", { id: 1, originalOrderId: 99, poNumber: "PO/2610/0099", customerName: "PT Graha Asri Sentosa", customerPhone: "+62 811-0000-2001", reason: "Input ganda, salah ketik jumlah", snapshot: J({ order: { id: 99, poNumber: "PO/2610/0099", status: "confirmed", totalAmount: 1200000 }, items: [{ productNameSnapshot: "Kanstin KS 20", quantity: 80, unit: "buah", unitPrice: 15000 }] }), deletedBy: 1, deletedAt: wib(19, 16) });

// Deliveries (satu per order yang sudah disiapkan; semua 8 status)
const D = [ // id, order, status, driver, vehicle, hari
  [1, 3, "unassigned", null, null, 22], [2, 4, "ready", 1, 1, 23], [3, 5, "assigned", 2, 2, 23], [4, 6, "in_transit", 1, 1, 24],
  [5, 10, "arrived", 2, 3, 25], [6, 7, "delivered", 1, 1, 19], [7, 8, "delayed", 3, 2, 25], [8, 9, "cancelled", null, null, 20],
];
for (const [id, order, status, driver, vehicle, d] of D) {
  ins("deliveries", { id, orderId: order, driverId: driver, vehicleId: vehicle, scheduledAt: wib(d, 9), status, startedAt: ["in_transit", "arrived", "delivered", "delayed"].includes(status) ? wib(d, 9, 30) : null, arrivedAt: ["arrived", "delivered"].includes(status) ? wib(d, 11) : null, completedAt: status === "delivered" ? wib(d, 12) : null, cancelledAt: status === "cancelled" ? wib(d, 8) : null, delayReason: status === "delayed" ? "Hujan deras, jalan licin" : null, driverNotes: status === "delivered" ? "Diterima Pak Rahmat" : null, createdAt: wib(d - 1), updatedAt: wib(d, 12) });
}
rows("deliveryStatusHistory", [
  { id: 1, deliveryId: 6, fromStatus: null, toStatus: "unassigned", changedBy: 2, note: null, createdAt: wib(18, 8), dutyOfficerName: null },
  { id: 2, deliveryId: 6, fromStatus: "unassigned", toStatus: "assigned", changedBy: 2, note: "Ditugaskan ke Asep", createdAt: wib(18, 9), dutyOfficerName: null },
  { id: 3, deliveryId: 6, fromStatus: "assigned", toStatus: "in_transit", changedByDriver: 1, note: null, createdAt: wib(19, 9, 30), dutyOfficerName: null },
  { id: 4, deliveryId: 6, fromStatus: "in_transit", toStatus: "delivered", changedByDriver: 1, note: "Selesai", createdAt: wib(19, 12), dutyOfficerName: null },
  { id: 5, deliveryId: 7, fromStatus: "in_transit", toStatus: "delayed", changedBy: 4, note: "Hujan deras", createdAt: wib(25, 10), dutyOfficerName: "Satpam Joko" },
  { id: 6, deliveryId: 8, fromStatus: "unassigned", toStatus: "cancelled", changedBy: 2, note: "Order dibatalkan", createdAt: wib(20, 8), dutyOfficerName: null },
]);
rows("deliveryProofs", [
  { id: 1, deliveryId: 6, proofType: "photo", fileKey: "delivery-proofs/6/1790500000001-pf6aaaa1.jpg", fileUrl: "/files/delivery-proofs/6/1790500000001-pf6aaaa1.jpg", originalName: "muatan.jpg", createdByDriver: 1, createdAt: wib(19, 12) },
  { id: 2, deliveryId: 6, proofType: "photo", fileKey: "delivery-proofs/6/1790500000002-pf6bbbb2.jpg", fileUrl: "/files/delivery-proofs/6/1790500000002-pf6bbbb2.jpg", originalName: null, createdByDriver: 1, createdAt: wib(19, 12) },
  { id: 3, deliveryId: 6, proofType: "signature", fileKey: "delivery-proofs/6/1790500000003-pf6cccc3.png", fileUrl: "/files/delivery-proofs/6/1790500000003-pf6cccc3.png", originalName: "ttd-penerima.png", createdBy: 2, createdAt: wib(19, 13) },
  { id: 4, deliveryId: 5, proofType: "photo", fileKey: "delivery-proofs/5/1790600000001-pf5dddd4.jpg", fileUrl: "/files/delivery-proofs/5/1790600000001-pf5dddd4.jpg", originalName: "tiba.jpg", createdByDriver: 2, createdAt: wib(25, 11) },
]);
for (const p of db.prepare("SELECT fileKey FROM deliveryProofs").all()) files.set(p.fileKey, p.fileKey.endsWith(".png") ? PNG : JPG);
rows("publicTrackingLinks", [
  { id: 1, deliveryId: 4, tokenHash: "a".repeat(64), expiresAt: wib(31), isRevoked: 0, lastAccessedAt: wib(24, 10), createdAt: wib(24), updatedAt: wib(24, 10) },
  { id: 2, deliveryId: 6, tokenHash: "b".repeat(64), expiresAt: wib(19, 23), isRevoked: 0, lastAccessedAt: null, createdAt: wib(18), updatedAt: wib(18) },
  { id: 3, deliveryId: 5, tokenHash: "c".repeat(64), expiresAt: null, isRevoked: 1, lastAccessedAt: wib(25, 9), createdAt: wib(25), updatedAt: wib(25, 9) },
]);
rows("deliveryNotifications", [
  { id: 1, deliveryId: 4, status: "in_transit", title: "Muatan berangkat", message: "PO/2610/0006 sedang diantar", readAt: null, createdAt: wib(24, 9, 30) },
  { id: 2, deliveryId: 6, status: "delivered", title: "Muatan tiba", message: "PO/2610/0007 diterima", readAt: wib(19, 13), createdAt: wib(19, 12) },
]);
rows("qualityControlNotifications", [
  { id: 1, orderId: 3, type: "new_order", title: "Order baru", message: "PO/2610/0003 perlu disiapkan", readAt: null, createdAt: wib(21) },
  { id: 2, orderId: 4, type: "loaded", title: "Sudah dimuat", message: "PO/2610/0004 siap kirim", readAt: wib(22, 9), createdAt: wib(22, 8) },
]);
rows("driverLocations", [
  { id: 1, deliveryId: 4, driverId: 1, latitude: -6.5301, longitude: 107.44, accuracyMeters: 12.5, recordedAt: wib(24, 9, 40), createdAt: wib(24, 9, 40) },
  { id: 2, deliveryId: 4, driverId: 1, latitude: -6.5222, longitude: 107.45, accuracyMeters: 9, recordedAt: wib(24, 9, 50), createdAt: wib(24, 9, 50) },
  { id: 3, deliveryId: 5, driverId: 2, latitude: -6.4169, longitude: 107.4518, accuracyMeters: null, recordedAt: wib(25, 10, 55), createdAt: wib(25, 10, 55) },
]);
rows("pushSubscriptions", [{ id: 1, userId: 1, endpoint: "https://push.example.test/sub/fixture-1", p256dh: "p256dh-fixture", auth: "auth-fixture", userAgent: "Chrome", createdAt: wib(10), updatedAt: wib(10) }]);

// QC
const mats = (...m) => J(m.map(([name, qty, unit]) => ({ name, qty, unit })));
rows("mixDesigns", [
  { id: 1, name: "Paving K-300 badan", layer: "badan", product: "Paving Block", materials: mats(["Semen PCC", 50, "kg"], ["Pasir", 120, "kg"], ["Abu batu", 80, "kg"]), notes: null, status: "disetujui", isActive: 1, createdBy: 8, approvedBy: 7, approvedAt: wib(5), reviewNote: null, createdAt: wib(4), updatedAt: wib(5) },
  { id: 2, name: "Paving kepalaan merah", layer: "kepalaan", product: "Paving Block", materials: mats(["Semen PCC", 30, "kg"], ["Pigmen merah", 1.5, "kg"], ["Pasir halus", 40, null]), notes: "uji coba", status: "diajukan", isActive: 1, createdBy: 8, createdAt: wib(20), updatedAt: wib(20) },
  { id: 3, name: "Batako lama (gagal)", layer: "lainnya", product: "Batako", materials: mats(["Semen PCC", null, "kg"]), notes: null, status: "gagal", isActive: 0, createdBy: 8, approvedBy: 7, approvedAt: wib(6), reviewNote: "Retak", createdAt: wib(5), updatedAt: wib(8), retiredReason: "Diganti desain baru", retiredBy: 7, retiredAt: wib(8) },
]);
rows("mixDesignLogs", [
  { id: 1, workDate: wib(21), layer: "badan", product: "Paving Block", mixDesignId: 1, approvedMaterials: mats(["Semen PCC", 50, "kg"], ["Pasir", 120, "kg"]), actualMaterials: mats(["Semen PCC", 50, "kg"], ["Pasir", 118, "kg"]), mixingCount: 12, boards: 240, squareMeters: 36.5, rejects: 3, status: "sesuai", notes: null, createdBy: 8, managerSignedBy: 7, managerSignedAt: wib(21, 16), leaderSignedBy: 7, leaderSignedAt: wib(21, 17), createdAt: wib(21), updatedAt: wib(21, 17), reviewStatus: "disetujui", reviewNote: null },
  { id: 2, workDate: wib(22), layer: "kepalaan", product: "Paving Block", mixDesignId: null, approvedMaterials: mats(["Semen PCC", 30, "kg"]), actualMaterials: mats(["Semen PCC", 35, "kg"]), mixingCount: null, boards: null, squareMeters: null, rejects: null, status: "tidak_sesuai", notes: "Semen lebih dari rencana", createdBy: 8, createdAt: wib(22), updatedAt: wib(22), reviewStatus: "revisi", reviewNote: "Cek ulang timbangan" },
]);
rows("strengthTests", [{ id: 1, reportDate: wib(15), companyName: "PT Istana Block", address: "Purwakarta", concreteGrade: "K-300", addressedTo: "Kontraktor X", composition: mats(["Semen", 350, "kg/m³"], ["Air", 175, "l/m³"]), notes: null, createdBy: 8, labSignedBy: 7, labSignedAt: wib(15, 15), leaderSignedBy: 7, leaderSignedAt: wib(15, 16), createdAt: wib(15), updatedAt: wib(15, 16), reviewStatus: "disetujui", reviewNote: null }]);
rows("strengthTestSamples", [
  { id: 1, testId: 1, position: 1, sampleName: "A-1", madeAt: wib(1), testedAt: wib(8), weightKg: 8.4, areaCm2: 225, maxLoadKn: 720.5 },
  { id: 2, testId: 1, position: 2, sampleName: "A-2", madeAt: wib(1), testedAt: wib(8), weightKg: 8.38, areaCm2: 225, maxLoadKn: 705 },
  { id: 3, testId: 1, position: 3, sampleName: "A-3", madeAt: wib(1), testedAt: null, weightKg: null, areaCm2: null, maxLoadKn: null },
]);

// Penerimaan barang, uji lumpur, produksi
const r1 = jpg("receipts/1790300000001-rc1aaaa1.jpg"), r2 = jpg("receipts/1790300000002-rc1bbbb2.jpg"), r3 = jpg("receipts/1790310000001-rc2cccc3.jpg");
const rDang = "/files/receipts/1790320000001-hilang00.jpg"; // dirujuk data tapi objek KV sudah tidak ada
kv("receipts/1790999999999-yatim000.jpg", JPG); // ada di KV tapi tidak dirujuk data manapun
rows("goodsReceipts", [
  { id: 1, receivedAt: wib(12, 8), category: "bahan_baku", itemName: "Pasir Cor", tag: "A", supplier: "CV Pasir Jaya", quarry: "Galian Cikao", quantity: 7, unit: "m³", vehiclePlate: "T 5555 XY", driverName: "Pak Ikin", deliveryNoteNo: "SJ-1201", deliveryMode: "quarry", expeditionName: null, hasBrangkal: 0, status: "diterima", photoUrls: J([r1, r2]), notes: null, dutyOfficerName: "Satpam Joko", tier: 1, qualityNote: "Bersih", qualityBy: 7, qualityAt: wib(12, 10), speedRating: 4, deliveryNote: null, deliveryBy: null, deliveryAt: null, createdBy: 4, createdAt: wib(12, 8), updatedAt: wib(12, 10), priceRating: 3, priceNote: "Agak mahal", priceBy: 7, priceAt: wib(13) },
  { id: 2, receivedAt: wib(14, 9), category: "bahan_baku", itemName: "Semen PCC 50 kg", tag: null, supplier: "Toko Semen Sejahtera", quarry: null, quantity: 200, unit: "sak", vehiclePlate: null, driverName: null, deliveryNoteNo: null, deliveryMode: "ekspedisi", expeditionName: "JNE Cargo", hasBrangkal: null, status: "diterima", photoUrls: J([r3, rDang]), notes: "Foto kedua sudah terhapus dari KV", dutyOfficerName: null, createdBy: 4, createdAt: wib(14, 9), updatedAt: wib(14, 9) },
  { id: 3, receivedAt: wib(16, 7), category: "lainnya", itemName: "Pasir Urug", tag: "B", supplier: "CV Pasir Jaya", quarry: "Galian Cikao", quantity: 5.5, unit: "m³", vehiclePlate: "T 6666 ZZ", driverName: "Pak Ujo", deliveryNoteNo: "SJ-1202", deliveryMode: "quarry", expeditionName: null, hasBrangkal: 1, status: "ditolak", photoUrls: "[]", notes: "Banyak lumpur", dutyOfficerName: "Satpam Joko", tier: 3, qualityNote: "Ditolak", qualityBy: 8, qualityAt: wib(16, 9), createdBy: 4, createdAt: wib(16, 7), updatedAt: wib(16, 9) },
]);
const s1 = jpg("sand-tests/1790330000001-sd1aaaa1.jpg"), s2 = jpg("sand-tests/1790330000002-sd1bbbb2.jpg"), s3 = jpg("sand-tests/1790340000001-sd2cccc3.jpg");
rows("sandTests", [
  { id: 1, receiptId: 1, status: "selesai", testedAt: wib(12, 9), completedAt: wib(12, 11), supplier: "CV Pasir Jaya", quarry: "Galian Cikao", sandType: "Pasir Cor", readingUnit: "cm", sandHeightCm: 18.5, siltHeightCm: 1.2, siltPercent: 6.1, maxSiltPercent: 10, decision: "diterima", startPhotoUrl: s1, photoUrl: s2, notes: null, dutyOfficerName: "Satpam Joko", completedByName: "Rina Lab", createdBy: 4, completedBy: 8, createdAt: wib(12, 9) },
  { id: 2, receiptId: 3, status: "selesai", testedAt: wib(16, 8), completedAt: wib(16, 10), supplier: "CV Pasir Jaya", quarry: null, sandType: "Pasir Urug", readingUnit: "ml", sandHeightCm: 100, siltHeightCm: 22, siltPercent: 22, maxSiltPercent: 10, decision: "ditolak", startPhotoUrl: null, photoUrl: s3, notes: "Lumpur tinggi", dutyOfficerName: null, completedByName: "Rina Lab", createdBy: 4, completedBy: 8, createdAt: wib(16, 8) },
  { id: 3, receiptId: null, status: "draft", testedAt: wib(25, 8), completedAt: null, supplier: null, quarry: null, sandType: "Pasir Halus", readingUnit: "cm", sandHeightCm: null, siltHeightCm: null, siltPercent: null, maxSiltPercent: 10, decision: null, startPhotoUrl: null, photoUrl: null, notes: null, dutyOfficerName: "Satpam Gerbang", createdBy: 4, createdAt: wib(25, 8) },
]);
const pr1 = jpg("production/1790350000001-pr1aaaa1.jpg"), pr2 = jpg("production/1790350000002-pr2bbbb2.jpg");
rows("productionOutputs", [
  { id: 1, productionDate: wib(21), category: "precast", product: "U-Ditch 40×40", spec: "400×400×1200", quantity: 18, unit: "unit", boards: null, rejects: 1, photoUrl: pr1, notes: null, dutyOfficerName: "Satpam Joko", createdBy: 3, createdAt: wib(21, 16), updatedAt: wib(21, 16), issues: J(["Cetakan retak"]), batchCode: "PC-261021-01", leader: "Pak Mandor Dedi", target: 20, cementBags: 36 },
  { id: 2, productionDate: wib(22), category: "paving", product: "Paving Truepave", spec: "6 cm abu", quantity: 42.5, unit: "m²", boards: 85, rejects: 4, photoUrl: pr2, notes: "Lancar", dutyOfficerName: null, createdBy: 3, createdAt: wib(22, 16), updatedAt: wib(22, 16), issues: "[]", batchCode: "PV-261022-01", leader: null, target: null, cementBags: null },
]);

// Piket, kalender, ISO, log, backup
rows("dutyOfficers", [
  { id: 1, accountUserId: 4, name: "Satpam Joko", isActive: 1, createdAt: wib(2), pinHash: "pin-hash-fixture-1", failedAttempts: 0, lockedUntil: null },
  { id: 2, accountUserId: 4, name: "Satpam Budi", isActive: 0, createdAt: wib(2), pinHash: null, failedAttempts: 3, lockedUntil: wib(26) },
]);
rows("dutyShifts", [
  { id: 1, accountUserId: 4, officerId: 1, officerName: "Satpam Joko", startedAt: wib(24, 7), endedAt: wib(24, 19), handoverNote: "Aman; 1 truk pasir tertunda", createdAt: wib(24, 7) },
  { id: 2, accountUserId: 4, officerId: 2, officerName: "Satpam Budi", startedAt: wib(25, 7), endedAt: null, handoverNote: null, createdAt: wib(25, 7) },
]);
const cf = { url: `/files/calendar/1790360000001-cl1aaaa1.pdf`, name: "Notulen rapat.pdf", contentType: "application/pdf", size: PDF.length };
const cf2 = { url: `/files/calendar/1790360000002-cl1bbbb2.jpg`, name: "Foto rapat.jpg", contentType: "image/jpeg", size: JPG.length };
files.set("calendar/1790360000001-cl1aaaa1.pdf", PDF); files.set("calendar/1790360000002-cl1bbbb2.jpg", JPG);
rows("calendarEvents", [
  { id: 1, title: "Rapat mingguan produksi", type: "rapat", startAt: wib(19, 9), endAt: wib(19, 10), location: "Ruang rapat", description: "Bahas target 'Oktober'", reminderMinutes: J([60, 15]), seriesId: "series-fixture-1", createdBy: 1, createdAt: wib(10), updatedAt: wib(10) },
  { id: 2, title: "Training K3", type: "training", startAt: wib(28, 13), endAt: null, location: null, description: null, reminderMinutes: J([1440]), seriesId: null, createdBy: 2, createdAt: wib(20), updatedAt: wib(20) },
]);
rows("calendarParticipants", [{ id: 1, eventId: 1, userId: 1 }, { id: 2, eventId: 1, userId: 3 }, { id: 3, eventId: 2, userId: 8 }]);
rows("calendarReminders", [
  { id: 1, eventId: 1, minutesBefore: 60, remindAt: wib(19, 8), sentAt: wib(19, 8) },
  { id: 2, eventId: 1, minutesBefore: 15, remindAt: wib(19, 8, 45), sentAt: wib(19, 8, 45) },
  { id: 3, eventId: 2, minutesBefore: 1440, remindAt: wib(27, 13), sentAt: null },
]);
rows("calendarResults", [{ id: 1, eventId: 1, leader: "Siti", category: "Produksi", summary: "Target tercapai 90%", attendees: J([{ userId: 1, name: "Siti Customer Service", present: true, score: "A", note: null }, { userId: 3, name: "Pak Mandor Dedi", present: false, score: null, note: "Sakit" }]), guests: "2 orang tamu", durationHours: 1.5, evaluation: "Baik", notes: null, files: J([cf, cf2]), filledBy: 1, filledByName: "Siti Customer Service", createdAt: wib(19, 11), updatedAt: wib(19, 11) }]);
rows("isoRecords", [
  { id: 1, formCode: "F-IB-01", kind: "record", recordDate: "2026-10-21", sourceKey: null, number: "001/F-IB-01/X/2026", data: J({ a: "isian", b: 12.5, _from: "manual" }), history: "[]", createdBy: 1, createdByName: "Siti Customer Service", updatedByName: null, createdAt: wib(21), updatedAt: wib(21) },
  { id: 2, formCode: "F-IB-03", kind: "supplement", recordDate: "2026-10", sourceKey: "2026-10:5", number: null, data: J({ catatan: "pelengkap baris aplikasi" }), history: J([{ at: wib(22), by: "Admin Kantor" }]), createdBy: null, createdByName: "Admin Kantor", updatedByName: "Admin Kantor", createdAt: wib(22), updatedAt: wib(23) },
  { id: 3, formCode: "F-IB-09", kind: "objective", recordDate: "2026-10", sourceKey: null, number: null, data: J({ sasaran: "Reject < 3%" }), history: "[]", createdBy: 7, createdByName: "Lukman QC", updatedByName: null, createdAt: wib(23), updatedAt: wib(23) },
]);
rows("activityLogs", [
  { id: 1, at: wib(25, 9), userId: 1, userName: "Siti Customer Service", role: "superadmin", dutyOfficerName: null, action: "auth.login", label: "Login", summary: "Login berhasil", details: null, success: 1, ip: "203.0.113.5", device: "Chrome / Windows" },
  { id: 2, at: wib(24, 10), userId: 2, userName: "Admin Kantor", role: "admin", dutyOfficerName: null, action: "order.create", label: "Buat order", summary: "PO/2610/0010", details: J({ customerId: 1 }), success: 1, ip: "203.0.113.6", device: "Edge / Windows" },
  { id: 3, at: wib(23, 8), userId: null, userName: "orang tak dikenal", role: null, dutyOfficerName: null, action: "auth.login", label: "Login", summary: "Login gagal", details: null, success: 0, ip: "198.51.100.9", device: null },
  { id: 4, at: wib(22, 8), userId: 4, userName: "Satpam Gerbang", role: "satpam", dutyOfficerName: "Satpam Joko", action: "receipt.create", label: "Terima barang", summary: "Pasir Cor 7 m³", details: null, success: 1, ip: null, device: null },
]);
rows("backupRuns", [
  { id: 1, at: wib(19, 10), userId: 1, userName: "Siti Customer Service", folder: "PD.istana block purwakarta", tables: 33, rows: 120, photos: 10, newPhotos: 10 },
  { id: 2, at: wib(26, 10), userId: 1, userName: "Siti Customer Service", folder: "unduhan (tanpa foto)", tables: 33, rows: 150, photos: 0, newPhotos: 0 },
]);

// ---- 3. tulis .sql persis seperti client/src/lib/backup.ts + worker/backup.ts ----
const sqlValue = value => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
};
const SCHEMA_ONLY = new Set(["sessions"]);
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
const manifest = {
  tables: tables.map(t => ({ name: t.name, sql: t.sql, rows: SCHEMA_ONLY.has(t.name) ? 0 : db.prepare(`SELECT count(*) AS total FROM "${t.name}"`).get().total })),
  indexes: db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all().map(r => r.sql),
};
const total = manifest.tables.reduce((s, t) => s + t.rows, 0);
const dibuat = new Date("2026-10-26T03:00:00Z").toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
let out = `-- Backup aplikasi PT Istana Block (app.kirimistanablock.com)\n-- Dibuat: ${dibuat}\n-- Tabel: ${manifest.tables.length}, baris: ${total}. Isi tabel sessions sengaja tidak disimpan.\nPRAGMA defer_foreign_keys=TRUE;\n`;
out += `\n${manifest.tables.map(t => `${t.sql};`).join("\n")}\n`;
for (const t of manifest.tables) {
  out += `\n-- ${t.name}: ${t.rows} baris\n`;
  for (let offset = 0; offset < t.rows; offset += 500) {
    const rs = db.prepare(`SELECT * FROM "${t.name}" LIMIT ?1 OFFSET ?2`).all(500, offset);
    if (!rs.length) break;
    const columns = Object.keys(rs[0]).map(c => `"${c}"`).join(",");
    out += rs.map(r => `INSERT INTO "${t.name}" (${columns}) VALUES (${Object.values(r).map(sqlValue).join(",")});`).join("\n") + "\n";
  }
}
out += `\n${manifest.indexes.map(sql => `${sql};`).join("\n")}\n`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "database"), { recursive: true });
fs.writeFileSync(path.join(OUT, "database", `backup-${STAMP}.sql`), out, "utf8");
for (const [key, bytes] of files) {
  const p = path.join(OUT, "foto", ...key.split("/"));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, bytes);
}
console.log(`OK: ${manifest.tables.length} tabel, ${total} baris, ${files.size} foto -> ${OUT}`);
