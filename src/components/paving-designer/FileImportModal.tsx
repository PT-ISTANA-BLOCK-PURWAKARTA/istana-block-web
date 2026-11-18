"use client";

import { useState } from "react";
import { parseGeoJsonToProjectGeometry } from "@/lib/paving/adapters/geojson";
import { parseKmlToProjectGeometry, parseKmzToProjectGeometry } from "@/lib/paving/adapters/kml";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
import { IconAlert, IconCheck, IconUpload } from "./Icons";
import css from "./PavingDesigner.module.css";

interface Props {
  onApplyGeometry: (geom: ProjectGeometry) => void;
  onCancel?: () => void;
}

export function FileImportModal({ onApplyGeometry, onCancel }: Props) {
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [parsedGeom, setParsedGeom] = useState<ProjectGeometry | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const processFile = async (file: File) => {
    setErrorMsg(null);
    setParsedGeom(null);
    setFileName(file.name);
    setFileSize(file.size);
    setIsLoading(true);

    try {
      const lower = file.name.toLowerCase();

      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Ukuran berkas melebihi batas maksimal 5 MB.");
      }

      let geom: ProjectGeometry;

      if (lower.endsWith(".kmz")) {
        const buffer = await file.arrayBuffer();
        geom = parseKmzToProjectGeometry(new Uint8Array(buffer));
      } else if (lower.endsWith(".kml")) {
        const text = await file.text();
        geom = parseKmlToProjectGeometry(text);
      } else if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
        const text = await file.text();
        geom = parseGeoJsonToProjectGeometry(text);
      } else {
        throw new Error(
          "Format berkas tidak didukung. Harap pilih berkas dengan ekstensi .geojson, .kml, atau .kmz.",
        );
      }

      setParsedGeom(geom);
    } catch (err: any) {
      setErrorMsg(err?.message || "Terjadi kesalahan saat memproses berkas.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className={css.stack}>
      <p className={css.instruction}>
        Berkas diproses sepenuhnya di peramban Anda (tanpa unggah ke server). Mendukung poligon batas
        tanah WGS84 dari Google Earth, QGIS, ArcGIS, atau peta ukur digital.
      </p>

      <div
        className={`${css.dropzone} ${isDragOver ? css.dropzoneActive : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <span className={`${css.dropzoneIconWrap} hex`}>
          <IconUpload size={22} />
        </span>
        <p className={css.dropzoneText}>
          Tarik dan letakkan berkas <strong>.geojson</strong>, <strong>.kml</strong>, atau{" "}
          <strong>.kmz</strong> di sini
        </p>
        <label className="btn btn-blue btn-sm">
          <span>Pilih Berkas dari Perangkat</span>
          <input
            type="file"
            accept=".geojson,.json,.kml,.kmz"
            onChange={handleFileChange}
            className={css.hiddenInput}
          />
        </label>
        <span className={css.dropzoneHint}>Maksimal 5 MB per berkas · 100% lokal di perangkat</span>
      </div>

      {isLoading && (
        <div className={css.loadingBox}>
          <p>Memproses dan memproyeksikan geometri lahan...</p>
        </div>
      )}

      {errorMsg && (
        <div className={css.errorAlert} role="alert">
          <IconAlert size={18} />
          <div>
            <strong>Gagal membaca berkas:</strong> {errorMsg}
          </div>
        </div>
      )}

      {parsedGeom && (
        <div className={css.summaryCard}>
          <h4 className={css.summaryTitle}>Ringkasan Hasil Ekstraksi</h4>
          <div className={css.metricGrid}>
            <div className={css.metricItem}>
              <span className={css.metricLabel}>Nama Berkas</span>
              <span className={css.metricValue}>
                {fileName} ({(fileSize / 1024).toFixed(1)} KB)
              </span>
            </div>
            <div className={css.metricItem}>
              <span className={css.metricLabel}>Luas Lahan</span>
              <span className={css.metricValue}>
                {parsedGeom.metrics.areaM2.toLocaleString("id-ID")} m²
              </span>
            </div>
            <div className={css.metricItem}>
              <span className={css.metricLabel}>Keliling Batas Luar</span>
              <span className={css.metricValue}>
                {parsedGeom.metrics.perimeterM.toLocaleString("id-ID")} m
              </span>
            </div>
            <div className={css.metricItem}>
              <span className={css.metricLabel}>Proyeksi Koordinat</span>
              <span className={css.metricValue}>
                {parsedGeom.projection
                  ? `UTM Zona ${parsedGeom.projection.zone} (${parsedGeom.projection.epsg})`
                  : "Meter Lokal"}
              </span>
            </div>
            <div className={css.metricItem}>
              <span className={css.metricLabel}>Dimensi Area (P × L)</span>
              <span className={css.metricValue}>
                {(parsedGeom.metrics.bounds.maxX - parsedGeom.metrics.bounds.minX).toFixed(1)} m ×{" "}
                {(parsedGeom.metrics.bounds.maxY - parsedGeom.metrics.bounds.minY).toFixed(1)} m
              </span>
            </div>
          </div>

          {parsedGeom.warnings && parsedGeom.warnings.length > 0 && (
            <div className={css.warningBox}>
              <IconAlert size={17} />
              <div>
                {parsedGeom.warnings.map((w, idx) => (
                  <p key={idx}>{w.message}</p>
                ))}
              </div>
            </div>
          )}

          <div className={css.mapActions}>
            <button
              type="button"
              className="btn btn-blue btn-sm"
              onClick={() => onApplyGeometry(parsedGeom)}
            >
              <IconCheck size={15} />
              <span>Terapkan Bentuk Lahan Ini</span>
            </button>
            {onCancel && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
                Batal
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
