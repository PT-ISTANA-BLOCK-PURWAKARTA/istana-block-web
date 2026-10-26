// Modul migrasi: piket (dutyShifts), QC, penerimaan, uji pasir, produksi ARSIP (tanpa stok/jurnal), kalender, ISO.
// Spesifikasi: docs/migrasi-data-inventori-ops.md (A.1 dutyShifts, A.4, A.5, D, E.2, E.3).
// Keluaran: 04-qc, 05-terima-produksi, 06-piket-kalender, 07-iso.
import { insert, sec, wibDate, iid } from "./core.mjs";

const WARN_BYTES = 90_000; // batas panjang SQL D1 ~100 KB (E.3)

export function migrate(ctx) {
  const nn = (v) => (v == null ? "" : v);
  const s = (ms) => (ms == null ? null : sec(ms));
  const d = (ms) => (ms == null ? null : wibDate(ms));
  const idOf = (r) => (r && typeof r === "object" ? (r.id ?? null) : (r ?? null));
  const uid = (srcId) => (srcId == null ? null : (ctx.user(srcId) ?? null));
  const skip = (table, id, alasan) => ctx.report("dilewati", { tabel: table, id_sumber: id, alasan });
  const note = (table, id, catatan) => ctx.report("catatan", { tabel: table, id_sumber: id, catatan });

  const put = (file, table, row, srcTable, srcId) => {
    const stmt = insert(table, row);
    if (Buffer.byteLength(stmt, "utf8") > WARN_BYTES) note(srcTable, srcId, `pernyataan ${table} ${Buffer.byteLength(stmt, "utf8")} byte, dekat batas D1 100 KB`);
    ctx.emit(file, stmt);
  };

  /** Teks JSON valid, atau fallback (+ catatan). */
  const jsonText = (v, fallback, srcTable, srcId, col) => {
    if (v == null || v === "") return fallback;
    try { JSON.parse(v); return v; } catch { note(srcTable, srcId, `${col} bukan JSON valid, diganti ${fallback}`); return fallback; }
  };
  const parseJson = (v, fallback) => { try { const x = JSON.parse(v); return x ?? fallback; } catch { return fallback; } };
  const joinNotes = (...parts) => parts.filter((p) => p != null && String(p).trim() !== "").join("\n");
  const userName = (id) => ctx.rows("SELECT name FROM users WHERE id = ?", id)[0]?.name ?? `pengguna #${id}`;
  const officerOr = (name, srcUserId) => (name ? idOf(ctx.officer(name)) : null) ?? uid(srcUserId);

  // ===================== 04-qc =====================
  const F_QC = "04-qc";

  let n = 0;
  for (const r of ctx.rows("SELECT * FROM mixDesigns ORDER BY id")) {
    put(F_QC, "qc_mix_designs", {
      id: iid("mixDesigns", r.id), name: r.name, layer: r.layer, product: r.product,
      materials: jsonText(r.materials, "[]", "mixDesigns", r.id, "materials"),
      notes: nn(r.notes), status: r.status, active: r.isActive ? 1 : 0,
      created_by: uid(r.createdBy), approved_by: uid(r.approvedBy), approved_at: s(r.approvedAt),
      review_note: r.reviewNote ?? null, retired_reason: r.retiredReason ?? null,
      retired_by: uid(r.retiredBy), retired_at: s(r.retiredAt),
      created_at: s(r.createdAt), updated_at: s(r.updatedAt ?? r.createdAt),
    }, "mixDesigns", r.id);
    n++;
  }
  ctx.count("mixDesigns", n);

  n = 0;
  for (const r of ctx.rows("SELECT * FROM mixDesignLogs ORDER BY id")) {
    const ttd = r.leaderSignedBy != null || r.leaderSignedAt != null
      ? `[TTD pimpinan lama: ${r.leaderSignedBy != null ? userName(r.leaderSignedBy) : "-"}${r.leaderSignedAt != null ? ` ${d(r.leaderSignedAt)}` : ""}]` : null;
    put(F_QC, "qc_mix_logs", {
      id: iid("mixDesignLogs", r.id), work_date: d(r.workDate), layer: r.layer, product: r.product,
      mix_design_id: r.mixDesignId != null ? iid("mixDesigns", r.mixDesignId) : null,
      approved_materials: jsonText(r.approvedMaterials, "[]", "mixDesignLogs", r.id, "approvedMaterials"),
      actual_materials: jsonText(r.actualMaterials, "[]", "mixDesignLogs", r.id, "actualMaterials"),
      mixing_count: r.mixingCount ?? null, boards: r.boards ?? null, square_meters: r.squareMeters ?? null, rejects: r.rejects ?? null,
      status: r.status, notes: joinNotes(r.notes, ttd), review_status: r.reviewStatus, review_note: r.reviewNote ?? null,
      created_by: uid(r.createdBy), manager_signed_by: uid(r.managerSignedBy), manager_signed_at: s(r.managerSignedAt),
      created_at: s(r.createdAt), updated_at: s(r.updatedAt ?? r.createdAt),
    }, "mixDesignLogs", r.id);
    n++;
  }
  ctx.count("mixDesignLogs", n);

  n = 0;
  for (const r of ctx.rows("SELECT * FROM strengthTests ORDER BY id")) {
    put(F_QC, "qc_strength_tests", {
      id: iid("strengthTests", r.id), report_date: d(r.reportDate), company_name: nn(r.companyName), address: nn(r.address),
      concrete_grade: r.concreteGrade, addressed_to: nn(r.addressedTo),
      composition: jsonText(r.composition, "[]", "strengthTests", r.id, "composition"), notes: nn(r.notes),
      review_status: r.reviewStatus, review_note: r.reviewNote ?? null,
      created_by: uid(r.createdBy), lab_signed_by: uid(r.labSignedBy), lab_signed_at: s(r.labSignedAt),
      leader_signed_by: uid(r.leaderSignedBy), leader_signed_at: s(r.leaderSignedAt),
      created_at: s(r.createdAt), updated_at: s(r.updatedAt ?? r.createdAt),
    }, "strengthTests", r.id);
    n++;
  }
  ctx.count("strengthTests", n);

  n = 0;
  for (const r of ctx.rows("SELECT * FROM strengthTestSamples ORDER BY id")) {
    put(F_QC, "qc_strength_samples", {
      id: iid("strengthTestSamples", r.id), test_id: iid("strengthTests", r.testId), position: r.position ?? 0, sample_name: r.sampleName,
      made_at: d(r.madeAt), tested_at: d(r.testedAt),
      weight_kg: r.weightKg ?? null, area_cm2: r.areaCm2 ?? null, max_load_kn: r.maxLoadKn ?? null,
    }, "strengthTestSamples", r.id);
    n++;
  }
  ctx.count("strengthTestSamples", n);

  // ===================== 05-terima-produksi =====================
  const F_TP = "05-terima-produksi";

  n = 0;
  for (const r of ctx.rows("SELECT * FROM goodsReceipts ORDER BY id")) {
    const urls = parseJson(r.photoUrls, []);
    const keys = (Array.isArray(urls) ? urls : []).map((u) => (typeof u === "string" ? ctx.photo(u, "penerimaan") : null)).filter(Boolean);
    put(F_TP, "ops_goods_receipts", {
      id: iid("goodsReceipts", r.id), received_at: s(r.receivedAt), category: r.category, item_name: r.itemName,
      tag: r.tag ?? null, supplier: r.supplier ?? null, quarry: r.quarry ?? null, quantity: r.quantity ?? null, unit: r.unit,
      vehicle_plate: r.vehiclePlate ?? null, driver_name: r.driverName ?? null, delivery_note_no: r.deliveryNoteNo ?? null,
      delivery_mode: r.deliveryMode ?? null, expedition_name: r.expeditionName ?? null,
      has_brangkal: r.hasBrangkal == null ? null : (r.hasBrangkal ? 1 : 0),
      status: r.status, photo_keys: JSON.stringify(keys),
      notes: joinNotes(r.notes, r.dutyOfficerName ? `[Petugas jaga: ${r.dutyOfficerName}]` : null),
      tier: r.tier ?? null, quality_note: r.qualityNote ?? null, quality_by: uid(r.qualityBy), quality_at: s(r.qualityAt),
      speed_rating: r.speedRating ?? null, delivery_note: r.deliveryNote ?? null, delivery_by: uid(r.deliveryBy), delivery_at: s(r.deliveryAt),
      price_rating: r.priceRating ?? null, price_note: r.priceNote ?? null, price_by: uid(r.priceBy), price_at: s(r.priceAt),
      created_by: officerOr(r.dutyOfficerName, r.createdBy),
      created_at: s(r.createdAt), updated_at: s(r.updatedAt ?? r.createdAt),
    }, "goodsReceipts", r.id);
    n++;
  }
  ctx.count("goodsReceipts", n);

  n = 0;
  for (const r of ctx.rows("SELECT * FROM sandTests ORDER BY id")) {
    const completedId = officerOr(r.completedByName, r.completedBy);
    put(F_TP, "qc_sand_tests", {
      id: iid("sandTests", r.id), receipt_id: r.receiptId != null ? iid("goodsReceipts", r.receiptId) : null,
      status: r.status, tested_at: s(r.testedAt), completed_at: s(r.completedAt),
      supplier: r.supplier ?? null, quarry: r.quarry ?? null, sand_type: r.sandType, reading_unit: r.readingUnit,
      sand_height: r.sandHeightCm ?? null, silt_height: r.siltHeightCm ?? null, silt_percent: r.siltPercent ?? null,
      max_silt_percent: r.maxSiltPercent ?? 10, decision: r.decision ?? null,
      start_photo_key: r.startPhotoUrl ? ctx.photo(r.startPhotoUrl, "uji-pasir") : null,
      photo_key: r.photoUrl ? ctx.photo(r.photoUrl, "uji-pasir") : null,
      notes: joinNotes(r.notes, r.dutyOfficerName ? `[Petugas jaga: ${r.dutyOfficerName}]` : null,
        r.completedByName && completedId == null ? `[Diselesaikan oleh: ${r.completedByName}]` : null),
      created_by: officerOr(r.dutyOfficerName, r.createdBy), completed_by: completedId,
      created_at: s(r.createdAt), updated_at: s(r.completedAt ?? r.createdAt),
    }, "sandTests", r.id);
    n++;
  }
  ctx.count("sandTests", n);

  // produksi ARSIP: tanpa inv_stock_moves, tanpa jurnal, labor_cost = 0
  const webBatches = new Set(ctx.webRows("SELECT batch_code FROM inv_productions WHERE batch_code IS NOT NULL AND id NOT LIKE 'iops-%'").map((x) => x.batch_code));
  n = 0;
  for (const r of ctx.rows("SELECT * FROM productionOutputs ORDER BY id")) {
    const pid = iid("productionOutputs", r.id);
    let batch = r.batchCode ?? null;
    if (batch != null && webBatches.has(batch)) {
      let nb = `${batch}-A`;
      while (webBatches.has(nb)) nb += "A";
      note("productionOutputs", r.id, `batch_code ${batch} bentrok dengan web -> ${nb}`);
      batch = nb;
    }
    const itemName = `${r.product}${r.spec ? ` ${r.spec}` : ""}`;
    const itemId = idOf(ctx.item({ name: itemName, unit: r.unit }));
    if (r.unit) note("productionOutputs", r.id, `satuan produksi ${r.unit} (satuan item web dipakai)`);
    put(F_TP, "inv_productions", {
      id: pid, number: `PRD-ARSIP-${String(r.id).padStart(5, "0")}`, date: d(r.productionDate), labor_cost: 0,
      note: joinNotes(r.notes, r.spec ? `Spesifikasi: ${r.spec}` : null, r.dutyOfficerName ? `[Petugas jaga: ${r.dutyOfficerName}]` : null,
        `[ARSIP inventori-ops] Produksi lama #${r.id}`),
      created_by: officerOr(r.dutyOfficerName, r.createdBy), created_at: s(r.createdAt), updated_at: s(r.updatedAt ?? r.createdAt),
      category: r.category ?? null, batch_code: batch, leader: r.leader ?? null, target: r.target ?? null,
      cement_bags: r.cementBags ?? null, boards: r.boards ?? null, rejects: r.rejects ?? null,
      issues: jsonText(r.issues, "[]", "productionOutputs", r.id, "issues"),
      photo_key: r.photoUrl ? ctx.photo(r.photoUrl, "produksi") : null,
    }, "productionOutputs", r.id);
    if (itemId) {
      put(F_TP, "inv_production_lines", { id: iid("productionLines", r.id), production_id: pid, role: "hasil", item_id: itemId, qty: r.quantity }, "productionOutputs", r.id);
    } else {
      skip("productionOutputs", r.id, "item hasil tidak terselesaikan; header dibuat tanpa baris hasil");
    }
    n++;
  }
  ctx.count("productionOutputs", n);

  // ===================== 06-piket-kalender =====================
  const F_PK = "06-piket-kalender";

  n = 0;
  for (const r of ctx.rows("SELECT * FROM dutyShifts ORDER BY id")) {
    const userId = idOf(ctx.officer(r.officerName)) ?? uid(r.accountUserId);
    if (userId == null) { skip("dutyShifts", r.id, `petugas "${r.officerName}" tidak terpetakan ke pengguna`); continue; }
    const started = s(r.startedAt);
    if (r.endedAt == null) note("dutyShifts", r.id, "shift terbuka ditutup ended_at = started_at");
    put(F_PK, "ops_duty_shifts", {
      id: iid("dutyShifts", r.id), user_id: userId, user_name: r.officerName, started_at: started,
      ended_at: r.endedAt == null ? started : s(r.endedAt), handover_note: nn(r.handoverNote), created_at: s(r.createdAt),
    }, "dutyShifts", r.id);
    n++;
  }
  ctx.count("dutyShifts", n);

  n = 0;
  for (const r of ctx.rows("SELECT * FROM calendarEvents ORDER BY id")) {
    put(F_PK, "ops_calendar_events", {
      id: iid("calendarEvents", r.id), title: r.title, type: r.type, start_at: s(r.startAt), end_at: s(r.endAt),
      location: nn(r.location), description: nn(r.description),
      reminder_minutes: jsonText(r.reminderMinutes, "[]", "calendarEvents", r.id, "reminderMinutes"),
      series_id: r.seriesId ?? null, created_by: uid(r.createdBy),
      created_at: s(r.createdAt), updated_at: s(r.updatedAt ?? r.createdAt),
    }, "calendarEvents", r.id);
    n++;
  }
  ctx.count("calendarEvents", n);

  n = 0;
  const seenPart = new Set();
  for (const r of ctx.rows("SELECT * FROM calendarParticipants ORDER BY id")) {
    const userId = uid(r.userId);
    if (userId == null) { skip("calendarParticipants", r.id, `pengguna sumber ${r.userId} tidak terpetakan`); continue; }
    const key = `${r.eventId}:${userId}`;
    if (seenPart.has(key)) { skip("calendarParticipants", r.id, "peserta ganda setelah pemetaan pengguna (indeks unik)"); continue; }
    seenPart.add(key);
    put(F_PK, "ops_calendar_participants", { id: iid("calendarParticipants", r.id), event_id: iid("calendarEvents", r.eventId), user_id: userId }, "calendarParticipants", r.id);
    n++;
  }
  ctx.count("calendarParticipants", n);

  n = 0;
  for (const r of ctx.rows("SELECT * FROM calendarReminders ORDER BY id")) {
    const remindAt = s(r.remindAt);
    let sentAt = s(r.sentAt);
    if (sentAt == null && remindAt < ctx.cutoverSec) { sentAt = remindAt; note("calendarReminders", r.id, "lewat cutover & belum terkirim -> sent_at = remind_at"); }
    put(F_PK, "ops_calendar_reminders", {
      id: iid("calendarReminders", r.id), event_id: iid("calendarEvents", r.eventId), minutes_before: r.minutesBefore, remind_at: remindAt, sent_at: sentAt,
    }, "calendarReminders", r.id);
    n++;
  }
  ctx.count("calendarReminders", n);

  n = 0;
  for (const r of ctx.rows("SELECT * FROM calendarResults ORDER BY id")) {
    const attendees = parseJson(r.attendees, []);
    const attOut = (Array.isArray(attendees) ? attendees : []).map((a) => {
      if (!a || typeof a !== "object") return a;
      if (a.userId == null) return a;
      const mapped = uid(a.userId);
      if (mapped == null) note("calendarResults", r.id, `attendees: userId ${a.userId} (${a.name ?? "?"}) tidak terpetakan -> null`);
      return { ...a, userId: mapped };
    });
    const files = parseJson(r.files, []);
    const filesOut = [];
    for (const f of Array.isArray(files) ? files : []) {
      if (!f || typeof f !== "object" || !f.url) continue;
      const key = ctx.photo(f.url, "kalender", { name: f.name, contentType: f.contentType, size: f.size });
      if (key) filesOut.push({ key, name: f.name ?? null, contentType: f.contentType ?? null, size: f.size ?? null });
    }
    put(F_PK, "ops_calendar_results", {
      id: iid("calendarResults", r.id), event_id: iid("calendarEvents", r.eventId), leader: nn(r.leader), category: nn(r.category),
      summary: nn(r.summary), attendees: JSON.stringify(attOut), guests: nn(r.guests), duration_hours: r.durationHours ?? null,
      evaluation: nn(r.evaluation), notes: nn(r.notes), files: JSON.stringify(filesOut),
      filled_by: uid(r.filledBy), filled_by_name: r.filledByName ?? null,
      created_at: s(r.createdAt), updated_at: s(r.updatedAt ?? r.createdAt),
    }, "calendarResults", r.id);
    n++;
  }
  ctx.count("calendarResults", n);

  // ===================== 07-iso =====================
  const F_ISO = "07-iso";

  /** Terjemahkan "<jenis>:<id>[:<rn>]". Balikan: {value} atau {skip: alasan}. production: source_key diberi ":1" bila tanpa rn; _from tidak. */
  const mapRef = (ref, forKey) => {
    const m = /^(order|customer|mix|receipt|production|event):(\d+)(?::(\d+))?$/.exec(ref);
    if (!m) return { value: ref };
    const [, kind, id, rn] = m;
    switch (kind) {
      case "order":
        if (ctx.isSkipped(Number(id))) return { skip: `PO sumber ${id} dilewati (terbuka)` };
        return { value: `order:${iid("orders", id)}` };
      case "customer": {
        const c = idOf(ctx.contact(Number(id)));
        return c ? { value: `customer:${c}` } : { skip: `pelanggan sumber ${id} tidak terpetakan` };
      }
      case "mix": return { value: `mix:${iid("mixDesignLogs", id)}` };
      case "receipt": return { value: `receipt:${iid("goodsReceipts", id)}` };
      case "event": return { value: `event:${iid("calendarEvents", id)}` };
      case "production": return { value: `production:${iid("productionOutputs", id)}${rn ? `:${rn}` : forKey ? ":1" : ""}` };
    }
    return { value: ref };
  };

  const webKeys = new Set(ctx.webRows("SELECT form_code, source_key FROM iso_records WHERE source_key IS NOT NULL AND id NOT LIKE 'iops-%'").map((x) => `${x.form_code}\u0000${x.source_key}`));
  const usedKeys = new Set();
  n = 0;
  for (const r of ctx.rows("SELECT * FROM isoRecords ORDER BY id")) {
    let sourceKey = r.sourceKey ?? null;
    if (sourceKey != null) {
      const m = mapRef(sourceKey, true);
      if (m.skip) { skip("isoRecords", r.id, m.skip); continue; }
      sourceKey = m.value;
      const uk = `${r.formCode}\u0000${sourceKey}`;
      if (webKeys.has(uk) || usedKeys.has(uk)) { skip("isoRecords", r.id, `kunci unik (form, source_key) ${r.formCode} / ${sourceKey} bentrok`); continue; }
      usedKeys.add(uk);
    }
    let dataText = jsonText(r.data, "{}", "isoRecords", r.id, "data");
    const data = parseJson(dataText, {});
    if (data && typeof data === "object" && typeof data._from === "string") {
      const m = mapRef(data._from, false);
      if (m.skip) note("isoRecords", r.id, `data._from ${data._from} dibiarkan (${m.skip})`);
      else if (m.value !== data._from) dataText = JSON.stringify({ ...data, _from: m.value });
    }
    put(F_ISO, "iso_records", {
      id: iid("isoRecords", r.id), form_code: r.formCode, kind: r.kind, record_date: r.recordDate, source_key: sourceKey,
      number: r.number ?? null, data: dataText, history: jsonText(r.history, "[]", "isoRecords", r.id, "history"),
      created_by: uid(r.createdBy), created_by_name: r.createdByName ?? null, updated_by_name: r.updatedByName ?? null,
      created_at: s(r.createdAt), updated_at: s(r.updatedAt ?? r.createdAt),
    }, "isoRecords", r.id);
    n++;
  }
  ctx.count("isoRecords", n);
}
