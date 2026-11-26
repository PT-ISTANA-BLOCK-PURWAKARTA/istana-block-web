// Operational U-Ditch (dulu "Cashflow U-Ditch", app.kirim /uditch): buku kas proyek per sumber dana & kategori.
// Tab: Transaksi (filter + tambah/ubah), Per kategori (kolom per sumber dana), Per bulan, Kontrabon IB.
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { ActionButton } from "@/components/erp/ActionButton";
import { PrintButton } from "@/components/erp/PrintButton";
import { ZahirForm, zDate, zn } from "@/components/erp/report/ZahirForm";
import { Kpis, PageHead } from "@/components/erp/ui";
import { KontrabonForm, UditchEntryForm } from "@/components/ops/UditchForms";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { isDate, today } from "@/lib/erp/util";
import { ACCOUNT_BY_KEY, accountSummary, categoriesFor, categoryLabel, categoryMatrix, headline, monthlySummary, UDITCH_ACCOUNTS, UDITCH_GROUPS, UDITCH_PICS } from "@/lib/ops/uditch";
import { can } from "@/lib/roles";
import { deleteKontrabon, deleteUditchEntry } from "./actions";

export const metadata = { title: "Operational U-Ditch" };
export const dynamic = "force-dynamic";

type Tab = "transaksi" | "kategori" | "bulan" | "kontrabon";
const TABS: [Tab, string][] = [["transaksi", "Transaksi"], ["kategori", "Per kategori"], ["bulan", "Per bulan"], ["kontrabon", "Kontrabon IB"]];
const monthText = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

