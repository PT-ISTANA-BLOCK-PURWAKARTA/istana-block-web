import "./piket.css";
import { Empty, Ok, PageHead, RangeForm } from "@/components/erp/ui";
import { EndDutyForm, StartDutyForm } from "@/components/ops/duty/DutyForms";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { isDate, monthStart, today } from "@/lib/erp/util";
import { closeStaleShifts, currentShift } from "@/lib/ops/duty";
import { formatDateTime } from "@/lib/ops/shared/format";
import { can, needsShift, normalizeRoles, ROLE_SHORT } from "@/lib/roles";
import { dayWindow, lastHandover, listShifts, myShifts, openShifts, personRecap, type ShiftRow } from "./recap";

export const metadata = { title: "Piket" };
export const dynamic = "force-dynamic";

/** 1.5 jam → "1 j 30 m". */
function duration(secs: number) {
  const m = Math.max(0, Math.round(secs / 60));
  return m >= 60 ? `${Math.floor(m / 60)} j ${m % 60} m` : `${m} m`;
}
const hoursText = (secs: number) => (secs / 3600).toLocaleString("id-ID", { maximumFractionDigits: 1 });
const nowSec = () => Math.floor(Date.now() / 1000);

function ShiftTable({ rows, showName }: { rows: ShiftRow[]; showName: boolean }) {
  const now = nowSec();
  return (
    <div className="admin-table">
      <table>
        <thead>
          <tr>
            {showName && <th>Nama</th>}
            <th>Mulai</th>
            <th>Selesai</th>
            <th className="num">Durasi</th>
            <th>Catatan serah terima</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const end = r.endedAt ? r.endedAt.getTime() / 1000 : null;
            return (
              <tr key={r.id}>
                {showName && <td>{r.userName}</td>}
                <td>{formatDateTime(r.startedAt)}</td>
                <td>{end ? formatDateTime(r.endedAt) : <span className="badge badge-on">Sedang piket</span>}</td>
                <td className="num">{duration((end ?? now) - r.startedAt.getTime() / 1000)}</td>
                <td className="pk-hand">{r.handoverNote || <span className="muted">-</span>}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <Empty cols={showName ? 5 : 4}>Belum ada shift piket.</Empty>}
        </tbody>
      </table>
    </div>
  );
}

export default async function Piket({ searchParams }: { searchParams: Promise<{ ok?: string; from?: string; to?: string }> }) {
  const me = await requirePerm("piket", "kalender_kelola");
  const sp = await searchParams;
  const canDuty = can(me.roles, "piket");
  const office = can(me.roles, "kalender_kelola");
  const db = await getDb();
  await closeStaleShifts(db);

  const to = isDate(sp.to) ? sp.to : today();
  let from = isDate(sp.from) ? sp.from : monthStart(to);
  let end = to;
  if (from > end) [from, end] = [end, from];

  const [mine, handover] = await Promise.all([canDuty ? currentShift(db, me.id) : undefined, canDuty ? lastHandover(db) : null]);

  const recap = office
    ? await Promise.all([openShifts(db), listShifts(db, dayWindow(from, end)), personRecap(db, { from, to: end }, nowSec()), db.select({ id: schema.users.id, name: schema.users.name, roles: schema.users.roles }).from(schema.users)])
    : null;
  const history = !office && canDuty ? await myShifts(db, me.id) : [];

  return (
    <>
      <PageHead title="Piket" sub={office ? "Absen piket dan rekap petugas: jam piket serta pekerjaan yang dicatat tiap orang." : "Absen piket sebelum mencatat barang masuk, uji pasir, atau “Sudah dimuat”."} />
      <Ok ok={sp.ok} />

      <div className="stack" style={{ gap: 16 }}>
        {canDuty && (
          <section className="admin-card pk-status">
            <div className={`pk-state${mine ? " is-on" : ""}`}>
              <span className="pk-dot" aria-hidden="true" />
              {mine ? (
                <b>
                  Sedang piket
                  <small>sejak {formatDateTime(mine.startedAt)}</small>
                </b>
              ) : (
                <b>
                  Belum piket
                  <small>{needsShift(me.roles) ? "Anda wajib absen piket sebelum mencatat." : "Absen piket bila Anda bertugas jaga."}</small>
                </b>
              )}
            </div>
            {!mine && handover && (
              <p className="pk-note">
                <small>Catatan serah terima dari {handover.userName}, {formatDateTime(handover.endedAt)}</small>
                {handover.handoverNote}
              </p>
            )}
            {mine ? <EndDutyForm /> : <StartDutyForm />}
          </section>
        )}

        {!office && canDuty && history.length > 0 && (
          <section className="admin-card">
            <div className="card-head"><h2>Shift terakhir saya</h2></div>
            <ShiftTable rows={history} showName={false} />
          </section>
        )}

        {recap && (() => {
          const [open, shifts, people, users] = recap;
          const rows = users
            .map((u) => ({ u, r: people.get(u.id), roles: normalizeRoles(u.roles) }))
            .filter((x) => (x.r?.shifts ?? 0) > 0 || needsShift(x.roles))
            .sort((a, b) => (b.r?.secs ?? 0) - (a.r?.secs ?? 0) || a.u.name.localeCompare(b.u.name, "id"));
          return (
            <>
              <section className="admin-card">
                <div className="card-head"><h2>Sedang piket sekarang</h2></div>
                {open.length ? (
                  <ul className="pk-open">
                    {open.map((o) => (
                      <li key={o.id}><b>{o.userName}</b> <span className="muted">sejak {formatDateTime(o.startedAt)} ({duration(nowSec() - o.startedAt.getTime() / 1000)})</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>Tidak ada yang sedang piket.</p>
                )}
              </section>

              <RangeForm from={from} to={end} />

              <div className="admin-table">
                <table>
                  <caption>Rekap per orang · {from} s.d. {end}</caption>
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Peran</th>
                      <th className="num">Shift</th>
                      <th className="num">Jam</th>
                      <th className="num">Barang masuk</th>
                      <th className="num">Uji pasir</th>
                      <th className="num">Muat</th>
                      <th className="num">Produksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ u, r, roles }) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{roles.map((x) => ROLE_SHORT[x]).join(", ")}</td>
                        <td className="num">{r?.shifts ?? 0}</td>
                        <td className="num">{hoursText(r?.secs ?? 0)}</td>
                        <td className="num">{r?.receipts ?? 0}</td>
                        <td className="num">{r?.tests ?? 0}</td>
                        <td className="num">{r?.loads ?? 0}</td>
                        <td className="num">{r?.production ?? 0}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && <Empty cols={8}>Belum ada shift piket pada rentang ini.</Empty>}
                  </tbody>
                </table>
              </div>

              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Riwayat shift{shifts.length >= 500 ? " (500 terbaru)" : ""}</h2>
                <ShiftTable rows={shifts} showName />
              </div>
            </>
          );
        })()}
      </div>
    </>
  );
}
