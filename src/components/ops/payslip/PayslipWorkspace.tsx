"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateField, Select } from "@/components/ui";
import { downloadWorkbook } from "@/lib/ops/excel";
import {
  addDays,
  buildWeeklyItemRecap,
  formatRupiahSimple,
  formatSlipQty,
  nextFirst,
  nextThursday,
  PAY_KIND_LABEL,
  payPeriod,
  payslipTotals,
  periodPresets,
  periodText,
  type KasbonBalance,
  type PayGroup,
  type PayKind,
  type PayslipView,
  type SignerOption,
} from "@/lib/ops/payslip";
import { parseQty, parseRupiah } from "@/lib/erp/util";
import { deletePayslipAction, loadProductionPayAction, savePayslipAction } from "@/app/operasional/(panel)/gaji/actions";

type EarningForm = { quantity: string; description: string; rate: string };
type DeductionForm = { description: string; amount: string };
type SlipFormState = {
  id?: string;
  employeeName: string;
  slipDate: string;
  payKind: PayKind | "";
  periodFrom: string;
  periodTo: string;
  earnings: EarningForm[];
  deductions: DeductionForm[];
  kasbonNote: string;
  note: string;
  signerId: string;
  signerName: string;
};

const emptyEarning = (): EarningForm => ({ quantity: "", description: "", rate: "" });
const emptyDeduction = (): DeductionForm => ({ description: "", amount: "" });
const numInput = (v: number) => (v ? String(v).replace(".", ",") : "");
const rpInput = (v: number) => (v ? Math.round(v).toLocaleString("id-ID") : "");

function emptySlip(today: string, kind: PayKind | "" = "", defaultSigner?: SignerOption): SlipFormState {
  const slipDate = kind === "mingguan" ? nextThursday(today) : kind === "bulanan" ? nextFirst(today) : today;
  const period = kind ? payPeriod(kind, slipDate) : { from: "", to: "" };
  return {
    employeeName: "",
    slipDate,
    payKind: kind,
    periodFrom: period.from,
    periodTo: period.to,
    earnings: [emptyEarning()],
    deductions: [emptyDeduction()],
    kasbonNote: "",
    note: "",
    signerId: defaultSigner ? String(defaultSigner.id) : "",
    signerName: defaultSigner?.name ?? "",
  };
}

function slipToForm(slip: PayslipView, today: string, duplicate = false, defaultSigner?: SignerOption): SlipFormState {
  const payKind = slip.payKind ?? "";
  const slipDate = duplicate
    ? payKind === "mingguan"
      ? nextThursday(today)
      : payKind === "bulanan"
        ? nextFirst(today)
        : today
    : slip.slipDate;
  const period = payKind ? payPeriod(payKind, slipDate) : { from: "", to: "" };
  return {
    id: duplicate ? undefined : slip.id,
    employeeName: slip.employeeName,
    slipDate,
    payKind,
    periodFrom: duplicate ? period.from : (slip.periodFrom ?? period.from),
    periodTo: duplicate ? period.to : (slip.periodTo ?? period.to),
    earnings: slip.earnings.length
      ? slip.earnings.map((e) => ({
          quantity: e.legacy ? "1" : numInput(e.quantity) || "1",
          description: e.description,
          rate: rpInput(e.legacy ? e.amount : e.rate),
        }))
      : [emptyEarning()],
    deductions: slip.deductions.length
      ? slip.deductions.map((d) => ({ description: d.description, amount: rpInput(d.amount) }))
      : [emptyDeduction()],
    kasbonNote: duplicate ? "" : (slip.kasbonNote ?? ""),
    note: slip.note ?? "",
    signerId: slip.signerId ? String(slip.signerId) : (defaultSigner ? String(defaultSigner.id) : ""),
    signerName: slip.signerName ?? defaultSigner?.name ?? "",
  };
}

