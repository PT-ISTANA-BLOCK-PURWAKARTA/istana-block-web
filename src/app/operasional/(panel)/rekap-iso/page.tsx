import Link from "next/link";
import { Ok, PageHead } from "@/components/erp/ui";
import { DateField } from "@/components/ui";
import { FormsTab } from "@/components/ops/iso/FormsTab";
import { ExportAllButton } from "@/components/ops/iso/IsoExportButtons";
import { IsoRecordForm } from "@/components/ops/iso/IsoRecordForm";
import { ObjectiveForm } from "@/components/ops/iso/ObjectiveForm";
import { ObjectivesTab } from "@/components/ops/iso/ObjectivesTab";
import { SummaryTab } from "@/components/ops/iso/SummaryTab";
import { sortRows } from "@/components/ops/iso/sortRows";
import { isoUrl, type IsoTab, type IsoView } from "@/components/ops/iso/url";
import { getDb } from "@/db";
import { canInputForm, getManualRecord, isoAccess, isoOverview, isoPresets, isoSuggestions, listIsoRows, objectiveMonth, parseRange, SUGGESTION_FORMS, todayWib, type IsoRow } from "@/lib/ops/iso";
import { FORM_BY_CODE, ISO_FORMS, type IsoCode, type IsoValues } from "@/lib/ops/shared/isoForms";
import { QUALITY_OBJECTIVES } from "@/lib/ops/shared/isoObjectives";
import { monthsInRange, rangeText } from "@/lib/ops/shared/isoRecap";
import "./rekap-iso.css";

export const metadata = { title: "Rekap ISO" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TABS: { key: IsoTab; label: string }[] = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "sasaran", label: "Sasaran Mutu" },
  { key: "form", label: "Form F-IB" },
];

