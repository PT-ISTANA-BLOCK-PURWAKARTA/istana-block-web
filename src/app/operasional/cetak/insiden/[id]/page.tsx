// Cetak satu laporan insiden (F-IB-18) di A4 tegak: kop, data kejadian, kronologi, penyebab & tindakan, foto, tanda tangan.
import { notFound } from "next/navigation";
import { PrintDoc, Sign } from "@/components/erp/PrintDoc";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getManualRecord, manualRow, todayWib } from "@/lib/ops/iso-core";
import { can } from "@/lib/roles";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak laporan insiden", robots: { index: false } };

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const day = (v: unknown) => (typeof v === "string" && v ? new Date(`${v}T12:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");

function Box({ title, children, tall }: { title: string; children: React.ReactNode; tall?: boolean }) {
  return (
    <div style={{ border: "1px solid #000", marginTop: 8, pageBreakInside: "avoid" }}>
      <h3 style={{ margin: 0, padding: "3px 6px", fontSize: "9.5pt", background: "#e4e7eb", borderBottom: "1px solid #000" }}>{title}</h3>
      <div style={{ padding: "5px 6px", minHeight: tall ? 52 : 28, whiteSpace: "pre-wrap" }}>{children}</div>
    </div>
  );
}

export default async function CetakInsiden({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm("insiden");
  const { id } = await params;
  const db = await getDb();
  const [rec, site] = await Promise.all([getManualRecord(db, "F-IB-18", id), getSettings()]);
  if (!rec) notFound();
  // Sama dengan daftar: satpam & PIC Kendaraan hanya laporannya sendiri.
  const seeAll = ["owner", "operasional", "mandor", "qc", "qcbeton", "manajer_qc"].some((r) => me.roles.includes(r as never)) || can(me.roles, "laporan");
  if (!seeAll && rec.createdBy !== me.id) notFound();
  const row = manualRow(rec, todayWib());
  const v = row.values;
  const photos = t(v.foto).split(/\n+/).filter(Boolean).slice(0, 3);
  const status = t(v.status) === "Closed" ? `Selesai${v.closed ? ` (${day(v.closed)})` : ""}` : `Belum selesai${typeof v.umur === "number" ? ` — ${v.umur} hari sejak kejadian` : ""}`;
  const rows: [string, string][] = [
    ["Tanggal & jam kejadian", `${day(v.tanggal)}${v.jam ? `, pukul ${t(v.jam)}` : ""}`],
    ["Jenis insiden", t(v.jenis)],
    ["Lokasi", t(v.lokasi)],
    ["Pekerja / sopir terlibat", t(v.terlibat)],
    ["Kendaraan / alat", t(v.kendaraan)],
    ["Tingkat keparahan", t(v.keparahan)],
    ["Berobat", t(v.berobat)],
    ["Perkiraan biaya / kerugian", typeof v.biaya === "number" ? `Rp ${v.biaya.toLocaleString("id-ID")}` : ""],
    ["Status", status],
  ];
  return (
    <PrintDoc site={site} title="LAPORAN INSIDEN & KECELAKAAN" subtitle={`F-IB-18 · Rev. 00 · No. Insiden ${row.number ?? "-"}`} back="/operasional/insiden">
      <table className="print-lines">
        <tbody>
          {rows.map(([k, val]) => (
            <tr key={k}><td style={{ width: "31%", background: "#f0f2f5", fontWeight: 700 }}>{k}</td><td>{val || " "}</td></tr>
          ))}
        </tbody>
      </table>
      <Box title="KRONOLOGI KEJADIAN" tall>{t(v.kronologi)}</Box>
      <Box title="AKIBAT (LUKA / KERUSAKAN)">{t(v.akibat)}</Box>
      <Box title="PENYEBAB">{t(v.penyebab)}</Box>
      <Box title="TINDAKAN PERBAIKAN / PENCEGAHAN">
        {t(v.tindakan)}
        <div style={{ borderTop: "1px dotted #999", marginTop: 4, fontSize: "9pt" }}>PJ: {t(v.pj) || "…………………"} &nbsp;|&nbsp; Target selesai: {day(v.target) || "…………………"}</div>
      </Box>
      {photos.length > 0 && (
        <Box title="FOTO KEJADIAN">
          <div style={{ display: "flex", gap: 8 }}>
            {photos.map((k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={`/operasional/berkas/${k}`} alt="Foto kejadian" style={{ height: 96, maxWidth: "32%", objectFit: "cover", border: "1px solid #999" }} />
            ))}
          </div>
        </Box>
      )}
      <Sign labels={[`Dilaporkan oleh (${t(v.pelapor) || row.createdByName || "…"})`, "Diperiksa (Mandor / Atasan)", "Disetujui Pimpinan"]} />
    </PrintDoc>
  );
}
