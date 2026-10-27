#!/usr/bin/env node
// Migrasi data inventori-ops -> istana-block-web (Operasional). Spesifikasi: docs/arsip/migrasi-data-inventori-ops.md
//   node scripts/migrasi-inventori-ops/migrasi.mjs --backup <folder backup> --snapshot <snap.sql> --out <folder keluaran> [--final] [--open=stop|skip] [--cutover <ISO>]
// Default dry-run: hanya laporan + hitungan. --final menulis out/*.sql, r2-manifest.json, unggah-r2.ps1, akun-baru.csv (di ..\rahasia).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Ctx, lit, writeCsv } from "./lib/core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const fixtureDir = path.join(here, "fixture");

// ---- argumen ----
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) fail(`Argumen tak dikenal: ${a}`);
  const [k, v] = a.slice(2).split(/=(.*)/s);
  if (["final"].includes(k)) opt[k] = true;
  else opt[k] = v ?? argv[++i];
}
function fail(msg, code = 1) { console.error(msg); process.exit(code); }
if (!opt.backup || !opt.snapshot || !opt.out) {
  fail("Pakai: node scripts/migrasi-inventori-ops/migrasi.mjs --backup <folder> --snapshot <snap.sql> --out <folder> [--final] [--open=stop|skip] [--cutover <ISO>]");
}
if (opt.open && !["stop", "skip"].includes(opt.open)) fail("--open harus stop atau skip");
const within = (child, parent) => { const r = path.relative(parent, child); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };
const outDir = path.resolve(opt.out), secretDir = path.resolve(outDir, "..", "rahasia");
for (const d of [outDir, secretDir]) {
  if (within(d, repoRoot) && !within(d, fixtureDir)) fail(`Folder ${d} ada di dalam repo (hanya boleh di bawah scripts/migrasi-inventori-ops/fixture/ yang di-gitignore). Pakai --out di luar repo.`);
}
const cutover = opt.cutover ? Date.parse(opt.cutover) : undefined; // default: waktu backup (lihat Ctx)
if (opt.cutover && !Number.isFinite(cutover)) fail("--cutover harus tanggal ISO, mis. 2026-10-31T00:00:00+07:00");

const ctx = new Ctx({ backupDir: opt.backup, snapshot: opt.snapshot, outDir, final: !!opt.final, open: opt.open ?? "stop", cutoverSec: cutover === undefined ? undefined : Math.floor(cutover / 1000) });
console.log(`${ctx.final ? "FINAL" : "DRY-RUN"} | backup: ${ctx.backupFile}\nkeluaran: ${outDir}`);

// ---- F3: PO/pengiriman terbuka ----
const openOrders = ctx.rows(`SELECT o.id, o.poNumber, o.status, group_concat(d.status) AS statusKirim FROM orders o LEFT JOIN deliveries d ON d.orderId = o.id
  WHERE o.status NOT IN ('delivered','cancelled') OR d.status NOT IN ('delivered','cancelled') GROUP BY o.id ORDER BY o.id`);
if (openOrders.length) {
  for (const r of openOrders.map((o) => ({ id_sumber: o.id, nomor: o.poNumber, status_po: o.status, status_kirim: o.statusKirim ?? "" }))) ctx.report("po-terbuka", r);
  const daftar = openOrders.map((o) => `  #${o.id} ${o.poNumber} [${o.status}${o.statusKirim ? ` / ${o.statusKirim}` : ""}]`).join("\n");
  if (ctx.open === "skip") {
    openOrders.forEach((o) => ctx.skipOrder(o.id));
    console.log(`--open=skip: ${openOrders.length} PO terbuka dilewati (beserta turunannya):\n${daftar}`);
  } else if (ctx.final) {
    ctx.finish(); // tulis daftar po-terbuka.csv
    fail(`BERHENTI: ${openOrders.length} PO/pengiriman masih terbuka. Selesaikan/batalkan di app lama, atau jalankan dengan --open=skip.\n${daftar}\n(daftar: ${path.join(outDir, "laporan", "po-terbuka.csv")})`, 2);
  } else {
    console.warn(`PERINGATAN: ${openOrders.length} PO/pengiriman terbuka (--final akan BERHENTI kecuali --open=skip):\n${daftar}`);
  }
}