export default async function Halaman({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, canCustomers, canObjective, isOffice } = await isoAccess();
  const sp = await searchParams;
  const today = todayWib();
  const { range, error } = parseRange(one(sp.dari), one(sp.sampai), today);
  const tab: IsoTab = one(sp.tab) === "sasaran" ? "sasaran" : one(sp.tab) === "form" ? "form" : "ringkasan";
  const forms = ISO_FORMS.filter((f) => f.code !== "F-IB-01" || canCustomers);
  const wanted = one(sp.form);
  const code: IsoCode = (forms.find((f) => f.code === wanted) ?? forms.find((f) => f.code === "F-IB-02") ?? forms[0]).code;
  const offset = tab === "form" ? Math.max(0, Math.floor(Number(one(sp.offset))) || 0) : 0;
  const view: IsoView = { range, tab, code, offset };
  const here = isoUrl(view);

  const db = await getDb();
  const overview = await isoOverview(db, range);

  // ---- tab Form F-IB
  let formsTab: React.ReactNode = null;
  if (tab === "form") {
    const form = FORM_BY_CODE[code];
    const canInput = canInputForm(user.roles, form);
    const supplementable = form.columns.some((c) => c.supplement);
    const page = await listIsoRows(db, { code, from: range.from, to: range.to, offset });
    const rows: IsoRow[] = sortRows(form, page.rows);
    const suggestions = canInput && SUGGESTION_FORMS.includes(code) ? await isoSuggestions(db, { code, from: range.from, to: range.to }) : [];

    const aksi = one(sp.aksi);
    let editor: React.ReactNode = null;
    if (aksi === "tambah" && form.manual && canInput) {
      const saran = suggestions.find((s) => s.from === one(sp.saran));
      editor = <IsoRecordForm key={`tambah-${saran?.from ?? ""}`} code={code} mode="tambah" initial={saran?.values ?? {}} from={saran?.from} userName={user.name} today={today} back={here} cancelHref={here} />;
    } else if (aksi === "ubah" && form.manual && canInput) {
      const record = await getManualRecord(db, code, one(sp.id) ?? "");
      if (record) {
        const initial: IsoValues = { ...record.data };
        if (one(sp.selesai) === "1" && code === "F-IB-06") initial.terakhir = today;
        editor = <IsoRecordForm key={`ubah-${record.id}-${one(sp.selesai) ?? ""}`} code={code} mode="ubah" recordId={record.id} number={record.number} initial={initial} userName={user.name} today={today} back={here} cancelHref={here} />;
      }
    } else if (aksi === "lengkapi" && canInput && supplementable) {
      const row = rows.find((r) => r.source === "app" && r.key === one(sp.key));
      if (row) editor = <IsoRecordForm key={`lengkapi-${row.key}`} code={code} mode="lengkapi" sourceKey={row.key} initial={row.values} userName={user.name} today={today} back={here} cancelHref={here} />;
    }

    formsTab = (
      <FormsTab
        view={view} forms={forms} counts={overview.counts} form={form} rows={rows} nextOffset={page.nextOffset}
        canInput={canInput} isOffice={isOffice} userId={user.id} userName={user.name} today={today} suggestions={suggestions} editor={editor}
      />
    );
  }

  // ---- tab Sasaran Mutu
  let objectivesTab: React.ReactNode = null;
  if (tab === "sasaran") {
    const defaultMonth = range.to.slice(0, 7);
    let editor: React.ReactNode = null;
    const isi = Number(one(sp.isi));
    const objective = canObjective ? QUALITY_OBJECTIVES.find((o) => o.no === isi && (!o.auto || o.manualAchieved)) : undefined;
    if (objective) {
      const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(one(sp.bulan) ?? "") ? (one(sp.bulan) as string) : defaultMonth;
      const current = (await objectiveMonth(db, bulan)).find((e) => e.no === objective.no);
      editor = (
        <ObjectiveForm
          key={`${objective.no}-${bulan}`} no={objective.no} text={objective.text} basis={objective.basis} targetLabel={objective.targetLabel} target={objective.target} pic={objective.pic}
          totalAuto={objective.manualAchieved === true} month={bulan} initial={{ total: current?.total ?? null, achieved: current?.achieved ?? null, note: current?.note ?? null }}
          back={here} cancelHref={here} keep={{ dari: range.from, sampai: range.to, tab: "sasaran", isi: String(objective.no) }}
        />
      );
    }
    objectivesTab = <ObjectivesTab overview={overview} range={range} canEdit={canObjective} defaultMonth={defaultMonth} editor={editor} />;
  }

  const presets = isoPresets(today);
  const months = monthsInRange(range).length;

  return (
    <>
      <PageHead title="Rekap ISO" sub="Rekaman mutu ISO 9001 & SNI: form F-IB-01 s/d F-IB-16 dalam satu tempat. Data PO, produksi, mix desain, uji tekan, dan barang masuk masuk otomatis; form lainnya diisi langsung di sini. Pilih rentang tanggal, lalu unduh Excel dalam format form yang sama.">
        <ExportAllButton range={range} codes={forms.map((f) => f.code)} printedBy={user.name} />
      </PageHead>
      <Ok ok={one(sp.ok)} />
      {error && <p className="alert alert-warn" role="status" style={{ marginBottom: 16 }}>{error}</p>}

      <form className="filter-bar" method="get">
        <input type="hidden" name="tab" value={tab} />
        {tab === "form" && <input type="hidden" name="form" value={code} />}
        <div className="field"><label htmlFor="iso-dari">Dari tanggal</label><DateField id="iso-dari" name="dari" defaultValue={range.from} required /></div>
        <div className="field"><label htmlFor="iso-sampai">Sampai tanggal</label><DateField id="iso-sampai" name="sampai" defaultValue={range.to} required /></div>
        <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        <div className="presets">
          {presets.map((p) => (
            <Link key={p.key} href={isoUrl({ range: p.range, tab, code })} aria-current={p.range.from === range.from && p.range.to === range.to ? "page" : undefined}>{p.label}</Link>
          ))}
        </div>
        <p className="small muted" style={{ marginLeft: "auto" }}>Periode <b>{rangeText(range)}</b>{months > 1 ? ` · ${months} bulan` : ""}</p>
      </form>

      <nav className="seg" aria-label="Bagian Rekap ISO" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <Link key={t.key} href={isoUrl({ range, tab: t.key, code })} aria-current={t.key === tab ? "page" : undefined}>{t.label}</Link>
        ))}
      </nav>

      {tab === "ringkasan" && <SummaryTab overview={overview} range={range} visible={forms.map((f) => f.code)} />}
      {objectivesTab}
      {formsTab}

      <p className="small muted" style={{ marginTop: 20 }}>
        File form asli: folder “Data Form Istana Block” (Rev. 00, terbit 15/10/2026). Alamat di form tertulis No.121 — samakan dengan dokumen lain sebelum audit.
      </p>
    </>
  );
}
