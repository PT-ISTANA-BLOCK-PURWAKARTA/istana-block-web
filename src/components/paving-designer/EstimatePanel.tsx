"use client";

import { useState } from "react";
import { PAVING_CATALOG } from "@/lib/paving/catalog";
import type { MaterialEstimate, PatternConfig } from "@/lib/paving/engine/types";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import {
  buildShareUrl,
  createWhatsAppShareLink,
  type ShareState,
} from "@/lib/paving/share";
import { IconCheck, IconCopy, IconInfo, IconLink, IconWhatsApp } from "./Icons";
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
  const [copiedLink, setCopiedLink] = useState(false);
  const spec = PAVING_CATALOG[config.productId];

  const shareState: ShareState = {
    v: 1,
    engineVersion: "1.0.0",
    geom: {
      kind: "preset",
      preset: "rectangle",
      params: {
        lengthM: Math.round((geometry.metrics.bounds.maxX - geometry.metrics.bounds.minX) * 10) / 10,
        widthM: Math.round((geometry.metrics.bounds.maxY - geometry.metrics.bounds.minY) * 10) / 10,
      },
    },
    cfg: {
      productId: config.productId,
      motifId: config.motifId,
      reservePercent: config.reservePercent,
      rotationDeg: config.rotationDeg || 0,
    },
  };

  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "https://istanablock.com/pola-paving";

  const shareUrl = buildShareUrl(baseUrl, shareState);

  const waHref = createWhatsAppShareLink({
    whatsappNumber: whatsapp,
    shareUrl,
    productName: `${spec.name} (${spec.sizeLabel})`,
    motifName: config.motifId,
    geometry,
    estimate,
    config,
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Abaikan jika clipboard dibatasi browser
    }
  };

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
      // Abaikan jika clipboard dibatasi browser
    }
  };

  return (
    <div className={css.panel}>
      <div className={css.stepHead}>
        <div className={css.stepHeadLeft}>
          <span className={`${css.stepHex} hex`} aria-hidden="true">
            3
          </span>
          <div>
            <h3 className={css.panelTitle}>Rincian Kebutuhan Material</h3>
            <p className={css.panelSub}>Dihitung langsung dari potongan geometri lahan</p>
          </div>
        </div>
        <span className={css.badgeSuccess}>Estimasi Presisi</span>
      </div>

      <div className={css.totalBox}>
        <span className={css.totalLabel}>Rekomendasi Pemesanan Paving</span>
        <b className={css.totalVal}>{fmt(estimate.recommendedPurchaseUnits)} pcs</b>
        <span className={css.totalSub}>
          Sudah mencakup blok utuh, bahan potongan tepi, dan cadangan {estimate.reservePercent}%
        </span>
      </div>

      <ul className={css.rowList}>
        <li className={css.rowItem}>
          <div>
            <span className={css.rowItemLabel}>Blok utuh terpasang</span>
            <span className={css.rowItemSub}>Keping penuh di dalam batas lahan</span>
          </div>
          <span className={css.rowItemVal}>{fmt(estimate.fullUnits)} pcs</span>
        </li>
        <li className={css.rowItem}>
          <div>
            <span className={css.rowItemLabel}>Potongan tepi batas</span>
            <span className={css.rowItemSub}>
              Kebutuhan bahan potong ±{fmt(estimate.estimatedStockUnitsForCuts)} pcs
            </span>
          </div>
          <span className={css.rowItemVal}>{fmt(estimate.cutInstalledPieces)} keping</span>
        </li>
        <li className={css.rowItem}>
          <div>
            <span className={css.rowItemLabel}>Abu batu alas</span>
            <span className={css.rowItemSub}>Tebal padat 5 cm di bawah paving</span>
          </div>
          <span className={css.rowItemVal}>{estimate.extras?.stoneDustM3 || 0} m³</span>
        </li>
        <li className={css.rowItem}>
          <div>
            <span className={css.rowItemLabel}>Base course (sirtu/makadam)</span>
            <span className={css.rowItemSub}>Lapis pondasi padat 20 cm</span>
          </div>
          <span className={css.rowItemVal}>{estimate.extras?.baseCourseM3 || 0} m³</span>
        </li>
      </ul>

      <div className={css.noteBox}>
        <IconInfo size={17} />
        <div>
          <strong>Catatan teknis pemasangan:</strong>
          <ul className={css.noteList}>
            {estimate.assumptions.map((item, idx) => (
              <li key={`asmp_${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={css.actionStack}>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          data-cta="kalkulator"
        >
          <IconWhatsApp size={18} />
          <span>Kirim Rincian ke WhatsApp Admin</span>
        </a>

        <div className={css.actionRow}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleCopy}>
            {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            <span>{copied ? "Rincian Disalin" : "Salin Rincian"}</span>
          </button>

          <button type="button" className="btn btn-ghost btn-sm" onClick={handleCopyLink}>
            {copiedLink ? <IconCheck size={15} /> : <IconLink size={15} />}
            <span>{copiedLink ? "Tautan Disalin" : "Salin Tautan"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
