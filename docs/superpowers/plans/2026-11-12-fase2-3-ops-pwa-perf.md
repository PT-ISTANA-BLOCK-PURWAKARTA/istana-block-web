# Fase 2 & Fase 3 — Operasional Migration, SEO, Mobile, PWA & Performance Plan

> **For agentic workers:** Execute 3 disjoint parallel worker packages (**Worker A**: `biaya-armada`, **Worker B**: `gaji` + `stok` Paving + `qc` batch + `LinesEditor`, **Worker C**: Tempo cron/alarm + PWA + Performance/Mobile/Accessibility/SEO). Maintain all existing unrelated comments/docstrings, adapt all D1/UUID/users schemas to `istana-block-web`, verify `tsc --noEmit`, deploy safely with preserved Cloudflare custom domains, and run full verification (`cek-seo.mjs`, `openseo_crawl.mjs`, `Lighthouse`, `320px/390px/768px/1280px` Chromium checks, and `/operasional` checks) after the final edit.

**Scope:**
- **Included:** Backlog `#6` (full remaining `istana-block-inventori-ops` delta: `519b8e2`..`2e1acf8` + `batchCode`/`PavingStockSummary`), `#7` (SEO), `#8` (Mobile Optimization `320px`/`390px`/`768px`), `#9` (PWA), `#10` (Lighthouse/Performance + Accessibility contrast/name fixes).
- **Excluded / Held:** Hold `#12` (`/area-pengiriman` BBM simulator), Skip `#15` (stay on Next.js 15). Keep `SEARCH_INDEXING: "off"` in `wrangler.jsonc` unless owner changes it.

---

## Worker File Ownership & Tasks

### Worker A — Biaya Armada Full Feature Parity (`#6a`)
**Source reference:** `istana-block-inventori-ops` (`shared/fleet.ts`, `worker/fleet.ts`, `client/src/pages/FleetExpenses.tsx`, `scratch/ops_ui_delta.diff`, `scratch/ops_backend_delta.diff`).

**Target files (exclusive to Worker A):**
- Create `src/lib/ops/shared/fleet.ts` — shared constants/helpers adapted to `istana-block-web` (`FLEET_START_DATE = "2026-11-07"`, categories/kinds `EXPENSE_KINDS` including `"sewa"` / `"pendapatan"` / maintenance kinds, `SUBCATEGORIES`, `OTHER_INCOME_SUBCATEGORIES`, `PAYMENT_METHODS` without `"Kasbon"`, `FUNDS` `"ib"`/`"cepi"`/`"kas"`, `APPROVAL_THRESHOLD = 3_000_000`, `FLEET_CASH_DRIVERS`, `isTempoPayment`, `expenseNeedsApproval`, `isExpenseApproved`).
- Create `src/lib/ops/fleet.ts` — server helpers (`listFleetExpenses`, `listFleetVehicles`, `fleetTotals` with `pendapatan` & `approvalStatus` & `dueDate` tempo filtering, `assertFleetStart`, `summarizeBySubcategory`, `summarizeByTrip` / Perjalanan tracking).
- Modify `src/lib/media.ts` — add `"armada"` to `MediaFolder` union + doc comment.
- Modify `src/app/operasional/berkas/[...key]/route.ts` — allow `"armada"` folder in `FOLDERS` & `FOLDER_PERMS` (`armada: ["keuangan", "pengiriman", "laporan"]`).
- Create `src/app/operasional/(panel)/biaya-armada/actions.ts` — server actions (`saveFleetExpense`, `deleteFleetExpense`, `approveFleetExpense`, `markTempoPaid`, `saveFleetTrip`, `deleteFleetTrip`, `uploadFleetPhoto`) gated by `requirePerm("keuangan")` (or appropriate perm checks; note ACC approve restricted cleanly to pimpinan/owner/keuangan approvers as in `opsAccess()` + role check, and mandatory `dueDate` YYYY-MM-DD when `payment === "tempo"`, automatic `approvalStatus = total > 3_000_000 ? "menunggu" : "ok"`).
- Create `src/components/ops/fleet/FleetWorkspace.tsx` & `src/components/ops/fleet/fleet.css` — full interactive client workspace:
  - KPI strip (Sewa, Pendapatan lain, Biaya operasional, Dana Cepi, Tempo belum lunas)
  - Filter bar (period / month / vehicle / kind / subcategory / payment / tempo status + Excel export via `downloadWorkbook`)
  - Tabs: **Catatan biaya & pendapatan**, **Rekap subkategori**, **Perjalanan (`tripRef`)**, **Tempo & Jatuh tempo** (`TempoPanel` + `TempoBadge` + `Tandai lunas`), **Surat kendaraan** (STNK/KIR overview link to `/operasional/armada`)
  - Create/Edit modal or drawer/panel using `<Select>` & `<DateField>`, kind switcher (`Biaya`, `Sewa / pemasukan armada`, `Pendapatan lain (di luar sewa)`), mandatory `dueDate` when `payment === "tempo"`, multi-photo upload (`PhotoPicker` -> `armada` R2 folder -> `/operasional/berkas/armada/...`), inline ACC approve/reject banner for items `> Rp 3.000.000`.
