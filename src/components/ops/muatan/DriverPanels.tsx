// Tab sopir di Muatan & tugas sopir: Status sopir, Jadwal sopir (mingguan), Absensi sopir — padanan
// DriverStatusPanel / DriverSchedulePanel / DriverAttendancePanel di app.kirimistanablock.com.
import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { setDriverSchedule } from "@/app/operasional/actions/driverSchedule";
import { addDays, today } from "@/lib/erp/util";
import { ATTENDANCE_KINDS, type AttendanceKind, type DriverStatusRow, type ScheduleEntry } from "@/lib/ops/muatanBoard";

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const REASONS = ["Istirahat", "Sakit", "Izin", "Alfa", "Pulang", "Belum datang"];
const TASK_LABEL: Record<string, string> = { dijadwalkan: "Ditugaskan", dimuat: "Siap muat", berangkat: "Dalam perjalanan", tiba: "Sampai lokasi", tertunda: "Terlambat" };
export const DRIVER_STATUS = { aktif: { label: "Aktif", tone: "ds-aktif" }, istirahat: { label: "Istirahat", tone: "ds-istirahat" }, libur: { label: "Libur", tone: "ds-libur" } } as const;

const ago = (sec: number | null | undefined) => {
  if (!sec) return null;
  const m = Math.round((Date.now() / 1000 - sec) / 60);
  if (m < 60) return `${Math.max(m, 0)} mnt lalu`;
  if (m < 24 * 60) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
};
const waLink = (phone: string | null) => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 8 ? `https://wa.me/${d.startsWith("0") ? `62${d.slice(1)}` : d}` : null;
};

function stateOf(d: DriverStatusRow) {
  const off = Boolean(d.today && d.today.status !== "aktif");
  const reason = d.today?.status === "istirahat" ? `Istirahat${d.today.untilTime ? ` s/d ${d.today.untilTime}` : ""}` : d.today?.note || "Libur";
  if (d.tasks.length) return { key: "tugas", label: off ? `Bertugas · ${reason}` : "Bertugas", tone: "ds-tugas", off };
  if (off) return { key: "nonaktif", label: `Non-aktif · ${reason}`, tone: "ds-libur", off };
  if (!d.today) return { key: "belum", label: "Belum diisi", tone: "ds-belum", off: false };
  return { key: "aktif", label: "Aktif", tone: "ds-aktif", off };
}

/** Tombol cepat: satu form, satu status, hari ini. */
function QuickStatus({ driverId, status, label, className, day }: { driverId: string; status: string; label: string; className: string; day: string }) {
  return (
    <ActionForm action={setDriverSchedule}>
      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton className={className} pendingText="Menyimpan…">{label}</SubmitButton>
    </ActionForm>
  );
}

/** Non-aktif: pilih alasan (Istirahat → sampai jam; lainnya → libur dengan alasan). */
function OffForm({ driverId, name, day }: { driverId: string; name: string; day: string }) {
  return (
    <details className="ds-off">
      <summary className="btn btn-ghost btn-sm ds-btn-off">Non-aktif</summary>
      <ActionForm action={setDriverSchedule} className="ds-off-form">
        <p className="small muted">{name} tidak siap menerima order hari ini. Kantor melihat tanda NON-AKTIF saat memilih sopir.</p>
        <input type="hidden" name="driverId" value={driverId} />
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="status" value="nonaktif" />
        <div className="ds-chips">
          {REASONS.map((r, i) => (
            <label key={r}><input type="radio" name="reason" value={r} defaultChecked={i === 0} /> <span>{r}</span></label>
          ))}
        </div>
        <div className="field"><label>Istirahat sampai jam (opsional)</label><input type="time" name="untilTime" /></div>
        <div className="field"><input name="note" placeholder="Keterangan (opsional)" maxLength={200} /></div>
        <SubmitButton className="btn btn-danger btn-sm" pendingText="Menyimpan…">Tandai non-aktif</SubmitButton>
      </ActionForm>
    </details>
  );
}

