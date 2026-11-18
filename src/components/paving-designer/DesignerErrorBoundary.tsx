"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { IconAlert, IconRefresh } from "./Icons";
import css from "./PavingDesigner.module.css";

/**
 * Mencoba ulang dynamic import secara otomatis bila koneksi sempat terputus
 * (mis. ERR_CONNECTION_CLOSED atau ChunkLoadError sementara).
 */
export async function retryImport<T>(loader: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await loader();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

interface BoundaryProps {
  children: ReactNode;
  title?: string;
  fallbackHint?: string;
  resetKey?: string | number;
  onFallbackAction?: () => void;
  fallbackActionLabel?: string;
}

interface BoundaryState {
  hasError: boolean;
  isChunkError: boolean;
  message: string;
}

export class DesignerErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {
    hasError: false,
    isChunkError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): BoundaryState {
    const raw = error?.message || "";
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      /Loading chunk|Failed to fetch dynamically imported module|ERR_CONNECTION_CLOSED/i.test(raw);
    return {
      hasError: true,
      isChunkError,
      message: raw,
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Error ditangani secara terisolasi di dalam kartu agar halaman tidak putih/crash.
  }

  componentDidUpdate(prevProps: BoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, isChunkError: false, message: "" });
    }
  }

  handleRetry = () => {
    if (this.state.isChunkError && typeof window !== "undefined") {
      // Coba reset boundary terlebih dahulu; jika chunk memang usang setelah deploy, muat ulang halaman.
      this.setState({ hasError: false, isChunkError: false, message: "" });
      return;
    }
    this.setState({ hasError: false, isChunkError: false, message: "" });
  };

  handleHardReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const {
      title = "Modul tidak dapat dimuat sementara",
      fallbackHint,
      onFallbackAction,
      fallbackActionLabel,
    } = this.props;

    return (
      <div className={css.errorCard} role="alert">
        <div className={css.errorCardHead}>
          <span className={css.errorIconWrap}>
            <IconAlert size={20} />
          </span>
          <div>
            <strong className={css.errorCardTitle}>{title}</strong>
            <p className={css.errorCardDesc}>
              {this.state.isChunkError
                ? "Koneksi ke server sempat terputus saat mengunduh modul tampilan, atau versi halaman baru saja diperbarui."
                : fallbackHint ||
                  "Peramban mengalami kendala saat menjalankan modul grafis. Data bentuk lahan dan perhitungan material Anda tetap aman."}
            </p>
          </div>
        </div>
        <div className={css.errorCardActions}>
          <button
            type="button"
            className="btn btn-blue btn-sm"
            onClick={this.state.isChunkError ? this.handleHardReload : this.handleRetry}
          >
            <IconRefresh size={15} />
            <span>{this.state.isChunkError ? "Muat Ulang Halaman" : "Coba Lagi"}</span>
          </button>
          {onFallbackAction && fallbackActionLabel && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onFallbackAction}>
              {fallbackActionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }
}