- Rewrite `src/app/operasional/(panel)/biaya-armada/page.tsx` — server component loading expenses, vehicles, trips, and permissions, rendering `<FleetWorkspace />`.

---

### Worker B — Gaji & Rekap Kamis + Stok Paving + QC Batch + LinesEditor (`#6b`, `#6c`, `#6d`, `#6e`)
**Source reference:** `istana-block-inventori-ops` (`worker/payslips.ts`, `client/src/lib/payslipDoc.ts`, `client/src/pages/Payslips.tsx`, `shared/paving.ts`, `client/src/components/PavingStockSummary.tsx`, `shared/strength.ts`, `worker/qc.ts`, `LineEditor`).

**Target files (exclusive to Worker B):**
1. **Gaji & Rekap Barang Kamis (`#6b`):**
   - Create `src/lib/ops/payslip.ts` — `nextThursday`, `nextFirst`, `payPeriod`, `periodText`, `isIncomeLine`, backward-compatible line normalization supporting BOTH `{ quantity, description, rate, amount }` and legacy `{ amount, description }` rows in `ops_payslips`, `payslipTotals`, `productionPay` (querying `schema.productions`, `schema.productionLines` (`role = 'hasil'`), `schema.items`, and `schema.transfers` where `toKey = 'cat'` / tile painting per leader & period), `buildWeeklyItemRecap` (Jumat–Kamis production & transfer grouping), and `payslipHtml` print helper.
   - Rewrite `src/app/operasional/(panel)/gaji/actions.ts` & `src/app/operasional/(panel)/gaji/page.tsx`, plus create `src/components/ops/payslip/PayslipWorkspace.tsx` — `PaydayCard`, `payKind` (`mingguan` Kamis Jumat–Kamis vs `bulanan` tgl 1), `periodFrom`/`periodTo`, copy previous slip, auto-fill `ProductionFill`, `WeeklyItemRecap` + Excel export (`downloadWorkbook`) + `/operasional/cetak/rekap-gaji`, plus A5 print/PDF links.
   - Create A5 print routes:
     - `src/app/operasional/cetak/gaji/page.tsx`
     - `src/app/operasional/cetak/gaji/[id]/page.tsx`
     - `src/app/operasional/cetak/rekap-gaji/page.tsx`
2. **Stok Paving Matrix (`#6c`):**
   - Create `src/lib/ops/shared/paving.ts` (adapted cleanly to `schema.items` / `goods.ts` IDs & names).
   - Create `src/components/ops/stock/PavingStockSummary.tsx`.
   - Modify `src/app/operasional/(panel)/stok/page.tsx` to render `<PavingStockSummary />`.
