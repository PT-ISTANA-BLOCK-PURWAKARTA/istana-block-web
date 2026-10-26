// 03-pesanan-kirim: orders, orderItems, deliveries (+turunan delivery_lines), deliveryStatusHistory,
// deliveryProofs, publicTrackingLinks, orderDeletionAudit  (spesifikasi A.3, B, D, E.2/E.3).
// Semua data arsip: departed_at SELALU NULL, harga baris 0, tanpa stok/jurnal.
import { insert, iid, sec, wibDate } from "./core.mjs";

const FILE = "03-pesanan-kirim";
const MAX_STMT = 90_000; // batas D1 100 KB per pernyataan (E.3)

const ORDER_STATUS = {
  draft: "draft",
  confirmed: "dikonfirmasi",
  preparing: "dikonfirmasi",
  ready_to_ship: "dikonfirmasi",
  assigned: "dikonfirmasi",
  in_delivery: "dikirim_sebagian",
  delayed: "dikirim_sebagian",
  delivered: "terkirim",
  cancelled: "batal",
};
const DELIVERY_STATUS = {
  unassigned: "dijadwalkan",
  assigned: "dijadwalkan",
  ready: "dimuat",
  in_transit: "berangkat",
  arrived: "tiba",
  delayed: "tertunda",
  delivered: "terkirim",
  cancelled: "batal",
};
const OPEN_DELIVERY = new Set(["dijadwalkan", "dimuat", "berangkat", "tiba", "tertunda"]);

const nn = (v) => (v === undefined || v === null ? null : v);
const str = (v) => (v === undefined || v === null ? "" : String(v));
const secN = (ms) => (ms === undefined || ms === null ? null : sec(ms));
const dateN = (ms) => (ms === undefined || ms === null ? null : wibDate(ms));
const rupiah = (v) => (v === undefined || v === null ? 0 : Math.round(Number(v)));
const digits = (v) => str(v).replace(/\D/g, "");
const isIntegerLike = (v) => v !== undefined && v !== null && /^\d+$/.test(String(v).trim());
const wibStamp = (ms) => `${new Date(Number(ms) + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " ")} WIB`;
const joinLines = (...parts) => parts.map((p) => str(p).trim()).filter(Boolean).join("\n");

function mapsUrl(addr) {
  if (!addr) return "";
  if (str(addr.shareLocationUrl).trim()) return str(addr.shareLocationUrl).trim();
  if (addr.latitude != null && addr.longitude != null) return `https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`;
  return "";
}

function addressText(addr, snapshot) {
  const src = addr ?? snapshot;
  if (!src) return "";
  return [src.addressText, src.city, src.province].map((s) => str(s).trim()).filter(Boolean).join(", ");
}

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return null;
  }
}

