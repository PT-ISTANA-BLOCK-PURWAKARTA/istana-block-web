"use client";

import { useState } from "react";
import { PAVING_CATALOG } from "@/lib/paving/catalog";
import type { MaterialEstimate, PatternConfig } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { COLORS } from "@/lib/paving/legacy/types";
import { waLink } from "@/lib/format";
import css from "./PavingDesigner.module.css";

interface Props {
  estimate: MaterialEstimate;
  config: PatternConfig;
  geometry: ProjectGeometry;
  whatsapp: string;
}

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function EstimatePanel({ estimate, config, geometry, whatsapp }: Props) {
  const [copied, setCopied] = useState(false);
  const spec = PAVING_CATALOG[config.productId];

  const buildSummaryText = () => {
    return [
      "Halo Istana Block Purwakarta, saya mau konsultasi estimasi paving custom layout:",
      "",
      `• Produk: ${spec.name} (${spec.sizeLabel})`,
      `• Motif: ${config.motifId}`,
      `• Bentuk Lahan: ${geometry.source.toUpperCase()} (${geometry.metrics.areaM2.toFixed(1)} m²)`,
      `• Blok Utuh: ${fmt(estimate.fullUnits)} pcs`,
      `• Potongan Tepi: ${fmt(estimate.cutInstalledPieces)} keping (butuh ±${fmt(estimate.estimatedStockUnitsForCuts)} pcs bahan)`,
      `• Cadangan: ${estimate.reservePercent}% (${fmt(estimate.reserveUnits)} pcs)`,
      `• REKOMENDASI TOTAL: ${fmt(estimate.recommendedPurchaseUnits)} pcs`,
      estimate.extras?.stoneDustM3 ? `• Abu Batu 5 cm: ${estimate.extras.stoneDustM3} m³` : "",
      estimate.extras?.baseCourseM3 ? `• Base Course 20 cm: ${estimate.extras.baseCourseM3} m³` : "",
      "",
      "Lokasi proyek: ...",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const waHref = waLink(whatsapp, buildSummaryText());

  return (
    <div className={css.panel}>
      <div className={css.panelHeader}>
        <h3 className={css.panelTitle}>Rincian Kebutuhan Material</h3>
        <span className={css.badgeSuccess}>Estimasi Geometri Terpotong</span>
      </div>

      {/* Hero Recommendation */}
      <div className={css.recBox}>
        <span className={css.statLabel}>Rekomendasi Pemesanan Paving</span>
        <div className={css.recVal}>{fmt(estimate.recommendedPurchaseUnits)} pcs</div>
        <span className={css.statLabel} style={{ color: "var(--biru-tua)" }}>
          Mencakup blok utuh, bahan potong, dan cadangan {estimate.reservePercent}%
        </span>
      </div>

      {/* Breakdown Grid */}
      <div className={css.statGrid}>
        <div className={css.statBox}>
          <span className={css.statVal}>{fmt(estimate.fullUnits)} pcs</span>
          <span className={css.statLabel}>Blok Utuh Terpasang</span>
        </div>
        <div className={css.statBox}>
          <span className={css.statVal}>{fmt(estimate.cutInstalledPieces)} pcs</span>
          <span className={css.statLabel}>Potongan Tepi Batas</span>
        </div>
        <div className={css.statBox}>
          <span className={css.statVal}>{estimate.extras?.stoneDustM3 || 0} m³</span>
          <span className={css.statLabel}>Abu Batu (Alas 5 cm)</span>
        </div>
        <div className={css.statBox}>
          <span className={css.statVal}>{estimate.extras?.baseCourseM3 || 0} m³</span>
          <span className={css.statLabel}>Base Course (20 cm)</span>
        </div>
      </div>

      {/* Assumptions & Advice */}
      <div className={css.noteText}>
        💡 <strong>Catatan Teknis Pemasangan:</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
          {estimate.assumptions.map((item, idx) => (
            <li key={`asmp_${idx}`} style={{ marginBottom: "3px" }}>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${css.button} ${css.buttonWhatsApp}`}
          data-cta="kalkulator"
        >
          <span>💬</span>
          <span>Kirim Rincian ke WhatsApp Admin</span>
        </a>

        <button
          type="button"
          className={`${css.button} ${css.buttonSecondary}`}
          onClick={handleCopy}
        >
          <span>{copied ? "✅ Berhasil Disalin!" : "📋 Salin Rincian Teks"}</span>
        </button>
      </div>
    </div>
  );
}