// ---- 00-prep: trigger pengaman arsip (B.3.4) ----
if (ctx.final) {
  for (const [name, table] of [["iops_arsip_stock_moves", "inv_stock_moves"], ["iops_arsip_fin_journals", "fin_journals"]]) {
    ctx.emit("00-prep", `CREATE TRIGGER IF NOT EXISTS ${name} BEFORE INSERT ON ${table} WHEN NEW.source_id LIKE 'iops-%' BEGIN SELECT RAISE(ABORT, 'arsip inventori-ops tidak boleh diposting'); END;`);
  }
}

// ---- modul berurutan ----
for (const name of ["pengguna", "induk", "pesanan-kirim", "mutu-lainnya"]) {
  let mod;
  try { mod = await import(pathToFileURL(path.join(here, "lib", `${name}.mjs`)).href); }
  catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND" && String(e.message).includes(`${name}.mjs`)) { ctx.warn(`modul lib/${name}.mjs belum ada: dilewati`); continue; }
    throw e;
  }
  console.log(`> ${name}`);
  await mod.migrate(ctx);
}

// ---- 08-verifikasi (E.4) ----
function buildVerifikasi() {
  const q = [];
  const add = (label, expr, harapan) => q.push(`SELECT ${lit(label)} AS pemeriksaan, (${expr}) AS nilai, ${harapan} AS harapan`);
  for (const [t, n] of Object.entries(ctx.targetCounts).sort()) if (t !== "users") add(`jumlah ${t} (id iops-%)`, `SELECT count(*) FROM "${t}" WHERE id LIKE 'iops-%'`, n);
  add("stok bergerak arsip", "SELECT count(*) FROM inv_stock_moves WHERE source_id LIKE 'iops-%'", 0);
  add("jurnal arsip", "SELECT count(*) FROM fin_journals WHERE source_id LIKE 'iops-%'", 0);
  add("faktur dari PO arsip", "SELECT count(*) FROM fin_invoices WHERE order_id LIKE 'iops-%'", 0);
  add("SJ arsip dengan departed_at", "SELECT count(*) FROM ops_deliveries WHERE id LIKE 'iops-%' AND departed_at IS NOT NULL", 0);
  add("baris SJ arsip pada SJ terbuka", "SELECT count(*) FROM ops_delivery_lines l JOIN ops_deliveries d ON d.id = l.delivery_id WHERE d.id LIKE 'iops-%' AND d.status NOT IN ('terkirim','batal')", 0);
  const sm = ctx.web.prepare("SELECT count(*) AS n, coalesce(sum(qty),0) AS q, coalesce(sum(value),0) AS v FROM inv_stock_moves").get();
  add("stok: jumlah baris (snapshot)", "SELECT count(*) FROM inv_stock_moves", sm.n);
  add("stok: sum(qty) (snapshot)", "SELECT coalesce(sum(qty),0) FROM inv_stock_moves", sm.q);
  add("stok: sum(value) (snapshot)", "SELECT coalesce(sum(value),0) FROM inv_stock_moves", sm.v);
  const jl = ctx.web.prepare("SELECT count(*) AS n, coalesce(sum(debit),0) AS d, coalesce(sum(credit),0) AS c FROM fin_journal_lines").get();
  add("buku besar: jumlah baris (snapshot)", "SELECT count(*) FROM fin_journal_lines", jl.n);
  add("buku besar: sum(debit) (snapshot)", "SELECT coalesce(sum(debit),0) FROM fin_journal_lines", jl.d);
  add("buku besar: sum(credit) (snapshot)", "SELECT coalesce(sum(credit),0) FROM fin_journal_lines", jl.c);
  // rujukan yatim (hanya baris arsip)
  const orphan = (t, col, ref) => ctx.targetCounts[t] && add(`yatim ${t}.${col}`, `SELECT count(*) FROM "${t}" t WHERE t.id LIKE 'iops-%' AND t.${col} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${ref} r WHERE r.id = t.${col})`, 0);
  orphan("ops_orders", "contact_id", "fin_contacts");
  orphan("ops_order_lines", "order_id", "ops_orders");
  orphan("ops_order_lines", "item_id", "fin_items");
  orphan("ops_deliveries", "order_id", "ops_orders");
  orphan("ops_delivery_history", "delivery_id", "ops_deliveries");
  orphan("ops_delivery_proofs", "delivery_id", "ops_deliveries");
  orphan("qc_strength_samples", "test_id", "qc_strength_tests");
  orphan("qc_sand_tests", "receipt_id", "ops_goods_receipts");
  orphan("ops_calendar_participants", "event_id", "ops_calendar_events");
  orphan("ops_calendar_results", "event_id", "ops_calendar_events");
  for (const t of ["ops_orders", "ops_goods_receipts", "inv_productions", "ops_calendar_events", "qc_mix_designs"]) orphan(t, "created_by", "users");
  // pengguna
  const nu = ctx.newUsers;
  if (nu.length) {
    const cond = nu.map((u) => `(id = ${u.id} AND name = ${lit(u.name)} AND email IS ${lit(u.email)} AND phone IS ${lit(u.phone)})`).join(" OR ");
    add("pengguna baru sesuai user-map (id,nama,email,HP)", `SELECT count(*) FROM users WHERE ${cond}`, nu.length);
    add("pengguna baru tanpa kredensial", `SELECT count(*) FROM users WHERE id IN (${nu.map((u) => u.id).join(",")}) AND password_hash IS NULL AND pin_hash IS NULL`, (ctx.reports.get("perlu-kredensial") ?? []).length);
  }
  add("email ganda", "SELECT count(*) FROM (SELECT 1 FROM users WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1)", 0);
  add("HP ganda", "SELECT count(*) FROM (SELECT 1 FROM users WHERE phone IS NOT NULL GROUP BY phone HAVING count(*) > 1)", 0);
  // D1 membatasi suku compound SELECT: potong per 5 suku (satu pernyataan per potongan).
  const chunks = [];
  for (let i = 0; i < q.length; i += 5) chunks.push(q.slice(i, i + 5).join("\nUNION ALL\n"));
  return chunks;
}

