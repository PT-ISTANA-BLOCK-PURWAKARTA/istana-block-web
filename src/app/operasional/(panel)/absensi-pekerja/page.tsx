// Absensi pekerja harian (PIC absensi & kantor): per hari + salin dari kemarin, dan rekap per pekerja untuk satu periode.
import Link from "next/link";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { copyYesterday, deleteAttendance } from "@/app/operasional/actions/attendance";
import { Ok, PageHead, RangeForm } from "@/components/erp/ui";
import { AttendanceForm, type AttendanceInitial, type KnownWorker } from "@/components/ops/attendance/AttendanceForm";
import { QcActionButton } from "@/components/ops/qc/QcActionButton";
import { QcExcelButton } from "@/components/ops/qc/QcExcel";
import "@/components/ops/qc/qc.css";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { addDays, isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Absensi Pekerja" };

const BASE = "/operasional/absensi-pekerja";
const STATUS_LABEL: Record<string, string> = { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alfa: "Alfa" };
const STATUS_BADGE: Record<string, string> = { hadir: "badge-on", izin: "badge-info", sakit: "badge-warn", alfa: "badge-danger" };
const PAY_LABEL: Record<string, string> = { harian: "Harian", jam: "Per jam", borongan: "Borongan" };
const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const numText = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const longDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function AbsensiPekerja({ searchParams }: { searchParams: Promise<{ hari?: string; dari?: string; sampai?: string; from?: string; to?: string; aksi?: string; id?: string; ok?: string }> }) {
  await requirePerm("absensi_pekerja");
  const sp = await searchParams;
  const now = today();
  const day = isDate(sp.hari) ? sp.hari : now;
  const from = isDate(sp.from ?? sp.dari) ? (sp.from ?? sp.dari)! : monthStart(now);
  const to = isDate(sp.to ?? sp.sampai) ? (sp.to ?? sp.sampai)! : now;
  const db = await getDb();
  const t = schema.workerAttendance;
  const [rows, prev, recap, history] = await Promise.all([
    db.select().from(t).where(eq(t.workDate, day)).orderBy(asc(t.workerName)),
    db.select({ name: t.workerName }).from(t).where(eq(t.workDate, addDays(day, -1))),
    db.select().from(t).where(and(gte(t.workDate, from), lte(t.workDate, to))).orderBy(asc(t.workDate), asc(t.workerName)),
    db.select({ workerName: t.workerName, task: t.task, payType: t.payType }).from(t).orderBy(desc(t.workDate)).limit(3000),
  ]);
  const names: KnownWorker[] = [];
  const seen = new Set<string>();
  for (const h of history) if (!seen.has(h.workerName)) { seen.add(h.workerName); names.push(h); }
  names.sort((a, b) => a.workerName.localeCompare(b.workerName, "id"));
  const have = new Set(rows.map((r) => r.workerName));
  const copyable = prev.filter((p) => !have.has(p.name)).length;

  let editor: React.ReactNode = null;
  const back = `${BASE}?hari=${day}`;
  if (sp.aksi === "tambah") {
    editor = <AttendanceForm initial={{ workDate: day, workerName: "", task: "", payType: "harian", status: "hadir", startTime: "08:00", endTime: "16:00", hours: "", overtimeHours: "", output: "", outputUnit: "", note: "" }} names={names} back={back} />;
  } else if (sp.aksi === "ubah" && sp.id) {
    const r = await db.query.workerAttendance.findFirst({ where: eq(t.id, sp.id) });
    if (r) {
      const initial: AttendanceInitial = { id: r.id, workDate: r.workDate, workerName: r.workerName, task: r.task ?? "", payType: r.payType, status: r.status, startTime: r.startTime ?? "", endTime: r.endTime ?? "", hours: numText(r.hours), overtimeHours: numText(r.overtimeHours), output: numText(r.output), outputUnit: r.outputUnit ?? "", note: r.note ?? "" };
      editor = <AttendanceForm initial={initial} names={names} back={back} />;
    }
  }

  // Rekap per pekerja
  type Sum = { name: string; hadir: number; izin: number; sakit: number; alfa: number; hours: number; overtime: number; borongan: Map<string, number> };
  const by = new Map<string, Sum>();
  for (const r of recap) {
    const s = by.get(r.workerName) ?? { name: r.workerName, hadir: 0, izin: 0, sakit: 0, alfa: 0, hours: 0, overtime: 0, borongan: new Map() };
    s[r.status] += 1;
    s.hours += r.hours ?? 0;
    s.overtime += r.overtimeHours ?? 0;
    if (r.output) s.borongan.set(r.outputUnit ?? "", (s.borongan.get(r.outputUnit ?? "") ?? 0) + r.output);
    by.set(r.workerName, s);
  }
  const summary = [...by.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  const boronganText = (m: Map<string, number>) => [...m.entries()].map(([u, q]) => `${fmt(q)} ${u}`.trim()).join(", ");

  return (
    <>
      <PageHead title="Absensi Pekerja" sub="Absensi harian pekerja pabrik: kehadiran, tugas, jenis upah (harian / per jam / borongan), jam kerja & lembur. Absensi sopir tetap di Jadwal sopir.">
        <Link href={`${BASE}?hari=${day}&aksi=tambah`} className="btn btn-primary btn-sm">+ Absensi pekerja</Link>
      </PageHead>
      <Ok ok={sp.ok} />
      {editor && <div style={{ marginBottom: 20 }}>{editor}</div>}

      <section className="admin-card" style={{ marginBottom: 20 }}>
        <div className="qc-bar">
          <div className="qc-row-actions">
            <Link href={`${BASE}?hari=${addDays(day, -1)}`} className="btn btn-ghost btn-sm" aria-label="Hari sebelumnya">‹</Link>
            <b>{longDay(day)}</b>
            <Link href={`${BASE}?hari=${addDays(day, 1)}`} className="btn btn-ghost btn-sm" aria-label="Hari berikutnya">›</Link>
            {day !== now && <Link href={BASE} className="btn btn-ghost btn-sm">Hari ini</Link>}
          </div>
          {copyable > 0 && <QcActionButton label={`Salin dari kemarin (${copyable})`} confirmText={`Salin ${copyable} pekerja dari kemarin sebagai hadir?`} action={copyYesterday.bind(null, day)} />}
        </div>
        <p className="small muted">{rows.length} pekerja · {rows.filter((r) => r.status === "hadir").length} hadir</p>
        {!rows.length ? (
          <p className="muted">Belum ada absensi hari ini.</p>
        ) : (
          <div className="admin-table">
            <table className="compact">
              <thead><tr><th>Nama</th><th>Tugas</th><th>Kehadiran</th><th>Upah</th><th>Jam</th><th className="num">Jam kerja</th><th className="num">Lembur</th><th>Hasil</th><th>Ket.</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.workerName}</b></td>
                    <td>{r.task ?? "-"}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                    <td>{PAY_LABEL[r.payType]}</td>
                    <td className="small">{r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : "-"}</td>
                    <td className="num">{r.hours !== null ? fmt(r.hours) : "-"}</td>
                    <td className="num">{r.overtimeHours ? fmt(r.overtimeHours) : "-"}</td>
                    <td className="small">{r.output ? `${fmt(r.output)} ${r.outputUnit ?? ""}` : "-"}</td>
                    <td className="small muted">{r.note ?? ""}</td>
                    <td>
                      <div className="qc-row-actions">
                        <Link href={`${BASE}?hari=${day}&aksi=ubah&id=${r.id}`} className="btn btn-ghost btn-sm">Ubah</Link>
                        <QcActionButton className="link-btn" label="Hapus" confirmText={`Hapus absensi ${r.workerName}?`} action={deleteAttendance.bind(null, r.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card">
        <div className="qc-bar">
          <h3 style={{ margin: 0 }}>Rekap per pekerja</h3>
          <QcExcelButton
            fileName={`Absensi-Pekerja_${from}_sd_${to}.xlsx`}
            dateKeys={["tanggal"]}
            sheets={[
              { name: "Rekap", columns: [{ key: "nama", header: "Nama", width: 22 }, { key: "hadir", header: "Hadir", width: 8 }, { key: "izin", header: "Izin", width: 8 }, { key: "sakit", header: "Sakit", width: 8 }, { key: "alfa", header: "Alfa", width: 8 }, { key: "jam", header: "Jam kerja", width: 10 }, { key: "lembur", header: "Lembur", width: 10 }, { key: "borongan", header: "Hasil borongan", width: 24 }], rows: summary.map((s) => ({ nama: s.name, hadir: s.hadir, izin: s.izin, sakit: s.sakit, alfa: s.alfa, jam: s.hours, lembur: s.overtime, borongan: boronganText(s.borongan) })) },
              { name: "Detail", columns: [{ key: "tanggal", header: "Tanggal", width: 12 }, { key: "nama", header: "Nama", width: 22 }, { key: "tugas", header: "Tugas", width: 24 }, { key: "status", header: "Kehadiran", width: 10 }, { key: "upah", header: "Upah", width: 10 }, { key: "masuk", header: "Masuk", width: 8 }, { key: "pulang", header: "Pulang", width: 8 }, { key: "jam", header: "Jam kerja", width: 10 }, { key: "lembur", header: "Lembur", width: 10 }, { key: "hasil", header: "Hasil", width: 10 }, { key: "satuan", header: "Satuan", width: 8 }, { key: "ket", header: "Keterangan", width: 24 }], rows: recap.map((r) => ({ tanggal: r.workDate, nama: r.workerName, tugas: r.task ?? "", status: STATUS_LABEL[r.status], upah: PAY_LABEL[r.payType], masuk: r.startTime ?? "", pulang: r.endTime ?? "", jam: r.hours, lembur: r.overtimeHours, hasil: r.output, satuan: r.outputUnit ?? "", ket: r.note ?? "" })) },
            ]}
          />
        </div>
        <RangeForm from={from} to={to} extra={<input type="hidden" name="hari" value={day} />} />
        {!summary.length ? (
          <p className="muted">Belum ada absensi pada periode ini.</p>
        ) : (
          <div className="admin-table">
            <table className="compact">
              <thead><tr><th>Nama</th><th className="num">Hadir</th><th className="num">Izin</th><th className="num">Sakit</th><th className="num">Alfa</th><th className="num">Jam kerja</th><th className="num">Lembur</th><th>Hasil borongan</th></tr></thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.name}>
                    <td><b>{s.name}</b></td>
                    <td className="num">{s.hadir}</td><td className="num">{s.izin}</td><td className="num">{s.sakit}</td><td className="num">{s.alfa}</td>
                    <td className="num">{fmt(s.hours)}</td><td className="num">{s.overtime ? fmt(s.overtime) : "-"}</td>
                    <td className="small">{boronganText(s.borongan) || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