export default async function OperationalUditch({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string; akun?: string; arah?: string; kategori?: string; q?: string; ubah?: string; baru?: string; kb?: string; ok?: string }> }) {
  const user = await requireModule("anak");
  const canEdit = can(user.roles, "keuangan");
  const sp = await searchParams;
  const tab: Tab = (TABS.map((x) => x[0]) as string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "transaksi";
  const t = today();
  const presets = [
    { label: "Bulan ini", from: `${t.slice(0, 7)}-01`, to: t },
    { label: "Bulan lalu", from: new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10) },
    { label: "Tahun ini", from: `${t.slice(0, 4)}-01-01`, to: t },
    { label: "Semua", from: "2025-01-01", to: `${Number(t.slice(0, 4)) + 1}-12-31` },
  ];
  const from = isDate(sp.from) ? sp.from : presets[3].from;
  const to = isDate(sp.to) ? sp.to : presets[3].to;
  const db = await getDb();
  const all = (await db.select().from(schema.uditchEntries).where(sql`entry_date >= ${from} and entry_date <= ${to}`).orderBy(desc(schema.uditchEntries.entryDate), desc(schema.uditchEntries.createdAt)))
    .map((e) => ({ ...e, total: Number(e.total ?? 0) }));
  const fundOf = (acc: string) => (ACCOUNT_BY_KEY as Record<string, { fund: string; label: string } | undefined>)[acc];
  const scoped = all.filter((e) => !sp.akun || e.account === sp.akun || fundOf(e.account)?.fund === sp.akun);
  const q = (sp.q ?? "").toLowerCase().trim();
  const list = scoped.filter((e) => (!sp.arah || e.direction === sp.arah) && (!sp.kategori || (sp.kategori === "-" ? !e.category : e.category === sp.kategori)) && (!q || `${e.item} ${e.party ?? ""} ${e.note ?? ""} ${e.remark ?? ""} ${e.pic ?? ""}`.toLowerCase().includes(q)));
  const h = headline(scoped);
  const accSum = accountSummary(scoped);
  const kontrabon = await db.all<{ id: string; label: string; amount: number; note: string | null }>(sql`select id, label, amount, note from ops_uditch_kontrabon order by position`);
  const allTime = await db.all<{ account: string; s: number }>(sql`select account, sum(total) s from ops_uditch_entries where direction = 'keluar' and coalesce(category, '') <> 'X01' and account in ('tf_ib','cash_ib','kontrabon_ib') group by account`);
  const ibPaid = (k: string) => Number(allTime.find((a) => a.account === k)?.s ?? 0);
  const loans = kontrabon.reduce((s, k) => s + Number(k.amount), 0);
  const paid = ibPaid("tf_ib") + ibPaid("cash_ib") + ibPaid("kontrabon_ib");
  const accountOpts = UDITCH_ACCOUNTS.map((a) => ({ value: a.key, label: a.label }));
  const catOpts = (d: "masuk" | "keluar") => categoriesFor(d).map((c) => ({ value: c.code, label: `${c.code} · ${c.label}`, group: UDITCH_GROUPS[c.group as keyof typeof UDITCH_GROUPS] }));
  const editing = sp.ubah ? all.find((e) => e.id === sp.ubah) : undefined;
  const editKb = sp.kb ? kontrabon.find((k) => k.id === sp.kb) : undefined;
  const qs = (p: Record<string, string | undefined>) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries({ tab, from, to, akun: sp.akun, arah: sp.arah, kategori: sp.kategori, q: sp.q, ...p })) if (v) u.set(k, v); return `?${u}`; };
  const period = `${zDate(from)} – ${zDate(to > t ? t : to)}`;

  return (
    <>
      <div className="no-print">
        <PageHead title="Operational U-Ditch" sub="Buku kas proyek U-Ditch (PIC Lina): uang masuk & keluar per sumber dana dan kategori, kontrabon dengan Istana Block.">
          {canEdit && tab === "transaksi" && <Link href={qs({ baru: "1" })} className="btn btn-primary btn-sm">+ Transaksi</Link>}
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        {sp.ok && <p className="alert alert-ok">Tersimpan.</p>}
        <form method="get" className="filter-bar">
          <input type="hidden" name="tab" value={tab} />
          <div className="field"><label htmlFor="u-f">Dari</label><input id="u-f" type="date" name="from" defaultValue={from} /></div>
          <div className="field"><label htmlFor="u-t">Sampai</label><input id="u-t" type="date" name="to" defaultValue={to} /></div>
          <div className="field"><label htmlFor="u-a">Sumber dana</label><select id="u-a" name="akun" defaultValue={sp.akun ?? ""}><option value="">Semua</option><optgroup label="Kelompok"><option value="lina">Lina (TF + Cash)</option><option value="ib">IB (TF + Cash)</option></optgroup><optgroup label="Rekening">{UDITCH_ACCOUNTS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</optgroup></select></div>
          {tab === "transaksi" && <>
            <div className="field"><label htmlFor="u-d">Arah</label><select id="u-d" name="arah" defaultValue={sp.arah ?? ""}><option value="">Semua</option><option value="masuk">Masuk</option><option value="keluar">Keluar</option></select></div>
            <div className="field"><label htmlFor="u-k">Kategori</label><select id="u-k" name="kategori" defaultValue={sp.kategori ?? ""}><option value="">Semua</option><option value="-">Belum dikategorikan</option>{[...categoriesFor("masuk"), ...categoriesFor("keluar")].map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}</select></div>
            <div className="field grow"><label htmlFor="u-q">Cari</label><input id="u-q" name="q" defaultValue={sp.q} placeholder="barang, nama, keterangan…" /></div>
          </>}
          <button className="btn btn-blue btn-sm">Tampilkan</button>
          {presets.map((p) => <Link key={p.label} href={qs({ from: p.from, to: p.to })} className={`btn btn-ghost btn-sm${p.from === from && p.to === to ? " is-on" : ""}`}>{p.label}</Link>)}
        </form>
        <nav className="zt-tabs">{TABS.map(([k, l]) => <Link key={k} href={qs({ tab: k })} aria-current={k === tab ? "page" : undefined}>{l}</Link>)}</nav>
        {canEdit && (sp.baru || editing) && tab === "transaksi" && (
          <section className="zd-card" style={{ marginBottom: 16 }}>
            <h2>{editing ? "Ubah transaksi" : "Transaksi baru"}</h2>
            <UditchEntryForm key={editing?.id ?? "baru"} value={editing ? { ...editing, total: Number(editing.total), qty: editing.qty == null ? null : Number(editing.qty), price: editing.price == null ? null : Number(editing.price) } : { entryDate: t, account: "cash_lina", direction: "keluar", item: "", qty: 1, party: null, price: null, total: null, category: null, note: null, remark: null, pic: null }} accounts={accountOpts} categoriesIn={catOpts("masuk")} categoriesOut={catOpts("keluar")} pics={[...UDITCH_PICS]} />
            <p className="small"><Link href={qs({})}>Tutup form</Link></p>
          </section>
        )}
      </div>

      <ZahirForm company="Proyek U-Ditch · Istana Block" title={`Operational U-Ditch — ${TABS.find((x) => x[0] === tab)![1]}`} period={period}>
        <Kpis items={[
          { label: "Pemasukan", value: zn(h.pemasukan, true), sub: `penjualan ${zn(h.penjualan, true)}` },
          { label: "A. Biaya proyek U-Ditch", value: zn(h.biayaProyek, true) },
          { label: "B. Proyek lain", value: zn(h.proyekLain, true) },
          { label: "C. Mutasi dana & pinjaman", value: zn(h.mutasi, true) },
          { label: "Saldo kas + bank Lina", value: zn(h.saldoKas, true), tone: h.saldoKas < 0 ? "bad" : "ok" },
          { label: "Dana IB terpakai", value: zn(h.danaIb, true), sub: h.tempo ? `tempo/DO ${zn(h.tempo, true)}` : undefined },
          ...(h.belumKategori ? [{ label: "Belum dikategorikan", value: zn(h.belumKategori, true), tone: "warn" as const }] : []),
        ]} />
        <h3 className="zf-h3">Per sumber dana</h3>
        <table className="zf-table">
          <thead><tr><th>Sumber dana</th><th className="num">Masuk</th><th className="num">Keluar</th><th className="num">Saldo</th><th className="num">Transaksi</th></tr></thead>
          <tbody>{accSum.filter((a) => a.count).map((a) => <tr key={a.key}><td><Link href={qs({ akun: a.key, tab: "transaksi" })}>{a.label}</Link><em className="zf-sub">{a.hint}</em></td><td className="num">{zn(a.masuk)}</td><td className="num">{zn(a.keluar)}</td><td className="num">{a.kind === "kas" ? zn(a.saldo, true) : "-"}</td><td className="num">{a.count}</td></tr>)}</tbody>
        </table>

        {tab === "transaksi" && (
          <>
            <h3 className="zf-h3">Transaksi ({list.length.toLocaleString("id-ID")}){list.length > 1000 ? " — 1.000 teratas, persempit filter" : ""}</h3>
            <table className="zf-table">
              <thead><tr><th className="zf-c-date">Tanggal</th><th>Sumber</th><th>Uraian / nama barang</th><th className="num">Jml</th><th>Nama</th><th className="num">Harga</th><th>Kategori</th><th>PIC</th><th className="num">Masuk</th><th className="num">Keluar</th>{canEdit && <th className="no-print" />}</tr></thead>
              <tbody>
                {list.slice(0, 1000).map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{zDate(e.entryDate)}</td>
                    <td className="small">{fundOf(e.account)?.label ?? e.account}</td>
                    <td>{e.item}{(e.note || e.remark) && <em className="zf-sub">{[e.note, e.remark].filter(Boolean).join(" · ")}</em>}</td>
                    <td className="num">{e.qty ?? ""}</td><td className="small">{e.party ?? ""}</td><td className="num">{e.price ? zn(Number(e.price)) : ""}</td>
                    <td className="small">{e.category ? `${e.category} ${categoryLabel(e.category)}` : <span className="text-bahaya">belum</span>}</td><td className="small">{e.pic ?? ""}</td>
                    <td className="num">{e.direction === "masuk" ? zn(e.total) : ""}</td><td className="num">{e.direction === "keluar" ? zn(e.total) : ""}</td>
                    {canEdit && <td className="nowrap small no-print"><Link href={qs({ ubah: e.id })}>Ubah</Link> <ActionButton action={deleteUditchEntry.bind(null, e.id)} label="Hapus" confirmText={`Hapus transaksi ${e.item}?`} className="link-btn" /></td>}
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={11}>Tidak ada transaksi.</td></tr>}
              </tbody>
              <tfoot><tr className="zf-total"><td colSpan={8}>Jumlah</td><td className="num">{zn(list.filter((e) => e.direction === "masuk").reduce((s, e) => s + e.total, 0), true)}</td><td className="num">{zn(list.filter((e) => e.direction === "keluar").reduce((s, e) => s + e.total, 0), true)}</td>{canEdit && <td className="no-print" />}</tr></tfoot>
            </table>
          </>
        )}

        {tab === "kategori" && (["keluar", "masuk"] as const).map((kind) => {
          const matrix = categoryMatrix(scoped, kind);
          const idx = UDITCH_ACCOUNTS.map((_, i) => i).filter((i) => matrix.some((m) => m.perAccount[i].count));
          return matrix.length ? (
            <section key={kind}>
              <h3 className="zf-h3">{kind === "keluar" ? "Pengeluaran per kategori" : "Pemasukan per kategori"}</h3>
              <table className="zf-table">
                <thead><tr><th>Kategori</th>{idx.map((i) => <th key={i} className="num">{UDITCH_ACCOUNTS[i].label}</th>)}<th className="num">Total</th><th className="num">Trx</th></tr></thead>
                <tbody>{matrix.map((m) => <tr key={m.code ?? "-"} className={m.group === "C" || m.group === "X" ? "muted" : undefined}><td><Link href={qs({ tab: "transaksi", kategori: m.code ?? "-", arah: kind })}><b>{m.code ?? "-"}</b> {m.label}</Link></td>{idx.map((i) => <td key={i} className="num">{m.perAccount[i].total ? zn(m.perAccount[i].total) : "-"}</td>)}<td className="num"><b>{zn(m.total, true)}</b></td><td className="num">{m.count}</td></tr>)}</tbody>
                <tfoot><tr className="zf-total"><td>Jumlah</td>{idx.map((i) => <td key={i} className="num">{zn(matrix.reduce((s, m) => s + m.perAccount[i].total, 0), true)}</td>)}<td className="num">{zn(matrix.reduce((s, m) => s + m.total, 0), true)}</td><td className="num">{matrix.reduce((s, m) => s + m.count, 0)}</td></tr></tfoot>
              </table>
            </section>
          ) : null;
        })}

        {tab === "bulan" && (
          <>
            <h3 className="zf-h3">Per bulan</h3>
            <table className="zf-table">
              <thead><tr><th>Bulan</th><th className="num">Pemasukan</th><th className="num">Biaya proyek (A)</th><th className="num">Proyek lain (B)</th><th className="num">Mutasi (C)</th><th className="num">Dana IB</th><th className="num">Saldo kas bulan itu</th></tr></thead>
              <tbody>{monthlySummary(scoped).map((m) => <tr key={m.month}><td>{monthText(m.month)}</td><td className="num">{zn(m.pemasukan)}</td><td className="num">{zn(m.biayaProyek)}</td><td className="num">{zn(m.proyekLain)}</td><td className="num">{zn(m.mutasi)}</td><td className="num">{zn(m.danaIb)}</td><td className="num">{zn(m.saldoKas, true)}</td></tr>)}</tbody>
              <tfoot><tr className="zf-total"><td>Jumlah</td><td className="num">{zn(h.pemasukan, true)}</td><td className="num">{zn(h.biayaProyek, true)}</td><td className="num">{zn(h.proyekLain, true)}</td><td className="num">{zn(h.mutasi, true)}</td><td className="num">{zn(h.danaIb, true)}</td><td className="num">{zn(h.saldoKas, true)}</td></tr></tfoot>
            </table>
          </>
        )}

        {tab === "kontrabon" && (
          <>
            <Kpis items={[
              { label: "Dipinjamkan ke IB (kontrabon)", value: zn(loans, true) },
              { label: "Dibayar IB (TF IB + Cash IB + Kontrabon IB)", value: zn(paid, true), sub: `TF ${zn(ibPaid("tf_ib"), true)} · Cash ${zn(ibPaid("cash_ib"), true)} · Kontrabon ${zn(ibPaid("kontrabon_ib"), true)}` },
              { label: "Sisa hutang IB", value: zn(loans - paid, true), tone: loans - paid > 0 ? "warn" : "ok" },
            ]} />
            {canEdit && <div className="no-print" style={{ margin: "10px 0" }}><KontrabonForm key={editKb?.id ?? "baru"} value={editKb ? { ...editKb, amount: Number(editKb.amount) } : undefined} /></div>}
            <table className="zf-table">
              <thead><tr><th>Rincian pinjaman ke IB</th><th className="num">Jumlah</th>{canEdit && <th className="no-print" />}</tr></thead>
              <tbody>
                {kontrabon.map((k) => <tr key={k.id}><td>{k.label}{k.note && <em className="zf-sub">{k.note}</em>}</td><td className="num">{zn(Number(k.amount), true)}</td>{canEdit && <td className="nowrap small no-print"><Link href={qs({ kb: k.id })}>Ubah</Link> <ActionButton action={deleteKontrabon.bind(null, k.id)} label="Hapus" confirmText="Hapus kontrabon ini?" className="link-btn" /></td>}</tr>)}
              </tbody>
              <tfoot>
                <tr className="zf-total"><td>Total dipinjamkan ke IB</td><td className="num">{zn(loans, true)}</td>{canEdit && <td className="no-print" />}</tr>
                <tr><td>Dikurangi: dibayar IB (TF IB + Cash IB + Kontrabon IB)</td><td className="num">-{zn(paid, true)}</td>{canEdit && <td className="no-print" />}</tr>
                <tr className="zf-total"><td>Sisa hutang IB</td><td className="num">{zn(loans - paid, true)}</td>{canEdit && <td className="no-print" />}</tr>
              </tfoot>
            </table>
            <p className="small muted">Setiap transaksi di sumber dana TF IB / Cash IB / Kontrabon IB otomatis mengurangi hutang ini (seluruh periode). Pengembalian uang dari IB ke rekening Lina dicatat sebagai uang masuk kategori pengembalian pinjaman.</p>
          </>
        )}
      </ZahirForm>
    </>
  );
}
