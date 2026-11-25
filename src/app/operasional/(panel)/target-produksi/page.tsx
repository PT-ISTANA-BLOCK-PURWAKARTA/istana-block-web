// Target produksi & capaian — tampilan seperti halaman Target di app.kirimistanablock.com:
// periode capaian (Hari ini / Kemarin / 7 hari / Bulan ini), ringkasan tercapai, daftar hari-produk tidak tercapai
// dengan isian alasan, dan target standar per produk (dikelompokkan per jenis) dengan saran dari data 30 hari.
import "@/components/ops/home/home.css";
import "./target.css";
import Link from "next/link";
import { removeTargetStandard, saveTargetReason, setTargetStandard } from "@/app/operasional/actions/productionTargets";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { Ok } from "@/components/erp/ui";
import { Icon } from "@/components/panel/Icon";
import { getDb } from "@/db";
import { addDays, formatQty, isDate, today } from "@/lib/erp/util";
import { productionAccess } from "@/lib/ops/production";
import { achievement, targetOverview, type Standard } from "@/lib/ops/productionTargets";

export const metadata = { title: "Target produksi" };
export const dynamic = "force-dynamic";

const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortDate = (sec: number) => new Date(sec * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function TargetProduksi({ searchParams }: { searchParams: Promise<{ dari?: string; sampai?: string; standar?: string; ubah?: string; ok?: string }> }) {
  const acc = await productionAccess();
  const sp = await searchParams;
  const t = today();
  const presets = [
    ["Hari ini", t, t],
    ["Kemarin", addDays(t, -1), addDays(t, -1)],
    ["7 hari", addDays(t, -6), t],
    ["Bulan ini", `${t.slice(0, 8)}01`, t],
  ] as const;
  let from = isDate(sp.dari ?? "") ? sp.dari! : addDays(t, -6);
  let to = isDate(sp.sampai ?? "") ? sp.sampai! : t;
  if (from > to) [from, to] = [to, from];
  const showStandards = sp.standar === "1" || Boolean(sp.ubah);
  const href = (p: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ dari: from, sampai: to, standar: showStandards ? "1" : "", ...p })) if (v) q.set(k, v);
    return `/operasional/target-produksi?${q}`;
  };

  const db = await getDb();
  const data = await targetOverview(db, from, to);
  const missed = data.days.filter((d) => !d.reached);
  const needReason = missed.filter((d) => !d.reason);
  const reached = data.days.length - missed.length;
  const standardKeys = new Set(data.standards.map((s) => s.key));
  const hintOf = new Map(data.suggestions.map((s) => [s.key, s]));
  // Produk tanpa standar tapi rutin diproduksi (>= 3 hari dalam 30 hari) ikut tampil supaya bisa ditetapkan.
  const unset = data.suggestions.filter((s) => !standardKeys.has(s.key) && s.days >= 3);
  const all: (Standard & { standard: boolean })[] = [
    ...data.standards.map((s) => ({ ...s, standard: true })),
    ...unset.map((s) => ({ key: s.key, label: s.label, unit: s.unit, target: 0, setByName: null, setAt: 0, history: [], group: s.group, standard: false })),
  ];
  const groups = [...new Set(all.map((s) => s.group))].sort((a, b) => a.localeCompare(b, "id")).map((name) => {
    const items = all.filter((s) => s.group === name);
    const totals = [...new Set(items.map((s) => s.unit))].map((u) => `${formatQty(items.filter((s) => s.unit === u).reduce((n, s) => n + s.target, 0))} ${u}`).join(" + ");
    return { name, items, totals };
  });

  return (
    <div className="ohome">
      <header className="ohome-head">
        <div>
          <p className="ohome-kicker">🎯 Target</p>
          <h1>Target produksi</h1>
          <p className="ohome-lead">Capaian hasil terhadap target per hari, alasan bila tidak tercapai, dan target standar per produk yang dipakai otomatis setiap hari.</p>
        </div>
        <Link href="/operasional/produksi" className="btn btn-ghost btn-sm">Hasil produksi →</Link>
      </header>
      <Ok ok={sp.ok} />

      <nav className="tg-sections" aria-label="Bagian target">
        <span aria-current="page"><Icon name="factory" size={16} /> Target produksi</span>
      </nav>

      <form className="tg-period" method="get">
        <b className="small">Periode capaian:</b>
        {presets.map(([label, f, tt]) => (
          <Link key={label} href={href({ dari: f, sampai: tt })} className={`oa-btn${from === f && to === tt ? " is-on" : ""}`}>{label}</Link>
        ))}
        <input type="date" name="dari" defaultValue={from} aria-label="Dari tanggal" />
        <span className="muted">s/d</span>
        <input type="date" name="sampai" defaultValue={to} aria-label="Sampai tanggal" />
        {showStandards && <input type="hidden" name="standar" value="1" />}
        <button type="submit" className="oa-btn">Tampilkan</button>
      </form>

      <section className={`ohome-card tg-card${needReason.length ? " is-alert" : ""}`}>
        <div className="ohome-card-head">
          <h2 className="tg-title"><Icon name="flask" size={16} /> Target produksi &amp; capaian</h2>
          <div className="tg-chips">
            <span className="tg-chip ok">Tercapai {reached} / {data.days.length} hari-produk</span>
            {missed.length > 0 && <span className="tg-chip warn">Tidak tercapai {missed.length}</span>}
            {needReason.length > 0 && <span className="tg-chip bad">{needReason.length} belum ada alasan</span>}
          </div>
        </div>
        {!data.standards.length && (
          <p className="tg-note">Belum ada target standar. Mandor / QC cukup mengisi target <b>sekali</b> per produk di daftar standar di bawah, lalu target itu dipakai otomatis setiap hari.</p>
        )}

        {missed.length > 0 && (
          <div className="tg-missed">
            {missed.map((d) => (
              <div key={`${d.key}#${d.workDate}`} className="tg-miss">
                <p className="tg-miss-title"><span className="tg-group">{d.group}</span>{d.label} <span className="muted">· {dayName(d.workDate)}</span></p>
                <p className="small">Target {formatQty(d.target)} {d.unit} · jadi {formatQty(d.actual)} · <b className="text-bahaya">{achievement(d.actual, d.target)}%</b></p>
                {d.reason ? (
                  <p className="small">⚠ Alasan: {d.reason}{d.reasonBy && <span className="muted"> — {d.reasonBy}</span>}</p>
                ) : acc.canEdit ? (
                  <ActionForm action={saveTargetReason} className="tg-reason">
                    <input type="hidden" name="key" value={d.key} />
                    <input type="hidden" name="workDate" value={d.workDate} />
                    <input type="hidden" name="label" value={d.label} />
                    <input type="hidden" name="target" value={d.target} />
                    <input type="hidden" name="actual" value={d.actual} />
                    <input name="reason" required minLength={3} maxLength={500} placeholder="Tulis alasan target tidak tercapai" aria-label={`Alasan ${d.label} ${d.workDate}`} />
                    <SubmitButton className="oa-btn oa-navy" pendingText="Menyimpan…">Simpan</SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="small muted">Belum ada alasan.</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Link href={href({ standar: showStandards ? "" : "1", ubah: "" })} className="tg-toggle">
          {showStandards ? "▲" : "▼"} Target standar per produk ({data.standards.length}){unset.length ? ` · ${unset.length} produk belum ada target` : ""}
        </Link>
        {showStandards && (
          <div className="admin-table tg-std">
            <table className="compact">
              <thead><tr><th>Produk</th><th className="num">Target standar / hari</th><th>Ditetapkan</th><th className="num" title="Hasil harian 30 hari terakhir">Data 30 hari (median · atas · maks)</th><th /></tr></thead>
              <tbody>
                {groups.map((g) => [
                  g.items.length > 1 ? (
                    <tr key={`g-${g.name}`} className="tg-grouprow"><td colSpan={5}><b>{g.name}</b> <span className="small muted">· {g.items.length} jenis · total target {g.totals}</span></td></tr>
                  ) : null,
                  ...g.items.map((s) => {
                    const hint = hintOf.get(s.key);
                    const editing = sp.ubah === s.key;
                    return (
                      <tr key={s.key}>
                        <td><b>{s.label}</b></td>
                        <td className="num">
                          {editing ? null : s.standard ? <b>{formatQty(s.target)} {s.unit}</b> : <span className="small text-warn">belum ada</span>}
                        </td>
                        <td className="small muted">
                          {s.standard ? <>{s.setByName ?? "-"} · {shortDate(s.setAt)}{s.history.length ? <div>sebelumnya {formatQty(s.history[0].target)}</div> : null}</> : "-"}
                        </td>
                        <td className="num small">{hint ? <>{formatQty(hint.median)} · {formatQty(hint.upper)} · {formatQty(hint.max)} <span className="muted">({hint.days} hari)</span></> : "-"}</td>
                        <td className="tg-actions">
                          {acc.canEdit && (editing ? (
                            <ActionForm action={setTargetStandard} className="tg-edit">
                              <input type="hidden" name="key" value={s.key} />
                              <input type="hidden" name="label" value={s.label} />
                              <input type="hidden" name="unit" value={s.unit} />
                              <input type="hidden" name="back" value={href({ ubah: "", ok: "" })} />
                              <input name="target" inputMode="decimal" required autoFocus defaultValue={s.standard ? String(s.target) : String(hint?.upper ?? "")} aria-label={`Target ${s.label}`} />
                              <SubmitButton className="oa-btn oa-navy" pendingText="…">Simpan</SubmitButton>
                              <Link href={href({ ubah: "" })} className="oa-btn">Batal</Link>
                            </ActionForm>
                          ) : (
                            <>
                              <Link href={href({ ubah: s.key })} className="oa-btn">{s.standard ? "Ubah" : "Tetapkan"}</Link>
                              {s.standard && <ConfirmAction action={removeTargetStandard.bind(null, s.key)} label="Hapus" confirmText={`Hapus target standar ${s.label}?`} className="oa-btn oa-danger" />}
                            </>
                          ))}
                        </td>
                      </tr>
                    );
                  }),
                ])}
                {!all.length && <tr><td colSpan={5} className="muted">Belum ada produk.</td></tr>}
              </tbody>
            </table>
            <p className="small muted" style={{ padding: "8px 12px" }}>Saran dari data: <b>median</b> = hasil hari biasa, <b>atas</b> = hasil hari yang bagus (kuartil atas). Genteng memakai satu target gabungan semua jenis.</p>
          </div>
        )}
        {data.days.length > 0 && <p className="small muted">✓ Hari yang tercapai tidak perlu alasan. Alasan wajib bila hasil di bawah target.</p>}
      </section>
    </div>
  );
}
