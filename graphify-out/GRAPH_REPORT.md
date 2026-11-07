# Graph Report - istana-block-web  (2026-11-07)

## Corpus Check
- 546 files · ~1,316,550 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4721 nodes · 15558 edges · 157 communities (143 shown, 14 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 282 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a304c20`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- xlsx-0.20.3.mjs
- new_buf
- db/index.ts
- isDate
- erp.ts
- safe_decode_range
- parse_zip
- writextag
- today
- kalender/page.tsx
- generate.mjs
- server.ts
- fmt
- cek-seo.mjs
- getDb
- SupplierBoard.tsx
- requirePerm
- requireAdmin
- actions/deliveries.ts
- receipts/util.ts
- rekap-iso/page.tsx
- customer-leads-core.ts
- write_numbers_tma
- parse_xlml_xml
- runBatch
- readSync
- iso-core.ts
- ui/index.ts
- users.ts
- roles.ts
- actions/sand.ts
- ActionForm.tsx
- formatQty
- PatternCalculator.tsx
- cfb_add
- ProductionForm.tsx
- buat-fixture.mjs
- stock.ts
- getSettings
- ZahirImport.tsx
- PanelShell.tsx
- compilerOptions
- RichEditor.tsx
- ReceiptRatings.tsx
- 1. STOK BARANG (`/stok`)
- dependencies
- ops/iso.ts
- (site)/page.tsx
- 1. REKAP PELANGGAN (`CustomersPage-*.js`)
- scripts
- erp/tracking.ts
- piket/page.tsx
- operasional/(panel)/layout.tsx
- normalizeRoles
- jsonld.ts
- StrengthForm.tsx
- shared/sand.ts
- security/backup.ts
- ops/qc.ts
- queries.ts
- invoiceNow
- can
- schema.ts
- produksi/page.tsx
- FormsTab.tsx
- addDays
- actions/customer-leads.ts
- operasional/(panel)/profil/page.tsx
- tugas/[id]/page.tsx
- isoExcel.ts
- isoForms.ts
- HarianTab.tsx
- qc/labels.ts
- guard.ts
- qc/page.tsx
- score.ts
- core.mjs
- operasional/(panel)/laporan/page.tsx
- LinesEditor.tsx
- summary-core.ts
- devDependencies
- create-admin.mjs
- actions/calendar.ts
- dyn
- parse_xlsxcfb
- Ctx
- session.ts
- status.ts
- push.ts
- Istana Block Purwakarta — situs web dan aplikasi internal (situs, operasional, keuangan)
- pesanan-kirim.mjs
- audio_vo.py
- Spesifikasi migrasi data: inventori-ops -> istana-block-web (Operasional)
- buyMaterials
- import-inventori-ops.py
- ops/deliveries.ts
- [token]/page.tsx
- imageUrl
- audio.py
- worker.ts
- generate_vo.py
- PatternCalculator
- Perbaikan SEO on-page dan schema: ringkasan, patch SQL, urutan kerja
- parse_TypedPropertyValue
- migrasi.mjs
- mix/page.tsx
- produk/[slug]/page.tsx
- Status terkini — 6 November 2026
- simulasi-gps.mjs
- getEnv
- muatan/page.tsx
- RekapTab.tsx
- parse_ColRelU
- akun-demo.mjs
- insert
- TestimonialForm.tsx
- TruckTracker.tsx
- Teks kebijakan privasi: Google Analytics dan Google Ads
- push/route.ts
- PatternArt
- period.ts
- docs/README.md
- Peta gap porting inventori-ops → istana-block-web
- fondasi-setara.md
- gambar-varian.mjs
- Pelacakan Google Ads & GA4 di situs baru
- Migrasi data inventori-ops -> istana-block-web
- faktur/[id]/page.tsx
- decodeState
- Rencana kerja 1–3 (6 November 2026)
- Worklog: port istana-block-inventori-ops → menu OPERASIONAL
- package.json
- make-vapid-keys.mjs
- render.mjs
- E. Urutan impor, penomoran, batas D1, verifikasi
- Brag plan — Istana Block: fitur yang berguna di situs
- salin-foto-ke-r2.py
- mod
- path
- ym
- rng
- Video fitur (reel)
- cloudflare-env.d.ts
- @fontsource/poppins
- next.config.ts
- react-dom
- @tiptap/extension-table
- @tiptap/pm
- @tiptap/react
- @tiptap/starter-kit
- zod
- Raw
- vo_prep.py

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 440 edges
2. `requirePerm()` - 169 edges
3. `new_buf()` - 132 edges
4. `today()` - 129 edges
5. `PageHead()` - 113 edges
6. `requireModule()` - 108 edges
7. `tgl()` - 105 edges
8. `guard()` - 103 edges
9. `logActivity()` - 91 edges
10. `formatQty()` - 86 edges

## Surprising Connections (you probably didn't know these)
- `check_wb()` --indirect_call--> `nn()`  [INFERRED]
  public/vendor/xlsx-0.20.3.mjs → scripts/migrasi-inventori-ops/lib/pesanan-kirim.mjs
- `buyMaterials()` --indirect_call--> `qty()`  [INFERRED]
  scripts/demo/generate.mjs → src/components/ops/supplier/summaries.ts
- `produce()` --indirect_call--> `qty()`  [INFERRED]
  scripts/demo/generate.mjs → src/components/ops/supplier/summaries.ts
- `refresh()` --indirect_call--> `path()`  [INFERRED]
  src/app/operasional/actions/receipts.ts → scripts/demo/generate.mjs
- `refresh()` --indirect_call--> `path()`  [INFERRED]
  src/app/operasional/actions/sand.ts → scripts/demo/generate.mjs

## Import Cycles
- None detected.

## Communities (157 total, 14 thin omitted)

### Community 0 - "xlsx-0.20.3.mjs"
Cohesion: 0.01
Nodes (256): RFC-1951, book_set_sheet_visibility(), build_full_paths(), cell_set_hyperlink(), cell_set_internal_link(), check_get_mver(), check_shifts(), chkcond() (+248 more)

### Community 1 - "new_buf"
Cohesion: 0.03
Nodes (170): book_to_wk3(), buf_array(), decode_cell(), get_sst_id(), guess_property_type(), new_buf(), safe1904(), write_Bes() (+162 more)

### Community 2 - "db/index.ts"
Cohesion: 0.05
Nodes (91): metadata, metadata, metadata, metadata, metadata, metadata, KasDetail(), KIND (+83 more)

### Community 3 - "isDate"
Cohesion: 0.05
Nodes (108): Cell, csv(), GET(), Akun(), metadata, JurnalDetail(), Jurnal(), Kas() (+100 more)

### Community 4 - "erp.ts"
Cohesion: 0.02
Nodes (112): Account, AccountGroup, accounts, activityLogs, adjustments, Bill, billLines, bills (+104 more)

### Community 5 - "safe_decode_range"
Cohesion: 0.04
Nodes (114): book_append_sheet(), book_new(), check_wb(), check_wb_names(), check_ws(), check_ws_name(), datenum(), decode_range() (+106 more)

### Community 6 - "parse_zip"
Cohesion: 0.03
Nodes (101): char_codes(), escapehtml(), fix_opts_func(), fix_read_opts(), get_sheet_type(), getdata(), getdatabin(), getdatastr() (+93 more)

### Community 7 - "writextag"
Cohesion: 0.05
Nodes (94): add_rels(), char2width(), col_obj_w(), cp_doit(), cycle_width(), dup(), escapexlml(), escapexml() (+86 more)

### Community 8 - "today"
Cohesion: 0.05
Nodes (70): JurnalBaru(), KasBaru(), FakturBaru(), metadata, CetakSuratJalan(), metadata, Armada(), BiayaArmada() (+62 more)

### Community 9 - "kalender/page.tsx"
Cohesion: 0.06
Nodes (70): HasilAcara(), metadata, metadata, UbahAcara(), CalendarTab(), Kalender(), lastOfMonth(), metadata (+62 more)

### Community 10 - "generate.mjs"
Cohesion: 0.02
Nodes (72): A, AREAS, argv, balance, BILLS, BULAN, cancelled, CID (+64 more)

### Community 11 - "server.ts"
Cohesion: 0.05
Nodes (60): AccountInput, ContactInput, deleteAccount(), deleteContact(), deleteItem(), importItemsFromProducts(), ItemInput, itemNameFrom() (+52 more)

### Community 12 - "fmt"
Cohesion: 0.08
Nodes (54): AckLevel, CetakUjiPasir(), metadata, Chips(), PhotoPicker(), Picked, ReceiptCard(), berkasUrl() (+46 more)

### Community 13 - "cek-seo.mjs"
Cohesion: 0.07
Nodes (66): url(), ambilHalaman(), ambilHeaderMentah(), ambilTag(), analisisHtml(), analisisJsonLd(), ANGGARAN_JS, bacaPackageJson() (+58 more)

### Community 14 - "getDb"
Cohesion: 0.06
Nodes (51): AkunDetail(), UbahJurnal(), Kontak(), GET(), Kendaraan(), FakturJual(), metadata, rupiah() (+43 more)

### Community 15 - "SupplierBoard.tsx"
Cohesion: 0.10
Nodes (56): shortDate(), whenFull(), wibDay(), wibMonth(), esc(), exportSupplierExcel(), latest(), levelText() (+48 more)

### Community 16 - "requirePerm"
Cohesion: 0.10
Nodes (55): deleteEvent(), signAttendance(), deleteLeadAction(), correctDeliveryArrival(), deleteDriver(), deleteVehicle(), DriverInput, saveDriver() (+47 more)

### Community 17 - "requireAdmin"
Cohesion: 0.07
Nodes (43): ArticleInput, deleteArticle(), saveArticle(), deletePage(), PageInput, savePage(), deleteProduct(), deleteTestimonial() (+35 more)

### Community 18 - "actions/deliveries.ts"
Cohesion: 0.08
Nodes (51): assignDelivery(), backTarget(), checkAssignees(), completeDelivery(), createTrackingLink(), deleteDelivery(), DeliveryRow, doneMessage() (+43 more)

### Community 19 - "receipts/util.ts"
Cohesion: 0.07
Nodes (50): BahanBaku(), metadata, threeMonthsStart(), BarangMasuk(), metadata, Params, TABS, metadata (+42 more)

### Community 20 - "rekap-iso/page.tsx"
Cohesion: 0.09
Nodes (46): metadata, one(), SearchParams, TABS, fetchAllRows(), fetchOverview(), getJson(), objectivesSheet() (+38 more)

### Community 21 - "customer-leads-core.ts"
Cohesion: 0.07
Nodes (48): ImportDialog(), LeadForm(), Dialog, Feedback(), LeadWorkspace(), rateLabel(), ratingEmpty(), rp() (+40 more)

### Community 22 - "write_numbers_tma"
Cohesion: 0.12
Nodes (55): build_numbers_deps(), compress_iwa_file(), decompress_iwa_file(), find(), get_author_color(), get_unique_msgid(), iwa_to_s5s_comment(), mappa() (+47 more)

### Community 23 - "parse_xlml_xml"
Cohesion: 0.06
Nodes (53): ab2a(), carry(), commaify(), dec(), default_margins(), evert(), fill(), flr() (+45 more)

### Community 24 - "runBatch"
Cohesion: 0.21
Nodes (47): CASH_PREFIX, deleteCash(), deleteJournal(), saveCash(), saveJournal(), deleteBill(), deletePayment(), recalcBillPaid() (+39 more)

### Community 25 - "readSync"
Cohesion: 0.07
Nodes (47): a2s(), aoa_to_sheet(), Base64_decode(), bstrify(), cc2str(), cpdoit(), dateNF_regex(), dbf_to_aoa() (+39 more)

### Community 26 - "iso-core.ts"
Cohesion: 0.09
Nodes (46): APP_ROWS, AppPage, appRow(), average(), bounds(), CHECK_LABELS, completerUser, COUNTED_UNITS (+38 more)

### Community 27 - "ui/index.ts"
Cohesion: 0.07
Nodes (35): saveContact(), KIND, metadata, KontakBaru(), metadata, dynamic, metadata, Params (+27 more)

### Community 28 - "users.ts"
Cohesion: 0.10
Nodes (39): changePassword(), changePin(), checkPhonePin(), checkRoles(), createUser(), Db, deleteUser(), nowDate() (+31 more)

### Community 29 - "roles.ts"
Cohesion: 0.10
Nodes (32): dynamic, metadata, clientIp(), Db, lockedFor(), loginEmail(), loginPin(), LoginState (+24 more)

### Community 30 - "actions/sand.ts"
Cohesion: 0.12
Nodes (39): endDuty(), startDuty(), createReceipt(), deleteReceipt(), findReceipt(), rateDelivery(), ratePrice(), rateQuality() (+31 more)

### Community 31 - "ActionForm.tsx"
Cohesion: 0.11
Nodes (17): ActionForm(), PendingContext, FormMessage(), Col, Repeater(), SubmitButton(), FinSettingsForm(), ArrivalCorrection() (+9 more)

### Community 32 - "formatQty"
Cohesion: 0.10
Nodes (34): BarangDetail(), Barang(), metadata, Page(), metadata, Page(), href(), KartuStok() (+26 more)

### Community 33 - "PatternCalculator.tsx"
Cohesion: 0.05
Nodes (33): ArtProps, CAD_OPTIONS, CalcState, COLOR_IDS, ColorId, COLORS, DEFAULT_W, fullpave() (+25 more)

### Community 34 - "cfb_add"
Cohesion: 0.07
Nodes (40): a2u(), Base64_encode(), Base64_encode_arr(), Base64_encode_pass(), blobify(), cfb_add(), cfb_del(), cfb_gc() (+32 more)

### Community 35 - "ProductionForm.tsx"
Cohesion: 0.09
Nodes (32): CetakSpesifikasi(), metadata, metadata, Page(), BatchForm(), BatchRow, blankRow(), ProdCategory (+24 more)

### Community 36 - "buat-fixture.mjs"
Cohesion: 0.06
Nodes (34): A, cf, cf2, D, db, dibuat, files, here (+26 more)

### Community 37 - "stock.ts"
Cohesion: 0.12
Nodes (32): ADJ_SOURCES, deleteBatch(), deleteProduction(), fillProductionFromMix(), optionalNumber(), parseIssues(), saveBatch(), productionCategories (+24 more)

### Community 38 - "getSettings"
Cohesion: 0.10
Nodes (26): AreaPage(), COLORS, metadata, Wilayah, KontakPage(), metadata, generateMetadata(), FAQ (+18 more)

### Community 39 - "ZahirImport.tsx"
Cohesion: 0.12
Nodes (32): SHORT, TONE, digits(), Draft, money(), Opt, PickItem, Veh (+24 more)

### Community 40 - "PanelShell.tsx"
Cohesion: 0.09
Nodes (26): dynamic, ITEMS, KeuanganLayout(), metadata, logout(), dynamic, metadata, dynamic (+18 more)

### Community 41 - "compilerOptions"
Cohesion: 0.06
Nodes (31): cloudflare-env.d.ts, @cloudflare/workers-types, dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules (+23 more)

### Community 42 - "RichEditor.tsx"
Cohesion: 0.09
Nodes (22): ArticleForm(), metadata, NewArticle(), EditArticle(), metadata, ImageField(), shrinkImage(), Glyph() (+14 more)

### Community 43 - "ReceiptRatings.tsx"
Cohesion: 0.11
Nodes (27): DialogForm(), Modal(), exportExcel(), LEVEL_CLASS, officerText(), ReceiptCardRow, ReceiptList(), DeliveryDialog() (+19 more)

### Community 44 - "1. STOK BARANG (`/stok`)"
Cohesion: 0.06
Nodes (30): 0. Menu & izin yang terlihat (DashboardLayout + rute di index), 1.1 Layar & label PERSIS (StockPage), 1.2 Kelompok barang (`line`) dan satuan, 1.3 Format kunci stok (`key`) [pasti dari fungsi `a` di stock-*.js], 1.4 Aturan pemetaan nama produk → jenis stok (di KLIEN, `stock-*.js` fungsi `d`), 1.5 Rumus sisa, 1.6 Prosedur, 1.7 Dugaan skema D1 [tebakan] (+22 more)

### Community 45 - "dependencies"
Cohesion: 0.06
Nodes (31): drizzle-orm, @fontsource/plus-jakarta-sans, jose, leaflet, next, @opennextjs/cloudflare, dependencies, drizzle-orm (+23 more)

### Community 46 - "ops/iso.ts"
Cohesion: 0.14
Nodes (29): backUrl(), deleteIsoRecordAction(), saveIsoRecordAction(), saveIsoSupplementAction(), saveObjectiveAction(), toNumber(), valuesFrom(), withOk() (+21 more)

### Community 47 - "(site)/page.tsx"
Cohesion: 0.13
Nodes (20): FILTERS, GaleriPage(), metadata, TILE_COLORS, metadata, Calculator(), fmt(), TYPES (+12 more)

### Community 48 - "1. REKAP PELANGGAN (`CustomersPage-*.js`)"
Cohesion: 0.07
Nodes (28): 0. Ringkasan delta yang ditemukan, 1.1 Menu, rute, izin (DashboardLayout + index) [pasti], 1.2 Layar (teks persis), 1.3 Form `Tambah konsumen` / `Ubah konsumen` (dialog), 1.4 Dialog `Penilaian pembeli`, 1.5 Prosedur tRPC `customers.*` (semua baru), 1.6 Impor Excel [pasti, logika klien lengkap], 1.7 Ekspor Excel [pasti] (+20 more)

### Community 49 - "scripts"
Cohesion: 0.07
Nodes (29): scripts, admin:create, build, cek:seo, cf-typegen, db:generate, db:migrate:local, db:migrate:remote (+21 more)

### Community 50 - "erp/tracking.ts"
Cohesion: 0.15
Nodes (23): fromJson(), fromParams(), GET, handle(), json(), num(), Parsed, POST (+15 more)

### Community 51 - "piket/page.tsx"
Cohesion: 0.15
Nodes (24): markNotificationsRead(), duration(), dynamic, hoursText(), metadata, nowSec(), Piket(), ShiftTable() (+16 more)

### Community 52 - "operasional/(panel)/layout.tsx"
Cohesion: 0.11
Nodes (24): Keamanan(), pretty(), dynamic, ITEMS, metadata, OperasionalLayout(), deviceLabel(), MODULE_LABELS (+16 more)

### Community 53 - "normalizeRoles"
Cohesion: 0.16
Nodes (22): backupRuns, calendarEvents, calendarParticipants, calendarReminders, users, remindBackup(), leadText(), sendDueReminders() (+14 more)

### Community 54 - "jsonld.ts"
Cohesion: 0.11
Nodes (21): dynamic, SiteLayout(), GoogleTagManager(), HexDivider(), hexPath(), LOOSE_COLORS, rand(), NAV_LINKS (+13 more)

### Community 55 - "StrengthForm.tsx"
Cohesion: 0.15
Nodes (22): CetakUjiTekan(), metadata, dateShort(), num(), emptySample(), pn(), StrengthForm(), defaultArea() (+14 more)

### Community 56 - "shared/sand.ts"
Cohesion: 0.11
Nodes (23): CATEGORIES, CATEGORY_CHIPS, ReceiveForm(), ReceiptStatus, BATCH_PREFIXES, MAX_RECEIPT_PHOTOS, OTHER_GOODS, OTHER_UNITS (+15 more)

### Community 57 - "security/backup.ts"
Cohesion: 0.15
Nodes (24): alreadyThere(), api(), backupToFolder(), DirHandle, downloadDatabase(), ensurePermission(), FileHandleW, folderPickerSupported() (+16 more)

### Community 58 - "ops/qc.ts"
Cohesion: 0.11
Nodes (23): MixDesignStatus, approver, avg(), BULAN, creator, getMixLog(), getStrengthTest(), groupBy() (+15 more)

### Community 59 - "queries.ts"
Cohesion: 0.17
Nodes (20): dynamic, GET(), oneLine(), sentence(), ArtikelPage(), metadata, Home(), dynamic (+12 more)

### Community 60 - "invoiceNow"
Cohesion: 0.21
Nodes (24): addBill(), bal(), cashTxn(), ensureBank(), ensureCash(), epoch(), GROUP(), invoiceNow() (+16 more)

### Community 61 - "can"
Cohesion: 0.17
Nodes (19): GET(), STATIC, FOLDERS, json(), POST(), FOLDER_PERMS, folderAllowed(), GET() (+11 more)

### Community 62 - "schema.ts"
Cohesion: 0.12
Nodes (20): metadata, ProdukPage(), parseJson(), ProductInput, saveProduct(), toInt(), ProductCard(), articles (+12 more)

### Community 63 - "produksi/page.tsx"
Cohesion: 0.19
Nodes (18): metadata, Produksi(), ProductionExcel(), CATEGORY_LABEL, categoryLabel(), hasilText(), hasNonconformity(), IssueSummary (+10 more)

### Community 64 - "FormsTab.tsx"
Cohesion: 0.11
Nodes (19): Chip(), TONE_OF, TONES, columnsOf(), FormsTab(), Props, SOURCE, ExportFormButton() (+11 more)

### Community 65 - "addDays"
Cohesion: 0.13
Nodes (22): addDays(), addWorkdays(), dow(), drafts, isClosed(), isOfficeDay(), isWorkday(), lastDay() (+14 more)

### Community 66 - "actions/customer-leads.ts"
Cohesion: 0.21
Nodes (19): exportLeadsAction(), importLeadsAction(), optDate(), rateLeadAction(), reasonsOf(), refresh(), saveLeadAction(), star() (+11 more)

### Community 67 - "operasional/(panel)/profil/page.tsx"
Cohesion: 0.16
Nodes (15): metadata, Profil(), AkunSopir(), metadata, Akun(), metadata, PasswordForm(), PinForm() (+7 more)

### Community 68 - "tugas/[id]/page.tsx"
Cohesion: 0.18
Nodes (18): jam(), metadata, TugasDetail(), metadata, Trip(), Tugas(), DRIVER_STEP_LABEL, driverBase() (+10 more)

### Community 69 - "isoExcel.ts"
Cohesion: 0.16
Nodes (21): cell(), downloadAllForms(), downloadFormFile(), exportColumns(), ExportMeta, ExportRow, formSheet(), lineCell() (+13 more)

### Community 70 - "isoForms.ts"
Cohesion: 0.12
Nodes (19): URGENCY, objectiveMonth(), env(), IsoForm, IsoInputRole, IsoValues, KGCM2_PER_MPA, num() (+11 more)

### Community 71 - "HarianTab.tsx"
Cohesion: 0.18
Nodes (19): differs(), excelSheets(), HarianTab(), TONE, materialText(), REVIEW_LABELS, archiveLabel(), archiveTone() (+11 more)

### Community 72 - "qc/labels.ts"
Cohesion: 0.20
Nodes (18): CHECK_STATUS_LABELS, CHECK_STATUSES, dayName(), dayShort(), DEFAULT_MATERIALS, fromRows(), LAYER_LABELS, LAYERS (+10 more)

### Community 73 - "guard.ts"
Cohesion: 0.32
Nodes (14): GET(), GET(), forbidden(), json(), owner(), quote(), sameOrigin(), SCHEMA_ONLY (+6 more)

### Community 74 - "qc/page.tsx"
Cohesion: 0.17
Nodes (18): IsiMixDesain(), UbahMixDesain(), metadata, QcPage(), rangeOf(), TabKey, TABS, TemplateBaru() (+10 more)

### Community 75 - "score.ts"
Cohesion: 0.16
Nodes (19): OverallBadge(), monthName(), monthShort(), num(), OverallBars(), OverallCurve(), PartsLine(), RankItem (+11 more)

### Community 76 - "core.mjs"
Cohesion: 0.19
Nodes (17): csvCell(), CT, loadSql(), normalizePhone(), normName(), NOT_MIGRATED, readCsv(), toCsv() (+9 more)

### Community 77 - "operasional/(panel)/laporan/page.tsx"
Cohesion: 0.19
Nodes (15): dynamic, href(), Laporan(), metadata, Delta(), PREVIOUS_LABEL, QtyTable(), share() (+7 more)

### Community 78 - "LinesEditor.tsx"
Cohesion: 0.20
Nodes (13): CashEditor(), CRow, Head, JournalEditor(), JRow, EditorLine, LinesEditor(), Mode (+5 more)

### Community 79 - "summary-core.ts"
Cohesion: 0.16
Nodes (19): BuildOptions, buildSummary(), deliveredProducts(), dutyHours(), fmt(), Issue, issueList(), list() (+11 more)

### Community 80 - "devDependencies"
Cohesion: 0.11
Nodes (19): @cloudflare/workers-types, drizzle-kit, devDependencies, @cloudflare/workers-types, drizzle-kit, sharp, @types/leaflet, @types/node (+11 more)

### Community 81 - "create-admin.mjs"
Cohesion: 0.11
Nodes (15): args, config, dir, driver, email, FIELD, file, password (+7 more)

### Community 82 - "actions/calendar.ts"
Cohesion: 0.16
Nodes (14): addMonths(), FILE_MIMES, occurrenceDays(), parseJsonList(), reminderRows(), requireTime(), saveEvent(), saveResult() (+6 more)

### Community 83 - "dyn"
Cohesion: 0.13
Nodes (18): bit_swap_n(), build_tree(), crypto_CreatePasswordVerifier_Method1(), dyn(), inflate(), _JS2ANSI(), new_raw_buf(), new_unsafe_buf() (+10 more)

### Community 84 - "parse_xlsxcfb"
Cohesion: 0.14
Nodes (18): parse_CRYPTOVersion(), parse_DataSpaceDefinition(), parse_DataSpaceMap(), parse_DataSpaceMapEntry(), parse_DataSpaceVersionInfo(), parse_EncInfoExt(), parse_EncInfoStd(), parse_EncryptionHeader() (+10 more)

### Community 86 - "session.ts"
Cohesion: 0.16
Nodes (14): dynamic, robots(), isCanonicalHost(), SESSION_COOKIE, SESSION_MAX_AGE, SessionPayload, verifySession(), config (+6 more)

### Community 87 - "status.ts"
Cohesion: 0.14
Nodes (12): ExportButton(), Hist, Payload, Row, FLOW_STEPS, Progress, STATUS_LABEL, STATUS_TITLE (+4 more)

### Community 88 - "push.ts"
Cohesion: 0.19
Nodes (16): RFC-8291, RFC-8292, bs(), clip(), concat(), decodeBase64(), encodeBase64Url(), encoder (+8 more)

### Community 89 - "Istana Block Purwakarta — situs web dan aplikasi internal (situs, operasional, keuangan)"
Cohesion: 0.12
Nodes (17): Data awal & yang perlu dilengkapi, Data contoh (untuk latihan & presentasi), Deploy ke Cloudflare, Editor isi, Fitur, Istana Block Purwakarta — situs web dan aplikasi internal (situs, operasional, keuangan), Keamanan, Komponen form (+9 more)

### Community 90 - "pesanan-kirim.mjs"
Cohesion: 0.20
Nodes (15): addressText(), dateN(), DELIVERY_STATUS, digits(), isIntegerLike(), joinLines(), mapsUrl(), migrate() (+7 more)

### Community 91 - "audio_vo.py"
Cohesion: 0.16
Nodes (10): bp(), click(), hat(), hp(), key(), lp(), pad(), VO version soundtrack: music + SFX (same key, same space) re-timed to the 28.6… (+2 more)

### Community 92 - "Spesifikasi migrasi data: inventori-ops -> istana-block-web (Operasional)"
Cohesion: 0.12
Nodes (15): 0. Masukan, keluaran, konvensi, A.1 Pengguna & sesi, A.2 Data induk (dicocokkan, bukan disalin), A.3 Pesanan & pengiriman (ARSIP), A.4 QC, produksi, penerimaan, A.5 Kalender, ISO, keamanan, A. Pemetaan per tabel, B.1 Bagaimana web menandai "sudah diposting" (+7 more)

### Community 93 - "buyMaterials"
Cohesion: 0.25
Nodes (16): addOrder(), at(), basket(), between(), buyMaterials(), cap(), chance(), deliveryAddress() (+8 more)

### Community 94 - "import-inventori-ops.py"
Cohesion: 0.21
Nodes (14): b(), build(), coerce(), day(), j(), key(), keys(), lit() (+6 more)

### Community 95 - "ops/deliveries.ts"
Cohesion: 0.18
Nodes (14): GET(), NotificationKind, coordsFromMapsUrl(), BoardJob, BoardNotification, HistoryRow, ReportHistory, ReportRow (+6 more)

### Community 96 - "[token]/page.tsx"
Cohesion: 0.18
Nodes (13): ago(), dynamic, HEADLINE, Kiriman(), metadata, wib(), HOME, TrackMap() (+5 more)

### Community 97 - "imageUrl"
Cohesion: 0.26
Nodes (12): ArticlePage(), generateMetadata(), Props, generateMetadata(), load(), Props, StaticPage(), components (+4 more)

### Community 98 - "audio.py"
Cohesion: 0.17
Nodes (10): bp(), click(), hat(), hp(), key(), lp(), pad(), Music + sound effects for the Istana Block reel, written as one piece (D major,… (+2 more)

### Community 99 - "worker.ts"
Cohesion: 0.23
Nodes (15): cacheKey(), edgeCache(), Entry, fetch(), forget(), fromEdge(), memory, refreshing (+7 more)

### Community 100 - "generate_vo.py"
Cohesion: 0.33
Nodes (14): ndarray, Path, finish(), list_edge_voices(), load_mono(), main(), process(), shift_rate() (+6 more)

### Community 101 - "PatternCalculator"
Cohesion: 0.25
Nodes (15): autoShares(), ceilSafe(), compute(), copyMessage(), copyText(), detailLines(), effectiveColors(), encodeState() (+7 more)

### Community 102 - "Perbaikan SEO on-page dan schema: ringkasan, patch SQL, urutan kerja"
Cohesion: 0.14
Nodes (14): 1. Apa yang berubah per butir prioritas, 2. Berkas SQL dan cara menjalankannya, 3. Urutan yang disarankan, 4. Pemeriksaan sesudah deploy, 5. Yang perlu pemilik (ringkas), 6. Catatan QA lintas klaster, 7.1 Apa yang ditambahkan, 7.2 Pagar regresi `tools/cek-seo.mjs` (+6 more)

### Community 103 - "parse_TypedPropertyValue"
Cohesion: 0.19
Nodes (14): parse_BLOB(), parse_ClipboardData(), parse_dictionary(), parse_lpstr(), parse_lpwstr(), parse_PropertySet(), parse_TypedPropertyValue(), parse_VtHeadingPair() (+6 more)

### Community 104 - "migrasi.mjs"
Cohesion: 0.14
Nodes (11): argv, buildVerifikasi(), ctx, fixtureDir, here, openOrders, opt, outDir (+3 more)

### Community 105 - "mix/page.tsx"
Cohesion: 0.25
Nodes (11): CetakKetidaksesuaian(), metadata, CetakMixDesain(), metadata, PrintDoc(), dayLong(), periodText(), SignBlock() (+3 more)

### Community 106 - "produk/[slug]/page.tsx"
Cohesion: 0.29
Nodes (12): cell(), dynamic, GET(), oneLine(), generateMetadata(), groupRows(), ProductPage(), Props (+4 more)

### Community 107 - "Status terkini — 6 November 2026"
Cohesion: 0.15
Nodes (13): 10. Cara deploy, 11. Catatan dokumen, 1. Produksi, 2. PR yang sudah di-merge, 3. App lama dan data, 4. Sisa pekerjaan: kode dan UI, 5. Pengujian dan bug terbuka, 6. Error 1102 (CPU Workers Free 10 ms) (+5 more)

### Community 108 - "simulasi-gps.mjs"
Cohesion: 0.19
Nodes (11): args, BASE, bearing(), HOME, INTERVAL, KEY, km(), send() (+3 more)

### Community 109 - "getEnv"
Cohesion: 0.24
Nodes (10): generateMetadata(), RootLayout(), viewport, GET(), GET(), HEAD(), load(), serve() (+2 more)

### Community 110 - "muatan/page.tsx"
Cohesion: 0.18
Nodes (10): dynamic, metadata, RANGES, STATUSES, wib(), AutoRefresh(), LoadButton(), NoticeItem (+2 more)

### Community 111 - "RekapTab.tsx"
Cohesion: 0.26
Nodes (7): QcExcelButton(), QcSheet, pct(), pctText(), RekapTab(), sheets(), SheetColumn

### Community 112 - "parse_ColRelU"
Cohesion: 0.24
Nodes (11): parse_ColRelU(), parse_PtgArea(), parse_PtgArea3d(), parse_PtgAreaN(), parse_PtgRef(), parse_PtgRef3d(), parse_RgceArea(), parse_RgceArea_BIFF2() (+3 more)

### Community 113 - "akun-demo.mjs"
Cohesion: 0.18
Nodes (7): args, FIELD, OFFICE, pass, password, rows, script

### Community 114 - "insert"
Cohesion: 0.47
Nodes (9): iid(), insert(), lit(), sec(), wibDate(), byAgeActive(), groupBy(), migrate() (+1 more)

### Community 115 - "TestimonialForm.tsx"
Cohesion: 0.22
Nodes (7): metadata, NewTestimonial(), EditTestimonial(), metadata, TestimonialForm(), Switch(), Testimonial

### Community 116 - "TruckTracker.tsx"
Cohesion: 0.31
Nodes (9): ago(), Data, HOME, jam(), Route, STATE_LABEL, stateText(), TruckTracker() (+1 more)

### Community 117 - "Teks kebijakan privasi: Google Analytics dan Google Ads"
Cohesion: 0.22
Nodes (8): 1. Bagian "Ringkasnya": ganti dua butir, 2. Bagian "Cookie": tambah satu baris tabel, 3. Bagian baru: tempel sebelum "Tautan ke WhatsApp, telepon, email, dan peta", 4. Bagian "Dengan siapa data dibagikan": ubah butir pertama, 5. Bagian "Perubahan kebijakan": ubah satu frasa, 6. Tanggal berlaku, Cara memasang (pemilik), Teks kebijakan privasi: Google Analytics dan Google Ads

### Community 118 - "push/route.ts"
Cohesion: 0.56
Nodes (8): DELETE(), GET(), guard(), json(), POST(), text(), isPushEndpoint(), pushConfigured()

### Community 119 - "PatternArt"
Cohesion: 0.31
Nodes (9): grassPath(), hexPath(), layoutTiles(), PatternArt, patternTransform(), r2(), rectPath(), tileBox() (+1 more)

### Community 120 - "period.ts"
Cohesion: 0.33
Nodes (8): DAYS, dayText(), MONTHS, pad(), periodRange(), PERIODS, shiftPeriod(), wibMidnight()

### Community 122 - "Peta gap porting inventori-ops → istana-block-web"
Cohesion: 0.25
Nodes (8): 1. Tabel yang sudah punya padanan, 2. Tabel yang belum ada di web, 3. Kolom baru pada tabel lama yang belum ada, 4. Irisan porting yang diusulkan, 5. Catatan teknis dan risiko, 6. Cara angka ini didapat, Peta gap porting inventori-ops → istana-block-web, Ringkasan

### Community 123 - "fondasi-setara.md"
Cohesion: 0.25
Nodes (7): 1. Keputusan desain (dan alasannya), 2. Tabel baru, 3. Kolom baru di tabel lama, 4. Izin (src/lib/roles.ts) dan peta peran, 5. Menu dan halaman (ITEMS di operasional/(panel)/layout.tsx; semua placeholder "Sedang disiapkan" + `requirePerm`, timpa isinya), 6. Helper, 7. Batasan yang diwariskan / data yang dibutuhkan dari backup .sql app live

### Community 124 - "gambar-varian.mjs"
Cohesion: 0.25
Nodes (6): ATURAN, baris, manifest, paksa, pub, root

### Community 125 - "Pelacakan Google Ads & GA4 di situs baru"
Cohesion: 0.29
Nodes (7): 1. GTM: pastikan tag dasar ada di container, 2. Google Ads: buat conversion action klik WhatsApp & telepon, 3. GTM: tag konversi dengan pemicu yang sudah ada, 4. Uji di staging (sebelum domain dipindah), 5. Setelah domain dipindah (Hari-H), Opsional, nanti, Pelacakan Google Ads & GA4 di situs baru

### Community 126 - "Migrasi data inventori-ops -> istana-block-web"
Cohesion: 0.29
Nodes (6): API untuk modul (`lib/*.mjs` mengekspor `migrate(ctx)`), Berkas masukan opsional, Migrasi data inventori-ops -> istana-block-web, Pakai, Proses ulang, Urutan impor

### Community 127 - "faktur/[id]/page.tsx"
Cohesion: 0.38
Nodes (5): CetakFaktur(), invoiceDeliveries(), metadata, Sign(), Settings

### Community 128 - "decodeState"
Cohesion: 0.29
Nodes (7): cleanNum(), decodeState(), isColor(), isProduct(), NumField(), parseNum(), urlNum()

### Community 129 - "Rencana kerja 1–3 (6 November 2026)"
Cohesion: 0.33
Nodes (5): 1. Form input/ubah + cetak PDF, 2. Faktur penjualan → piutang, 3. Bundel Worker & Workers Paid, Rencana kerja 1–3 (6 November 2026), Urutan eksekusi yang disarankan

### Community 130 - "Worklog: port istana-block-inventori-ops → menu OPERASIONAL"
Cohesion: 0.33
Nodes (5): Sesi lanjutan 2026-10-21 pagi (orkestrator Opus + subagen Sonnet), Sisa pekerjaan (urut, status awal sesi lanjutan), Tindak lanjut di luar cakupan / keputusan pemilik, Worklog: port istana-block-inventori-ops → menu OPERASIONAL, Yang sudah selesai

### Community 131 - "package.json"
Cohesion: 0.33
Nodes (5): engines, node, name, private, version

### Community 132 - "make-vapid-keys.mjs"
Cohesion: 0.33
Nodes (5): devVars, jwk, keep, publicBase64Url, root

### Community 133 - "render.mjs"
Cohesion: 0.33
Nodes (4): [fmt, mode, a1, a2], home, html, VO_MAP

### Community 134 - "E. Urutan impor, penomoran, batas D1, verifikasi"
Cohesion: 0.40
Nodes (5): E.1 Urutan (tanpa FK di target, urutan demi keterbacaan & kegagalan terlokalisir), E.2 Penomoran dokumen, E.3 Batas D1 dan pemecahan berkas, E.4 Verifikasi (`08-verifikasi.sql` + `laporan/hitungan.csv`), E. Urutan impor, penomoran, batas D1, verifikasi

### Community 135 - "Brag plan — Istana Block: fitur yang berguna di situs"
Cohesion: 0.40
Nodes (4): Brag plan — Istana Block: fitur yang berguna di situs, Real UI used, Sound (versi share saja; versi web senyap), Storyboard (22 s, 30 fps)

### Community 136 - "salin-foto-ke-r2.py"
Cohesion: 0.83
Nodes (3): log(), main(), token()

### Community 137 - "mod"
Cohesion: 0.50
Nodes (4): flower(), herringbone(), mod(), staggerNeighbours()

### Community 138 - "path"
Cohesion: 0.67
Nodes (3): bearing(), haversine(), path()

### Community 139 - "ym"
Cohesion: 0.67
Nodes (3): monthDone(), mstat(), ym()

### Community 140 - "rng"
Cohesion: 0.67
Nodes (3): rng(), shuffledRoles(), spreadRoles()

## Knowledge Gaps
- **1055 isolated node(s):** `CloudflareEnv`, `nextConfig`, `name`, `version`, `private` (+1050 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `nn()` connect `pesanan-kirim.mjs` to `safe_decode_range`?**
  _High betweenness centrality (0.318) - this node is a cross-community bridge._
- **Why does `check_wb()` connect `safe_decode_range` to `xlsx-0.20.3.mjs`, `pesanan-kirim.mjs`, `writextag`?**
  _High betweenness centrality (0.318) - this node is a cross-community bridge._
- **Why does `insert()` connect `insert` to `pesanan-kirim.mjs`, `core.mjs`, `Ctx`?**
  _High betweenness centrality (0.315) - this node is a cross-community bridge._
- **What connects `CloudflareEnv`, `nextConfig`, `name` to the rest of the system?**
  _1055 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `xlsx-0.20.3.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.009029310048041563 - nodes in this community are weakly interconnected._
- **Should `new_buf` be split into smaller, more focused modules?**
  _Cohesion score 0.02701009397841977 - nodes in this community are weakly interconnected._
- **Should `db/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05046017137416693 - nodes in this community are weakly interconnected._