// Membaca mutasi rekening koran dari tabel (hasil CSV/Excel) — tanpa server-only, dipakai di browser & tes.
// Format yang dikenali:
//  - KlikBCA Individu (CSV): baris info "Periode : 01/11/2026 - 25/11/2026", lalu kolom
//    Tanggal Transaksi | Keterangan | Cabang | Jumlah | (DB/CR) | Saldo. Tanggal "01/11", "PEND" = tertunda (dilewati).
//  - KlikBCA Bisnis / e-statement / bank lain: Tanggal | Keterangan | Mutasi/Jumlah (+DB/CR) | Saldo,
//    atau kolom Debet & Kredit terpisah.
// Angka boleh format "1,500,000.00" atau "1.500.000,00"; minus / DB = uang keluar.

export type StatementLine = { date: string; description: string; amount: number; balance: number | null };
export type ParsedStatement = { lines: StatementLine[]; skipped: number; accountNo: string | null; period: { from: string; to: string } | null; warnings: string[] };

const clean = (v: unknown) => String(v ?? "").replace(/^'+/, "").replace(/\s+/g, " ").trim();

/** "1,500,000.00" | "1.500.000,00" | "(1.500)" | "1,500,000.00 DB" → angka bulat (rupiah) bertanda. */
export function parseAmount(raw: unknown): number | null {
  let s = clean(raw).toUpperCase();
  if (!s) return null;
  let sign = 1;
  if (/\bDB\b|\bD\b$|^-|\(.*\)/.test(s)) sign = -1;
  s = s.replace(/\b(CR|DB|D|K)\b/g, "").replace(/[()\s-]|RP/g, "");
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma > -1 && lastDot > -1) {
    // Pemisah desimal = yang paling akhir.
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot > -1) {
    normalized = /\.\d{1,2}$/.test(s) && (s.match(/\./g) ?? []).length === 1 ? s : s.replace(/\./g, "");
  } else normalized = s;
  const n = Number(normalized.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) * sign : null;
}

/** "01/11", "01/11/2026", "01-11-26", "2026-11-01", angka serial Excel → "2026-11-01". */
export function parseDate(raw: unknown, year: number | null): string | null {
  const s = clean(raw);
  if (!s || /^PEND/i.test(s)) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/.exec(s);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = m[3] ? Number(m[3]) : year;
  if (y == null) return null;
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const findCol = (head: string[], re: RegExp) => head.findIndex((h) => re.test(h));

export function parseStatement(table: unknown[][], fallbackYear: number | null = null): ParsedStatement {
  const rows = table.map((r) => (Array.isArray(r) ? r.map(clean) : []));
  const warnings: string[] = [];
  let accountNo: string | null = null;
  let period: ParsedStatement["period"] = null;
  let year = fallbackYear;
  // Info di atas tabel (KlikBCA): no. rekening & periode.
  for (const r of rows.slice(0, 15)) {
    const line = r.join(" ");
    const acc = /no\.?\s*rek(?:ening)?\s*:?\s*'?([\d-]{6,})/i.exec(line);
    if (acc) accountNo = acc[1];
    const per = /periode\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(line);
    if (per) {
      const from = parseDate(per[1], null);
      const to = parseDate(per[2], null);
      if (from && to) { period = { from, to }; year = Number(to.slice(0, 4)); }
    }
  }
  const headIdx = rows.findIndex((r) => r.some((c) => /tanggal|tgl|date/i.test(c)) && r.some((c) => /keterangan|uraian|deskripsi|description|remark/i.test(c)));
  if (headIdx < 0) return { lines: [], skipped: rows.length, accountNo, period, warnings: ["Judul kolom (Tanggal & Keterangan) tidak ditemukan."] };
  const head = rows[headIdx].map((h) => h.toLowerCase());
  const cDate = findCol(head, /tanggal|tgl|date/);
  const cDesc = findCol(head, /keterangan|uraian|deskripsi|description|remark/);
  const cDebit = findCol(head, /^(debet|debit|db|keluar|penarikan|withdrawal)/);
  const cCredit = findCol(head, /^(kredit|credit|cr|masuk|setoran|deposit)/);
  const cAmount = findCol(head, /jumlah|mutasi|nominal|amount/);
  const cBal = findCol(head, /saldo|balance/);
  // Kolom DB/CR tanpa judul (KlikBCA) = kolom setelah Jumlah.
  const cSign = cAmount > -1 ? cAmount + 1 : -1;
  if (cDate < 0 || (cAmount < 0 && cDebit < 0 && cCredit < 0)) warnings.push("Kolom jumlah tidak dikenali.");
  if (year == null) warnings.push("Tahun tidak ada di file; dipakai tahun dari periode yang dipilih.");
  const lines: StatementLine[] = [];
  let skipped = 0;
  for (const r of rows.slice(headIdx + 1)) {
    const date = parseDate(r[cDate], year);
    if (!date) { skipped++; continue; }
    let amount: number | null = null;
    if (cDebit > -1 || cCredit > -1) {
      const d = cDebit > -1 ? Math.abs(parseAmount(r[cDebit]) ?? 0) : 0;
      const c = cCredit > -1 ? Math.abs(parseAmount(r[cCredit]) ?? 0) : 0;
      amount = c - d;
    } else if (cAmount > -1) {
      const raw = r[cAmount] ?? "";
      const sign = (r[cSign] ?? "").toUpperCase();
      amount = parseAmount(/^(DB|CR|D|K)$/.test(sign) ? `${raw} ${sign}` : raw);
    }
    if (!amount) { skipped++; continue; }
    lines.push({ date, description: r[cDesc] ?? "", amount, balance: cBal > -1 ? parseAmount(r[cBal]) : null });
  }
  return { lines, skipped, accountNo, period, warnings };
}

/** Sidik jari baris (anti-dobel): tanggal|jumlah|saldo|keterangan|urutan kemunculan yang sama di file. */
export function fingerprints(lines: StatementLine[]) {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const base = `${l.date}|${l.amount}|${l.balance ?? ""}|${l.description.toLowerCase().replace(/\s+/g, " ").slice(0, 120)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}|${n}`;
  });
}