// ---- tulis ----
if (ctx.final) {
  for (const stmt of buildVerifikasi()) ctx.emit("08-verifikasi", stmt);
  const manifest = [...ctx.manifest.values()];
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "r2-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "unggah-r2.ps1"), `# Unggah foto ke R2 (bucket istana-block-media) dari r2-manifest.json. Wajib pilih TEPAT SATU: -Local (uji) atau -Remote (produksi).
# Jalankan dari PowerShell; -Repo = folder repo istana-block-web (tempat wrangler terpasang).
param([switch]$Local, [switch]$Remote, [switch]$Wsl, [string]$WslRepo = "~/ibw-ops", [string]$Repo = (Get-Location).Path, [string]$Manifest = "$PSScriptRoot\\r2-manifest.json")
if ($Local.IsPresent -eq $Remote.IsPresent) { Write-Host "Pilih tepat satu: -Local (uji lokal) atau -Remote (produksi)."; exit 1 }
$mode = if ($Remote) { "--remote" } else { "--local" }
$items = Get-Content -Raw -Encoding UTF8 $Manifest | ConvertFrom-Json  # PS 5.1: jangan dibungkus @() (array tunggal tak diurai)
Set-Location $Repo
$gagal = 0; $i = 0
foreach ($m in $items) {
  $i++
  Write-Host "[$i/$($items.Count)] $($m.key)"
  if ($Wsl) {
    # -Wsl (hanya -Local): wrangler/workerd di Windows sering crash; jalankan di WSL dari $WslRepo (state R2 lokal = .wrangler milik salinan WSL itu).
    $p = ($m.src -replace '\\\\', '/'); $p = '/mnt/' + $p.Substring(0, 1).ToLower() + $p.Substring(2)
    wsl -e bash -lc ". ~/.nvm/nvm.sh; cd $WslRepo; CI=1 npx wrangler r2 object put 'istana-block-media/$($m.key)' --file '$p' --content-type '$($m.contentType)' --local"
  } else {
  npx wrangler r2 object put "istana-block-media/$($m.key)" --file $m.src --content-type $m.contentType $mode
  }
  if ($LASTEXITCODE -ne 0) { $gagal++; Add-Content "$PSScriptRoot\\unggah-r2-gagal.txt" $m.key }
}
Write-Host "Selesai: $($items.Count - $gagal) berhasil, $gagal gagal."
if ($gagal -gt 0) { exit 1 }
`, "utf8");
}
const written = ctx.finish();

// ---- ringkasan ----
console.log(`\nSelesai (${ctx.final ? "final" : "dry-run"}).`);
const hit = ctx.reports.get("hitungan") ?? [];
console.table(hit.map((h) => ({ tabel: h.tabel_sumber, sumber: h.baris_sumber, target: h.baris_target, status: h.status })));
for (const [name, rows] of ctx.reports) if (rows.length && name !== "hitungan") console.log(`laporan/${name}.csv: ${rows.length} baris`);
if (ctx.final) console.log(`berkas SQL (${written.length}):\n${written.map((f) => `  ${path.relative(outDir, f)}`).join("\n")}\nkredensial: ${path.join(secretDir, "akun-baru.csv")} (JANGAN di-commit)`);
