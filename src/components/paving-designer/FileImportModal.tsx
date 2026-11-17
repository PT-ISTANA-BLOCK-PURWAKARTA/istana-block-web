"use client";

import { useState } from "react";
import { parseGeoJsonToProjectGeometry } from "@/lib/paving/adapters/geojson";
import { parseKmlToProjectGeometry, parseKmzToProjectGeometry } from "@/lib/paving/adapters/kml";
import type { ProjectGeometry } from "@/lib/paving/geometry/types";
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
    <div className={css.panel}>
      <h3 className={css.panelTitle}>Unggah Berkas Lahan (GeoJSON / KML / KMZ)</h3>
      <p className={css.instruction}>
        Paving Designer memproses berkas sepenuhnya di perangkat Anda (tanpa unggah server).
        Mendukung poligon batas tanah WGS84 dari Google Earth, QGIS, ArcGIS, atau sertifikat ukur digital.
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
        <span className={css.dropzoneIcon}>📁</span>
        <p className={css.dropzoneText}>
          Tarik & letakkan berkas <strong>.geojson</strong>, <strong>.kml</strong>, atau{" "}
          <strong>.kmz</strong> ke sini
        </p>
        <label className={css.fileInputLabel}>
          <span>Pilih Berkas dari Perangkat</span>
          <input
            type="file"
            accept=".geojson,.json,.kml,.kmz"
            onChange={handleFileChange}
            className={css.hiddenInput}
          />
        </label>
        <span className={css.dropzoneHint}>Maksimal 5 MB per berkas</span>
      </div>

      {isLoading && (
        <div className={css.loadingBox}>
          <p>Memproses dan memproyeksikan geometri lahan...</p>
        </div>
      )}

      {errorMsg && (
        <div className={css.errorAlert} role="alert">
          <strong>Gagal Membaca Berkas:</strong>
          <p>{errorMsg}</p>
        </div>
      )}

      {parsedGeom && (
        <div className={css.summaryCard}>
          <h4 className={css.summaryTitle}>Ringkasan Hasil Ekstraksi</h4>
          <div className={css.metricGrid}>
            <div className={css.metricItem}>
              <span className={css.metricLabel}>Nama Berkas</span>
              <span className={css.metricValue}>{fileName} ({(fileSize / 1024).toFixed(1)} KB)</span>
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
              <span className={css.metricLabel}>Dimensi Area (P x L)</span>
              <span className={css.metricValue}>
                {(parsedGeom.metrics.bounds.maxX - parsedGeom.metrics.bounds.minX).toFixed(1)} m x{" "}
                {(parsedGeom.metrics.bounds.maxY - parsedGeom.metrics.bounds.minY).toFixed(1)} m
              </span>
            </div>
          </div>

          {parsedGeom.warnings && parsedGeom.warnings.length > 0 && (
            <div className={css.warningList}>
              {parsedGeom.warnings.map((w, idx) => (
                <p key={idx} className={css.warningText}>⚠️ {w.message}</p>
              ))}
            </div>
          )}

          <div className={css.buttonRow}>
            <button
              type="button"
              className={css.applyButton}
              onClick={() => onApplyGeometry(parsedGeom)}
            >
              Terapkan Bentuk Lahan Ini
            </button>
            {onCancel && (
              <button
                type="button"
                className={css.secondaryButton}
                onClick={onCancel}
              >
                Batal
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