3. **QC Uji Kuat Tekan `batchCode` & `batchAverages` (`#6d`):**
   - Modify `src/lib/ops/shared/strength.ts` (`batchAverages`).
   - Modify `src/lib/ops/qc.ts`, `src/app/operasional/actions/qc.ts`, `src/components/ops/qc/strengthInit.ts`, `src/components/ops/qc/StrengthForm.tsx`, `src/components/ops/qc/UjiTekanTab.tsx`, `src/app/operasional/(panel)/qc/uji-tekan/[id]/ubah/page.tsx`, `src/app/operasional/cetak/qc/uji-tekan/[id]/page.tsx` — add `batchCode` persistence/editing/display, `+3 sampel (batch sama)` action, and per-batch average summary on table & print sheet.
4. **Akuntansi `LinesEditor` Quick Shipping Charges (`#6e`):**
   - Modify `src/components/erp/LinesEditor.tsx` — when `mode === "sales"`, show quick add preset chips (`Biaya muat`, `Biaya bongkar`, `Biaya langsir`, `Ongkos kirim tambahan`) mapped to an existing `kind === "jasa"` item (`item:<id>`) if present, so `saveInvoice`'s strict `item:<id>` validation always succeeds.

---

### Worker C — Tempo Alarm/Cron + PWA + Performance/Mobile/Accessibility/SEO (`#6f`, `#7`, `#8`, `#9`, `#10`)
**Target files (exclusive to Worker C):**
1. **Tempo Hari-H Alarm & Cron (`#6f`):**
   - Create `src/lib/ops/cron/tempo.ts` — `remindFleetTempo(c)` using `c.db`, `c.env`, `c.budget` (no `server-only`, no `@/` aliases inside `cron/`). Queries due/overdue unpaid tempo items (`payment = 'tempo'`, `tempoPaidAt IS NULL`, `dueDate <= todayWib`, `tempoRemindedOn != todayWib`) when WIB hour `>= 8`, finds Cepi & Arel users in `users`, dispatches push with `tag: "alarm-tempo-" + date` (`alarm-` prefix for persistent sound/vibration), updates `tempoRemindedOn`.
   - Modify `src/lib/ops/cron.ts` — register `remindFleetTempo` in `jobs`.
   - Create `src/lib/ops/alarm.ts` (Web Audio double chime + Vibration fallback with user gesture unlock & mute toggle) and `src/components/ops/OpsAlarmListener.tsx` (listens to ServiceWorker push messages & polls/checks active alarms on `/operasional`).
   - Modify `src/app/operasional/(panel)/layout.tsx` — mount `<OpsAlarmListener />` (and verify menu permissions/order for `biaya-armada` & `gaji`).
2. **PWA (`#9`):**
   - Generate crisp `public/icon-192.png` (`192x192`), `public/icon-512.png` (`512x512`), and optimize `src/app/icon.png` (<= 12 KB instead of 139 KB!) from `src/app/icon.png` / brand logo.
   - Create `src/app/manifest.ts` serving `/manifest.webmanifest` (`name: "Istana Block Purwakarta"`, `short_name: "Istana Block"`, `start_url: "/"`, `display: "standalone"`, `theme_color: "#0E2A6B"`, `background_color: "#F1F1EE"`, icons `/icon-192.png`, `/icon-512.png`).
   - Modify `public/sw.js` — handle `alarm-` and `delivery-` notification prefixes (`requireInteraction: true`, `vibrate: [250, 120, 250, 120, 250]`, `icon: "/icon-192.png"`, `badge: "/icon-192.png"`), forward `postMessage` to open clients, NO `fetch` listener so `worker.ts` HTML cache is untouched.
