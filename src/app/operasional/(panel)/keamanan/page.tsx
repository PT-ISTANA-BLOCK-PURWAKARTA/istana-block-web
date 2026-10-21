import "./keamanan.css";
import Link from "next/link";
import { Empty, PageHead } from "@/components/erp/ui";
import { BackupPanel } from "@/components/ops/security/BackupPanel";
import { deviceLabel, moduleLabel, roleText } from "@/components/ops/security/labels";
import { LogExport } from "@/components/ops/security/LogExport";
import { DateField } from "@/components/ui";
import { getDb, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { addDays, isDate, today } from "@/lib/erp/util";
import { ACTIVITY_LIMIT, BACKUP_OVERDUE_DAYS, activityModules, activityStats, backupHistory, daysSince, listActivity, wibRange, type ActivityFilter } from "@/lib/ops/security";
import { formatDateTime } from "@/lib/ops/shared/format";

export const metadata = { title: "Keamanan" };
export const dynamic = "force-dynamic";

/** Baris log yang ditampilkan di halaman; Excel membawa sampai ACTIVITY_LIMIT. */
const SHOWN = 500;

type Params = { tab?: string; dari?: string; sampai?: string; pengguna?: string; modul?: string; cari?: string; gagal?: string };

const pretty = (details: string | null) => {
  if (!details) return "Tidak ada detail";
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
};

export default async function Keamanan({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePerm("keamanan");
  const sp = await searchParams;
  const tab = sp.tab === "log" ? "log" : "backup";
  const db = await getDb();

  const tabs = (
    <nav className="seg kc-tabs" aria-label="Bagian">
      <Link href="/operasional/keamanan" aria-current={tab === "backup" ? "page" : undefined}>Backup</Link>
      <Link href="/operasional/keamanan?tab=log" aria-current={tab === "log" ? "page" : undefined}>Log aktivitas</Link>
    </nav>
  );

  if (tab === "backup") {
    const history = await backupHistory(db);
    const last = history[0];
    const overdue = !last || daysSince(last.at) >= BACKUP_OVERDUE_DAYS;
    return (
      <>
        <PageHead title="Keamanan" sub="Backup seminggu sekali ke komputer kantor, dan catatan siapa mengubah apa. Khusus pemilik." />
        {tabs}
        <div className={`kc-banner${overdue ? "" : " is-ok"}`}>
          <div>
            <p><b>{last ? `Backup terakhir ${daysSince(last.at) === 0 ? "hari ini" : `${daysSince(last.at)} hari lalu`}` : "Belum pernah backup"}</b></p>
            <small>
              {last ? `${formatDateTime(last.at)} oleh ${last.userName ?? "-"} · ${last.rows} baris · ${last.newPhotos} berkas baru · folder ${last.folder ?? "-"}` : "Lakukan backup pertama dari komputer kantor."}
              {overdue ? " Jadwal: seminggu sekali (pengingat dikirim tiap Senin pagi)." : ""}
            </small>
          </div>
          <span className={`badge ${overdue ? "badge-warn" : "badge-on"}`}>{overdue ? "Perlu backup" : "Aman"}</span>
        </div>

        <section className="admin-card kc-card">
          <h2>Backup ke komputer kantor</h2>
          <p className="muted">
            Seluruh data aplikasi (pesanan, pengiriman, sopir, QC, uji lumpur, barang masuk, produksi, kalender, log, akun) disimpan sebagai berkas <b>.sql</b> di folder <code>database</code>,
            dan foto, tanda tangan, serta lampiran di folder <code>berkas</code> (hanya yang baru yang disalin). Berkas akun memuat hash password dan PIN, jadi simpan di tempat yang aman.
            Catatan percobaan masuk hanya disimpan strukturnya.
          </p>
          <ol className="kc-steps">
            <li>Buka halaman ini dari <b>komputer kantor</b> (Chrome atau Edge).</li>
            <li>Pertama kali: klik <b>Pilih folder</b>, pilih atau buat folder tujuan (mis. di server kantor), lalu izinkan.</li>
            <li>Seminggu sekali: klik <b>Backup sekarang</b>. Folder sudah diingat.</li>
          </ol>
          <BackupPanel />
        </section>

        <div className="admin-table" style={{ marginTop: 16 }}>
          <table>
            <caption>Riwayat backup (30 terakhir)</caption>
            <thead>
              <tr><th>Waktu</th><th>Oleh</th><th>Folder</th><th className="num">Tabel</th><th className="num">Baris</th><th className="num">Berkas (baru)</th></tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.at)}</td>
                  <td>{row.userName ?? "-"}</td>
                  <td className="small muted">{row.folder ?? "-"}</td>
                  <td className="num">{row.tables}</td>
                  <td className="num">{row.rows}</td>
                  <td className="num">{row.photos} ({row.newPhotos})</td>
                </tr>
              ))}
              {history.length === 0 && <Empty cols={6}>Belum ada backup.</Empty>}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>Selain backup ini, Cloudflare juga menyimpan riwayat database beberapa hari terakhir. Untuk memulihkan dari berkas .sql, hubungi pengembang aplikasi.</p>
      </>
    );
  }

  // ---- Log aktivitas
  const now = today();
  let from = isDate(sp.dari) ? sp.dari : addDays(now, -6);
  let to = isDate(sp.sampai) ? sp.sampai : now;
  if (from > to) [from, to] = [to, from];
  const userId = Number(sp.pengguna) || undefined;
  const modul = sp.modul && /^[a-z_]+$/.test(sp.modul) ? sp.modul : "";
  const cari = (sp.cari ?? "").trim().slice(0, 80);
  const failedOnly = sp.gagal === "1";

  const range = wibRange(from, to);
  const filter: ActivityFilter = { ...range, userId, module: modul || undefined, search: cari || undefined, failedOnly };
  const [rows, stats, modules, people] = await Promise.all([
    listActivity(db, filter, SHOWN),
    activityStats(db, filter),
    activityModules(db, range.from, range.to),
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).orderBy(schema.users.name),
  ]);

  const query = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ tab: "log", dari: from, sampai: to, ...(userId ? { pengguna: String(userId) } : {}), ...(modul ? { modul } : {}), ...(cari ? { cari } : {}), ...(failedOnly ? { gagal: "1" } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return p.toString();
  };
  const presets: [string, number][] = [["Hari ini", 0], ["7 hari", 6], ["30 hari", 29]];
  const exportQuery = new URLSearchParams({ dari: from, sampai: to, ...(userId ? { pengguna: String(userId) } : {}), ...(modul ? { modul } : {}), ...(cari ? { cari } : {}), ...(failedOnly ? { gagal: "1" } : {}) }).toString();

  return (
    <>
      <PageHead title="Keamanan" sub="Backup seminggu sekali ke komputer kantor, dan catatan siapa mengubah apa. Khusus pemilik.">
        {stats.total > 0 && <LogExport query={exportQuery} from={from} to={to} />}
      </PageHead>
      {tabs}

      <div className="kc-presets">
        {presets.map(([label, days]) => (
          <Link key={label} href={`/operasional/keamanan?${query({ dari: addDays(now, -days), sampai: now })}`} className="btn btn-ghost btn-sm" aria-current={from === addDays(now, -days) && to === now ? "page" : undefined}>{label}</Link>
        ))}
      </div>

      <form className="filter-bar" method="get">
        <input type="hidden" name="tab" value="log" />
        {modul && <input type="hidden" name="modul" value={modul} />}
        <div className="field"><label htmlFor="kc-dari">Dari</label><DateField id="kc-dari" name="dari" defaultValue={from} /></div>
        <div className="field"><label htmlFor="kc-sampai">Sampai</label><DateField id="kc-sampai" name="sampai" defaultValue={to} /></div>
        <div className="field">
          <label htmlFor="kc-pengguna">Pengguna</label>
          <select id="kc-pengguna" name="pengguna" defaultValue={userId ? String(userId) : ""}>
            <option value="">Semua pengguna</option>
            {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="field grow"><label htmlFor="kc-cari">Cari</label><input id="kc-cari" name="cari" defaultValue={cari} placeholder="nomor PO, nama, kata kunci…" /></div>
        <label className="kc-check"><input type="checkbox" name="gagal" value="1" defaultChecked={failedOnly} /> Hanya gagal/ditolak</label>
        <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
      </form>

      <nav className="kc-chips" aria-label="Modul">
        <Link href={`/operasional/keamanan?${query({ modul: "" })}`} aria-current={!modul ? "page" : undefined}>Semua</Link>
        {modules.map((m) => <Link key={m} href={`/operasional/keamanan?${query({ modul: m })}`} aria-current={modul === m ? "page" : undefined}>{moduleLabel(m)}</Link>)}
      </nav>

      <p className="muted small">
        {stats.total} aktivitas · {stats.people} pengguna · {stats.failed} gagal/ditolak
        {stats.total > SHOWN ? ` · menampilkan ${SHOWN} terbaru; Excel memuat sampai ${ACTIVITY_LIMIT}` : ""}. Password, PIN, dan foto tidak pernah disimpan di log.
      </p>

      <div className="admin-table">
        <table>
          <thead>
            <tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Status</th><th>Perangkat</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="small" style={{ whiteSpace: "nowrap" }}>{formatDateTime(row.at)}</td>
                <td>
                  <b>{row.userName ?? "Tidak dikenal"}</b>
                  <div className="small muted">{roleText(row.role) || "-"}</div>
                </td>
                <td>
                  <div>{row.label}</div>
                  {row.summary && <div className="small muted">{row.summary}</div>}
                  <details className="kc-detail">
                    <summary>Detail</summary>
                    <pre>{pretty(row.details)}</pre>
                    <span className="small muted">Kode aksi: {row.action}</span>
                  </details>
                </td>
                <td>{row.success ? <span className="kc-okay">Berhasil</span> : <span className="kc-fail">Gagal / ditolak</span>}</td>
                <td className="small">{deviceLabel(row.device)}<div className="muted">{row.ip ?? ""}</div></td>
              </tr>
            ))}
            {rows.length === 0 && <Empty cols={5}>Belum ada aktivitas pada filter ini.</Empty>}
          </tbody>
        </table>
      </div>
    </>
  );
}