function longIndoDate(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  return new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PayslipWorkspace({
  today,
  canEdit,
  currentUserId,
  initialSlips,
  signers,
  kasbonBalances,
  initialRecapPayday,
  initialRecapGroups,
}: {
  today: string;
  canEdit: boolean;
  currentUserId: number;
  initialSlips: PayslipView[];
  signers: SignerOption[];
  kasbonBalances: KasbonBalance[];
  initialRecapPayday: string;
  initialRecapGroups: PayGroup[];
}) {
  const router = useRouter();
  const [slips, setSlips] = useState<PayslipView[]>(initialSlips);
  useEffect(() => {
    setSlips(initialSlips);
  }, [initialSlips]);

  // Default penanda tangan: Indana (admin pembuat) jika punya TTD, atau user login jika punya TTD.
  const defaultSigner = useMemo(
    () =>
      signers.find((s) => /indana/i.test(s.name) && s.signatureKey) ??
      signers.find((s) => s.id === currentUserId && s.signatureKey) ??
      signers.find((s) => s.signatureKey),
    [signers, currentUserId],
  );

  // Filter daftar slip: default "Semua" bila ada slip lama agar langsung terlihat, atau preset bisa diklik.
  const presets = useMemo(() => periodPresets(today), [today]);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<SlipFormState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const monthOptions = useMemo(() => {
    const set = new Set<string>([today.slice(0, 7)]);
    for (const s of slips) {
      if (/^\d{4}-\d{2}/.test(s.slipDate)) set.add(s.slipDate.slice(0, 7));
    }
    return [
      { value: "", label: "Semua bulan" },
      ...[...set]
        .sort((a, b) => b.localeCompare(a))
        .map((ym) => ({ value: ym, label: monthLabel(ym) })),
    ];
  }, [slips, today]);

  const filteredSlips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return slips.filter((s) => {
      if (filterMonth && !s.slipDate.startsWith(filterMonth)) return false;
      if (!filterMonth && filterFrom && s.slipDate < filterFrom) return false;
      if (!filterMonth && filterTo && s.slipDate > filterTo) return false;
      if (q && !s.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [slips, filterMonth, filterFrom, filterTo, search]);

  const summary = useMemo(
    () =>
      filteredSlips.reduce(
        (acc, slip) => {
          const t = payslipTotals(slip);
          return { income: acc.income + t.income, deduction: acc.deduction + t.deduction, net: acc.net + t.net };
        },
        { income: 0, deduction: 0, net: 0 },
      ),
    [filteredSlips],
  );

  const batchPrintUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filterMonth) params.set("month", filterMonth);
    else {
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
    }
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString();
    return `/operasional/cetak/gaji${qs ? `?${qs}` : ""}`;
  }, [filterMonth, filterFrom, filterTo, search]);

  // PaydayCard dates
  const nextThu = nextThursday(today);
  const prevThu = addDays(nextThu, -7);
  const next1st = nextFirst(today);
  const nextThuWeek = payPeriod("mingguan", nextThu);
  const prevThuWeek = payPeriod("mingguan", prevThu);
  const nextMonthPeriod = payPeriod("bulanan", next1st);
  const paydayCards = [
    {
      title: nextThu === today ? "Gajian Kamis — HARI INI" : "Gajian Kamis berikutnya",
      day: nextThu,
      sub: `Barang ${periodText(nextThuWeek.from, nextThuWeek.to)}`,
    },
    {
      title: "Gajian Kamis lalu",
      day: prevThu,
      sub: `Barang ${periodText(prevThuWeek.from, prevThuWeek.to)}`,
    },
    {
      title: next1st === today ? "Gajian tgl 1 — HARI INI" : "Gajian bulanan berikutnya",
      day: next1st,
      sub: `Periode ${monthLabel(nextMonthPeriod.from.slice(0, 7))}`,
    },
  ];

  const handleDelete = async (slip: PayslipView) => {
    if (!window.confirm(`Hapus slip gaji ${slip.employeeName} (${slip.slipDate})?`)) return;
    setBusyId(slip.id);
    const res = await deletePayslipAction(slip.id);
    setBusyId(null);
    if (!res.ok) {
      setNotice({ kind: "err", text: res.error });
      return;
    }
    setSlips((prev) => prev.filter((item) => item.id !== slip.id));
    setNotice({ kind: "ok", text: `Slip gaji ${slip.employeeName} dihapus.` });
    router.refresh();
  };

  const uniqueEmployees = useMemo(() => [...new Set(slips.map((s) => s.employeeName))], [slips]);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <style>{`
        .ps-paydays { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .ps-payday-btn { text-align: left; background: #fff; border: 1px solid var(--p-line); border-radius: var(--p-radius); padding: 14px 16px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: border-color .15s, box-shadow .15s; }
        .ps-payday-btn:hover { border-color: var(--biru); }
        .ps-payday-btn.is-on { border-color: var(--biru-tua); box-shadow: 0 0 0 2px rgba(14, 42, 107, .12); background: #f8faff; }
        .ps-payday-tag { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--oranye-cta); }
        .ps-payday-date { font-size: 16.5px; font-weight: 700; color: var(--biru-tua); }
        .ps-modal { border: 0; padding: 0; border-radius: var(--p-radius); width: min(920px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); box-shadow: 0 24px 60px rgba(14, 42, 107, .28); color: var(--tinta); background: #fff; margin: auto; }
        .ps-modal::backdrop { background: rgba(14, 42, 107, .48); }
        .ps-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: calc(100dvh - 24px); }
        .ps-cols { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14px; align-items: start; }
        .ps-box { border: 1px solid var(--p-line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #fafbfd; }
        .ps-box-in { border-color: #c5d7f2; background: #f4f8ff; }
        .ps-box-out { border-color: #f0d7ae; background: #fffaf2; }
        .ps-row-in { display: grid; grid-template-columns: 68px minmax(110px, 1fr) 104px 86px 34px; gap: 6px; align-items: center; }
        .ps-row-out { display: grid; grid-template-columns: minmax(120px, 1fr) 114px 34px; gap: 6px; align-items: center; }
        .ps-row-in input, .ps-row-out input { min-height: 38px; padding: 5px 9px; border: 1px solid var(--p-line-strong); border-radius: 8px; background: #fff; font: inherit; font-size: 14px; width: 100%; }
        .ps-prod-box { border: 1px solid #b6dfc9; background: #f2fbf6; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .ps-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .ps-total-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; background: var(--biru-tua); color: #fff; padding: 12px 16px; border-radius: 12px; }
        @media (max-width: 820px) {
          .ps-paydays { grid-template-columns: 1fr; }
          .ps-cols { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .ps-row-in { grid-template-columns: 60px 1fr 90px 34px; }
          .ps-row-in output { grid-column: 1 / -1; text-align: right; }
        }
      `}</style>

      {notice && (
        <div className={`alert ${notice.kind === "ok" ? "alert-ok" : "alert-error"}`} role="status">
          {notice.text}
        </div>
      )}

      {/* Tombol aksi utama */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {canEdit && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setEditing(emptySlip(today, "mingguan", defaultSigner))}
              >
                + Slip gajian Kamis
              </button>
              <button
                type="button"
                className="btn btn-blue btn-sm"
                onClick={() => setEditing(emptySlip(today, "bulanan", defaultSigner))}
              >
                + Slip gajian tgl 1
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditing(emptySlip(today, "", defaultSigner))}
              >
                + Slip lainnya
              </button>
            </>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href={`/operasional/cetak/rekap-gaji?payday=${nextThu}`} target="_blank" className="btn btn-ghost btn-sm">
            Cetak Rekap Barang Kamis
          </Link>
          {filteredSlips.length > 0 && (
            <Link href={batchPrintUrl} target="_blank" className="btn btn-ghost btn-sm">
              Cetak semua A5 ({filteredSlips.length})
            </Link>
          )}
        </div>
      </div>

      {/* PaydayCard */}
      <section className="ps-paydays" aria-label="Jadwal gajian">
        {paydayCards.map((card) => {
          const active = !filterMonth && filterFrom === card.day && filterTo === card.day;
          return (
            <button
              key={card.title}
              type="button"
              className={`ps-payday-btn${active ? " is-on" : ""}`}
              onClick={() => {
                setFilterMonth("");
                setFilterFrom(card.day);
                setFilterTo(card.day);
              }}
            >
              <span className="ps-payday-tag">{card.title}</span>
              <span className="ps-payday-date">{longIndoDate(card.day)}</span>
              <span className="small muted">{card.sub} · klik untuk lihat slip</span>
            </button>
          );
        })}
      </section>

      {/* Filter periode, bulan, dan pencarian nama */}
      <div className="filter-bar" style={{ marginBottom: 0 }}>
        <div className="seg" role="group" aria-label="Preset periode">
          {presets.map((p) => {
            const on = !filterMonth && filterFrom === p.from && filterTo === p.to;
            return (
              <button
                key={p.label}
                type="button"
                className={on ? "is-on" : undefined}
                onClick={() => {
                  setFilterMonth("");
                  setFilterFrom(p.from);
                  setFilterTo(p.to);
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="field" style={{ minWidth: 165 }}>
          <label htmlFor="ps-f-month">Bulan</label>
          <Select
            id="ps-f-month"
            value={filterMonth}
            onChange={(v) => {
              setFilterMonth(v);
              if (v) {
                setFilterFrom("");
                setFilterTo("");
              }
            }}
            options={monthOptions}
          />
        </div>
        <div className="field">
          <label htmlFor="ps-f-from">Dari tanggal</label>
          <DateField
            id="ps-f-from"
            value={filterFrom}
            onChange={(v) => {
              setFilterMonth("");
              setFilterFrom(v);
              if (v && !filterTo) setFilterTo(v);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="ps-f-to">Sampai tanggal</label>
          <DateField
            id="ps-f-to"
            value={filterTo}
            onChange={(v) => {
              setFilterMonth("");
              setFilterTo(v);
              if (v && !filterFrom) setFilterFrom(v);
            }}
          />
        </div>
        <div className="field grow">
          <label htmlFor="ps-f-q">Cari karyawan / grup</label>
          <input
            id="ps-f-q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik nama karyawan…"
          />
        </div>
      </div>

      {/* Ringkasan KPI */}
      <div className="kpis">
        <div className="stat">
          <span className="small muted">Jumlah slip</span>
          <b className="tabular">{filteredSlips.length}</b>
        </div>
        <div className="stat">
          <span className="small muted">Total pendapatan</span>
          <b className="tabular">Rp {formatRupiahSimple(summary.income)}</b>
        </div>
        <div className="stat">
          <span className="small muted">Total potongan</span>
          <b className="tabular">Rp {formatRupiahSimple(summary.deduction)}</b>
        </div>
        <div className="stat">
          <span className="small muted">Total diterima</span>
          <b className="tabular" style={{ color: "var(--sukses)" }}>
            Rp {formatRupiahSimple(summary.net)}
          </b>
        </div>
      </div>

      {/* Tabel Daftar Slip Gaji */}
      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Karyawan &amp; Periode</th>
              <th>Rincian pendapatan &amp; potongan</th>
              <th className="num">Pendapatan</th>
              <th className="num">Potongan</th>
              <th className="num">Diterima</th>
              <th>Kasbon / Pembuat</th>
              <th style={{ width: 220 }} />
            </tr>
          </thead>
          <tbody>
            {filteredSlips.map((slip) => {
              const t = payslipTotals(slip);
              return (
                <tr key={slip.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{slip.slipDate}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--biru-tua)" }}>{slip.employeeName}</div>
                    {slip.payKind && (
                      <div style={{ marginTop: 3 }}>
                        <span className="badge badge-info">
                          {PAY_KIND_LABEL[slip.payKind]} · {periodText(slip.periodFrom, slip.periodTo)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="small" style={{ maxWidth: 340 }}>
                    <div>
                      {slip.earnings.map((row, idx) => (
                        <span key={idx}>
                          {idx > 0 && " · "}
                          {row.legacy
                            ? `${row.description || "Pendapatan"} (Rp ${formatRupiahSimple(row.amount)})`
                            : `${formatSlipQty(row.quantity)} × ${row.description}${row.rate ? ` @${formatRupiahSimple(row.rate)}` : ""}`}
                        </span>
                      ))}
                    </div>
                    {slip.deductions.length > 0 && (
                      <div className="text-warn" style={{ marginTop: 2 }}>
                        Potongan:{" "}
                        {slip.deductions
                          .map((d) => `${d.description} Rp ${formatRupiahSimple(d.amount)}`)
                          .join(" · ")}
                      </div>
                    )}
                    {slip.note && <div className="muted" style={{ marginTop: 2 }}>{slip.note}</div>}
                  </td>
                  <td className="num tabular">{t.income ? `Rp ${formatRupiahSimple(t.income)}` : "—"}</td>
                  <td className="num tabular">{t.deduction ? `Rp ${formatRupiahSimple(t.deduction)}` : "—"}</td>
                  <td className="num tabular" style={{ fontWeight: 700, color: "var(--biru-tua)" }}>
                    Rp {formatRupiahSimple(t.net)}
                  </td>
                  <td className="small">
                    {slip.kasbonNote && <div style={{ whiteSpace: "pre-line" }}>{slip.kasbonNote}</div>}
                    <div className="muted">{slip.signerName || slip.createdByName || "—"}</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                      <Link href={`/operasional/cetak/gaji/${slip.id}`} target="_blank" className="btn btn-ghost btn-sm">
                        Cetak A5
                      </Link>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditing(slipToForm(slip, today, false, defaultSigner))}
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Buat slip baru dengan menyalin baris slip ini"
                            onClick={() => setEditing(slipToForm(slip, today, true, defaultSigner))}
                          >
                            Salin
                          </button>
                          <button
                            type="button"
                            className="link-btn"
                            disabled={busyId === slip.id}
                            onClick={() => handleDelete(slip)}
                          >
                            {busyId === slip.id ? "…" : "Hapus"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredSlips.length === 0 && (
              <tr>
                <td colSpan={8} className="muted" style={{ padding: 24, textAlign: "center" }}>
                  Belum ada slip gaji yang cocok dengan filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rekap Barang Gajian Kamis (Jumat–Kamis) */}
      <WeeklyItemRecap
        initialPayday={initialRecapPayday}
        initialGroups={initialRecapGroups}
      />

      {/* Dialog Buat / Ubah Slip Gaji */}
      {editing && (
        <SlipModal
          initial={editing}
          slips={slips}
          employees={uniqueEmployees}
          signers={signers}
          defaultSigner={defaultSigner}
          kasbonBalances={kasbonBalances}
          onClose={() => setEditing(null)}
          onSaved={(savedId, openPrint) => {
            setEditing(null);
            setNotice({ kind: "ok", text: "Slip gaji berhasil disimpan." });
            router.refresh();
            if (openPrint) {
              window.open(`/operasional/cetak/gaji/${savedId}`, "_blank", "noopener,noreferrer");
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Rekap barang gajian Kamis (Jumat–Kamis) per leader/grup: hasil produksi + cat genteng,
 * dilengkapi ekspor Excel (`downloadWorkbook`) dan tombol buka halaman cetak A5 (`/operasional/cetak/rekap-gaji`).
 */
function WeeklyItemRecap({
  initialPayday,
  initialGroups,
}: {
  initialPayday: string;
  initialGroups: PayGroup[];
}) {
  const [payday, setPayday] = useState(initialPayday);
  const [groups, setGroups] = useState<PayGroup[]>(initialGroups);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const firstRender = useRef(true);

  const period = useMemo(() => payPeriod("mingguan", payday), [payday]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let active = true;
    setLoading(true);
    setErr(null);
    loadProductionPayAction(period.from, period.to).then((res) => {
      if (!active) return;
      setLoading(false);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setGroups(res.groups);
    });
    return () => {
      active = false;
    };
  }, [period.from, period.to]);

  const recap = useMemo(() => buildWeeklyItemRecap(groups, { from: period.from, to: period.to, payday }), [groups, period.from, period.to, payday]);
  const printHref = `/operasional/cetak/rekap-gaji?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}&payday=${encodeURIComponent(payday)}`;

  const exportExcel = async () => {
    if (!groups.length) return;
    await downloadWorkbook(`Rekap-Barang-Gajian_${payday}.xlsx`, recap.sheets);
  };

  return (
    <section className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--biru-tua)" }}>Rekap barang gajian Kamis (Jumat–Kamis)</h2>
          <p className="small muted" style={{ margin: "2px 0 0" }}>
            Otomatis menjumlahkan hasil produksi &amp; cat genteng per leader dari <b>{period.from}</b> s/d <b>{period.to}</b> ({recap.totalGroups} grup · {recap.totalItems} jenis barang).
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="recap-payday">Tanggal gajian (Kamis)</label>
            <DateField id="recap-payday" value={payday} onChange={(v) => v && setPayday(v)} />
          </div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!groups.length} onClick={exportExcel}>
            Unduh Excel (.xlsx)
          </button>
          <Link href={printHref} target="_blank" className="btn btn-blue btn-sm">
            Cetak / PDF Rekap (A5)
          </Link>
        </div>
      </div>

      {err && <p className="alert alert-error">{err}</p>}

      {loading ? (
        <p className="small muted">Memuat rekap produksi &amp; cat genteng…</p>
      ) : groups.length === 0 ? (
        <p className="small muted">Belum ada catatan hasil produksi atau cat genteng pada rentang {periodText(period.from, period.to)}.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {groups.map((group) => (
            <div key={group.leader} style={{ border: "1px solid var(--p-line)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
              <div style={{ background: "var(--biru-tua)", color: "#fff", padding: "8px 12px", fontWeight: 700, fontSize: 13.5, display: "flex", justifyContent: "space-between" }}>
                <span>{group.leader.toUpperCase()}</span>
                <span style={{ opacity: 0.85, fontWeight: 500 }}>{group.items.length} barang</span>
              </div>
              <table className="compact" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>No</th>
                    <th>Barang</th>
                    <th className="num">Jumlah</th>
                    <th>Satuan</th>
                    <th className="num">Hari</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item, idx) => (
                    <tr key={item.description}>
                      <td className="muted">{idx + 1}</td>
                      <td>{item.description}</td>
                      <td className="num tabular" style={{ fontWeight: 700 }}>{formatSlipQty(item.quantity)}</td>
                      <td className="small">{item.unit}</td>
                      <td className="num tabular small">{item.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SlipModal({
  initial,
  slips,
  employees,
  signers,
  defaultSigner,
  kasbonBalances,
  onClose,
  onSaved,
}: {
  initial: SlipFormState;
  slips: PayslipView[];
  employees: string[];
  signers: SignerOption[];
  defaultSigner?: SignerOption;
  kasbonBalances: KasbonBalance[];
  onClose: () => void;
  onSaved: (id: string, openPrint: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<SlipFormState>(initial);
  const [prodGroups, setProdGroups] = useState<PayGroup[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) dlg.showModal();
  }, []);

  // Muat hasil produksi otomatis saat jenis gajian mingguan dan periode terisi.
  useEffect(() => {
    if (form.payKind !== "mingguan" || !form.periodFrom || !form.periodTo) {
      setProdGroups([]);
      return;
    }
    let active = true;
    setProdLoading(true);
    loadProductionPayAction(form.periodFrom, form.periodTo).then((res) => {
      if (!active) return;
      setProdLoading(false);
      if (res.ok) setProdGroups(res.groups);
    });
    return () => {
      active = false;
    };
  }, [form.payKind, form.periodFrom, form.periodTo]);

  const set = (patch: Partial<SlipFormState>) => setForm((cur) => ({ ...cur, ...patch }));
  const setEarning = (idx: number, patch: Partial<EarningForm>) =>
    setForm((cur) => ({
      ...cur,
      earnings: cur.earnings.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  const setDeduction = (idx: number, patch: Partial<DeductionForm>) =>
    setForm((cur) => ({
      ...cur,
      deductions: cur.deductions.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));

  const parsedEarnings = form.earnings
    .filter((r) => r.description.trim() || r.quantity.trim() || r.rate.trim())
    .map((r) => ({
      quantity: parseQty(r.quantity),
      description: r.description.trim(),
      rate: parseRupiah(r.rate),
    }));
  const parsedDeductions = form.deductions
    .filter((r) => r.description.trim() || r.amount.trim())
    .map((r) => ({
      description: r.description.trim(),
      amount: parseRupiah(r.amount),
    }));

  const totals = payslipTotals({
    earnings: parsedEarnings.map((e) => ({ ...e, amount: Math.round(e.quantity * e.rate) })),
    deductions: parsedDeductions,
  });

  // Slip sebelumnya untuk karyawan yang sama (untuk tombol salin cepat).
  const previousForEmployee = useMemo(() => {
    if (form.id || !form.employeeName.trim()) return undefined;
    const key = form.employeeName.trim().toUpperCase();
    return slips.find((s) => s.employeeName.trim().toUpperCase() === key);
  }, [form.id, form.employeeName, slips]);

  // Saldo kasbon belum lunas untuk karyawan ini.
  const owedKasbon = useMemo(() => {
    const key = form.employeeName.trim().toUpperCase();
    if (!key) return undefined;
    return kasbonBalances.find((k) => k.name.trim().toUpperCase() === key && k.sisa > 0);
  }, [form.employeeName, kasbonBalances]);

  // Lookup harga satuan terakhir per deskripsi barang (utamakan karyawan yang sama).
  const lookupRate = (description: string) => {
    const descKey = description.trim().toUpperCase();
    const empKey = form.employeeName.trim().toUpperCase();
    const prioritized = [...slips].sort(
      (a, b) => Number(b.employeeName.trim().toUpperCase() === empKey) - Number(a.employeeName.trim().toUpperCase() === empKey),
    );
    for (const s of prioritized) {
      const match = s.earnings.find((row) => !row.legacy && row.description.trim().toUpperCase() === descKey && row.rate > 0);
      if (match) return rpInput(match.rate);
    }
    return "";
  };

  const applyProductionGroup = (group: PayGroup) => {
    const rows: EarningForm[] = group.items.map((item) => {
      const desc = /^m[²³23]/i.test(item.unit) ? `${item.description} (${item.unit})` : item.description;
      return {
        quantity: numInput(item.quantity),
        description: desc,
        rate: lookupRate(desc),
      };
    });
    set({
      employeeName: form.employeeName.trim() || (group.leader.startsWith("(") ? "" : `${group.leader.toUpperCase()} GRUP`),
      earnings: rows.length ? rows : [emptyEarning()],
    });
  };

  const signerOptions = useMemo(
    () => [
      { value: "", label: "— Tanpa TTD (nama pembuat saja) —" },
      ...signers.map((s) => ({
        value: String(s.id),
        label: s.name,
        hint: s.signatureKey ? "TTD tersedia" : "belum ada gambar TTD",
      })),
    ],
    [signers],
  );

  const submit = async (openPrint: boolean) => {
    setErr(null);
    if (form.employeeName.trim().length < 2) {
      setErr("Isi nama karyawan / grup minimal 2 huruf.");
      return;
    }
    const validEarnings = parsedEarnings.filter((e) => e.description);
    if (!validEarnings.length) {
      setErr("Isi minimal satu baris pendapatan dengan keterangan barang/hari.");
      return;
    }
    setSaving(true);
    const res = await savePayslipAction({
      id: form.id,
      employeeName: form.employeeName.trim(),
      slipDate: form.slipDate,
      payKind: form.payKind || null,
      periodFrom: form.payKind ? form.periodFrom : null,
      periodTo: form.payKind ? form.periodTo : null,
      earnings: validEarnings,
      deductions: parsedDeductions.filter((d) => d.description || d.amount !== 0),
      kasbonNote: form.kasbonNote.trim() || null,
      note: form.note.trim() || null,
      signerId: form.signerId ? Number(form.signerId) : null,
      signerName: form.signerName.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    onSaved(res.id, openPrint);
  };

  const isThu = /^\d{4}-\d{2}-\d{2}$/.test(form.slipDate) && new Date(`${form.slipDate}T12:00:00Z`).getUTCDay() === 4;

  return (
    <dialog
      ref={dialogRef}
      className="ps-modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="ps-modal-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--biru-tua)" }}>
              {form.id ? "Ubah slip gaji" : "Buat slip gaji"}
            </h2>
            <p className="small muted" style={{ margin: "2px 0 0" }}>
              Format slip A5: Pendapatan (Banyak × Satuan) dikurangi Potongan = Total Diterima.
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Tutup" onClick={onClose}>
            ×
          </button>
        </div>

        {err && <div className="alert alert-error">{err}</div>}

        {/* Jenis gajian */}
        <div className="field">
          <span className="label">Jenis gajian</span>
          <div className="seg" role="group" aria-label="Jenis gajian">
            {(["mingguan", "bulanan", ""] as const).map((kind) => (
              <button
                key={kind || "lain"}
                type="button"
                className={form.payKind === kind ? "is-on" : undefined}
                onClick={() => {
                  if (!kind) {
                    set({ payKind: "", periodFrom: "", periodTo: "" });
                    return;
                  }
                  const slipDate = kind === "mingguan" ? nextThursday(form.slipDate) : nextFirst(form.slipDate);
                  const period = payPeriod(kind, slipDate);
                  set({ payKind: kind, slipDate, periodFrom: period.from, periodTo: period.to });
                }}
              >
                {kind ? PAY_KIND_LABEL[kind] : "Lainnya"}
              </button>
            ))}
          </div>
          {form.payKind === "mingguan" && (
            <span className="small muted">
              Gajian produksi tiap Kamis; barang dihitung Jumat–Kamis minggu itu.
              {!isThu && <b className="text-warn"> (Tanggal slip bukan hari Kamis)</b>}
            </span>
          )}
          {form.payKind === "bulanan" && (
            <span className="small muted">
              Gajian bulanan tiap tanggal 1 untuk bulan kalender sebelumnya.
              {!form.slipDate.endsWith("-01") && <b className="text-warn"> (Tanggal slip bukan tanggal 1)</b>}
            </span>
          )}
        </div>

        {/* Nama, tanggal, periode */}
        <div className="form-grid cols-4">
          <div className="field span-2">
            <label htmlFor="ps-emp">Nama karyawan / grup</label>
            <input
              id="ps-emp"
              list="ps-emp-list"
              value={form.employeeName}
              onChange={(e) => set({ employeeName: e.target.value })}
              placeholder="Ketik nama, mis. JULI GRUP, ADE, WAWAN G"
            />
            <datalist id="ps-emp-list">
              {employees.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {previousForEmployee && (
              <button
                type="button"
                className="link-btn"
                style={{ color: "var(--biru)", textAlign: "left", padding: "2px 0", fontSize: 13 }}
                onClick={() =>
                  set({
                    ...slipToForm(previousForEmployee, form.slipDate, true, defaultSigner),
                    employeeName: form.employeeName,
                    slipDate: form.slipDate,
                    periodFrom: form.periodFrom,
                    periodTo: form.periodTo,
                  })
                }
              >
                Salin dari slip terakhir {previousForEmployee.employeeName} ({previousForEmployee.slipDate})
              </button>
            )}
          </div>
          <div className="field">
            <label htmlFor="ps-date">Tanggal gajian</label>
            <DateField
              id="ps-date"
              value={form.slipDate}
              onChange={(slipDate) => {
                if (!slipDate || !form.payKind) {
                  set({ slipDate });
                  return;
                }
                const period = payPeriod(form.payKind, slipDate);
                set({ slipDate, periodFrom: period.from, periodTo: period.to });
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="ps-signer">Pembuat (TTD)</label>
            <Select
              id="ps-signer"
              value={form.signerId}
              onChange={(v) => {
                const found = signers.find((s) => String(s.id) === v);
                set({ signerId: v, signerName: found?.name ?? "" });
              }}
              options={signerOptions}
            />
          </div>
          {form.payKind && (
            <>
              <div className="field span-2">
                <label htmlFor="ps-pfrom">Periode dari</label>
                <DateField id="ps-pfrom" value={form.periodFrom} onChange={(v) => set({ periodFrom: v })} />
              </div>
              <div className="field span-2">
                <label htmlFor="ps-pto">Periode sampai</label>
                <DateField id="ps-pto" value={form.periodTo} onChange={(v) => set({ periodTo: v })} />
              </div>
            </>
          )}
        </div>

        {/* ProductionFill untuk gajian mingguan */}
        {form.payKind === "mingguan" && form.periodFrom && form.periodTo && (
          <div className="ps-prod-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <b className="small" style={{ color: "var(--biru-tua)" }}>
                Ambil otomatis dari hasil produksi &amp; cat genteng ({periodText(form.periodFrom, form.periodTo)})
              </b>
              {prodLoading && <span className="small muted">Memuat…</span>}
            </div>
            {!prodLoading && prodGroups.length === 0 ? (
              <span className="small muted">Belum ada hasil produksi atau cat genteng pada periode ini.</span>
            ) : (
              <div className="ps-chip-row">
                {prodGroups.map((group) => (
                  <button
                    key={group.leader}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ background: "#fff", borderColor: "#9fd2b5", fontSize: 12.5 }}
                    title={group.items.map((it) => `${formatSlipQty(it.quantity)} ${it.unit} · ${it.description}`).join("\n")}
                    onClick={() => applyProductionGroup(group)}
                  >
                    {group.leader} · {group.items.length} barang
                  </button>
                ))}
              </div>
            )}
            <span className="small muted" style={{ fontSize: 12 }}>
              Klik nama leader → baris pendapatan diisi jumlah barang Jumat–Kamis. Upah satuan (Rp) diambil otomatis dari slip sebelumnya bila ada.
            </span>
          </div>
        )}

        {/* Pendapatan & Potongan */}
        <div className="ps-cols">
          <div className="ps-box ps-box-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ color: "var(--biru-tua)" }}>Pendapatan</b>
              <span className="small tabular">Jumlah: <b>Rp {formatRupiahSimple(totals.income)}</b></span>
            </div>
            <div className="ps-row-in small muted" style={{ fontWeight: 600 }}>
              <span>Banyak</span>
              <span>Barang / Keterangan</span>
              <span className="num">Satuan (Rp)</span>
              <span className="num">Jumlah</span>
              <span />
            </div>
            {form.earnings.map((row, idx) => {
              const lineTotal = Math.round(parseQty(row.quantity) * parseRupiah(row.rate));
              return (
                <div key={idx} className="ps-row-in">
                  <input
                    aria-label={`Banyak baris ${idx + 1}`}
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(e) => setEarning(idx, { quantity: e.target.value })}
                    placeholder="1"
                  />
                  <input
                    aria-label={`Keterangan pendapatan baris ${idx + 1}`}
                    value={row.description}
                    onChange={(e) => setEarning(idx, { description: e.target.value })}
                    placeholder="GENTENG / HARI KERJA"
                  />
                  <input
                    aria-label={`Satuan Rp baris ${idx + 1}`}
                    className="num"
                    inputMode="numeric"
                    value={row.rate}
                    onChange={(e) => setEarning(idx, { rate: e.target.value })}
                    placeholder="150.000"
                  />
                  <output className="num tabular small" style={{ fontWeight: 700 }}>
                    {formatRupiahSimple(lineTotal)}
                  </output>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ minWidth: 32, minHeight: 34 }}
                    aria-label={`Hapus baris pendapatan ${idx + 1}`}
                    onClick={() =>
                      set({
                        earnings:
                          form.earnings.length > 1
                            ? form.earnings.filter((_, j) => j !== idx)
                            : [emptyEarning()],
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ background: "#fff" }}
                onClick={() => set({ earnings: [...form.earnings, emptyEarning()] })}
              >
                + Tambah baris pendapatan
              </button>
            </div>
          </div>

          <div className="ps-box ps-box-out">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ color: "var(--warn)" }}>Potongan &amp; Kasbon</b>
              <span className="small tabular">Jumlah: <b>Rp {formatRupiahSimple(totals.deduction)}</b></span>
            </div>
            <div className="ps-row-out small muted" style={{ fontWeight: 600 }}>
              <span>Keterangan</span>
              <span className="num">Jumlah (Rp)</span>
              <span />
            </div>
            {form.deductions.map((row, idx) => (
              <div key={idx} className="ps-row-out">
                <input
                  aria-label={`Keterangan potongan baris ${idx + 1}`}
                  value={row.description}
                  onChange={(e) => setDeduction(idx, { description: e.target.value })}
                  placeholder="POTONG KASBON"
                />
                <input
                  aria-label={`Jumlah potongan baris ${idx + 1}`}
                  className="num"
                  inputMode="numeric"
                  value={row.amount}
                  onChange={(e) => setDeduction(idx, { amount: e.target.value })}
                  placeholder="50.000"
                />
                <button
                  type="button"
                  className="icon-btn"
                  style={{ minWidth: 32, minHeight: 34 }}
                  aria-label={`Hapus baris potongan ${idx + 1}`}
                  onClick={() =>
                    set({
                      deductions:
                        form.deductions.length > 1
                          ? form.deductions.filter((_, j) => j !== idx)
                          : [emptyDeduction()],
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ background: "#fff" }}
                onClick={() => set({ deductions: [...form.deductions, emptyDeduction()] })}
              >
                + Tambah baris potongan
              </button>
            </div>

            {owedKasbon && (
              <div style={{ background: "#fff", border: "1px solid #eed7b0", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span>
                  Saldo kasbon <b>{owedKasbon.name}</b>: <b>Rp {formatRupiahSimple(owedKasbon.sisa)}</b>
                </span>
                <button
                  type="button"
                  className="link-btn"
                  style={{ color: "var(--biru)", padding: 0, fontSize: 12.5 }}
                  onClick={() => set({ kasbonNote: `${owedKasbon.name} : ${formatRupiahSimple(owedKasbon.sisa)}` })}
                >
                  Isi sisa kasbon
                </button>
                <button
                  type="button"
                  className="link-btn"
                  style={{ color: "var(--warn)", padding: 0, fontSize: 12.5 }}
                  onClick={() =>
                    set({
                      deductions: [
                        ...form.deductions.filter((r) => r.description.trim() || r.amount.trim()),
                        { description: "POTONG KASBON", amount: "" },
                      ],
                    })
                  }
                >
                  + Potong kasbon
                </button>
              </div>
            )}

            <div className="field">
              <label htmlFor="ps-kasbon-note">Sisa kasbon (ditulis di slip)</label>
              <textarea
                id="ps-kasbon-note"
                rows={2}
                value={form.kasbonNote}
                onChange={(e) => set({ kasbonNote: e.target.value })}
                placeholder={"JULI : 50.000\nULUNG : 300.000"}
              />
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ps-note">Catatan tambahan (opsional)</label>
          <input
            id="ps-note"
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="Mis. gaji minggu ke-2 November"
          />
        </div>

        <div className="ps-total-bar">
          <span>Total diterima</span>
          <b style={{ fontSize: 22 }} className="tabular">
            Rp {formatRupiahSimple(totals.net)}
          </b>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="button" className="btn btn-blue" disabled={saving} onClick={() => submit(false)}>
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => submit(true)}>
            {saving ? "Menyimpan…" : "Simpan & cetak A5"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