export function migrate(ctx) {
  const out = (stmt) => ctx.emit(FILE, stmt);
  const emitRow = (table, row) => out(insert(table, row));

  /* ------------------------------------------------------------ bahan sumber */
  const orders = ctx.rows(`SELECT * FROM orders ORDER BY id`);
  const items = ctx.rows(`SELECT * FROM orderItems ORDER BY orderId, id`);
  const deliveries = ctx.rows(`SELECT * FROM deliveries ORDER BY id`);
  const history = ctx.rows(`SELECT * FROM deliveryStatusHistory ORDER BY id`);
  const proofs = ctx.rows(`SELECT * FROM deliveryProofs ORDER BY id`);
  const links = ctx.rows(`SELECT * FROM publicTrackingLinks ORDER BY id`);
  const audits = ctx.rows(`SELECT * FROM orderDeletionAudit ORDER BY id`);
  const addrById = new Map(ctx.rows(`SELECT * FROM customerAddresses`).map((a) => [a.id, a]));
  const custById = new Map(ctx.rows(`SELECT id, name, phone FROM customers`).map((c) => [c.id, c]));

  // Nomor unik (ops_orders_number_uq / ops_deliveries_number_uq): INSERT OR IGNORE akan MEMBUANG baris bentrok
  // diam-diam, jadi nomor yang sudah dipakai dokumen web (bukan arsip kita sendiri) diberi akhiran -A, -B, ...
  const webTaken = (table) => new Set(ctx.webRows(`SELECT number FROM ${table} WHERE id NOT LIKE 'iops-%'`).map((r) => r.number));
  const takenOrderNo = webTaken("ops_orders");
  const takenDeliveryNo = webTaken("ops_deliveries");
  const uniqueNo = (base, taken, kind, srcId) => {
    let n = base;
    for (let i = 0; taken.has(n); i++) n = `${base}-${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
    taken.add(n);
    if (n !== base) ctx.report("nomor-bentrok", { jenis: kind, id_sumber: srcId, nomor_sumber: base, nomor_target: n });
    return n;
  };
  const orderNo = new Map(); // id sumber PO -> nomor target

  const itemsByOrder = new Map();
  for (const it of items) {
    if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, []);
    itemsByOrder.get(it.orderId).push(it);
  }
  const histByDelivery = new Map();
  for (const h of history) {
    if (!histByDelivery.has(h.deliveryId)) histByDelivery.set(h.deliveryId, []);
    histByDelivery.get(h.deliveryId).push(h);
  }

  /* ------------------------------------------------------------ pesanan */
  const done = { orders: 0, orderItems: 0, deliveries: 0, history: 0, proofs: 0, links: 0, audits: 0, deliveryLines: 0 };
  const skippedOrders = new Set(); // id sumber PO yang tidak dimigrasi (F3 atau data rusak)
  const orderById = new Map();
  const orderLineItem = new Map(); // id orderItem sumber -> { lineId, itemId, qty }

  for (const o of orders) {
    orderById.set(o.id, o);
    const poNumber = str(o.poNumber);
    if (ctx.isSkipped(o.id)) {
      skippedOrders.add(o.id);
      ctx.report("pesanan-dilewati", { id_sumber: o.id, po: poNumber, status: o.status, alasan: "PO terbuka, --open=skip" });
      continue;
    }
    const contactId = ctx.contact(o.customerId);
    if (!contactId) {
      skippedOrders.add(o.id);
      ctx.report("pesanan-dilewati", { id_sumber: o.id, po: poNumber, status: o.status, alasan: "pelanggan tidak terpetakan" });
      continue;
    }
    const orderId = iid("orders", o.id);
    const number = uniqueNo(poNumber, takenOrderNo, "PO", o.id);
    orderNo.set(o.id, number);
    const addr = addrById.get(o.deliveryAddressId) ?? null;
    const snapshot = parseJson(o.deliveryAddressSnapshot);
    const cust = custById.get(o.customerId);

    // site_contact: penerima di lokasi bila beda dari pelanggan
    let siteContact = "";
    const rName = str(addr?.recipientName ?? snapshot?.recipientName).trim();
    const rPhone = str(addr?.recipientPhone ?? snapshot?.recipientPhone).trim();
    if (rName || rPhone) {
      const sameName = rName.toLowerCase() === str(cust?.name).trim().toLowerCase();
      const phoneEmptyOrSame = !rPhone || digits(rPhone).slice(-9) === digits(cust?.phone).slice(-9);
      if (!(sameName && phoneEmptyOrSame)) siteContact = [rName, rPhone].filter(Boolean).join(" · ");
    }

    const confirmedRaw = o.paymentConfirmedBy;
    let confirmedUser = null;
    let confirmedText = "";
    if (confirmedRaw !== null && confirmedRaw !== undefined && String(confirmedRaw).trim() !== "") {
      if (isIntegerLike(confirmedRaw)) confirmedUser = ctx.user(Number(confirmedRaw));
      else confirmedText = String(confirmedRaw).trim();
    }

    const note = joinLines(
      o.notes,
      addr?.deliveryNotes,
      `[ARSIP inventori-ops] PO lama ${poNumber}`,
      confirmedText ? `Konfirmasi bayar oleh: ${confirmedText}` : "",
    );

    emitRow("ops_orders", {
      id: orderId,
      number,
      date: dateN(o.orderDate) ?? dateN(o.createdAt),
      contact_id: contactId,
      customer_ref: "",
      project: "",
      address: addressText(addr, snapshot),
      maps_url: mapsUrl(addr),
      site_contact: siteContact,
      requested_date: dateN(o.requestedDeliveryDate),
      status: ORDER_STATUS[o.status] ?? "dikonfirmasi",
      ongkir: rupiah(o.deliveryFee),
      discount: rupiah(o.discount),
      taxable: 0,
      note,
      external_ref: nn(o.externalRef),
      payment_status: nn(o.paymentStatus),
      payment_confirmed_by: confirmedUser,
      payment_confirmed_at: secN(o.paymentConfirmedAt),
      cancel_reason: nn(o.cancellationReason),
      cancelled_by: o.cancelledBy != null ? ctx.user(o.cancelledBy) : null,
      cancelled_at: secN(o.cancelledAt),
      created_by: o.createdBy != null ? ctx.user(o.createdBy) : null,
      created_at: secN(o.createdAt) ?? secN(o.orderDate),
      updated_at: secN(o.updatedAt) ?? secN(o.createdAt) ?? secN(o.orderDate),
    });
    done.orders++;

    /* ---- baris PO */
    const lines = itemsByOrder.get(o.id) ?? [];
    let priced = 0;
    let pricedSum = 0;
    lines.forEach((it, idx) => {
      const itemId = ctx.item({ productId: it.productId, name: it.productNameSnapshot, unit: it.unit });
      if (!itemId) {
        ctx.report("pesanan-dilewati", { id_sumber: `orderItems:${it.id}`, po: poNumber, status: o.status, alasan: "barang tidak terpetakan, baris dilewati" });
        return;
      }
      const lineId = iid("orderItems", it.id);
      if (Number(it.unitPrice) > 0) {
        priced++;
        pricedSum += Number(it.unitPrice) * Number(it.quantity);
      }
      emitRow("ops_order_lines", {
        id: lineId,
        order_id: orderId,
        item_id: itemId,
        description: [str(it.specificationSnapshot).trim(), str(it.notes).trim()].filter(Boolean).join("; "),
        qty: Number(it.quantity),
        unit: str(it.unit),
        price: 0,
        sort: idx,
      });
      orderLineItem.set(it.id, { lineId, itemId, qty: Number(it.quantity), orderId: o.id });
      done.orderItems++;
    });
    if (priced > 0) {
      ctx.report("po-harga-diabaikan", { id_sumber: o.id, po: poNumber, baris_berharga: priced, nilai_sumber: Math.round(pricedSum) });
    }
  }

  /* ------------------------------------------------------------ pengiriman */
  const deliveryById = new Map();
  const skippedDeliveries = new Set();
  for (const d of deliveries) {
    const o = orderById.get(d.orderId);
    if (!o) {
      skippedDeliveries.add(d.id);
      ctx.report("pesanan-dilewati", { id_sumber: `deliveries:${d.id}`, po: "", status: d.status, alasan: "PO induk tidak ada di sumber" });
      continue;
    }
    if (skippedOrders.has(d.orderId)) {
      skippedDeliveries.add(d.id);
      ctx.report("pesanan-dilewati", { id_sumber: `deliveries:${d.id}`, po: str(o.poNumber), status: d.status, alasan: "mengikuti PO yang dilewati" });
      continue;
    }
    const status = DELIVERY_STATUS[d.status] ?? "dijadwalkan";
    const deliveryId = iid("deliveries", d.id);
    deliveryById.set(d.id, { id: deliveryId, status });

    const hist = histByDelivery.get(d.id) ?? [];
    const firstReady = hist.find((h) => h.toStatus === "ready");
    const note = joinLines(d.driverNotes, d.startedAt != null ? `[ARSIP] berangkat ${wibStamp(d.startedAt)}` : "");
    const dateMs = d.startedAt ?? d.scheduledAt ?? d.createdAt;

    emitRow("ops_deliveries", {
      id: deliveryId,
      number: uniqueNo(`SJ-${orderNo.get(d.orderId)}`, takenDeliveryNo, "SJ", d.id),
      order_id: iid("orders", d.orderId),
      date: dateN(dateMs),
      vehicle_id: d.vehicleId != null ? ctx.vehicle(d.vehicleId) : null,
      driver_id: d.driverId != null ? ctx.driver(d.driverId) : null,
      status,
      loaded_at: firstReady ? secN(firstReady.createdAt) : null,
      departed_at: null, // SENGAJA NULL (bagian B): arsip tidak boleh dianggap "terposting"
      arrived_at: secN(d.arrivedAt),
      delivered_at: secN(d.completedAt),
      delay_reason: nn(d.delayReason),
      received_by: "",
      proof_key: null,
      note,
      created_by: null,
      created_at: secN(d.createdAt) ?? secN(dateMs),
      updated_at: secN(d.updatedAt) ?? secN(d.createdAt) ?? secN(dateMs),
    });
    done.deliveries++;

    /* ---- baris SJ (turunan baris PO); lewati SJ batal dan SJ terbuka pada PO terminal (anomali) */
    if (status === "batal") continue;
    if (OPEN_DELIVERY.has(status)) {
      ctx.report("sj-anomali", {
        id_sumber: d.id,
        sj: `SJ-${str(o.poNumber)}`,
        status_sj: status,
        status_po: ORDER_STATUS[o.status] ?? o.status,
        catatan: "SJ terbuka pada PO yang tidak dilewati; baris SJ tidak dibuat agar tidak mengurangi stok bebas",
      });
      continue;
    }
    for (const it of itemsByOrder.get(d.orderId) ?? []) {
      const ol = orderLineItem.get(it.id);
      if (!ol) continue;
      emitRow("ops_delivery_lines", {
        id: iid("deliveryLines", `${d.id}-${it.id}`),
        delivery_id: deliveryId,
        order_line_id: ol.lineId,
        item_id: ol.itemId,
        qty: ol.qty,
      });
      done.deliveryLines++;
    }
  }

  /* ------------------------------------------------------------ riwayat status */
  for (const h of history) {
    if (!deliveryById.has(h.deliveryId)) continue;
    const duty = str(h.dutyOfficerName).trim();
    let changedBy = null;
    if (duty) changedBy = ctx.officer(duty);
    if (changedBy == null && h.changedBy != null) changedBy = ctx.user(h.changedBy);
    emitRow("ops_delivery_history", {
      id: iid("deliveryStatusHistory", h.id),
      delivery_id: deliveryById.get(h.deliveryId).id,
      from_status: h.fromStatus ? (DELIVERY_STATUS[h.fromStatus] ?? null) : null,
      to_status: DELIVERY_STATUS[h.toStatus] ?? "dijadwalkan",
      changed_by: changedBy,
      changed_by_driver: h.changedByDriver != null ? ctx.driver(h.changedByDriver) : null,
      note: joinLines(h.note, duty ? `(petugas jaga ${duty})` : "").replace("\n", " "),
      created_at: secN(h.createdAt) ?? 0,
    });
    done.history++;
  }

  /* ------------------------------------------------------------ bukti kirim */
  for (const p of proofs) {
    const del = deliveryById.get(p.deliveryId);
    if (!del) continue;
    const key = ctx.photo(p.fileKey || p.fileUrl, "pengiriman", { deliveryId: String(p.deliveryId), ref: `deliveryProofs:${p.id}` });
    if (!key) {
      ctx.report("bukti-kirim-dilewati", { id_sumber: p.id, delivery: p.deliveryId, file: str(p.fileKey || p.fileUrl), alasan: "berkas tidak ada di foto/" });
      continue;
    }
    emitRow("ops_delivery_proofs", {
      id: iid("deliveryProofs", p.id),
      delivery_id: del.id,
      kind: p.proofType || "photo",
      file_key: key,
      original_name: str(p.originalName),
      created_by: p.createdBy != null ? ctx.user(p.createdBy) : null,
      created_by_driver: p.createdByDriver != null ? ctx.driver(p.createdByDriver) : null,
      created_at: secN(p.createdAt) ?? 0,
    });
    done.proofs++;
  }

  /* ------------------------------------------------------------ tautan lacak */
  for (const l of links) {
    const del = deliveryById.get(l.deliveryId);
    if (!del) continue;
    const revoked = Number(l.isRevoked) === 1;
    const expired = l.expiresAt != null && Math.floor(Number(l.expiresAt) / 1000) <= ctx.cutoverSec;
    if (revoked || expired) {
      ctx.report("tautan-lacak-dilewati", { id_sumber: l.id, delivery: l.deliveryId, alasan: revoked ? "dicabut" : "kedaluwarsa" });
      continue;
    }
    emitRow("ops_tracking_links", {
      id: iid("publicTrackingLinks", l.id),
      delivery_id: del.id,
      token_hash: l.tokenHash,
      last_accessed_at: secN(l.lastAccessedAt),
      created_by: null,
      created_at: secN(l.createdAt) ?? 0,
    });
    done.links++;
  }

  /* ------------------------------------------------------------ jejak PO dihapus */
  for (const a of audits) {
    let snapshot = typeof a.snapshot === "string" ? a.snapshot : JSON.stringify(a.snapshot ?? {});
    if (parseJson(snapshot) === null || typeof parseJson(snapshot) !== "object") {
      snapshot = JSON.stringify({ raw: snapshot });
    }
    if (Buffer.byteLength(snapshot, "utf8") > MAX_STMT) {
      ctx.report("snapshot-dipotong", { id_sumber: a.id, po: str(a.poNumber), ukuran: Buffer.byteLength(snapshot, "utf8") });
      snapshot = JSON.stringify({ truncated: true, note: "Snapshot asli terlalu besar untuk D1; lihat backup .sql inventori-ops" });
    }
    emitRow("ops_order_deletions", {
      id: iid("orderDeletionAudit", a.id),
      order_id: iid("orders", a.originalOrderId),
      number: str(a.poNumber),
      customer_name: str(a.customerName),
      customer_phone: str(a.customerPhone),
      reason: str(a.reason),
      snapshot,
      deleted_by: a.deletedBy != null ? ctx.user(a.deletedBy) : null,
      deleted_at: secN(a.deletedAt) ?? 0,
    });
    done.audits++;
  }

  /* ------------------------------------------------------------ hitungan (sumber -> dimigrasi) */
  ctx.count("orders", done.orders);
  ctx.count("orderItems", done.orderItems);
  ctx.count("deliveries", done.deliveries);
  ctx.count("deliveryStatusHistory", done.history);
  ctx.count("deliveryProofs", done.proofs);
  ctx.count("publicTrackingLinks", done.links);
  ctx.count("orderDeletionAudit", done.audits);
  return done;
}
