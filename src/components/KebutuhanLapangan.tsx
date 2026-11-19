"use client";

import { useId } from "react";
import { fmt } from "@/lib/paving/legacy/calculator";
import type { ProductId } from "@/lib/paving/catalog";
import { PAVING_CATALOG } from "@/lib/paving/catalog";
import {
  KELAS_BEBAN,
  LABEL_BEBAN,
  TAMPILKAN_BIAYA,
  type AreaProyek,
  type HasilProyek,
  type KelasBeban,
  type RekomendasiBeban,
} from "@/lib/paving/kebutuhan";
import css from "./PatternCalculator.module.css";

const rp = (n: number) => `Rp${fmt(n, 0)}`;

/** Label kecil untuk angka yang bertumpu pada konstanta sementara. */
function Perkiraan() {
  return <small className={css.perkiraan}>perkiraan, konfirmasi ke admin</small>;
}

function BarisKebutuhan({ hasil, area, sirtuSudahAda, totalPcs }: { hasil: HasilProyek; area: AreaProyek; sirtuSudahAda: boolean; totalPcs: number }) {
  return (
      <ul className={`rowlist ${css.rows}`}>
        <li className="rowitem">
          <span>
            Pasir alas
            <small className={css.rowSub}>tebal {area.material.pasirAlas.tebalCm} cm, sudah dikali faktor padat</small>
            <Perkiraan />
          </span>
          <b className="tabular">{fmt(hasil.material.pasirAlasM3)} m³</b>
        </li>
        {!sirtuSudahAda && (
          <li className="rowitem">
            <span>
              Sirtu / base course
              <small className={css.rowSub}>tebal {area.material.sirtu.tebalCm} cm</small>
              <Perkiraan />
            </span>
            <b className="tabular">{fmt(hasil.material.sirtuM3)} m³</b>
          </li>
        )}
        <li className="rowitem">
          <span>
            Pengiriman
            <small className={css.rowSub}>
              {fmt(hasil.logistik.paletTotal)} palet · ±{fmt(hasil.logistik.beratTotalKg, 0)} kg · dari {fmt(totalPcs)} pcs
            </small>
            <Perkiraan />
          </span>
          <b className="tabular">
            {fmt(hasil.logistik.trip)} trip {hasil.logistik.jenisTruk}
          </b>
        </li>
        {TAMPILKAN_BIAYA && hasil.biaya?.baris.map((b) => (
          <li key={b.kode} className="rowitem">
            <span>
              {b.label}
              <small className={css.rowSub}>
                {fmt(b.qty)} {b.satuan} × {rp(b.hargaSatuan)}
              </small>
              {b.sementara && <Perkiraan />}
            </span>
            <b className="tabular">{rp(b.subtotal)}</b>
          </li>
        ))}
        {TAMPILKAN_BIAYA && hasil.biaya && (
          <li className="rowitem">
            <span>
              Perkiraan ongkir + pasang
              <Perkiraan />
            </span>
            <b className="tabular">{rp(hasil.biaya.total)}</b>
          </li>
        )}
      </ul>
  );
}

interface Props {
  kelas: KelasBeban | "";
  onKelas: (k: KelasBeban | "") => void;
  jarak: string;
  onJarak: (v: string) => void;
  jarakBad: boolean;
  produkId: ProductId;
  tebalCm: number;
  rek: RekomendasiBeban | null;
  hasil: HasilProyek | null;
  /** Ukuran lahan belum ada (atau perhitungan layout belum selesai). */
  menunggu: boolean;
  /** Sirtu sudah dihitung hitungan utama (base course); baris sirtu tidak diulang. */
  sirtuSudahAda: boolean;
  /** Total pcs dari hitungan utama, dasar palet/trip/berat. */
  totalPcs: number;
}

/**
 * Bagian lipat "Kebutuhan lapangan (perkiraan)". Seluruh nilainya dihitung di induk; komponen ini hanya
 * menampilkan. Tidak memilih kelas beban = bagian ini tidak ikut ke pesan WhatsApp.
 */