3. **Lighthouse Performance, Accessibility, Mobile (`320px`) & SEO (`#7`, `#8`, `#10`):**
   - **Scope `panel.css` out of public `(site)` routes:** Create tiny route-group `layout.tsx` files importing `@/app/panel.css` for `src/app/internal/layout.tsx`, `src/app/akuntansi/layout.tsx`, `src/app/operasional/layout.tsx`, `src/app/situs/layout.tsx`, `src/app/kiriman/layout.tsx` (taking care of `@import` or relative path), and remove `import "./panel.css";` from root `src/app/layout.tsx`.
   - **Enable Chrome bf-cache & Longer Asset Caching:** Modify `worker.ts` so cached public HTML responses send browser `Cache-Control: public, max-age=0, must-revalidate` instead of `no-store` (preserving `no-store` ONLY on `NO_CACHE` / panel routes!), and update `public/_headers` `/img/*`, `/brand/*`, `/reel/*`, `/katalog/*` to `Cache-Control: public, max-age=2592000`.
   - **Fix Accessibility Contrast & Label Mismatches:**
     - `src/app/globals.css`: `.pill-orange { background: var(--oranye-cta); }` (contrast >= 4.5:1), fix `.faq-grid` (`minmax(min(100%, 320px), 1fr)`), `.reviews` (`minmax(min(100%, 280px), 1fr)`), `.proof` (`minmax(min(100%, 220px), 1fr)`), `.steps` (`minmax(min(100%, 240px), 1fr)`), `.site-footer .wrap` (`minmax(min(100%, 240px), 1fr)`), `.artikel-archive-grid` (`minmax(min(100%, 240px), 1fr)`).
     - `src/app/panel.css`: fix `.login-wrap` / `.login-card` / `.pin-input` padding on `@media (max-width: 480px)` so `/operasional/login` has 0 overflow at `320px`.
     - `src/app/(site)/produk/produk.css`: darken `.pk-reg-kick` (`color: var(--oranye-cta-hover);` = `#b8350e`, >= 5:1 on light slate), and replace expensive `backdrop-filter: blur(8px)` on `.pk-wm-badge` with solid translucent `rgba(255,255,255,0.92)` for faster mobile compositing.
     - `src/components/HomeSearch.tsx` & `src/components/ProdukShowcase.tsx`: eliminate `label-content-name-mismatch` by keeping visible text inside accessible name (remove conflicting `aria-label` in `HomeSearch` trigger in favor of `<span className="sr-only">...</span>` alongside visible ticker, and update `pk-sample-tile` `aria-label={`${s.name} ${s.spec} — lihat sampel`}`). Also delay initial placeholder interval start cleanly after mount/idle (`>= 4500ms`) so first-paint main thread isn't disturbed during hydration.
   - **Optimize Oversized Sample/Logo/Poster Images (`image-delivery-insight`):** Generate `-320.webp` variants of `public/img/sampel/*tkdn-o.webp` and `public/brand/logo-istana-block*-294.webp` (or resize appropriately via `sharp`) and wire `srcSet` / `responsif` in `ProdukShowcase.tsx` (`PAVING_SAMPLES`) & `SiteChrome.tsx` (`brand-logo` & footer logo) without reducing visual quality.

---

## Coordinator Verification & Deploy Gate
1. `tsc --noEmit` in WSL `/home/sarimusan/ibw-ops` (after syncing).
2. `npx wrangler deploy --dry-run` check + check `wrangler.jsonc` (`"workers_dev": false` + preserved routes/custom domains), deploy via `sync_deploy.sh`.
3. Immediately verify `https://istanablock.com/`, `https://www.istanablock.com/`, `https://istanablock.com/manifest.webmanifest`, `https://istanablock.com/sw.js` return HTTP 200 and custom domains remain attached.
4. Warm public cache & run:
   - `node tools/cek-seo.mjs https://istanablock.com --skip-ttfb`
   - `openseo_crawl.mjs` against `https://istanablock.com`
   - `scratch/run_lh.mjs` against `https://istanablock.com` across `/`, `/produk`, `/pola-paving`, `/artikel`, `/kontak`, `/paket-proyek`
   - `scratch/probe_mobile.mjs` at `320px`, `390px`, `768px`, and desktop `1280px` + smoke check on `/operasional/biaya-armada`, `/operasional/gaji`, `/operasional/stok`, `/operasional/qc`.
