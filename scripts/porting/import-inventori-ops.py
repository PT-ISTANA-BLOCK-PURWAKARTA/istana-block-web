#!/usr/bin/env python3
"""Impor data app lama (inventori-ops) ke D1 istana-block-web.

Sumber : hasil `wrangler d1 export istana-block-db --remote` yang dimuat ke SQLite lokal.
Keluaran: file .sql per grup tabel, siap dijalankan dengan
          `wrangler d1 execute DB --remote --file=<grup>.sql`

Jalankan: python import-inventori-ops.py --src live-ops.sqlite --out ./import --group master
Grup: master | transaksi | semua
"""
import argparse, json, os, re, sqlite3
from datetime import datetime, timezone, timedelta

WIB = timezone(timedelta(hours=7))

def ts(v):
    """milidetik epoch -> detik epoch; nilai tanggal 'YYYY-MM-DD' ikut diterima."""
    if v in (None, ""): return None
    sv = str(v)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", sv):
        return int(datetime.strptime(sv, "%Y-%m-%d").replace(tzinfo=WIB).timestamp())
    return int(int(float(v)) / 1000)

def day(v):
    """milidetik epoch -> 'YYYY-MM-DD' WIB; nilai yang sudah tanggal dikembalikan apa adanya."""
    if v in (None, ""): return None
    sv = str(v)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", sv): return sv
    return datetime.fromtimestamp(int(float(v)) / 1000, WIB).strftime("%Y-%m-%d")

def b(v):
    if v is None: return 0
    return 1 if str(v) in ("1", "true", "True") else 0

def key(v):
    if not v: return None
    s = str(v)
    return re.sub(r"^/files/", "", s)

def keys(v):
    if not v: return "[]"
    try: arr = json.loads(v)
    except Exception: return "[]"
    if not isinstance(arr, list): return "[]"
    return json.dumps([re.sub(r"^/files/", "", str(x)) for x in arr])

def j(v, empty="[]"):
    if v in (None, ""): return empty
    if isinstance(v, (dict, list)): return json.dumps(v, ensure_ascii=False)
    try:
        json.loads(v); return v
    except Exception:
        return empty

def s(v, default="''"):
    return "" if v is None else str(v)

ROLE_MAP = {"superadmin": ["owner"], "admin": ["operasional"], "driver": ["sopir"],
            "mandor": ["mandor"], "qc": ["qc"], "satpam": ["satpam"], "ekspedisi": []}

ORDER_STATUS = {"ready_to_ship": "dikonfirmasi", "in_delivery": "dikirim_sebagian",
                "delivered": "terkirim", "cancelled": "batal"}
DELIV_STATUS = {"ready": "dimuat", "in_transit": "berangkat", "delivered": "terkirim", "cancelled": "batal"}