export function DriverStatusBoard({ drivers, canSet, office }: { drivers: DriverStatusRow[]; canSet: boolean; office: boolean }) {
  const day = today();
  const states = drivers.map(stateOf);
  const count = (k: string) => states.filter((s) => s.key === k).length;
  const withPush = drivers.filter((d) => d.devices > 0).length;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="ds-stats">
        {([["Bertugas", count("tugas"), "c-sky"], ["Aktif (siap order)", count("aktif"), "c-green"], ["Belum diisi", count("belum"), "c-slate"], ["Non-aktif", count("nonaktif"), "c-rose"], ["Notifikasi aktif", `${withPush}/${drivers.length}`, withPush === drivers.length ? "c-green" : "c-rose"]] as const).map(([label, value, tone]) => (
          <article key={label} className="ohome-card"><span className="small muted">{label}</span><b className={`ds-num ${tone}`}>{value}</b></article>
        ))}
      </div>
      {withPush < drivers.length && (
        <p className="alert alert-error"><b>{drivers.length - withPush} sopir belum mengaktifkan notifikasi</b> — mereka tidak menerima pemberitahuan tugas baru. Minta sopir buka aplikasi di HP-nya → tekan <b>Aktifkan notifikasi tugas</b> → <b>Tes</b>.</p>
      )}
      <div className="mj-grid">
        {drivers.map((d, i) => {
          const s = states[i];
          const wa = waLink(d.phone);
          const failed = d.lastPush && d.lastPush.result && d.lastPush.result !== "terkirim" && d.lastPush.result !== "ok";
          return (
            <article key={d.id} className="ohome-card ds-card">
              <div className="mj-top">
                <div>
                  <b className="ds-name">{d.name}</b>
                  <p className="small muted">{d.userId ? "Akun sopir terhubung" : "Belum punya akun sopir"}{d.lastPositionAt ? ` · 📍 GPS ${ago(d.lastPositionAt)}` : ""}</p>
                </div>
                <span className={`ds-pill ${s.tone}`}>{s.label}</span>
              </div>
              {d.tasks.map((t) => <p key={t.orderNumber + t.status} className="ds-task">🚚 <b>{t.orderNumber}</b> · {TASK_LABEL[t.status] ?? t.status}{t.plate ? ` · ${t.plate}` : ""}</p>)}
              <div className="small" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {d.devices ? <span className="ds-pill ds-aktif-soft">🔔 Notifikasi aktif ({d.devices} HP)</span> : <span className="ds-pill ds-libur-soft">🔕 Notifikasi belum aktif</span>}
                {d.lastPush && <span className={failed ? "text-bahaya" : "muted"}>Terakhir: {d.lastPush.title} · {ago(d.lastPush.at)} · {failed ? `GAGAL (${d.lastPush.result})` : "terkirim"}</span>}
              </div>
              {d.today && d.today.status !== "aktif" && d.today.setByName && <p className="small muted">Ditandai {d.today.setByName}{d.today.updatedAt ? ` · ${ago(d.today.updatedAt)}` : ""}</p>}
              {canSet && (
                <div className="ds-actions">
                  {s.key === "aktif" || (s.key === "tugas" && !s.off) ? <button type="button" className="btn btn-sm ds-btn-on" disabled>Aktif</button> : <QuickStatus driverId={d.id} status="aktif" label="Aktif" className="btn btn-sm ds-btn-on is-strong" day={day} />}
                  <OffForm driverId={d.id} name={d.name} day={day} />
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">💬 WhatsApp</a>}
                {office && <Link href={`/operasional/sopir/${d.id}`} className="btn btn-ghost btn-sm">Data sopir</Link>}
              </div>
            </article>
          );
        })}
      </div>
      {!drivers.length && <p className="muted">Belum ada sopir aktif.</p>}
    </div>
  );
}

export function DriverScheduleBoard({ drivers, entries, week, canSet, pick }: { drivers: { id: string; name: string }[]; entries: ScheduleEntry[]; week: string; canSet: boolean; pick: { driverId?: string; day?: string } }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const now = today();
  const entryOf = (driverId: string, day: string) => entries.find((e) => e.driverId === driverId && e.day === day);
  const cnt = (st: string) => drivers.filter((d) => entryOf(d.id, now)?.status === st).length;
  const unfilled = drivers.filter((d) => !entryOf(d.id, now)).length;
  const sel = drivers.find((d) => d.id === pick.driverId);
  const selDay = pick.day && days.includes(pick.day) ? pick.day : now;
  const selEntry = sel ? entryOf(sel.id, selDay) : undefined;
  const href = (p: Record<string, string>) => `/operasional/muatan?${new URLSearchParams({ tab: "jadwal", minggu: week, ...p })}`;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {days.includes(now) && (
        <section className="ohome-card">
          <div className="ohome-card-head">
            <h2>Sopir hari ini</h2>
            <div className="ds-chips-row">
              {(Object.keys(DRIVER_STATUS) as (keyof typeof DRIVER_STATUS)[]).map((k) => <span key={k} className={`ds-pill ${DRIVER_STATUS[k].tone}`}>{DRIVER_STATUS[k].label} {cnt(k)}</span>)}
              {unfilled > 0 && <span className="ds-pill ds-belum">Belum diisi {unfilled}</span>}
            </div>
          </div>
          <div className="mj-grid">
            {drivers.map((d) => {
              const e = entryOf(d.id, now);
              return (
                <div key={d.id} className="ds-today">
                  <b>{d.name}</b>
                  <p className="small muted">{e ? `${DRIVER_STATUS[e.status]?.label ?? e.status}${e.untilTime ? ` s/d ${e.untilTime}` : ""}${e.note ? ` · ${e.note}` : ""}` : "Belum diisi"}</p>
                  {canSet && (
                    <div className="ds-three">
                      <QuickStatus driverId={d.id} status="aktif" label="Aktif" className={`btn btn-sm ${e?.status === "aktif" ? "ds-aktif" : "btn-ghost"}`} day={now} />
                      <Link href={href({ sopir: d.id, hari: now, status: "istirahat" })} className={`btn btn-sm ${e?.status === "istirahat" ? "ds-istirahat" : "btn-ghost"}`}>Istirahat</Link>
                      <QuickStatus driverId={d.id} status="libur" label="Libur" className={`btn btn-sm ${e?.status === "libur" ? "ds-libur" : "btn-ghost"}`} day={now} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="ohome-card">
        <div className="ohome-card-head">
          <h2>📅 Jadwal sopir mingguan</h2>
          <div className="ds-chips-row">
            <Link href={href({ minggu: addDays(week, -7) })} className="btn btn-ghost btn-sm" aria-label="Minggu sebelumnya">‹</Link>
            <b className="small">{short(days[0])} – {short(days[6])}</b>
            <Link href={href({ minggu: addDays(week, 7) })} className="btn btn-ghost btn-sm" aria-label="Minggu berikutnya">›</Link>
          </div>
        </div>
        <div className="admin-table">
          <table className="compact ds-week">
            <thead><tr><th>Sopir</th>{days.map((day, i) => <th key={day} className={day === now ? "is-today" : ""}>{DAY_NAMES[i]}<br /><span className="small">{short(day)}</span></th>)}</tr></thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.name}</b></td>
                  {days.map((day) => {
                    const e = entryOf(d.id, day);
                    const meta = e ? DRIVER_STATUS[e.status] : null;
                    const cell = <span className={`ds-cell ${meta?.tone ?? "ds-empty"}`} title={e?.note ?? ""}>{meta ? meta.label : "–"}{e?.untilTime ? <small> s/d {e.untilTime}</small> : null}</span>;
                    return <td key={day}>{canSet ? <Link href={href({ sopir: d.id, hari: day })}>{cell}</Link> : cell}</td>;
                  })}
                </tr>
              ))}
              {!drivers.length && <tr><td colSpan={8} className="muted">Belum ada sopir aktif.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="small muted">Ketuk kotak untuk mengatur. Kosong (–) = belum diisi (isi manual tiap hari, tidak otomatis aktif). Status hari ini tampil saat kantor memilih sopir untuk tugas.</p>
      </section>

      {canSet && sel && (
        <section className="ohome-card" id="atur">
          <div className="ohome-card-head">
            <div><h2>{sel.name}</h2><p className="small muted">{new Date(`${selDay}T12:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</p></div>
            <Link href={href({})} className="small">Tutup</Link>
          </div>
          <ActionForm action={setDriverSchedule} className="stack" style={{ gap: 10 }}>
            <input type="hidden" name="driverId" value={sel.id} />
            <div className="ds-chips">
              {(Object.keys(DRIVER_STATUS) as (keyof typeof DRIVER_STATUS)[]).map((k) => (
                <label key={k}><input type="radio" name="status" value={k} defaultChecked={(pick as { status?: string }).status ? (pick as { status?: string }).status === k : (selEntry?.status ?? "aktif") === k} /> <span>{DRIVER_STATUS[k].label}</span></label>
              ))}
            </div>
            <div className="field"><label>Detail / catatan (opsional)</label><textarea name="note" rows={2} defaultValue={selEntry?.note ?? ""} placeholder="Mis. cuti, sakit, makan siang di warung depan, servis truk" maxLength={200} /></div>
            <div className="field"><label>Istirahat — perkiraan selesai (opsional)</label><input type="time" name="untilTime" defaultValue={selEntry?.untilTime ?? ""} /></div>
            <div className="field">
              <label>Berlaku untuk hari</label>
              <div className="ds-days">
                {days.map((day, i) => <label key={day}><input type="checkbox" name="day" value={day} defaultChecked={day === selDay} /> <span>{DAY_NAMES[i]}<small>{short(day)}</small></span></label>)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <SubmitButton className="btn btn-primary" pendingText="Menyimpan…">Simpan</SubmitButton>
            </div>
          </ActionForm>
          {selEntry && (
            <ActionForm action={setDriverSchedule} style={{ marginTop: 8 }}>
              <input type="hidden" name="driverId" value={sel.id} />
              <input type="hidden" name="day" value={selDay} />
              <input type="hidden" name="status" value="hapus" />
              <SubmitButton className="btn btn-ghost btn-sm" pendingText="Mengosongkan…">Kosongkan {short(selDay)}</SubmitButton>
            </ActionForm>
          )}
        </section>
      )}
    </div>
  );
}

const KINDS: Record<AttendanceKind, { label: string; code: string; tone: string }> = {
  hadir: { label: "Hadir", code: "H", tone: "ak-h" },
  istirahat: { label: "Istirahat", code: "I", tone: "ak-i" },
  terlambat: { label: "Belum datang / telat", code: "T", tone: "ak-t" },
  pulang: { label: "Pulang", code: "P", tone: "ak-p" },
  sakit: { label: "Sakit", code: "S", tone: "ak-s" },
  izin: { label: "Izin", code: "Z", tone: "ak-z" },
  alfa: { label: "Alfa", code: "A", tone: "ak-a" },
  libur: { label: "Libur", code: "L", tone: "ak-l" },
  belum: { label: "Belum diisi", code: "?", tone: "ak-b" },
};
const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`);

export function DriverAttendanceBoard({ data, from, to, detail }: { data: { days: string[]; rows: { id: string; name: string; workDays: number; counts: Record<AttendanceKind, number>; present: number; trips: number; attendance: number | null; daily: Record<string, { kind: AttendanceKind; note: string | null; trips: number }> }[] }; from: string; to: string; detail: boolean }) {
  const now = today();
  const m0 = `${now.slice(0, 7)}-01`;
  const prevEnd = addDays(m0, -1);
  const presets = [
    { label: "Bulan ini", from: m0, to: now },
    { label: "Bulan lalu", from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd },
    { label: "7 hari", from: addDays(now, -6), to: now },
  ];
  const q = (p: Record<string, string>) => `/operasional/muatan?${new URLSearchParams({ tab: "absensi", dari: from, sampai: to, ...p })}`;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <form className="ohome-card ds-range" method="get">
        <input type="hidden" name="tab" value="absensi" />
        {presets.map((p) => <Link key={p.label} href={q({ dari: p.from, sampai: p.to })} className={`btn btn-sm ${p.from === from && p.to === to ? "btn-navy" : "btn-ghost"}`}>{p.label}</Link>)}
        <input type="date" name="dari" defaultValue={from} aria-label="Dari tanggal" />
        <span className="muted">s/d</span>
        <input type="date" name="sampai" defaultValue={to} aria-label="Sampai tanggal" />
        <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
      </form>
      <section className="ohome-card">
        <div className="ohome-card-head">
          <div><h2>Absensi sopir</h2><p className="small muted">Dari status sopir harian (satpam / PIC kendaraan / kantor). Jumat tanpa isian = libur pabrik.</p></div>
          <Link href={q({ rinci: detail ? "" : "1" })} className="small">{detail ? "Sembunyikan harian" : "Lihat harian"}</Link>
        </div>
        <div className="admin-table">
          <table className="compact">
            <thead><tr><th>Sopir</th><th className="num">Hari kerja</th>{ATTENDANCE_KINDS.filter((k) => k !== "libur").map((k) => <th key={k} className="num" title={KINDS[k].label}>{KINDS[k].label}</th>)}<th className="num">Kehadiran</th><th className="num">Jalan</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b></td><td className="num">{r.workDays}</td>
                  {ATTENDANCE_KINDS.filter((k) => k !== "libur").map((k) => <td key={k} className={`num${k === "alfa" && r.counts[k] ? " text-bahaya" : ""}`}>{r.counts[k] || ""}</td>)}
                  <td className="num"><b>{pct(r.attendance)}</b></td><td className="num">{r.trips}</td>
                </tr>
              ))}
              {!data.rows.length && <tr><td colSpan={12} className="muted">Belum ada data pada periode ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {detail && data.days.length > 0 && (
        <section className="ohome-card">
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Harian</h2>
          <p className="small muted">{Object.values(KINDS).map((k) => `${k.code} ${k.label}`).join(" · ")}</p>
          <div className="admin-table">
            <table className="compact ak-grid">
              <thead><tr><th>Sopir</th>{data.days.map((d) => <th key={d}>{Number(d.slice(8))}</th>)}</tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}><td><b>{r.name}</b></td>{data.days.map((d) => { const c = r.daily[d]; const k = KINDS[c?.kind ?? "belum"]; return <td key={d}><span className={`ak ${k.tone}`} title={[k.label, c?.note, c?.trips ? `${c.trips} jalan` : null].filter(Boolean).join(" · ")}>{k.code}</span></td>; })}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
