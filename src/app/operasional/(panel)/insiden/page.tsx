// Lapor Insiden / Kecelakaan (F-IB-18): mandor, satpam, PIC Kendaraan, QC melapor dari HP; kantor & pimpinan melihat semua,
// melengkapi penyebab / tindakan, dan menutup. Pimpinan mendapat notifikasi saat laporan baru masuk. Rekap & Excel ada di Rekap ISO.
import Link from "next/link";
import { Ok, PageHead } from "@/components/erp/ui";
import { IsoRecordForm } from "@/components/ops/iso/IsoRecordForm";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getManualRecord, manualRecords, manualRow, todayWib } from "@/lib/ops/iso-core";
import type { IsoValues } from "@/lib/ops/shared/isoForms";
import { can } from "@/lib/roles";

export const metadata = { title: "Lapor Insiden" };

const BASE = "/operasional/insiden";
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const dayText = (d: unknown) => (typeof d === "string" && d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "-");
const isInjury = (jenis: unknown) => jenis === "Kecelakaan kerja (pekerja)" || jenis === "Kecelakaan kendaraan";
const TONE: Record<string, string> = { Ringan: "badge-warn", Sedang: "badge-warn", Berat: "badge-danger" };

export default async function InsidenPage({ searchParams }: { searchParams: Promise<{ f?: string; aksi?: string; id?: string; ok?: string }> }) {
  const me = await requirePerm("insiden");
  const sp = await searchParams;
  const db = await getDb();
  const today = todayWib();
  // Kantor, mandor, QC, dan pimpinan melihat semua laporan; satpam & PIC Kendaraan hanya laporannya sendiri.
  const seeAll = ["owner", "operasional", "mandor", "qc", "qcbeton", "manajer_qc"].some((r) => me.roles.includes(r as never)) || can(me.roles, "laporan");
  const office = me.roles.includes("owner") || me.roles.includes("operasional");
  const all = (await manualRecords(db, ["F-IB-18"], null)).filter((r) => seeAll || r.createdBy === me.id).map((r) => manualRow(r, today));

  let editor: React.ReactNode = null;
  if (sp.aksi === "tambah") {
    editor = <IsoRecordForm code="F-IB-18" mode="tambah" initial={{}} userName={me.name} today={today} back={BASE} cancelHref={BASE} office={office} />;
  } else if (sp.aksi === "ubah" && sp.id) {
    const rec = await getManualRecord(db, "F-IB-18", sp.id);
    if (rec && (office || rec.createdBy === me.id)) {
      editor = <IsoRecordForm code="F-IB-18" mode="ubah" recordId={rec.id} number={rec.number} initial={rec.data as IsoValues} userName={me.name} today={today} back={BASE} cancelHref={BASE} office={office} />;
    }
  }

  const month = today.slice(0, 7);
  const injuries = all.map((r) => r.values).filter((v) => isInjury(v.jenis) && typeof v.tanggal === "string").map((v) => String(v.tanggal)).sort();
  const last = injuries.at(-1);
  const stats = [
    { label: "Bulan ini", value: all.filter((r) => str(r.values.tanggal).startsWith(month)).length, tone: "" },
    { label: "Belum selesai", value: all.filter((r) => r.values.status !== "Closed").length, tone: "text-bahaya" },
    { label: "Tingkat berat (tahun ini)", value: all.filter((r) => r.values.keparahan === "Berat" && str(r.values.tanggal).startsWith(today.slice(0, 4))).length, tone: "text-bahaya" },
    { label: "Hari tanpa kecelakaan", value: last ? Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000)) : "-", tone: "text-sukses" },
  ];
  const onlyOpen = sp.f === "open";
  const shown = (onlyOpen ? all.filter((r) => r.values.status !== "Closed") : all)
    .slice()
    .sort((a, b) => str(b.values.tanggal).localeCompare(str(a.values.tanggal)) || str(b.number).localeCompare(str(a.number)));

  return (
    <>
      <PageHead title="Lapor Insiden & Kecelakaan" sub="Kecelakaan kerja, kecelakaan kendaraan, nyaris celaka, atau kerusakan barang / alat. Laporkan segera — pimpinan langsung mendapat notifikasi. Rekap & Excel ada di Rekap ISO (F-IB-18).">
        <Link href={`${BASE}?aksi=tambah`} className="btn btn-primary btn-sm">+ Lapor insiden</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      {editor && <div style={{ marginBottom: 20 }}>{editor}</div>}
      <div className="qc-tests" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 16 }}>
        {stats.map((s) => (
          <article key={s.label} className="admin-card">
            <div className="small muted">{s.label.toUpperCase()}</div>
            <div className={s.tone} style={{ fontSize: 28, fontWeight: 700 }}>{s.value}</div>
          </article>
        ))}
      </div>
      <nav className="seg no-print" style={{ marginBottom: 12 }}>
        <Link href={BASE} aria-current={!onlyOpen ? "page" : undefined}>Semua</Link>
        <Link href={`${BASE}?f=open`} aria-current={onlyOpen ? "page" : undefined}>Belum selesai</Link>
      </nav>
      {!shown.length ? (
        <div className="admin-card muted">{all.length ? "Tidak ada insiden yang belum selesai." : "Belum ada laporan insiden."}</div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {shown.map((row) => {
            const v = row.values;
            const photos = str(v.foto).split(/\n+/).filter(Boolean);
            const canEdit = office || row.createdBy === me.id;
            return (
              <article key={row.key} className="admin-card" style={v.keparahan === "Berat" && v.status !== "Closed" ? { borderColor: "#fca5a5" } : undefined}>
                <div className="qc-test-head">
                  <div>
                    <div className="small muted">{row.number ?? "-"} · {dayText(v.tanggal)}{v.jam ? `, ${str(v.jam)}` : ""}</div>
                    <h3 style={{ margin: "2px 0" }}>⚠ {str(v.jenis)} — {str(v.lokasi)}</h3>
                  </div>
                  <div className="qc-row-actions">
                    {v.keparahan ? <span className={`badge ${TONE[str(v.keparahan)] ?? "badge-info"}`}>{str(v.keparahan)}</span> : null}
                    <span className={`badge ${v.status === "Closed" ? "badge-on" : "badge-info"}`}>{v.status === "Closed" ? "Selesai" : `Belum selesai${typeof v.umur === "number" ? ` · ${v.umur} hari` : ""}`}</span>
                  </div>
                </div>
                <p>{str(v.kronologi)}</p>
                <p className="small muted">
                  {[v.terlibat ? `Terlibat: ${str(v.terlibat)}` : null, v.kendaraan ? `Kendaraan / alat: ${str(v.kendaraan)}` : null, v.akibat ? `Akibat: ${str(v.akibat)}` : null, v.berobat === "Ya" ? "Berobat" : null, typeof v.biaya === "number" ? `Perkiraan biaya Rp ${v.biaya.toLocaleString("id-ID")}` : null].filter(Boolean).join(" · ")}
                </p>
                {(v.penyebab || v.tindakan) && (
                  <p className="small" style={{ background: "#f8fafc", padding: "6px 10px", borderRadius: 8 }}>
                    {v.penyebab ? <><b>Penyebab:</b> {str(v.penyebab)}. </> : null}
                    {v.tindakan ? <><b>Tindakan:</b> {str(v.tindakan)}{v.pj ? ` (PJ ${str(v.pj)}${v.target ? `, target ${dayText(v.target)}` : ""})` : ""}</> : null}
                  </p>
                )}
                {photos.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {photos.map((k) => (
                      <a key={k} href={`/operasional/berkas/${k}`} target="_blank" rel="noreferrer"><img src={`/operasional/berkas/${k}`} alt="Foto kejadian" width={64} height={64} style={{ objectFit: "cover", borderRadius: 8 }} /></a>
                    ))}
                  </div>
                )}
                <div className="qc-bar small muted">
                  <span>Dilaporkan {str(v.pelapor) || row.createdByName || "-"}</span>
                  {canEdit && row.recordId && <Link href={`${BASE}?aksi=ubah&id=${row.recordId}`} className="btn btn-ghost btn-sm">{office ? "Lengkapi / tutup" : "Ubah"}</Link>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