# tabel: (sumber, [(kolom_tujuan, sumber_kolom, transformasi)])
MASTER = {
    "users": ("users", [
        ("id", "id", "uid_self"), ("name", "name", "s"), ("email", "id", "email_uniq"),
        ("phone", "phone", "s_null"),
        ("password_hash", "passwordHash", "role_pw"), ("pin_hash", "passwordHash", "role_pin"),
        ("roles", "role", "roles"), ("signature_key", "signatureUrl", "key"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "fin_contacts": ("customers", [
        ("id", "id", "s"), ("kind", "id", "const_pelanggan"), ("name", "name", "s"),
        ("phone", "phone", "s_null"), ("email", "email", "s"), ("note", "notes", "s"),
        ("active", "isActive", "b"), ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_customer_addresses": ("customerAddresses", [
        ("id", "id", "s"), ("contact_id", "customerId", "s"), ("label", "label", "s"),
        ("recipient_name", "recipientName", "s"), ("recipient_phone", "recipientPhone", "s_null"),
        ("address", "addressText", "s"), ("city", "city", "s"), ("province", "province", "s"),
        ("latitude", "latitude", "raw"), ("longitude", "longitude", "raw"),
        ("maps_url", "shareLocationUrl", "s"), ("delivery_note", "deliveryNotes", "s_null"),
        ("location_source", "locationSource", "s_null"), ("location_confirmed_at", "locationConfirmedAt", "ts"),
        ("via_latitude", "viaLatitude", "raw"), ("via_longitude", "viaLongitude", "raw"),
        ("via_note", "viaNote", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "fin_items": ("products", [
        ("id", "id", "s"), ("code", "sku", "s_null"), ("name", "name", "s"), ("kind", "id", "const_barang"),
        ("unit", "unit", "s"), ("sell_price", "defaultPrice", "raw0"), ("active", "isActive", "b"),
        ("note", "category", "s_null"), ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_drivers": ("drivers", [
        ("id", "id", "s"), ("name", "name", "s"), ("phone", "phone", "s"), ("active", "isAvailable", "b"),
        ("note", "id", "const_empty"), ("license_no", "licenseNumber", "s_null"),
        ("license_expiry", "licenseExpiryDate", "day"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_vehicles": ("vehicles", [
        ("id", "id", "s"), ("plate", "plateNumber", "s"), ("name", "vehicleType", "s"),
        ("capacity", "capacityNote", "s"), ("active", "isActive", "b"), ("note", "id", "const_empty"),
        ("stnk_expiry", "stnkExpiryDate", "day"), ("kir_expiry", "kirExpiryDate", "day"),
        ("tag", "tag", "s_null"), ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "qc_product_specs": ("productSpecs", [
        ("id", "id", "s"), ("line", "line", "s"), ("name", "name", "s"), ("variant", "variant", "s_null"),
        ("weight_kg", "weightKg", "raw"), ("specs", "specs", "j_obj"), ("notes", "notes", "s"),
        ("active", "isActive", "b"), ("photo_key", "photoUrl", "key"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
}

TRANSAKSI = {
    "ops_orders": ("orders", [
        ("id", "id", "s"), ("number", "poNumber", "s"), ("date", "orderDate", "day"),
        ("contact_id", "customerId", "s"), ("requested_date", "requestedDeliveryDate", "day"),
        ("status", "status", "order_status"), ("ongkir", "deliveryFee", "raw0"),
        ("discount", "discount", "raw0"), ("note", "notes", "s_null"),
        ("external_ref", "externalRef", "s_null"), ("payment_status", "paymentStatus", "s_null"),
        ("payment_confirmed_by", "paymentConfirmedBy", "uid"), ("payment_confirmed_at", "paymentConfirmedAt", "ts"),
        ("cancel_reason", "cancellationReason", "s_null"), ("cancelled_by", "cancelledBy", "uid"),
        ("cancelled_at", "cancelledAt", "ts"), ("is_internal", "isInternal", "b"),
        ("created_by", "createdBy", "uid"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_order_lines": ("orderItems", [
        ("id", "id", "s"), ("order_id", "orderId", "s"), ("item_id", "productId", "s"),
        ("description", "productNameSnapshot", "s"), ("qty", "quantity", "raw0"),
        ("unit", "unit", "s"), ("price", "unitPrice", "raw0"), ("sort", "id", "raw0"),
        ("loaded_qty", "loadedQuantity", "raw"), ("stock_key", "stockKey", "s_null")]),
    "ops_deliveries": ("deliveries", [
        ("id", "id", "s"), ("number", "id", "const_dn"), ("order_id", "orderId", "s"),
        ("date", "scheduledAt", "day_or_created"), ("vehicle_id", "vehicleId", "s_null"),
        ("driver_id", "driverId", "s_null"), ("status", "status", "deliv_status"),
        ("loaded_at", "loadedAt", "ts"), ("departed_at", "startedAt", "ts"),
        ("arrived_at", "arrivedAt", "ts"), ("delivered_at", "completedAt", "ts"),
        ("delay_reason", "delayReason", "s_null"), ("note", "driverNotes", "s_null"),
        ("arrival_corrected_at", "arrivalCorrectedAt", "ts"),
        ("arrival_correction_reason", "arrivalCorrectionReason", "s_null"),
        ("arrival_corrected_by_name", "arrivalCorrectedByName", "s_null"),
        ("arrival_correction_made_at", "arrivalCorrectionMadeAt", "ts"),
        ("loaded_by_name", "loadedByName", "s_null"), ("load_note", "loadNote", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_delivery_proofs": ("deliveryProofs", [
        ("id", "id", "s"), ("delivery_id", "deliveryId", "s"), ("kind", "proofType", "s"),
        ("file_key", "fileKey", "key"), ("original_name", "originalName", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_driver", "createdByDriver", "s_null"),
        ("created_at", "createdAt", "ts")]),
    "ops_delivery_history": ("deliveryStatusHistory", [
        ("id", "id", "s"), ("delivery_id", "deliveryId", "s"),
        ("to_status", "status", "deliv_status"), ("note", "note", "s_null"),
        ("created_at", "createdAt", "ts")]),
    "ops_positions": ("driverLocations", [
        ("id", "id", "s"), ("vehicle_id", "vehicleId", "s_null"), ("lat", "latitude", "raw0"),
        ("lng", "longitude", "raw0"), ("at", "recordedAt", "ts"), ("received_at", "createdAt", "ts"),
        ("source", "id", "const_hp")]),
    "ops_push_subscriptions": ("pushSubscriptions", [
        ("id", "id", "s"), ("user_id", "userId", "uid"), ("endpoint", "endpoint", "s"),
        ("p256dh", "p256dh", "s"), ("auth", "auth", "s"), ("user_agent", "userAgent", "s_null"),
        ("last_result", "lastResult", "s_null"), ("last_sent_at", "lastSentAt", "ts"),
        ("last_title", "lastTitle", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_goods_receipts": ("goodsReceipts", [
        ("id", "id", "s"), ("received_at", "receivedAt", "ts"), ("category", "category", "s"),
        ("item_name", "itemName", "s"), ("tag", "tag", "s_null"), ("supplier", "supplier", "s_null"),
        ("quarry", "quarry", "s_null"), ("quantity", "quantity", "raw"), ("unit", "unit", "s"),
        ("vehicle_plate", "vehiclePlate", "s_null"), ("driver_name", "driverName", "s_null"),
        ("delivery_note_no", "deliveryNoteNo", "s_null"), ("delivery_mode", "deliveryMode", "s_null"),
        ("expedition_name", "expeditionName", "s_null"), ("has_brangkal", "hasBrangkal", "b"),
        ("status", "status", "s"), ("photo_keys", "photoUrls", "keys"), ("notes", "notes", "s_null"),
        ("tier", "tier", "raw"), ("quality_note", "qualityNote", "s_null"), ("quality_by", "qualityBy", "uid"),
        ("quality_at", "qualityAt", "ts"), ("speed_rating", "speedRating", "raw"),
        ("delivery_note", "deliveryNote", "s_null"), ("delivery_by", "deliveryBy", "uid"),
        ("delivery_at", "deliveryAt", "ts"), ("price_rating", "priceRating", "raw"),
        ("price_note", "priceNote", "s_null"), ("price_by", "priceBy", "uid"), ("price_at", "priceAt", "ts"),
        ("test_skipped_at", "testSkippedAt", "ts"), ("test_skip_level", "testSkipLevel", "s_null"),
        ("test_skip_reason", "testSkipReason", "s_null"), ("test_skipped_by", "testSkippedBy", "uid"),
        ("test_skipped_by_name", "testSkippedByName", "s_null"),
        ("settled_by", "settledBy", "uid"), ("settled_by_name", "settledByName", "s_null"),
        ("settled_at", "settledAt", "ts"), ("original", "original", "s_null"),
        ("created_by", "createdBy", "uid"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "qc_sand_tests": ("sandTests", [
        ("id", "id", "s"), ("receipt_id", "receiptId", "s_null"), ("status", "status", "s"),
        ("tested_at", "testedAt", "ts"), ("completed_at", "completedAt", "ts"),
        ("supplier", "supplier", "s_null"), ("quarry", "quarry", "s_null"), ("sand_type", "sandType", "s_null"),
        ("reading_unit", "readingUnit", "s_null"), ("sand_height", "sandHeightCm", "raw"),
        ("silt_height", "siltHeightCm", "raw"), ("silt_percent", "siltPercent", "raw"),
        ("max_silt_percent", "maxSiltPercent", "raw"), ("decision", "decision", "s_null"),
        ("start_photo_key", "startPhotoUrl", "key"), ("photo_key", "photoUrl", "key"),
        ("notes", "notes", "s_null"), ("created_by", "createdBy", "uid"), ("completed_by", "completedBy", "uid"),
        ("manager_ack_by", "managerAckBy", "uid"), ("manager_ack_at", "managerAckAt", "ts"),
        ("leader_ack_by", "leaderAckBy", "uid"), ("leader_ack_at", "leaderAckAt", "ts"),
        ("secretary_ack_by", "secretaryAckBy", "uid"), ("secretary_ack_at", "secretaryAckAt", "ts"),
        ("edit_history", "editHistory", "j_obj"),
        ("created_at", "createdAt", "ts"), ("updated_at", "createdAt", "ts")]),
    "qc_mix_designs": ("mixDesigns", [
        ("id", "id", "s"), ("name", "name", "s"), ("layer", "layer", "s"), ("product", "product", "s_null"),
        ("materials", "materials", "j_arr"), ("notes", "notes", "s_null"), ("status", "status", "s"),
        ("active", "isActive", "b"), ("created_by", "createdBy", "uid"), ("approved_by", "approvedBy", "uid"),
        ("approved_at", "approvedAt", "ts"), ("review_note", "reviewNote", "s_null"),
        ("retired_reason", "retiredReason", "s_null"), ("retired_by", "retiredBy", "uid"),
        ("retired_at", "retiredAt", "ts"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "qc_mix_logs": ("mixDesignLogs", [
        ("id", "id", "s"), ("work_date", "workDate", "day"), ("layer", "layer", "s"),
        ("product", "product", "s_null"), ("mix_design_id", "mixDesignId", "s_null"),
        ("approved_materials", "approvedMaterials", "j_arr"), ("actual_materials", "actualMaterials", "j_arr"),
        ("mixing_count", "mixingCount", "raw"), ("boards", "boards", "raw"),
        ("square_meters", "squareMeters", "raw"), ("rejects", "rejects", "raw"),
        ("status", "status", "s"), ("notes", "notes", "s_null"),
        ("review_status", "reviewStatus", "s_null"), ("review_note", "reviewNote", "s_null"),
        ("created_by", "createdBy", "uid"), ("manager_signed_by", "managerSignedBy", "uid"),
        ("manager_signed_at", "managerSignedAt", "ts"),
        ("grade_b", "gradeB", "raw"), ("half_pieces", "halfPieces", "raw"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "qc_strength_tests": ("strengthTests", [
        ("id", "id", "s"), ("report_date", "reportDate", "day"), ("company_name", "companyName", "s_null"),
        ("address", "address", "s_null"), ("concrete_grade", "concreteGrade", "s"),
        ("addressed_to", "addressedTo", "s_null"), ("composition", "composition", "j_arr"),
        ("notes", "notes", "s_null"), ("review_status", "reviewStatus", "s_null"),
        ("review_note", "reviewNote", "s_null"), ("created_by", "createdBy", "uid"),
        ("lab_signed_by", "labSignedBy", "uid"), ("lab_signed_at", "labSignedAt", "ts"),
        ("leader_signed_by", "leaderSignedBy", "uid"), ("leader_signed_at", "leaderSignedAt", "ts"),
        ("absorption", "absorption", "s_null"), ("absorption_on_certificate", "absorptionOnCertificate", "b"),
        ("maker_signed_by", "makerSignedBy", "uid"), ("maker_signed_at", "makerSignedAt", "ts"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "qc_strength_samples": ("strengthTestSamples", [
        ("id", "id", "s"), ("test_id", "testId", "s"), ("position", "position", "raw0"),
        ("sample_name", "sampleName", "s"), ("made_at", "madeAt", "day"), ("tested_at", "testedAt", "day"),
        ("weight_kg", "weightKg", "raw"), ("area_cm2", "areaCm2", "raw"), ("max_load_kn", "maxLoadKn", "raw"),
        ("surface", "surface", "s_null")]),
    "inv_productions": ("productionOutputs", [
        ("id", "id", "s"), ("number", "id", "const_pr"), ("date", "productionDate", "day"),
        ("category", "category", "s"), ("product", "product", "s_null"), ("batch_code", "batchCode", "s_null"),
        ("leader", "leader", "s_null"), ("target", "target", "raw"), ("cement_bags", "cementBags", "raw"),
        ("boards", "boards", "raw"), ("rejects", "rejects", "raw"), ("issues", "issues", "j_arr"),
        ("photo_key", "photoUrl", "key"), ("note", "notes", "s_null"), ("grade_b", "gradeB", "raw"),
        ("method", "method", "s_null"), ("cement_kg", "cementKg", "raw"), ("mix_part", "mixPart", "s_null"),
        ("batch_id", "batchId", "s_null"), ("mix_log_id", "mixLogId", "s_null"),
        ("reject_manager_by", "rejectManagerAckBy", "uid"), ("reject_manager_at", "rejectManagerAckAt", "ts"),
        ("reject_leader_by", "rejectLeaderAckBy", "uid"), ("reject_leader_at", "rejectLeaderAckAt", "ts"),
        ("created_by", "createdBy", "uid"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "inv_production_batches": ("productionBatches", [
        ("id", "id", "s"), ("date", "productionDate", "day"), ("cement_bags", "cementBags", "raw"),
        ("leader", "leader", "s_null"), ("note", "notes", "s_null"), ("created_by", "createdBy", "uid"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_calendar_events": ("calendarEvents", [
        ("id", "id", "s"), ("title", "title", "s"), ("type", "type", "s_null"),
        ("start_at", "startAt", "ts"), ("end_at", "endAt", "ts"), ("location", "location", "s_null"),
        ("description", "description", "s_null"), ("reminder_minutes", "reminderMinutes", "raw"),
        ("series_id", "seriesId", "s_null"), ("created_by", "createdBy", "uid"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_calendar_participants": ("calendarParticipants", [
        ("id", "id", "s"), ("event_id", "eventId", "s"), ("user_id", "userId", "uid"),
        ("attendance_signed_at", "attendanceSignedAt", "ts")]),
    "ops_calendar_reminders": ("calendarReminders", [
        ("id", "id", "s"), ("event_id", "eventId", "s"), ("minutes_before", "minutesBefore", "raw"),
        ("remind_at", "remindAt", "ts"), ("sent_at", "sentAt", "ts")]),
    "ops_calendar_results": ("calendarResults", [
        ("id", "id", "s"), ("event_id", "eventId", "s"), ("leader", "leader", "s_null"),
        ("category", "category", "s_null"), ("summary", "summary", "s_null"), ("attendees", "attendees", "raw"),
        ("guests", "guests", "raw"), ("duration_hours", "durationHours", "raw"),
        ("evaluation", "evaluation", "s_null"), ("notes", "notes", "s_null"),
        ("files", "files", "j_arr"), ("filled_by", "filledBy", "uid"),
        ("filled_by_name", "filledByName", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_duty_shifts": ("dutyShifts", [
        ("id", "id", "s"), ("user_id", "userId", "uid"), ("user_name", "userName", "s"),
        ("started_at", "startedAt", "ts"), ("ended_at", "endedAt", "ts"),
        ("handover_note", "handoverNote", "s_null"), ("created_at", "createdAt", "ts")]),
    "ops_customer_leads": ("customerLeads", [
        ("id", "id", "s"), ("contact_date", "contactDate", "day"), ("source", "source", "s_null"),
        ("name", "name", "s"), ("phone", "phone", "s_null"), ("address", "address", "s_null"),
        ("product", "product", "s_null"), ("status", "status", "s_null"), ("sale_value", "saleValue", "raw"),
        ("price_nett", "priceNett", "raw"), ("price_offer", "priceOffer", "raw"),
        ("notes", "notes", "s_null"), ("rating_service", "ratingService", "raw"),
        ("rating_quality", "ratingQuality", "raw"), ("rating_speed", "ratingSpeed", "raw"),
        ("rating_note", "ratingNote", "s_null"), ("rated_by", "ratedBy", "uid"), ("rated_at", "ratedAt", "ts"),
        ("feedback", "feedback", "s_null"), ("complaint_date", "complaintDate", "day"),
        ("complaint_note", "complaintNote", "s_null"), ("getback_date", "getbackDate", "day"),
        ("getback_note", "getbackNote", "s_null"), ("getback_result", "getbackResult", "s_null"),
        ("created_by", "createdBy", "uid"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_activity_logs": ("activityLogs", [
        ("id", "id", "iters"), ("at", "createdAt", "ts0"), ("user_id", "userId", "uid"),
        ("user_name", "userName", "s"), ("action", "action", "s"), ("label", "description", "s"),
        ("success", "id", "const_one")]),
    "ops_backup_runs": ("backupRuns", [
        ("id", "id", "s"), ("at", "createdAt", "ts"), ("user_name", "createdBy", "s_null"),
        ("rows_count", "rows", "raw"), ("photos_count", "photos", "raw"),
        ("new_photos_count", "newPhotos", "raw")]),
    "ops_payslips": ("payslips", [
        ("id", "id", "s"), ("employee_name", "employeeName", "s"), ("slip_date", "slipDate", "s"),
        ("earnings", "earnings", "j_arr"), ("deductions", "deductions", "j_arr"),
        ("kasbon_note", "kasbonNote", "s"),
        ("pay_kind", "payKind", "s_null"), ("period_from", "periodFrom", "s_null"), ("period_to", "periodTo", "s_null"),
        ("note", "note", "s"),
        ("signer_id", "signerId", "uid"), ("signer_name", "signerName", "s"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s"),
        ("created_at", "createdAt", "ts0"), ("updated_at", "updatedAt", "ts0")]),
    "ops_fleet_expenses": ("fleetExpenses", [
        ("id", "id", "s"), ("entry_date", "entryDate", "s"), ("vehicle_id", "vehicleId", "s"),
        ("vehicle_label", "vehicleLabel", "s"), ("driver_name", "driverName", "s"),
        ("kind", "kind", "s"), ("item", "item", "s"), ("qty", "qty", "raw"),
        ("price", "price", "raw"), ("total", "total", "raw0"), ("shop", "shop", "s"),
        ("mechanic", "mechanic", "s"), ("place", "place", "s"), ("destination", "destination", "s"),
        ("payment", "payment", "s"), ("fund", "fund", "s"), ("note", "note", "s"),
        ("party", "party", "s"), ("photo_keys", "photos", "keys"),
        ("approval_status", "approvalStatus", "s"), ("approved_by", "approvedBy", "uid"),
        ("approved_by_name", "approvedByName", "s"), ("approved_at", "approvedAt", "ts"),
        ("approval_note", "approvalNote", "s"), ("source_key", "sourceKey", "s"),
        ("subcategory", "subcategory", "s_null"), ("trip_ref", "tripRef", "s_null"),
        ("due_date", "dueDate", "s_null"), ("tempo_paid_at", "tempoPaidAt", "ts"),
        ("tempo_paid_by_name", "tempoPaidByName", "s_null"), ("tempo_reminded_on", "tempoRemindedOn", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s"),
        ("updated_by_name", "updatedByName", "s"),
        ("created_at", "createdAt", "ts0"), ("updated_at", "updatedAt", "ts0")]),
    "ops_driver_schedules": ("driverSchedules", [
        ("id", "id", "s"), ("driver_id", "driverId", "s"), ("day", "day", "s"),
        ("status", "status", "s"), ("until_time", "untilTime", "s"), ("note", "note", "s"),
        ("set_by", "setById", "uid"), ("set_by_name", "setByName", "s"),
        ("created_at", "updatedAt", "ts0"), ("updated_at", "updatedAt", "ts0")]),
    "inv_transfers": ("stockTransfers", [
        ("id", "id", "s"), ("kind", "kind", "s"), ("from_key", "fromKey", "s"), ("to_key", "toKey", "s"),
        ("qty", "quantity", "raw0"), ("moved_at", "movedAt", "ts"), ("note", "note", "s_null"),
        ("moved_by_name", "movedByName", "s_null"), ("photo_keys", "photoUrls", "keys"),
        ("leader", "leader", "s_null"), ("target", "target", "raw"),
        ("created_by", "createdBy", "uid"),
        ("created_at", "createdAt", "ts"), ("updated_at", "createdAt", "ts")]),
    "inv_production_targets": ("productionTargets", [
        ("key", "key", "s"), ("label", "label", "s"), ("unit", "unit", "s"), ("target", "target", "raw0"),
        ("set_by", "setBy", "uid"), ("set_by_name", "setByName", "s_null"), ("set_at", "setAt", "ts"),
        ("history", "history", "j_arr")]),
    "inv_production_target_reasons": ("productionTargetReasons", [
        ("id", "id", "s"), ("key", "key", "s"), ("work_date", "workDate", "s"), ("label", "label", "s"),
        ("target", "target", "raw0"), ("actual", "actual", "raw0"), ("reason", "reason", "s"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("created_at", "createdAt", "ts")]),
    "inv_production_deletions": ("productionDeletions", [
        ("id", "id", "s"), ("kind", "kind", "s"), ("ref_id", "refId", "s_null"), ("work_date", "workDate", "s_null"),
        ("label", "label", "s"), ("qty", "quantity", "raw"), ("unit", "unit", "s_null"),
        ("snapshot", "snapshot", "j_obj"), ("reason", "reason", "s_null"),
        ("deleted_by", "deletedBy", "uid"), ("deleted_by_name", "deletedByName", "s_null"),
        ("deleted_at", "deletedAt", "ts")]),
    "ops_delivery_notes": ("deliveryNotes", [
        ("id", "id", "s"), ("issuer", "issuer", "s"), ("seq", "seq", "raw0"), ("number", "number", "s"),
        ("note_date", "noteDate", "s"), ("po_number", "poNumber", "s_null"), ("terms", "terms", "s_null"),
        ("customer_name", "customerName", "s"), ("customer_phone", "customerPhone", "s_null"),
        ("address", "address", "s_null"), ("note", "note", "s_null"), ("items", "items", "j_arr"),
        ("driver_name", "driverName", "s_null"), ("plate", "plateNumber", "s_null"),
        ("driver_id", "driverId", "s_null"), ("vehicle_id", "vehicleId", "s_null"),
        ("order_id", "orderId", "s_null"), ("order_po_number", "orderPoNumber", "s_null"),
        ("is_internal", "isInternal", "b"), ("pickup", "pickup", "b"),
        ("signer_id", "signerId", "uid"), ("signer_name", "signerName", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_planned_orders": ("plannedOrders", [
        ("id", "id", "s"), ("customer_name", "customerName", "s"), ("project", "project", "s_null"),
        ("expected_date", "expectedDate", "ts"), ("items", "items", "j_arr"), ("note", "note", "s_null"),
        ("status", "status", "s"), ("quotation_id", "quotationId", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_quotations": ("quotations", [
        ("id", "id", "s"), ("seq", "seq", "raw0"), ("number", "number", "s"),
        ("quote_date", "quoteDate", "ts"), ("project_name", "projectName", "s_null"),
        ("project_city", "projectCity", "s_null"), ("customer_name", "customerName", "s"),
        ("customer_address", "customerAddress", "s_null"), ("customer_phone", "customerPhone", "s_null"),
        ("work", "work", "s_null"), ("location", "location", "s_null"), ("items", "items", "j_arr"),
        ("terms", "terms", "j_arr"), ("bank_name", "bankName", "s_null"), ("bank_account", "bankAccount", "s_null"),
        ("signer_id", "signerId", "uid"), ("signer_name", "signerName", "s_null"),
        ("signer_title", "signerTitle", "s_null"), ("customer_sign_title", "customerSignTitle", "s_null"),
        ("status", "status", "s"), ("created_by", "createdBy", "uid"),
        ("created_by_name", "createdByName", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_sales_invoices": ("invoices", [
        ("id", "id", "s"), ("seq", "seq", "raw0"), ("number", "number", "s"),
        ("invoice_date", "invoiceDate", "ts"), ("quotation_id", "quotationId", "s_null"),
        ("order_id", "orderId", "s_null"), ("order_po_number", "orderPoNumber", "s_null"),
        ("customer_name", "customerName", "s"), ("customer_address", "customerAddress", "s_null"),
        ("customer_phone", "customerPhone", "s_null"), ("po_number", "poNumber", "s_null"),
        ("items", "items", "j_arr"), ("shipments", "shipments", "j_arr"),
        ("ppn_percent", "ppnPercent", "raw0"), ("down_payment_percent", "downPaymentPercent", "raw"),
        ("note", "note", "s_null"), ("bank_name", "bankName", "s_null"), ("bank_account", "bankAccount", "s_null"),
        ("signer_id", "signerId", "uid"), ("signer_name", "signerName", "s_null"), ("status", "status", "s"),
        ("paid_amount", "paidAmount", "raw"), ("paid_at", "paidAt", "ts"),
        ("payment_method", "paymentMethod", "s_null"), ("payment_note", "paymentNote", "s_null"),
        ("paid_by_name", "paidByName", "s_null"), ("issuer", "issuer", "s"),
        ("driver_name", "driverName", "s_null"), ("plate", "plateNumber", "s_null"),
        ("route", "route", "s_null"), ("ship_date", "shipDate", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "ops_uditch_entries": ("uditchEntries", [
        ("id", "id", "s"), ("entry_date", "entryDate", "s"), ("account", "account", "s"),
        ("direction", "direction", "s"), ("item", "item", "s"), ("qty", "qty", "raw"),
        ("party", "party", "s_null"), ("price", "price", "raw"), ("total", "total", "raw0"),
        ("category", "category", "s_null"), ("note", "note", "s_null"), ("remark", "remark", "s_null"),
        ("pic", "pic", "s_null"), ("source_key", "sourceKey", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("updated_by_name", "updatedByName", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    "iso_records": ("isoRecords", [
        ("id", "id", "s"), ("form_code", "formCode", "s"), ("kind", "kind", "s_null"),
        ("record_date", "recordDate", "day"), ("source_key", "sourceKey", "s_null"),
        ("number", "number", "s_null"), ("data", "data", "j_obj"), ("history", "history", "j_arr"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("updated_by_name", "updatedByName", "s_null"),
        ("created_at", "createdAt", "ts"), ("updated_at", "updatedAt", "ts")]),
    # Porting 0093-0101: id sumber INTEGER tanpa padanan teks, jadi pakai "iters" (900001+).
    "ops_vehicle_trips": ("vehicleTrips", [
        ("id", "id", "iters"), ("delivery_id", "deliveryId", "s_null"),
        ("vehicle_id", "vehicleId", "s_null"), ("plate", "plateNumber", "s_null"),
        ("driver_id", "driverId", "s_null"), ("driver_name", "driverName", "s_null"),
        ("purpose", "purpose", "s"), ("cargo", "cargo", "s_null"),
        ("destination", "destination", "s_null"), ("note", "note", "s_null"),
        ("out_at", "outAt", "ts"), ("in_at", "inAt", "ts"),
        ("out_by_name", "outByName", "s_null"), ("in_by_name", "inByName", "s_null"),
        ("created_by", "createdBy", "uid"),
        ("created_at", "createdAt", "ts0"), ("updated_at", "updatedAt", "ts0")]),
    "ops_kasbon_entries": ("kasbonEntries", [
        ("id", "id", "iters"), ("employee_name", "employeeName", "s"),
        ("entry_date", "entryDate", "s"), ("kind", "kind", "s"),
        ("amount", "amount", "raw0"), ("note", "note", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("created_at", "createdAt", "ts0")]),
    "ops_fleet_cash": ("fleetCash", [
        ("id", "id", "iters"), ("entry_date", "entryDate", "s"),
        ("amount", "amount", "raw0"), ("source", "source", "s_null"), ("note", "note", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("created_at", "createdAt", "ts0")]),
    "ops_cepi_loans": ("cepiLoans", [
        ("id", "id", "iters"), ("entry_date", "entryDate", "s"), ("kind", "kind", "s"),
        ("amount", "amount", "raw0"), ("method", "method", "s_null"), ("note", "note", "s_null"),
        ("created_by", "createdBy", "uid"), ("created_by_name", "createdByName", "s_null"),
        ("created_at", "createdAt", "ts0")]),
}

# Kolom yang ditambahkan sesudah tabelnya terlanjur diimpor: diterbitkan sebagai UPDATE,
# bukan INSERT, supaya baris yang sudah ada tidak bentrok primary key.
BACKFILL = {
    "ops_fleet_expenses": ("fleetExpenses", ["subcategory", "trip_ref", "due_date",
                                             "tempo_paid_at", "tempo_paid_by_name", "tempo_reminded_on"]),
    "ops_payslips": ("payslips", ["pay_kind", "period_from", "period_to"]),
}

def lit(v):
    if v is None: return "NULL"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def build(con, spec, user_map):
    out = {}
    for target, (src, cols) in spec.items():
        names = [c[0] for c in cols]
        rows = con.execute(f'SELECT * FROM "{src}"').fetchall()
        cur_cols = [d[0] for d in con.execute(f'SELECT * FROM "{src}" LIMIT 0').description]
        vals = []
        for r in rows:
            row = dict(zip(cur_cols, r))
            cells = []
            for _, srccol, tx in cols:
                v = row.get(srccol)
                if tx == "s": cells.append(lit("" if v is None else str(v)))
                elif tx == "s_null": cells.append(lit(None if v in (None, "") else str(v)))
                elif tx == "ts": cells.append(lit(ts(v)))
                elif tx == "day": cells.append(lit(day(v)))
                elif tx == "b": cells.append(lit(b(v)))
                elif tx == "raw": cells.append(lit(v))
                elif tx == "raw0": cells.append(lit(0 if v in (None, "") else v))
                elif tx == "key": cells.append(lit(key(v)))
                elif tx == "keys": cells.append(lit(keys(v)))
                elif tx == "j_arr": cells.append(lit(j(v, "[]")))
                elif tx == "j_obj": cells.append(lit(j(v, "{}")))
                elif tx == "uid": cells.append(lit(user_map.get(str(v), None)))
                elif tx == "uid_self": cells.append(lit(100000 + int(v)) if str(v).isdigit() else lit(None))
                elif tx == "email_uniq":
                    em = row.get("email")
                    cells.append(lit(em if em else f"legacy{row.get('id')}@istanablock.local"))
                elif tx == "roles": cells.append(lit(json.dumps(ROLE_MAP.get(str(v), []))))
                elif tx == "order_status": cells.append(lit(ORDER_STATUS.get(str(v), "dikonfirmasi")))
                elif tx == "deliv_status": cells.append(lit(DELIV_STATUS.get(str(v), "dijadwalkan")))
                elif tx == "const_pelanggan": cells.append(lit("pelanggan"))
                elif tx == "const_barang": cells.append(lit("barang"))
                elif tx == "const_empty": cells.append(lit(""))
                elif tx == "const_one": cells.append(lit(1))
                elif tx == "const_hp": cells.append(lit("hp"))
                elif tx == "const_dn": cells.append(lit("SJ-" + str(v)))
                elif tx == "const_pr": cells.append(lit("PR-" + str(v)))
                elif tx == "role_pw": cells.append(lit(None if row.get("role") == "driver" else row.get("passwordHash")))
                elif tx == "role_pin": cells.append(lit(row.get("passwordHash") if row.get("role") == "driver" else None))
                elif tx == "day_or_created": cells.append(lit(day(v) or day(row.get("createdAt"))))
                else: raise SystemExit(f"transform tidak dikenal: {tx}")
            vals.append("(" + ",".join(cells) + ")")
        out[target] = (names, vals)
    return out

NULL = object()

def coerce(cells, notnull):
    """NULL pada kolom NOT NULL diisi '' (teks) atau 0 (angka)."""
    out = []
    for col, val, typ in cells:
        if val is None and col in notnull:
            val = 0 if (typ or "").upper() in ("INTEGER", "REAL", "NUMERIC") else ""
        out.append(lit(val))
    return out

def build(con, spec, user_map, target=None, skip=None):
    """target: dict {tabel: {kolom: tipe}} dari schema tujuan; kolom tak dikenal dilewati.
    skip: dict {tabel: set(id)} — baris yang sudah ada di tujuan tidak diterbitkan lagi (mode delta)."""
    out = {}
    for tbl, (src, cols) in spec.items():
        ada = (skip or {}).get(tbl) or set()
        tgt = (target or {}).get(tbl, {})
        use = [c for c in cols if not tgt or c[0] in tgt]
        names = [c[0] for c in use]
        notnull = {c for c, t in tgt.items() if t and t[1]}
        # Snapshot sumber boleh parsial (mis. hanya tabel yang baru diporting) — lewati yang tidak ada.
        if not con.execute("select 1 from sqlite_master where type = 'table' and name = ?", (src,)).fetchone():
            print(f"lewati {tbl}: tabel sumber {src} tidak ada di snapshot")
            continue
        rows = con.execute(f'SELECT * FROM "{src}"').fetchall()
        cur_cols = [d[0] for d in con.execute(f'SELECT * FROM "{src}" LIMIT 0').description]
        vals = []
        lewat = 0
        for idx, r in enumerate(rows, 1):
            row = dict(zip(cur_cols, r))
            cells = []
            for tcol, srccol, tx in use:
                v = row.get(srccol)
                typ = tgt.get(tcol, (None, None))[0]
                if tx == "s": val = "" if v is None else str(v)
                elif tx == "s_null": val = None if v in (None, "") else str(v)
                elif tx == "ts": val = ts(v)
                elif tx == "ts0": val = ts(v) or 0
                elif tx == "day": val = day(v)
                elif tx == "b": val = b(v)
                elif tx == "raw": val = v
                elif tx == "raw0": val = 0 if v in (None, "") else v
                elif tx == "key": val = key(v)
                elif tx == "keys": val = keys(v)
                elif tx == "j_arr": val = j(v, "[]")
                elif tx == "j_obj": val = j(v, "{}")
                elif tx == "iters": val = 900000 + idx
                elif tx == "uid": val = user_map.get(str(v), None)
                elif tx == "uid0": val = user_map.get(str(v), 0)
                elif tx == "uid_self": val = 100000 + int(v) if str(v).isdigit() else None
                elif tx == "email_uniq":
                    em = row.get("email"); val = em if em else f"legacy{row.get('id')}@istanablock.local"
                elif tx == "roles": val = json.dumps(ROLE_MAP.get(str(v), []))
                elif tx == "order_status": val = ORDER_STATUS.get(str(v), "dikonfirmasi")
                elif tx == "deliv_status": val = DELIV_STATUS.get(str(v), "dijadwalkan")
                elif tx == "const_pelanggan": val = "pelanggan"
                elif tx == "const_barang": val = "barang"
                elif tx == "const_empty": val = ""
                elif tx == "const_one": val = 1
                elif tx == "const_hp": val = "hp"
                elif tx == "const_dn": val = "SJ-" + str(v)
                elif tx == "const_pr": val = "PR-" + str(v)
                elif tx == "role_pw": val = None if row.get("role") == "driver" else row.get("passwordHash")
                elif tx == "role_pin": val = row.get("passwordHash") if row.get("role") == "driver" else None
                elif tx == "day_or_created": val = day(v) or day(row.get("createdAt"))
                else: raise SystemExit(f"transform tidak dikenal: {tx}")
                cells.append((tcol, val, typ))
            if ada:
                ident = next((v for c, v, _ in cells if c == "id"), None)
                if ident is not None and str(ident) in ada:
                    lewat += 1
                    continue
            vals.append("(" + ",".join(coerce(cells, notnull)) + ")")
        if lewat:
            print(f"{tbl}: {lewat} baris dilewati (sudah ada di tujuan)")
        out[tbl] = (names, vals)
    return out

def emit_backfill(con, out):
    """UPDATE kolom baru pada tabel yang barisnya sudah diimpor lebih dulu (bukan INSERT)."""
    os.makedirs(out, exist_ok=True)
    for tbl, (src, cols) in BACKFILL.items():
        cur_cols = [d[0] for d in con.execute(f'SELECT * FROM "{src}" LIMIT 0').description]
        stmts = []
        for r in con.execute(f'SELECT * FROM "{src}"'):
            row = dict(zip(cur_cols, r))
            sets = []
            for col in cols:
                v = row.get(col)
                if v in (None, ""): continue
                if col == "tempo_paid_at":
                    v = ts(v)
                    if v is None: continue
                sets.append(f"{col}={lit(v)}")
            if not sets: continue
            stmts.append(f'UPDATE "{tbl}" SET {", ".join(sets)} WHERE id={lit(str(row["id"]))};')
        path = os.path.join(out, f"03-backfill-{tbl}.sql")
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(stmts) + "\n")
        print(f"{path}: {len(stmts)} baris")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--group", default="semua", choices=["master", "transaksi", "semua", "backfill"])
    ap.add_argument("--schema", default=None, help="SQLite berisi schema tujuan (untuk cek NOT NULL & kolom)")
    ap.add_argument("--skip-existing", default=None, help="JSON {tabel: [id]} yang sudah ada di tujuan (mode delta)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    con = sqlite3.connect(a.src)
    target = None
    if a.schema:
        sc = sqlite3.connect(a.schema)
        target = {}
        for spec in ([MASTER, TRANSAKSI]):
            for tbl in spec:
                rows = sc.execute(f'PRAGMA table_info("{tbl}")').fetchall()
                if rows: target[tbl] = {r[1]: (r[2], bool(r[3])) for r in rows}
        print(f"schema tujuan: {len(target)} tabel terbaca")
    user_map = {str(r[0]): 100000 + int(r[0]) for r in con.execute("SELECT id FROM users")}
    if a.group == "backfill":
        emit_backfill(con, a.out)
        return
    skip = None
    if a.skip_existing:
        raw = json.load(open(a.skip_existing, encoding="utf-8"))
        skip = {k: {str(x) for x in v} for k, v in raw.items()}
        print("mode delta:", ", ".join(f"{k}={len(v)}" for k, v in skip.items()))
    groups = []
    if a.group in ("master", "semua"): groups.append(("01-master", MASTER))
    if a.group in ("transaksi", "semua"): groups.append(("02-transaksi", TRANSAKSI))
    for prefix, spec in groups:
        built = build(con, spec, user_map, target, skip)
        for tbl, (names, vals) in built.items():
            path = os.path.join(a.out, f"{prefix}-{tbl}.sql")
            with open(path, "w", encoding="utf-8") as f:
                for i in range(0, len(vals), 100):
                    chunk = vals[i:i+100]
                    f.write(f'INSERT INTO "{tbl}" ({",".join(names)}) VALUES\n' + ",\n".join(chunk) + ";\n")
            print(f"{path}: {len(vals)} baris")

if __name__ == "__main__":
    main()
