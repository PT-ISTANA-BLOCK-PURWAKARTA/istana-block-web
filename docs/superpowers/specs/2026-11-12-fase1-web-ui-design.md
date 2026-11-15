# Fase 1 Web & UI Upgrades — Design Specification

**Date:** 2026-11-12  
**Project:** `istana-block-web` (`https://istana-block-web.istanablock.workers.dev/`)  
**Scope:** Backlog items `#1`, `#2`, `#3`, `#4`, `#5`, `#11`, `#13`, `#14` (holding `#12` awaiting tariff table, skipping `#15` Next.js 16 due to `@opennextjs/cloudflare` support boundary).

---

## 1. `/produk` Showcase & Hexagon Clarity (`#1`)
- **Asset Upgrade:** Re-process `C:\Users\Sarimusan\Downloads\asset_produk\paving_blocks.jfif` (2-row × 3-column studio lineup: Bata, Hexagon, Fullpave top; 4-hole/6-hole/interlocking Grass Block bottom) into `public/img/produk/paving-block*.webp` (`320`, `480`, `800`, `1200`, base) using safe padded 4:3 framing on crisp studio neutral `#F5F6F8` so `--hex` / `.pk-hex-frame` masks NEVER clip block corners.
- **Hexagon Frame & Watermark:** Add a contrasting hexagonal frame/bezel (`--biru-muda` matte backing + `#254186` hex perimeter ring + crisp drop shadow) around primary product image containers (`pk-hero-media` / `pk-card-media`), plus an accessible bottom-right subtle watermark badge (`logo-istana-block.webp`, `opacity: 0.72`, pill scrim, pointer-events none) across all flagship & category visuals.
- **2-Row Paving Showcase (`Paving Block` Flagship):** Inside `ProdukShowcase.tsx`, split the `Paving Block` flagship media column into **2 stacked visual rows**:
  - **Row 1:** Primary studio 2×3 lineup (`paving-block.webp`) inside a 16:10 / 4:3 framed stage.
  - **Row 2:** Compact 4-tile sample strip pulling real variant thumbnails from `/img/sampel/`: Truepave (`paving-block-truepave-istana-block-tkdn-o.webp`), Hexagon (`paving-block-hexagon-istana-block-tkdn-o.webp`), Fullpave (`paving-block-fullpave-istana-block-tkdn-o.webp`), and Grass Block (`paving-grass-block-istana-block-tkdn-o.webp`).
- **1-Column × 2-Row Stacking (`Pembatas Jalan & Atap`):** Change `.pk-grid-2` on the `pair` section in `ProdukShowcase.tsx` to `.pk-grid-1` (`grid-template-columns: 1fr`), rendering `Kanstin` (row 1) and `Genteng Beton` (row 2) as spacious horizontal wide cards matching desktop & mobile proportions.

## 2. `/` Homepage Search & HyperFrames Feature Reel (`#2`)
- **Centerpiece GitHub-Style Search (`HomeSearch.tsx` + `home-search.css` + `src/app/(site)/page.tsx`):**
  - Move `<HomeSearch />` to a dedicated centered band directly below `.hero` (or spanning full hero width cleanly), widening `.ib-search-wrap` to `max-width: 820px; width: 100%; margin: 0 auto;` and increasing `.ib-search-trigger` height (`min-height: 60px; padding: 10px 14px 10px 20px; font-size: 16px; border-radius: 18px;`).
  - Add an animated placeholder typewriter / vertical marquee ticker cycling through practical buyer queries (`"Paving Block K-350..."`, `"Gravel (Greffel) beton..."`, `"U-Ditch 40x40 + Cover..."`, `"Sertifikat TKDN Kemenperin..."`, `"Kalkulator pola Hexagon..."`). Honors `prefers-reduced-motion: reduce` (falls back to static text) and pauses while the search modal is open.
  - Keep homepage JS payload strictly `<= 140 KB gz` (`cek-seo.mjs` passing).
- **Realistic Feature Reel (`tools/reel-hf/` + `FeatureReel.tsx`):**
  - Author a deterministic HyperFrames composition (`1280×720` landscape & `720×1280` portrait, `22s` @ `30fps`) combining authentic plant/gallery photos (`/img/pabrik/pabrik-mesin-paving.webp`, `/img/galeri/galeri-01.webp`, `galeri-05.webp`, `galeri-11.webp`, `/img/produk/*.webp`) with 3D CSS perspective browser/mobile cards animating real calculations (`Hexagon 12×8 m → 2.722 pcs`), U-Ditch price highlights, and WhatsApp dispatch.
  - Validate with `npx --yes hyperframes lint` and `npx --yes hyperframes check`, render MP4/WebM (with & without audio) into `public/reel-src/reel-{16x9,9x16}{,-suara}.{mp4,webm}`, extract high-res posters directly to `.webp` (`public/reel/reel-16x9.webp`, `public/reel/reel-9x16.webp`), and update `FeatureReel.tsx` to serve `.webp` posters only (no `.jpg` `<img src>` fallback).

