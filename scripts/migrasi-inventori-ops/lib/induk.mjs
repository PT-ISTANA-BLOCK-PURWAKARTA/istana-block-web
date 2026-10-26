// Data induk (A.2): pelanggan -> fin_contacts, barang -> fin_items, sopir -> ops_drivers, kendaraan -> ops_vehicles.
// Dicocokkan dulu (HP / nama persis / plat); tak cocok -> baris baru bertanda iops-. Data web yang cocok tidak diubah.
import { insert, lit, sec, wibDate, iid, normalizePhone, normName } from "./core.mjs";

const byAgeActive = (a, b) => (b.active ?? 0) - (a.active ?? 0) || (a.created_at ?? 0) - (b.created_at ?? 0) || String(a.id).localeCompare(String(b.id));

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); if (k) (m.get(k) ?? m.set(k, []).get(k)).push(r); }
  for (const l of m.values()) l.sort(byAgeActive);
  return m;
}

export function migrate(ctx) {
  // ---------- pelanggan -> fin_contacts ----------
  // baris iops-* = hasil impor sebelumnya: diabaikan agar proses ulang menghasilkan SQL yang sama
  const live = (rows) => rows.filter((w) => !String(w.id).startsWith("iops-"));
  const webContacts = live(ctx.webRows("SELECT id, name, phone, active, created_at FROM fin_contacts"));
  const cByPhone = groupBy(webContacts, (w) => normalizePhone(w.phone));
  const cByName = groupBy(webContacts, (w) => normName(w.name));
  const addrs = ctx.rows("SELECT * FROM customerAddresses ORDER BY customerId, id");
  const repByKey = new Map(); // HP ternormalisasi -> {target, srcId}
  let nCust = 0;
  for (const c of ctx.rows("SELECT * FROM customers ORDER BY id")) {
    const key = normalizePhone(c.phone);
    const rep = (hasil, target, catatan = "") => ctx.report("cocok-pelanggan", { id_sumber: c.id, nama: c.name, kunci: key ?? (c.phone || "(kosong)"), hasil, id_target: target, catatan });
    if (key && repByKey.has(key)) {
      const r = repByKey.get(key);
      ctx.contactMap.set(c.id, r.target);
      rep("cocok", r.target, `digabung ke pelanggan sumber #${r.srcId} (HP sama)`);
      continue;
    }
    const hits = key ? cByPhone.get(key) : null;
    if (hits) {
      ctx.contactMap.set(c.id, hits[0].id);
      repByKey.set(key, { target: hits[0].id, srcId: c.id });
      rep(hits.length > 1 ? "ambigu" : "cocok", hits[0].id, hits.length > 1 ? `banyak kontak web (${hits.map((h) => h.id).join(", ")}); dipilih aktif/tertua` : "");
      continue;
    }
    const id = iid("customers", c.id);
    const mine = addrs.filter((a) => a.customerId === c.id);
    const a = mine.find((x) => /^utama$/i.test(String(x.label ?? "").trim())) ?? mine[0];
    const address = a ? [a.addressText, a.city, a.province].filter((x) => x && String(x).trim()).join(", ") : "";
    const sama = cByName.get(normName(c.name));
    ctx.emit("02-master", insert("fin_contacts", { id, kind: "pelanggan", name: c.name, company: "", phone: key ?? (c.phone ?? ""), email: c.email ?? "", address, note: c.notes ?? "", active: c.isActive ? 1 : 0, created_at: sec(c.createdAt), updated_at: sec(c.updatedAt) ?? sec(c.createdAt) }));
    ctx.contactMap.set(c.id, id);
    if (key) repByKey.set(key, { target: id, srcId: c.id });
    nCust++;
    rep("baru", id, sama ? `nama sama dengan kontak web ${sama[0].id}${key ? " tapi HP beda" : ""}: gabung manual bila orang yang sama` : (key ? "" : "HP kosong/tidak valid"));
  }
  ctx.count("customers", nCust);

  // ---------- barang -> fin_items (cocok nama persis; baru bertanda iops-items-) ----------
  for (const p of ctx.rows("SELECT id, name, unit FROM products ORDER BY id")) ctx.item({ productId: p.id, name: p.name, unit: p.unit });
  for (const o of ctx.rows("SELECT product, spec, unit FROM productionOutputs ORDER BY id")) ctx.item({ name: o.product + (o.spec ? ` ${o.spec}` : ""), unit: o.unit });
  for (const l of ctx.rows("SELECT DISTINCT productNameSnapshot AS name, unit FROM orderItems ORDER BY productNameSnapshot")) ctx.item({ name: l.name, unit: l.unit });

  // ---------- sopir -> ops_drivers ----------
  const webDrivers = live(ctx.webRows("SELECT id, name, phone, active, created_at, license_no, license_expiry FROM ops_drivers"));
  const dByPhone = groupBy(webDrivers, (w) => normalizePhone(w.phone));
  const dRep = new Map();
  let nDrv = 0;
  for (const d of ctx.rows("SELECT * FROM drivers ORDER BY id")) {
    const key = normalizePhone(d.phone);
    const rep = (hasil, target, catatan = "") => ctx.report("cocok-sopir", { id_sumber: d.id, nama: d.name, kunci: key ?? (d.phone || "(kosong)"), hasil, id_target: target, catatan });
    const licExp = wibDate(d.licenseExpiryDate);
    if (key && dRep.has(key)) { ctx.driverMap.set(d.id, dRep.get(key)); rep("cocok", dRep.get(key), "digabung (HP sama dengan sopir sumber lain)"); continue; }
    const hits = key ? dByPhone.get(key) : null;
    if (hits) {
      const w = hits[0];
      ctx.driverMap.set(d.id, w.id); dRep.set(key, w.id);
      const isi = [];
      if (d.licenseNumber && !w.license_no) { ctx.emit("02-master", `UPDATE ops_drivers SET license_no = ${lit(d.licenseNumber)} WHERE id = ${lit(w.id)} AND (license_no IS NULL OR license_no = '');`); isi.push("license_no diisi"); }
      if (licExp && !w.license_expiry) { ctx.emit("02-master", `UPDATE ops_drivers SET license_expiry = ${lit(licExp)} WHERE id = ${lit(w.id)} AND (license_expiry IS NULL OR license_expiry = '');`); isi.push("license_expiry diisi"); }
      rep(hits.length > 1 ? "ambigu" : "cocok", w.id, [hits.length > 1 ? `banyak sopir web (${hits.map((h) => h.id).join(", ")})` : "", ...isi].filter(Boolean).join("; "));
      continue;
    }
    const id = iid("drivers", d.id);
    ctx.emit("02-master", insert("ops_drivers", { id, name: d.name, phone: key ?? (d.phone ?? ""), active: d.isAvailable ? 1 : 0, note: "", license_no: d.licenseNumber ?? null, license_expiry: licExp, created_at: sec(d.createdAt), updated_at: sec(d.updatedAt) ?? sec(d.createdAt) }));
    ctx.driverMap.set(d.id, id); if (key) dRep.set(key, id);
    nDrv++;
    rep("baru", id, key ? "" : "HP kosong/tidak valid");
  }
  ctx.count("drivers", nDrv);
  // tautkan akun pengguna sopir -> sopir (hanya bila belum terisi)
  for (const d of ctx.rows("SELECT id, userId FROM drivers WHERE userId IS NOT NULL")) {
    const uid = ctx.user(d.userId), did = ctx.driver(d.id);
    if (uid && did) ctx.emit("01-users", `UPDATE users SET driver_id = ${lit(did)} WHERE id = ${uid} AND (driver_id IS NULL OR driver_id = '');`);
  }

  // ---------- kendaraan -> ops_vehicles ----------
  const plateKey = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, "");
  const webVeh = live(ctx.webRows("SELECT id, plate, active, created_at FROM ops_vehicles"));
  const vByPlate = groupBy(webVeh, (w) => plateKey(w.plate));
  const vRep = new Map();
  let nVeh = 0;
  for (const v of ctx.rows("SELECT * FROM vehicles ORDER BY id")) {
    const key = plateKey(v.plateNumber);
    const rep = (hasil, target, catatan = "") => ctx.report("cocok-kendaraan", { id_sumber: v.id, nama: v.plateNumber, kunci: key, hasil, id_target: target, catatan });
    if (vRep.has(key)) { ctx.vehicleMap.set(v.id, vRep.get(key)); rep("cocok", vRep.get(key), "digabung (plat sama dengan kendaraan sumber lain)"); continue; }
    const hits = vByPlate.get(key);
    if (hits) {
      ctx.vehicleMap.set(v.id, hits[0].id); vRep.set(key, hits[0].id);
      rep(hits.length > 1 ? "ambigu" : "cocok", hits[0].id, hits.length > 1 ? `plat ganda di web (${hits.map((h) => h.id).join(", ")}); dipilih aktif/tertua` : "");
      continue;
    }
    const id = iid("vehicles", v.id);
    ctx.emit("02-master", insert("ops_vehicles", { id, plate: v.plateNumber, name: v.vehicleType ?? "", capacity: v.capacityNote ?? "", active: v.isActive ? 1 : 0, note: "", stnk_expiry: wibDate(v.stnkExpiryDate), kir_expiry: wibDate(v.kirExpiryDate), created_at: sec(v.createdAt), updated_at: sec(v.updatedAt) ?? sec(v.createdAt) }));
    ctx.vehicleMap.set(v.id, id); vRep.set(key, id);
    nVeh++;
    rep("baru", id);
  }
  ctx.count("vehicles", nVeh);
}
