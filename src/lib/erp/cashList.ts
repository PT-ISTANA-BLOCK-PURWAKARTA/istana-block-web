import "server-only";
// Daftar Kas Keluar / Kas Masuk / Transfer gaya Zahir: transaksi kas web + histori jurnal impor Zahir
// (CD = kas keluar, CR = kas masuk, TR = transfer kas).
import { sql } from "drizzle-orm";
import type { DB } from "./server";

export type CashListKind = "keluar" | "masuk" | "transfer";
export type CashListRow = { key: string; id: string; href: string; date: string; number: string; party: string; memo: string; amount: number; zahir: boolean; draft: boolean };

const ZAHIR_PREFIX: Record<CashListKind, string> = { keluar: "CD%", masuk: "CR%", transfer: "TR%" };
const HONORIFIC = /^(KA|KAK|PAK|BPK\.?|BAPAK|IBU|IBU\.|BU|MANG|TEH|TETEH|MBAK|MAS|A|H\.?|HJ\.?|PT\.?|CV\.?|PD\.?|UD\.?|TB\.?|TOKO)$/i;

/** "Pengeluaran, KA MAMAT JATAH IZIN SAKIT" → "KA MAMAT" (Zahir menulis penerima di awal keterangan). */
export function partyFromMemo(memo: string) {
  const to = memo.match(/^(?:Pembayaran kepada|Penerimaan dari)\s+(.+?)(?:,|$)/i);
  if (to) return to[1].trim().slice(0, 40);
  const rest = memo.includes(",") ? memo.slice(memo.indexOf(",") + 1).trim() : memo.trim();
  const words = rest.split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const out = [words[0]];
  for (let i = 1; i < words.length && HONORIFIC.test(out[out.length - 1]); i++) out.push(words[i]);
  return out.join(" ");
}

export async function cashList(db: DB, kind: CashListKind, from: string, to: string, q: string) {
  const like = q ? `%${q}%` : null;
  const web = await db.all<{ id: string; date: string; number: string; memo: string; amount: number; party: string | null; status: string }>(sql`
    select t.id, t.date, t.number, t.memo, t.amount, c.name party, t.status
      from fin_cash_txns t left join fin_contacts c on c.id = t.contact_id
     where t.kind = ${kind} and t.date >= ${from} and t.date <= ${to}
       and (${like} is null or t.number like ${like} or t.memo like ${like} or c.name like ${like})
     order by t.date desc, t.number desc limit 1000`);
  const zahir = await db.all<{ id: string; date: string; number: string; memo: string; amount: number }>(sql`
    select j.id, j.date, j.number,
           trim(j.memo || ' ' || coalesce((select l.memo from fin_journal_lines l where l.journal_id = j.id and l.memo <> '' order by l.sort limit 1), '')) memo,
           (select coalesce(sum(l.debit), 0) from fin_journal_lines l where l.journal_id = j.id) amount
      from fin_journals j
     where j.source = 'zahir' and j.number like ${ZAHIR_PREFIX[kind]} and j.date >= ${from} and j.date <= ${to}
       and (${like} is null or j.number like ${like} or j.memo like ${like}
            or exists (select 1 from fin_journal_lines l where l.journal_id = j.id and l.memo like ${like}))
     order by j.date desc, j.number desc limit 3000`);
  const rows: CashListRow[] = [
    ...web.map((r) => ({ key: `k${r.id}`, id: r.id, draft: r.status === "draft", href: `/akuntansi/kas/${r.id}`, date: r.date, number: r.number, party: r.party ?? partyFromMemo(r.memo), memo: r.memo, amount: Number(r.amount), zahir: false })),
    ...zahir.map((r) => ({ key: `z${r.id}`, id: r.id, draft: false, href: `/akuntansi/jurnal/${r.id}`, date: r.date, number: r.number, party: partyFromMemo(r.memo), memo: r.memo, amount: Number(r.amount), zahir: true })),
  ].sort((a, b) => (a.date === b.date ? b.number.localeCompare(a.number) : b.date.localeCompare(a.date)));
  return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

/** Isi jendela Data Nama & Data Proyek untuk form kas. */
export async function cashPickers(db: DB, keepContactId?: string | null) {
  const keep = keepContactId ?? "";
  const [contacts, projects] = await Promise.all([
    db.all<{ id: string; code: string; name: string; kind: string }>(sql`
      select id, code, name, kind from fin_contacts where active = 1 or id = ${keep}
       order by case when code = '' then 1 else 0 end, code, name`),
    db.all<{ id: string; code: string; name: string; customer: string | null }>(sql`
      select p.id, p.code, p.name, c.name customer from fin_projects p left join fin_contacts c on c.id = p.contact_id
       where p.active = 1 order by p.code`),
  ]);
  return {
    contacts: contacts.map((c) => ({ ...c, kind: c.kind as "pelanggan" | "pemasok" | "keduanya" | "karyawan" })),
    projects: projects.map((p) => ({ ...p, customer: p.customer ?? "" })),
  };
}