## 3. `/pola-paving` Interactive 3D & `/kalkulator` Route (`#3`)
- **Canonical Route & `/kalkulator` Redirect:** Keep `/pola-paving` canonical everywhere in navigation, sitemap, JSON-LD, and SEO checks; add `"/kalkulator": "/pola-paving"` to `src/data/legacy-redirects.json` so `/kalkulator` resolves in a single `301` redirect to `/pola-paving`.
- **Lazy WebGL 3D Engine (`src/components/Paving3DView.tsx` + `three`):**
  - Install `three` + `@types/three` as project dependency.
  - Load `Paving3DView` exclusively via `next/dynamic(() => import("./Paving3DView"), { ssr: false, loading: ... })` inside `PatternCalculator.tsx`, triggered **only** when the visitor clicks `[Mode 3D]` in a clean `2D Tampak Atas | 3D Perspektif` segmented toggle above `.stage`.
  - Guarantee initial SSR `/pola-paving` script payload remains `<= 150 KB gz` (`three` chunk is never included in initial HTML `<script src>` tags).
  - Render physically proportional chamfered 3D paving blocks (Truepave, Hexagon, Fullpave 21/30, and 6-hole Grass Block with grass infill) over a mortar/abu-batu base bed + extruded concrete perimeter kanstin, procedural subtle concrete noise canvas bump/roughness map, studio directional + hemisphere lighting with soft ground shadows, and interactive OrbitControls (`OrbitControls` from `three/examples/jsm/controls/OrbitControls.js`) plus preset camera buttons (`Isometrik`, `Rendah / Mata Jalan`, `Atas`) and thickness slider sync (`6 cm` vs `8 cm`). Graceful fallback card if WebGL context is unavailable or headless blocks GPU.

## 4. `/kontak` Right Logo Panel & Checklist/Order Illustrations (`#4`)
- **Right Column Upgrade (`!hasEmbed` branch):** Replace the bare 3-Hex cluster with an authoritative Istana Block factory identity panel featuring `/brand/logo-istana-block.webp`, PT Istana Block Purwakarta badge, Pasawahan plant address summary, operating hours pill, and high-contrast `Buka di Google Maps` primary button.
- **Custom Illustrations:** Create `src/components/KontakIllustrations.tsx` containing two clean, lightweight, inline responsive SVGs tailored to Istana Block palette (`#254186`, `#0E2A6B`, `#FE5722`, `#B5B4AF`):
  1. `PrepChecklistIllustration` above the *"Yang perlu disiapkan saat menghubungi"* checklist (architectural blueprint + caliper dimension block + delivery pin).
  2. `OrderStepsIllustration` above the *"Cara memesan"* ordered steps (5-stage visual ribbon: Konsultasi → Pilih Produk → Hitung Volume → DP/Jadwal → Kirim Armada).

## 5. Standardized UI Controls & `/artikel` Filtering/Pagination (`#5`, `#11`)
- **UI Control Standard (`src/app/ui.css` + `src/components/ui/`):**
  - Document and unify public/internal styling tokens in `src/app/ui.css`: standard `Select` (`48px` height, `14px` radius, `1.5px` border `#8a93a6` / focus `var(--oranye)` on public `.ui-site` surfaces vs compact `38px` internal controls), `DateField` (`ui-date` with standard popover theme), `Switch`, and `.ui-form-row` / `.ui-input-sm` standard form input styling.
  - Ensure `@import` / CSS loading of `@/app/ui.css` works cleanly on public pages (including `/artikel`) without colliding with global reset rules.
- **`/artikel` Catalog Upgrade (`src/app/(site)/artikel/ArticleCatalog.tsx`, `page.tsx`, `globals.css`):**
  - Import `@/app/ui.css` in `artikel/page.tsx` (or include public `.ui-select`/`.ui-pop` rules cleanly).
  - Replace native `<select id="artikel-urut">` with standardized `<Select className="ui-site-ctrl" ... />`.
  - Add per-page selector `<Select />` with options `Auto` (responsive: `6` on mobile `<640px`, `9` on tablet, `12` on desktop), `12`, `24`, `48`, and `Semua` (`999`), resetting cleanly to page `1` on change.
  - Add direct page-jump control (`Hal [input] / Total [Go]`) inside `.artikel-pager` with keyboard Enter & clamp bounds (`1..totalPages`).

## 6. Diagram Responsiveness & `.webp` Asset Hygiene (`#13`, `#14`)
- **Responsive Diagram Sweep (`#13`):** Audit and harden overflow/wrapping/SVG scaling at `320px`, `390px`, `768px`, and `1280px` across:
  - `PaketProyekDiagrams.tsx` + `paket.css`
  - `AreaShippingExplorer.tsx` + `area.css`
  - `KontakIllustrations.tsx` (`width: 100%; height: auto; max-width: ...`)
  - `PatternCalculator.tsx` (`.stage` 2D/3D toggle controls & canvas resize observer)
- **WebP Hygiene (`#14`):**
  - Convert `FeatureReel.tsx` fallback `<img src="/reel/reel-16x9.webp">` + `public/reel/*.webp`.
  - Check any non-essential `.jpg`/`.png` content imgs across `src/` (preserving `og-default.jpg`, `icon.png`, `apple-icon.png`, and Schema.org `logo-istana-block.png` only where PNG/JPG is required by Open Graph / PWA / Schema.org). Ensure `public/sw.js` notification icon points to valid image (`/brand/logo-istana-block.png` or `.webp` as appropriate for Chromium notification icons — keep PNG for notification icon/OG compatibility while confirming 0 `.jpg`/`.png` content `<img>` tags on pages).
