import "./qc.css";

const stamp = (d: Date | null | undefined) =>
  d ? d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "";

/**
 * Satu kolom tanda tangan di kaki dokumen cetak: judul, gambar tanda tangan (bila ada), nama, waktu.
 * Belum ditandatangani = garis kosong. Gambar diambil dari /operasional/berkas/<kunci> (butuh login).
 */
export function SignBlock({ label, name, at, imageKey, emptyNote }: { label: string; name?: string | null; at?: Date | null; imageKey?: string | null; emptyNote?: string }) {
  return (
    <div className="qc-signblock">
      <span>{label}</span>
      {name ? (
        <>
          {imageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="qc-sig-img" src={`/operasional/berkas/${imageKey}`} alt="" />
          ) : (
            <div className="qc-sig-space" />
          )}
          <b>( {name} )</b>
          <small>{stamp(at)}</small>
        </>
      ) : (
        <>
          <div className="qc-sig-space" />
          <div className="qc-sig-blank">{emptyNote ?? "(…....................)"}</div>
        </>
      )}
    </div>
  );
}