export function KebutuhanLapangan({ kelas, onKelas, jarak, onJarak, jarakBad, produkId, tebalCm, rek, hasil, menunggu, sirtuSudahAda, totalPcs }: Props) {
  const uid = useId();
  const produkCocok = rek ? rek.produk.some((p) => p.id === produkId) : true;
  const area = hasil?.areas[0];

  return (
    <>
    <details className={css.kebutuhan} data-pp-noprint>
      <summary className={css.kebutuhanSummary}>
        <span>Kebutuhan lapangan (perkiraan)</span>
        <small>{kelas ? `${LABEL_BEBAN[kelas]} · ikut pesan WhatsApp` : "opsional"}</small>
      </summary>

      <div className={css.nested}>
        <fieldset className={css.fs}>
          <legend className={css.legend}>Kelas beban di atas paving</legend>
          <div className={css.seg}>
            {[{ v: "" as const, label: "Tidak dipakai" }, ...KELAS_BEBAN.map((v) => ({ v, label: LABEL_BEBAN[v] }))].map((o) => (
              <label key={o.v || "kosong"} className={css.pill}>
                <input type="radio" name={`${uid}-kelas`} value={o.v} checked={kelas === o.v} onChange={() => onKelas(o.v)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {!kelas && (
          <p className={css.help}>
            Pilih kelas beban untuk melihat tebal yang disarankan, pasir alas, sirtu, palet, dan trip
            truk. Tanpa pilihan ini kalkulator bekerja seperti biasa.
          </p>
        )}

        {kelas && rek && (
          <>
            <div className={css.note}>
              <b>Tebal minimal {rek.tebalMinCm} cm.</b>{" "}
              {rek.produk.length > 0
                ? `Produk yang cocok: ${rek.produk.map((p) => `${p.name} (${p.tebalCm.join("/")} cm)`).join(", ")}.`
                : "Belum ada produk katalog yang memenuhi tebal itu."}
              <Perkiraan />
            </div>
            {rek.peringatan.map((w) => (
              <p key={w} className={css.err} role="alert">
                {w}
              </p>
            ))}
            {rek.produk.length > 0 && !produkCocok && (
              <p className={css.err} role="alert">
                {PAVING_CATALOG[produkId].name} tidak masuk rekomendasi untuk beban {LABEL_BEBAN[kelas].toLowerCase()}.
              </p>
            )}
            {hasil?.peringatan.map((w) => (
              <p key={w} className={css.err} role="alert">
                {w}
              </p>
            ))}
            {rek.produk.length === 0 && rek.produkAlternatif.length > 0 && (
              <p className={css.help}>
                Tebal terbesar yang ada di katalog: {rek.produkAlternatif.map((p) => `${p.name} ${p.tebalMaksCm} cm`).join(", ")}.
              </p>
            )}

            {TAMPILKAN_BIAYA && (
              <div className="field">
                <label htmlFor={`${uid}-km`}>Jarak kirim (opsional)</label>
                <div className={css.inputWrap}>
                  <input
                    id={`${uid}-km`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={jarak}
                    placeholder="mis. 25"
                    onChange={(e) => onJarak(e.target.value.slice(0, 8))}
                    aria-invalid={jarakBad || undefined}
                    style={{ paddingRight: 52 }}
                  />
                  <span className={css.unit} aria-hidden="true">
                    km
                  </span>
                </div>
                {jarakBad && <p className={css.err}>Isi dengan angka, mis. 25</p>}
              </div>
            )}

            {menunggu || !hasil || !area ? (
              <p className={css.help}>Rincian muncul setelah ukuran lahan terisi dan tata letaknya selesai dihitung.</p>
            ) : (
              <BarisKebutuhan hasil={hasil} area={area} sirtuSudahAda={sirtuSudahAda} totalPcs={totalPcs} />
            )}
            <p className={css.help}>Tebal paving dibaca dari pilihan di atas ({tebalCm} cm). Rincian ini ikut di pesan WhatsApp; jumlah paving, kanstin, dan abu batu mengikuti hitungan di atas.</p>
          </>
        )}
      </div>
    </details>
    {/* Salinan khusus cetak: <details> yang tertutup tidak ikut tercetak, jadi rincian disajikan terpisah. */}
    {kelas && rek && hasil && area && !menunggu && (
      <section className={css.kebutuhanPrint} aria-label="Kebutuhan lapangan (perkiraan)">
        <h3>Kebutuhan lapangan (perkiraan)</h3>
        <p>
          <b>Beban {LABEL_BEBAN[kelas].toLowerCase()}: tebal minimal {rek.tebalMinCm} cm.</b>{" "}
          {rek.produk.length > 0
            ? `Produk yang cocok: ${rek.produk.map((p) => p.name).join(", ")}.`
            : "Belum ada produk katalog yang memenuhi tebal itu."}
        </p>
        {[...rek.peringatan, ...hasil.peringatan].map((w) => (
          <p key={w}>{w}</p>
        ))}
        <BarisKebutuhan hasil={hasil} area={area} sirtuSudahAda={sirtuSudahAda} totalPcs={totalPcs} />
      </section>
    )}
    </>
  );
}
