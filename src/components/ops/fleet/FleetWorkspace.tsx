"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PhotoLightboxGrid } from "@/components/ImageLightbox";
import { PhotoPicker } from "@/components/ops/receipts/PhotoPicker";
import { DateField, Select, type SelectOption } from "@/components/ui";
import { daysBetween, isDate, monthStart, parseRupiah, tgl, yearStart } from "@/lib/erp/util";
import { downloadWorkbook } from "@/lib/ops/excel";
import type {
  FleetAlert,
  FleetExpenseRow,
  FleetVehicleRow,
  SubcategoryRow,
  TempoGroup,
  TripGroup,
} from "@/lib/ops/fleet";
import {
  APPROVAL_THRESHOLD,
  berkasUrl,
  FLEET_FUNDS,
  FLEET_KIND_BY_KEY,
  FLEET_KINDS,
  FLEET_MECHANICS,
  FLEET_PAYMENTS,
  FLEET_PLACES,
  FLEET_START_DATE,
  FLEET_SUBCATEGORIES,
  fundLabelOf,
  isCounted,
  isIncome,
  isTempoPayment,
  MAINTENANCE_KINDS,
  MAX_FLEET_PHOTOS,
  placeOf,
  RENT_PAYMENTS,
  SERVICE_EXTRAS,
  TRIP_COSTS,
  type FleetKind,
} from "@/lib/ops/shared/fleet";
import {
  approveFleetExpense,
  deleteFleetExpense,
  deleteFleetTrip,
  markTempoPaid,
  saveFleetExpense,
  saveFleetTrip,
} from "@/app/anak-usaha/(panel)/biaya-armada/actions";
import "./fleet.css";

interface FleetWorkspaceProps {
  initialExpenses: FleetExpenseRow[];
  vehicles: FleetVehicleRow[];
  alerts: FleetAlert[];
  initialFrom: string;
  initialTo: string;
  todayDate: string;
  canEdit: boolean;
  canApprove: boolean;
}

type TabKey = "notes" | "recap" | "subcategory" | "trips";

interface LineDraft {
  item: string;
  qty: string;
  price: string;
}

function rp(n: number): string {
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  return `${neg ? "-" : ""}Rp ${abs.toLocaleString("id-ID")}`;
}

function TempoBadge({
  payment,
  dueDate,
  tempoPaidAt,
  todayDate,
}: {
  payment: string;
  dueDate: string;
  tempoPaidAt: string | null;
  todayDate: string;
}) {
  if (tempoPaidAt) {
    return <span className="fl-badge fl-badge-ok">Lunas tempo</span>;
  }
  if (!isTempoPayment(payment)) return null;
  if (!dueDate || !isDate(dueDate) || !isDate(todayDate)) {
    return <span className="fl-badge fl-badge-warn">Tempo</span>;
  }
  const left = daysBetween(todayDate, dueDate);
  if (left < 0) {
    return <span className="fl-badge fl-badge-err">Lewat {Math.abs(left)} hr</span>;
  }
  if (left === 0) {
    return <span className="fl-badge fl-badge-err">Jatuh tempo hari ini</span>;
  }
  if (left <= 3) {
    return <span className="fl-badge fl-badge-warn">Tempo H-{left}</span>;
  }
  return <span className="fl-badge fl-badge-info">Tempo · {tgl(dueDate)}</span>;
}

function AccBadge({ status, note }: { status: string; note?: string }) {
  if (status === "menunggu") {
    return <span className="fl-badge fl-badge-warn">Menunggu ACC</span>;
  }
  if (status === "ditolak") {
    return (
      <span className="fl-badge fl-badge-err" title={note || "Ditolak"}>
        Ditolak
      </span>
    );
  }
  if (status === "disetujui") {
    return <span className="fl-badge fl-badge-ok">Disetujui</span>;
  }
  return null;
}

export function FleetWorkspace({
  initialExpenses,
  vehicles,
  alerts,
  initialFrom,
  initialTo,
  todayDate,
  canEdit,
  canApprove,
}: FleetWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Navigasi rentang tanggal
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);

  useEffect(() => {
    setFromDate(initialFrom);
    setToDate(initialTo);
  }, [initialFrom, initialTo]);

  // Filter client
  const [tab, setTab] = useState<TabKey>("notes");
  const [vehFilter, setVehFilter] = useState("ALL");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [fundFilter, setFundFilter] = useState("ALL");
  const [payFilter, setPayFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Pesan status
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Tolak ACC inline
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // Modal Catat / Ubah Transaksi
  const entryDialogRef = useRef<HTMLDialogElement>(null);
  const [editingRow, setEditingRow] = useState<FleetExpenseRow | null>(null);
  const [entryDate, setEntryDate] = useState(todayDate);
  const [entryKind, setEntryKind] = useState<string>("solar");
  const [entrySub, setEntrySub] = useState<string>("");
  const [entryVeh, setEntryVeh] = useState<string>("UMUM");
  const [entryDriver, setEntryDriver] = useState("");
  const [entryShop, setEntryShop] = useState("");
  const [entryPlace, setEntryPlace] = useState<string>("Bengkel luar");
  const [entryMechanic, setEntryMechanic] = useState("");
  const [entryParty, setEntryParty] = useState("");
  const [entryPayment, setEntryPayment] = useState<string>("Transfer");
  const [entryFund, setEntryFund] = useState<string>("ib");
  const [entryDueDate, setEntryDueDate] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [entryExistingPhotos, setEntryExistingPhotos] = useState<string[]>([]);
  const [entryLines, setEntryLines] = useState<LineDraft[]>([{ item: "", qty: "1", price: "" }]);
  const [serviceExtras, setServiceExtras] = useState<Record<string, string>>({});
  const [pickerKey, setPickerKey] = useState(0);

  // Modal Perjalanan (Trip)
  const tripDialogRef = useRef<HTMLDialogElement>(null);
  const [editingTripRef, setEditingTripRef] = useState("");
  const [tripDate, setTripDate] = useState(todayDate);
  const [tripVeh, setTripVeh] = useState(vehicles[0]?.id || "UMUM");
  const [tripDriver, setTripDriver] = useState("");
  const [tripDest, setTripDest] = useState("");
  const [tripPayment, setTripPayment] = useState<string>("Cash (Cepi)");
  const [tripFund, setTripFund] = useState<string>("cepi");
  const [tripDueDate, setTripDueDate] = useState("");
  const [tripNote, setTripNote] = useState("");
  const [tripCosts, setTripCosts] = useState<Record<string, string>>({});
  const [tripExistingPhotos, setTripExistingPhotos] = useState<string[]>([]);
  const [tripPickerKey, setTripPickerKey] = useState(0);

  function applyRange(nextFrom: string, nextTo: string) {
    const safeFrom = nextFrom < FLEET_START_DATE ? FLEET_START_DATE : nextFrom;
    setFromDate(safeFrom);
    setToDate(nextTo);
    const params = new URLSearchParams();
    if (safeFrom) params.set("from", safeFrom);
    if (nextTo) params.set("to", nextTo);
    router.push(`/anak-usaha/biaya-armada?${params.toString()}`);
  }

  function applyPreset(preset: "this_month" | "last_month" | "this_year" | "since_start") {
    if (preset === "this_month") {
      const s = monthStart(todayDate);
      applyRange(s < FLEET_START_DATE ? FLEET_START_DATE : s, todayDate);
    } else if (preset === "last_month") {
      const [y, m] = todayDate.split("-").map(Number);
      const prevEnd = new Date(Date.UTC(y, m - 1, 0));
      const prevStart = new Date(Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), 1));
      const s = prevStart.toISOString().slice(0, 10);
      const e = prevEnd.toISOString().slice(0, 10);
      applyRange(s < FLEET_START_DATE ? FLEET_START_DATE : s, e);
    } else if (preset === "this_year") {
      const s = yearStart(todayDate);
      applyRange(s < FLEET_START_DATE ? FLEET_START_DATE : s, todayDate);
    } else {
      applyRange(FLEET_START_DATE, todayDate);
    }
  }

  // Opsi Select filter
  const vehicleFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: "ALL", label: "Semua kendaraan" },
      { value: "UMUM", label: "Umum / semua kendaraan" },
      ...vehicles.map((v) => ({
        value: v.id,
        label: `${v.plate} · ${v.name}`,
        hint: v.active ? undefined : "Nonaktif",
      })),
    ],
    [vehicles],
  );

  const kindFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: "ALL", label: "Semua jenis" },
      { value: "INCOME_ONLY", label: "Pendapatan saja" },
      { value: "EXPENSE_ONLY", label: "Biaya saja" },
      ...FLEET_KINDS.map((k) => ({ value: k.key, label: k.label, group: k.group })),
    ],
    [],
  );

  const subFilterOptions: SelectOption[] = useMemo(() => {
    const subs = new Set<string>();
    for (const r of initialExpenses) if (r.subcategory) subs.add(r.subcategory);
    if (kindFilter !== "ALL" && FLEET_SUBCATEGORIES[kindFilter]) {
      for (const s of FLEET_SUBCATEGORIES[kindFilter]) subs.add(s);
    }
    return [
      { value: "ALL", label: "Semua subkategori" },
      ...[...subs].sort().map((s) => ({ value: s, label: s })),
    ];
  }, [initialExpenses, kindFilter]);

  const fundFilterOptions: SelectOption[] = useMemo(
    () => [{ value: "ALL", label: "Semua dana" }, ...FLEET_FUNDS.map((f) => ({ value: f.key, label: f.label }))],
    [],
  );

  const payFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: "ALL", label: "Semua pembayaran" },
      { value: "TEMPO_OPEN", label: "Tempo belum lunas" },
      { value: "TEMPO_PAID", label: "Tempo sudah lunas" },
      { value: "PENDING_ACC", label: "Menunggu ACC" },
      ...FLEET_PAYMENTS.map((p) => ({ value: p, label: p })),
    ],
    [],
  );

  // Filter rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialExpenses.filter((r) => {
      if (vehFilter === "UMUM" && r.vehicleId) return false;
      if (vehFilter !== "ALL" && vehFilter !== "UMUM" && r.vehicleId !== vehFilter) return false;

      if (kindFilter === "INCOME_ONLY" && !isIncome(r.kind)) return false;
      if (kindFilter === "EXPENSE_ONLY" && isIncome(r.kind)) return false;
      if (kindFilter !== "ALL" && kindFilter !== "INCOME_ONLY" && kindFilter !== "EXPENSE_ONLY" && r.kind !== kindFilter) {
        return false;
      }

      if (subFilter !== "ALL" && r.subcategory !== subFilter) return false;
      if (fundFilter !== "ALL" && r.fund !== fundFilter) return false;

      if (payFilter === "TEMPO_OPEN" && (!isTempoPayment(r.payment) || r.tempoPaidAt)) return false;
      if (payFilter === "TEMPO_PAID" && !r.tempoPaidAt) return false;
      if (payFilter === "PENDING_ACC" && r.approvalStatus !== "menunggu") return false;
      if (
        payFilter !== "ALL" &&
        payFilter !== "TEMPO_OPEN" &&
        payFilter !== "TEMPO_PAID" &&
        payFilter !== "PENDING_ACC" &&
        r.payment !== payFilter
      ) {
        return false;
      }

      if (q) {
        const hay = [
          r.vehicleLabel,
          r.item,
          r.subcategory,
          r.shop,
          r.driverName,
          r.destination,
          r.party,
          r.note,
          r.tripRef,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialExpenses, vehFilter, kindFilter, subFilter, fundFilter, payFilter, search]);

  // Agregasi KPI, Pending ACC, Tempo, Rekap, Subkategori, Perjalanan
  const summary = useMemo(() => {
    let sewa = 0;
    let pendapatan = 0;
    let biaya = 0;
    let tempoTotal = 0;
    let tempoCount = 0;
    let accTotal = 0;
    const pendingAcc: FleetExpenseRow[] = [];

    for (const r of filteredRows) {
      if (r.approvalStatus === "menunggu") {
        accTotal += r.total;
        pendingAcc.push(r);
        continue;
      }
      if (!isCounted(r)) continue;
      if (r.kind === "sewa") sewa += r.total;
      else if (r.kind === "pendapatan") pendapatan += r.total;
      else {
        biaya += r.total;
        if (isTempoPayment(r.payment) && !r.tempoPaidAt) {
          tempoTotal += r.total;
          tempoCount += 1;
        }
      }
    }
    return {
      sewa,
      pendapatan,
      biaya,
      profit: sewa + pendapatan - biaya,
      tempoTotal,
      tempoCount,
      accTotal,
      pendingAcc,
    };
  }, [filteredRows]);

  const openTempoItems: TempoGroup[] = useMemo(() => {
    const map = new Map<string, TempoGroup>();
    for (const r of filteredRows) {
      if (!isCounted(r) || isIncome(r.kind)) continue;
      if (!isTempoPayment(r.payment) || r.tempoPaidAt) continue;

      const isTrip = Boolean(r.tripRef);
      const key = isTrip ? `trip:${r.tripRef}` : `id:${r.id}`;
      const due = r.dueDate || r.entryDate;
      const dl = isDate(due) && isDate(todayDate) ? daysBetween(todayDate, due) : null;
      const overdue = dl !== null && dl < 0;
      const dueSoon = dl !== null && dl >= 0 && dl <= 3;

      const ex = map.get(key);
      if (ex) {
        ex.total += r.total;
        if (!ex.dueDate && r.dueDate) ex.dueDate = r.dueDate;
      } else {
        map.set(key, {
          key,
          isTrip,
          id: isTrip ? null : r.id,
          tripRef: r.tripRef,
          entryDate: r.entryDate,
          dueDate: r.dueDate,
          daysLeft: dl,
          overdue,
          dueSoon,
          vehicleId: r.vehicleId,
          vehicleLabel: r.vehicleLabel,
          shop: r.shop,
          party: r.party,
          item: isTrip ? `Perjalanan ${r.destination || r.tripRef}` : r.item,
          payment: r.payment,
          fund: r.fund,
          total: r.total,
        });
      }
    }
    return [...map.values()].sort((a, b) => (a.dueDate || a.entryDate).localeCompare(b.dueDate || b.entryDate));
  }, [filteredRows, todayDate]);

  const recapRows = useMemo(() => {
    const byVeh = new Map<string, string>();
    for (const v of vehicles) byVeh.set(v.id, `${v.plate} · ${v.name}`);

    const map = new Map<
      string,
      {
        vehicleId: string | null;
        vehicleLabel: string;
        sewa: number;
        pendapatan: number;
        operasional: number;
        perawatan: number;
        admin: number;
        totalBiaya: number;
        net: number;
        count: number;
      }
    >();

    for (const r of filteredRows) {
      if (!isCounted(r)) continue;
      const key = r.vehicleId ? `v:${r.vehicleId}` : `u:${r.vehicleLabel || "Umum"}`;
      let row = map.get(key);
      if (!row) {
        row = {
          vehicleId: r.vehicleId,
          vehicleLabel: (r.vehicleId ? byVeh.get(r.vehicleId) : null) || r.vehicleLabel || "Umum / semua kendaraan",
          sewa: 0,
          pendapatan: 0,
          operasional: 0,
          perawatan: 0,
          admin: 0,
          totalBiaya: 0,
          net: 0,
          count: 0,
        };
        map.set(key, row);
      }
      row.count += 1;
      if (r.kind === "sewa") row.sewa += r.total;
      else if (r.kind === "pendapatan") row.pendapatan += r.total;
      else {
        const grp = FLEET_KIND_BY_KEY[r.kind as FleetKind]?.group;
        if (grp === "Operasional") row.operasional += r.total;
        else if (grp === "Perawatan") row.perawatan += r.total;
        else row.admin += r.total;
        row.totalBiaya += r.total;
      }
      row.net = row.sewa + row.pendapatan - row.totalBiaya;
    }
    return [...map.values()].sort((a, b) => b.totalBiaya - a.totalBiaya || b.sewa - a.sewa);
  }, [filteredRows, vehicles]);

  const subcategoryRows: SubcategoryRow[] = useMemo(() => {
    const map = new Map<string, SubcategoryRow>();
    for (const r of filteredRows) {
      if (!isCounted(r)) continue;
      const info = FLEET_KIND_BY_KEY[r.kind as FleetKind];
      const sub = r.subcategory || "(Tanpa subkategori)";
      const key = `${r.kind}::${sub}`;
      let row = map.get(key);
      if (!row) {
        row = {
          kind: r.kind,
          kindLabel: info?.label || r.kind,
          subcategory: sub,
          count: 0,
          total: 0,
          income: info?.income === true,
        };
        map.set(key, row);
      }
      row.count += 1;
      row.total += r.total;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  const tripGroups: TripGroup[] = useMemo(() => {
    const map = new Map<string, TripGroup>();
    for (const r of filteredRows) {
      if (!r.tripRef) continue;
      let g = map.get(r.tripRef);
      if (!g) {
        g = {
          tripRef: r.tripRef,
          entryDate: r.entryDate,
          vehicleId: r.vehicleId,
          vehicleLabel: r.vehicleLabel,
          driverName: r.driverName,
          destination: r.destination,
          payment: r.payment,
          fund: r.fund,
          dueDate: r.dueDate,
          tempoPaidAt: r.tempoPaidAt,
          tempoPaidByName: r.tempoPaidByName,
          note: r.note,
          photoKeys: [...r.photoKeys],
          approvalStatus: r.approvalStatus,
          costs: {},
          total: 0,
          rows: [],
        };
        map.set(r.tripRef, g);
      }
      g.costs[r.kind] = (g.costs[r.kind] || 0) + r.total;
      if (isCounted(r)) g.total += r.total;
      if (r.approvalStatus === "menunggu") g.approvalStatus = "menunggu";
      g.rows.push(r);
    }
    return [...map.values()].sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }, [filteredRows]);

  // Helper membuka modal Entry
  function openNewEntry(defaultKind: string) {
    setEditingRow(null);
    setEntryDate(todayDate < FLEET_START_DATE ? FLEET_START_DATE : todayDate);
    setEntryKind(defaultKind);
    setEntrySub(FLEET_SUBCATEGORIES[defaultKind]?.[0] || "");
    setEntryVeh(vehicles.find((v) => v.active)?.id || "UMUM");
    setEntryDriver("");
    setEntryShop("");
    setEntryPlace("Bengkel luar");
    setEntryMechanic("");
    setEntryParty("");
    setEntryPayment(isIncome(defaultKind) ? "Lunas" : "Transfer");
    setEntryFund(isIncome(defaultKind) ? "ib" : "cepi");
    setEntryDueDate("");
    setEntryNote("");
    setEntryExistingPhotos([]);
    setEntryLines([{ item: "", qty: "1", price: "" }]);
    setServiceExtras({});
    setPickerKey((k) => k + 1);
    entryDialogRef.current?.showModal();
  }

  function openEditEntry(row: FleetExpenseRow) {
    setEditingRow(row);
    setEntryDate(row.entryDate);
    setEntryKind(row.kind);
    setEntrySub(row.subcategory || FLEET_SUBCATEGORIES[row.kind]?.[0] || "");
    setEntryVeh(row.vehicleId || "UMUM");
    setEntryDriver(row.driverName);
    setEntryShop(row.shop);
    setEntryPlace(row.place || placeOf(row.kind, row.place));
    setEntryMechanic(row.mechanic);
    setEntryParty(row.party);
    setEntryPayment(row.payment || (isIncome(row.kind) ? "Lunas" : "Transfer"));
    setEntryFund(row.fund || "ib");
    setEntryDueDate(row.dueDate || "");
    setEntryNote(row.note);
    setEntryExistingPhotos([...row.photoKeys]);
    setEntryLines([
      {
        item: row.item,
        qty: String(row.qty || 1),
        price: String(row.price || row.total),
      },
    ]);
    setServiceExtras({});
    setPickerKey((k) => k + 1);
    entryDialogRef.current?.showModal();
  }

  function openNewTrip() {
    setEditingTripRef("");
    setTripDate(todayDate < FLEET_START_DATE ? FLEET_START_DATE : todayDate);
    const activeVeh = vehicles.find((v) => v.active);
    setTripVeh(activeVeh?.id || "UMUM");
    setTripDriver(activeVeh?.lastDriver || "");
    setTripDest("");
    setTripPayment("Cash (Cepi)");
    setTripFund("cepi");
    setTripDueDate("");
    setTripNote("");
    setTripCosts({});
    setTripExistingPhotos([]);
    setTripPickerKey((k) => k + 1);
    tripDialogRef.current?.showModal();
  }

  function openEditTrip(group: TripGroup) {
    setEditingTripRef(group.tripRef);
    setTripDate(group.entryDate);
    setTripVeh(group.vehicleId || "UMUM");
    setTripDriver(group.driverName);
    setTripDest(group.destination);
    setTripPayment(group.payment || "Cash (Cepi)");
    setTripFund(group.fund || "cepi");
    setTripDueDate(group.dueDate || "");
    setTripNote(group.note);
    const nextCosts: Record<string, string> = {};
    for (const c of TRIP_COSTS) {
      if (group.costs[c.key]) nextCosts[c.key] = String(group.costs[c.key]);
    }
    setTripCosts(nextCosts);
    setTripExistingPhotos([...group.photoKeys]);
    setTripPickerKey((k) => k + 1);
    tripDialogRef.current?.showModal();
  }

  const entryTotalPreview = useMemo(() => {
    const linesSum = entryLines.reduce((sum, l) => {
      const q = Math.max(0.01, Number(l.qty.replace(",", ".")) || 1);
      const p = parseRupiah(l.price);
      return sum + Math.round(q * p);
    }, 0);
    const extrasSum =
      entryKind === "servis" && !editingRow
        ? SERVICE_EXTRAS.reduce((sum, ex) => sum + parseRupiah(serviceExtras[ex.key] || ""), 0)
        : 0;
    return linesSum + extrasSum;
  }, [entryLines, serviceExtras, entryKind, editingRow]);

  const tripTotalPreview = useMemo(
    () => TRIP_COSTS.reduce((sum, c) => sum + parseRupiah(tripCosts[c.key] || ""), 0),
    [tripCosts],
  );

  function handleEntryKindChange(nextKind: string) {
    setEntryKind(nextKind);
    const subs = FLEET_SUBCATEGORIES[nextKind] || [];
    setEntrySub(subs[0] || "");
    if (isIncome(nextKind)) {
      if (!RENT_PAYMENTS.includes(entryPayment as (typeof RENT_PAYMENTS)[number])) {
        setEntryPayment("Lunas");
      }
      setEntryDueDate("");
    } else if (RENT_PAYMENTS.includes(entryPayment as (typeof RENT_PAYMENTS)[number])) {
      setEntryPayment("Transfer");
    }
    if (MAINTENANCE_KINDS.has(nextKind) && !entryPlace) {
      setEntryPlace("Bengkel luar");
    }
  }

  function handleSubmitEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (editingRow) formData.set("id", editingRow.id);
    formData.set("entryDate", entryDate);
    formData.set("kind", entryKind);
    formData.set("subcategory", entrySub);
    formData.set("vehicleId", entryVeh);
    const vObj = vehicles.find((v) => v.id === entryVeh);
    formData.set("vehicleLabel", vObj ? `${vObj.plate} · ${vObj.name}` : "Umum / semua kendaraan");
    formData.set("driverName", entryDriver);
    formData.set("shop", entryShop);
    formData.set("place", entryPlace);
    formData.set("mechanic", entryMechanic);
    formData.set("party", entryParty);
    formData.set("payment", entryPayment);
    formData.set("fund", entryFund);
    formData.set("dueDate", entryDueDate);
    formData.set("note", entryNote);
    formData.set("existingPhotosJson", JSON.stringify(entryExistingPhotos));

    const kindLabel = FLEET_KIND_BY_KEY[entryKind as FleetKind]?.label || entryKind;
    const preparedLines = entryLines.map((l) => {
      const q = Math.max(0.01, Number(l.qty.replace(",", ".")) || 1);
      const p = parseRupiah(l.price);
      return {
        item: l.item.trim() || entrySub || kindLabel,
        qty: q,
        price: p,
        total: Math.round(q * p),
      };
    });
    formData.set("linesJson", JSON.stringify(preparedLines));

    if (entryKind === "servis" && !editingRow) {
      const extras = SERVICE_EXTRAS.map((ex) => ({
        key: ex.key,
        label: ex.label,
        total: parseRupiah(serviceExtras[ex.key] || ""),
      })).filter((x) => x.total > 0);
      formData.set("extrasJson", JSON.stringify(extras));
    }

    startTransition(async () => {
      const res = await saveFleetExpense(formData);
      if (res.error) {
        setFlash({ kind: "err", text: res.error });
        return;
      }
      setFlash({ kind: "ok", text: res.ok || "Tersimpan." });
      entryDialogRef.current?.close();
      router.refresh();
    });
  }

  function handleSubmitTrip(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (editingTripRef) formData.set("tripRef", editingTripRef);
    formData.set("entryDate", tripDate);
    formData.set("vehicleId", tripVeh);
    const vObj = vehicles.find((v) => v.id === tripVeh);
    formData.set("vehicleLabel", vObj ? `${vObj.plate} · ${vObj.name}` : "Umum / semua kendaraan");
    formData.set("driverName", tripDriver);
    formData.set("destination", tripDest);
    formData.set("payment", tripPayment);
    formData.set("fund", tripFund);
    formData.set("dueDate", tripDueDate);
    formData.set("note", tripNote);
    formData.set("existingPhotosJson", JSON.stringify(tripExistingPhotos));

    const numericCosts: Record<string, number> = {};
    for (const c of TRIP_COSTS) numericCosts[c.key] = parseRupiah(tripCosts[c.key] || "");
    formData.set("costsJson", JSON.stringify(numericCosts));

    startTransition(async () => {
      const res = await saveFleetTrip(formData);
      if (res.error) {
        setFlash({ kind: "err", text: res.error });
        return;
      }
      setFlash({ kind: "ok", text: res.ok || "Perjalanan tersimpan." });
      tripDialogRef.current?.close();
      router.refresh();
    });
  }

  function handleDeleteRow(row: FleetExpenseRow) {
    if (!window.confirm(`Hapus catatan "${row.item}" (${rp(row.total)})?`)) return;
    startTransition(async () => {
      const res = await deleteFleetExpense(row.id);
      setFlash(res.error ? { kind: "err", text: res.error } : { kind: "ok", text: res.ok || "Dihapus." });
      router.refresh();
    });
  }

  function handleDeleteTrip(group: TripGroup) {
    if (!window.confirm(`Hapus semua ${group.rows.length} pos biaya perjalanan ${group.destination || group.tripRef}?`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteFleetTrip(group.tripRef);
      setFlash(res.error ? { kind: "err", text: res.error } : { kind: "ok", text: res.ok || "Perjalanan dihapus." });
      router.refresh();
    });
  }

  function handleApprove(id: string, decision: "disetujui" | "ditolak", note = "") {
    startTransition(async () => {
      const res = await approveFleetExpense({ id, decision, note });
      if (res.error) {
        setFlash({ kind: "err", text: res.error });
        return;
      }
      setRejectingId(null);
      setRejectNote("");
      setFlash({ kind: "ok", text: res.ok || "Diproses." });
      router.refresh();
    });
  }

  function handleMarkTempoPaid(
    target: { id?: string | null; tripRef?: string },
    method: "transfer" | "tunai",
  ) {
    startTransition(async () => {
      const res = await markTempoPaid({ ...target, paid: true, method });
      setFlash(res.error ? { kind: "err", text: res.error } : { kind: "ok", text: res.ok || "Tempo dilunasi." });
      router.refresh();
    });
  }

  async function handleExportExcel() {
    await downloadWorkbook(`biaya-armada-${fromDate}-${toDate}`, [
      {
        name: "Rekap per mobil",
        title: `Rekap Biaya & Pendapatan Armada (${fromDate} s.d. ${toDate})`,
        columns: [
          { key: "vehicleLabel", header: "Kendaraan", width: 28 },
          { key: "count", header: "Transaksi", width: 12 },
          { key: "sewa", header: "Sewa Armada", width: 16 },
          { key: "pendapatan", header: "Pendapatan Lain", width: 16 },
          { key: "operasional", header: "Operasional", width: 16 },
          { key: "perawatan", header: "Perawatan", width: 16 },
          { key: "admin", header: "Admin & Surat", width: 16 },
          { key: "totalBiaya", header: "Total Biaya", width: 16 },
          { key: "net", header: "Selisih Bersih", width: 16 },
        ],
        rows: recapRows,
      },
      {
        name: "Subkategori",
        title: `Ringkasan per Subkategori (${fromDate} s.d. ${toDate})`,
        columns: [
          { key: "kindLabel", header: "Jenis", width: 22 },
          { key: "subcategory", header: "Subkategori", width: 28 },
          { key: "count", header: "Jumlah", width: 10 },
          { key: "total", header: "Total", width: 18 },
        ],
        rows: subcategoryRows.map((s) => ({ ...s })),
      },
      {
        name: "Perjalanan",
        title: `Biaya Perjalanan Armada (${fromDate} s.d. ${toDate})`,
        columns: [
          { key: "entryDate", header: "Tanggal", width: 13 },
          { key: "vehicleLabel", header: "Kendaraan", width: 24 },
          { key: "driverName", header: "Supir", width: 16 },
          { key: "destination", header: "Tujuan", width: 24 },
          { key: "payment", header: "Pembayaran", width: 16 },
          { key: "fund", header: "Sumber Dana", width: 14 },
          { key: "total", header: "Total", width: 16 },
        ],
        rows: tripGroups.map((g) => ({
          entryDate: g.entryDate,
          vehicleLabel: g.vehicleLabel,
          driverName: g.driverName,
          destination: g.destination,
          payment: g.payment,
          fund: fundLabelOf(g.fund),
          total: g.total,
        })),
      },
      {
        name: "Detail catatan",
        title: `Detail Catatan Biaya Armada (${fromDate} s.d. ${toDate})`,
        columns: [
          { key: "entryDate", header: "Tanggal", width: 13 },
          { key: "vehicleLabel", header: "Kendaraan", width: 24 },
          { key: "kindLabel", header: "Jenis", width: 20 },
          { key: "subcategory", header: "Subkategori", width: 22 },
          { key: "item", header: "Uraian", width: 28 },
          { key: "qty", header: "Qty", width: 8 },
          { key: "price", header: "Harga", width: 14 },
          { key: "total", header: "Total", width: 15 },
          { key: "fundLabel", header: "Dana", width: 14 },
          { key: "payment", header: "Pembayaran", width: 16 },
          { key: "dueDate", header: "Jatuh Tempo", width: 13 },
          { key: "tempoStatus", header: "Status Tempo", width: 16 },
          { key: "approvalStatus", header: "ACC", width: 13 },
          { key: "shop", header: "Toko / Pihak", width: 20 },
          { key: "note", header: "Catatan", width: 28 },
        ],
        rows: filteredRows.map((r) => ({
          entryDate: r.entryDate,
          vehicleLabel: r.vehicleLabel,
          kindLabel: FLEET_KIND_BY_KEY[r.kind as FleetKind]?.label || r.kind,
          subcategory: r.subcategory,
          item: r.item,
          qty: r.qty,
          price: r.price,
          total: r.total,
          fundLabel: fundLabelOf(r.fund),
          payment: r.payment,
          dueDate: r.dueDate,
          tempoStatus: r.tempoPaidAt ? "Lunas" : isTempoPayment(r.payment) ? "Belum lunas" : "",
          approvalStatus: r.approvalStatus,
          shop: r.shop || r.party,
          note: r.note,
        })),
      },
    ]);
  }

  function handleShareWa() {
    const lines = [
      `*Rekap Biaya Armada (${tgl(fromDate)} – ${tgl(toDate)})*`,
      `• Sewa armada: ${rp(summary.sewa)}`,
      `• Pendapatan lain: ${rp(summary.pendapatan)}`,
      `• Total biaya: ${rp(summary.biaya)}`,
      `• Selisih bersih: ${rp(summary.profit)}`,
      summary.tempoCount > 0 ? `• Tagihan Tempo belum lunas: ${rp(summary.tempoTotal)} (${summary.tempoCount} pos)` : "",
      summary.pendingAcc.length > 0 ? `• Menunggu ACC (> 3 jt): ${summary.pendingAcc.length} pos` : "",
    ].filter(Boolean);
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const vehicleSelectOptions: SelectOption[] = useMemo(
    () => [
      { value: "UMUM", label: "Umum / semua kendaraan" },
      ...vehicles
        .filter((v) => v.active || v.id === entryVeh || v.id === tripVeh)
        .map((v) => ({
          value: v.id,
          label: `${v.plate} · ${v.name}`,
          hint: v.capacity || undefined,
        })),
    ],
    [vehicles, entryVeh, tripVeh],
  );

  const kindSelectOptions: SelectOption[] = useMemo(
    () => FLEET_KINDS.map((k) => ({ value: k.key, label: k.label, group: k.group })),
    [],
  );

  const entrySubOptions: SelectOption[] = useMemo(() => {
    const list = FLEET_SUBCATEGORIES[entryKind] || ["Lainnya"];
    return list.map((s) => ({ value: s, label: s }));
  }, [entryKind]);

  const entryPaymentOptions: SelectOption[] = useMemo(() => {
    const list = isIncome(entryKind) ? RENT_PAYMENTS : FLEET_PAYMENTS;
    return list.map((p) => ({ value: p, label: p }));
  }, [entryKind]);

  const tripPaymentOptions: SelectOption[] = useMemo(
    () => FLEET_PAYMENTS.map((p) => ({ value: p, label: p })),
    [],
  );

  const fundSelectOptions: SelectOption[] = useMemo(
    () => FLEET_FUNDS.map((f) => ({ value: f.key, label: f.label })),
    [],
  );

  const isMultiLineKind =
    !editingRow && (entryKind === "part" || entryKind === "oli" || entryKind === "ban" || entryKind === "servis");
  const entryNeedsTempoDue = !isIncome(entryKind) && isTempoPayment(entryPayment);
  const entryNeedsAcc = !isIncome(entryKind) && entryTotalPreview > APPROVAL_THRESHOLD;
  const tripNeedsTempoDue = isTempoPayment(tripPayment);
  const tripNeedsAcc = tripTotalPreview > APPROVAL_THRESHOLD;

  return (
    <div className="fl-root">
      {flash && (
        <div className={`admin-msg ${flash.kind === "ok" ? "admin-msg-ok" : "admin-msg-err"}`} role="status">
          <span>{flash.text}</span>
          <button
            type="button"
            className="admin-btn admin-btn-ghost fl-btn-sm"
            onClick={() => setFlash(null)}
            style={{ marginLeft: "auto" }}
          >
            Tutup
          </button>
        </div>
      )}

      {/* Bilah Aksi Utama */}
      <div className="fl-toolbar">
        <div className="fl-actions">
          {canEdit && (
            <>
              <button
                type="button"
                className="admin-btn fl-btn-cta"
                onClick={() => openNewEntry("solar")}
                disabled={isPending}
              >
                + Catat biaya / pendapatan
              </button>
              <button
                type="button"
                className="admin-btn fl-btn-income"
                onClick={() => openNewEntry("pendapatan")}
                disabled={isPending}
              >
                + Pendapatan lain
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={openNewTrip}
                disabled={isPending}
              >
                + Perjalanan (Trip)
              </button>
            </>
          )}
        </div>

        <div className="fl-actions">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={handleExportExcel}>
            Unduh Excel
          </button>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={handleShareWa}>
            Bagikan WA
          </button>
          <Link href="/operasional/armada" className="admin-btn admin-btn-ghost">
            Surat &amp; Pajak STNK/KIR
          </Link>
        </div>
      </div>

      {/* Bilah Periode & Filter */}
      <div className="fl-filters">
        <div className="fl-presets">
          <span className="fl-muted">Periode cepat:</span>
          <button type="button" className="fl-chip" onClick={() => applyPreset("this_month")}>
            Bulan ini
          </button>
          <button type="button" className="fl-chip" onClick={() => applyPreset("last_month")}>
            Bulan lalu
          </button>
          <button type="button" className="fl-chip" onClick={() => applyPreset("this_year")}>
            Tahun ini
          </button>
          <button type="button" className="fl-chip" onClick={() => applyPreset("since_start")}>
            Sejak {tgl(FLEET_START_DATE)}
          </button>
        </div>

        <div className="fl-filter-grid">
          <div className="fl-field">
            <label htmlFor="fl-from">Dari tanggal</label>
            <DateField
              id="fl-from"
              value={fromDate}
              min={FLEET_START_DATE}
              onChange={(val) => {
                if (val) applyRange(val, toDate);
              }}
            />
          </div>
          <div className="fl-field">
            <label htmlFor="fl-to">Sampai tanggal</label>
            <DateField
              id="fl-to"
              value={toDate}
              min={FLEET_START_DATE}
              onChange={(val) => {
                if (val) applyRange(fromDate, val);
              }}
            />
          </div>
          <div className="fl-field">
            <span className="fl-field-label">Kendaraan</span>
            <Select options={vehicleFilterOptions} value={vehFilter} onChange={setVehFilter} searchable />
          </div>
          <div className="fl-field">
            <span className="fl-field-label">Jenis</span>
            <Select options={kindFilterOptions} value={kindFilter} onChange={setKindFilter} searchable />
          </div>
          <div className="fl-field">
            <span className="fl-field-label">Subkategori</span>
            <Select options={subFilterOptions} value={subFilter} onChange={setSubFilter} searchable />
          </div>
          <div className="fl-field">
            <span className="fl-field-label">Sumber dana</span>
            <Select options={fundFilterOptions} value={fundFilter} onChange={setFundFilter} />
          </div>
          <div className="fl-field">
            <span className="fl-field-label">Pembayaran / Status</span>
            <Select options={payFilterOptions} value={payFilter} onChange={setPayFilter} />
          </div>
          <div className="fl-field">
            <label htmlFor="fl-search">Cari catatan</label>
            <input
              id="fl-search"
              type="search"
              className="fl-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Uraian, toko, supir, tujuan..."
            />
          </div>
        </div>
      </div>

      {/* Ringkasan KPI */}
      <div className="fl-kpis">
        <div className="fl-kpi is-income">
          <span className="fl-kpi-label">Sewa armada</span>
          <span className="fl-kpi-val">{rp(summary.sewa)}</span>
          <span className="fl-kpi-sub">Pemasukan sewa kirim</span>
        </div>
        <div className="fl-kpi is-income">
          <span className="fl-kpi-label">Pendapatan lain</span>
          <span className="fl-kpi-val">{rp(summary.pendapatan)}</span>
          <span className="fl-kpi-sub">Komisi, bekas, klaim</span>
        </div>
        <div className="fl-kpi is-expense">
          <span className="fl-kpi-label">Total biaya armada</span>
          <span className="fl-kpi-val">{rp(summary.biaya)}</span>
          <span className="fl-kpi-sub">Operasional, servis &amp; surat</span>
        </div>
        <div className="fl-kpi">
          <span className="fl-kpi-label">Selisih bersih</span>
          <span className="fl-kpi-val">{rp(summary.profit)}</span>
          <span className="fl-kpi-sub">Pendapatan dikurangi biaya</span>
        </div>
        <div className={`fl-kpi ${summary.tempoCount > 0 ? "is-warn" : ""}`}>
          <span className="fl-kpi-label">Tempo belum lunas</span>
          <span className="fl-kpi-val">{rp(summary.tempoTotal)}</span>
          <span className="fl-kpi-sub">{summary.tempoCount} catatan terbuka</span>
        </div>
        <div className={`fl-kpi ${summary.pendingAcc.length > 0 ? "is-info" : ""}`}>
          <span className="fl-kpi-label">Menunggu ACC</span>
          <span className="fl-kpi-val">{rp(summary.accTotal)}</span>
          <span className="fl-kpi-sub">{summary.pendingAcc.length} pos &gt; Rp 3 jt</span>
        </div>
      </div>

      {/* Peringatan Surat STNK / KIR / Oli */}
      {alerts.length > 0 && (
        <div className="fl-banner is-warn">
          <div className="fl-banner-head">
            <h3 className="fl-banner-title">Pengingat Surat &amp; Servis Armada ({alerts.length})</h3>
            <Link href="/operasional/armada" className="admin-btn admin-btn-ghost fl-btn-sm">
              Kelola armada
            </Link>
          </div>
          <div className="fl-alert-pills">
            {alerts.map((a, idx) => (
              <span key={`${a.vehicleId}-${a.type}-${idx}`} className={`fl-alert-pill ${a.urgent ? "is-urgent" : ""}`}>
                {a.plate}: {a.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Antrean ACC (> Rp 3.000.000) */}
      {summary.pendingAcc.length > 0 && (
        <div className="fl-banner is-info">
          <div className="fl-banner-head">
            <h3 className="fl-banner-title">
              Antrean Persetujuan Biaya &gt; Rp 3.000.000 ({summary.pendingAcc.length})
            </h3>
            <span className="fl-muted">Belum masuk hitungan sampai disetujui</span>
          </div>
          <div className="fl-acc-list">
            {summary.pendingAcc.map((row) => (
              <div key={row.id} className="fl-acc-item">
                <div className="fl-acc-meta">
                  <div className="fl-acc-title">
                    {tgl(row.entryDate)} · {row.vehicleLabel || "Umum"} · {row.item}
                  </div>
                  <div className="fl-acc-sub">
                    {FLEET_KIND_BY_KEY[row.kind as FleetKind]?.label || row.kind}
                    {row.subcategory ? ` (${row.subcategory})` : ""} · {fundLabelOf(row.fund)} · {row.payment} · Dicatat{" "}
                    {row.createdByName || "Staf"}
                  </div>
                  {row.photoKeys.length > 0 && (
                    <PhotoLightboxGrid
                      containerClassName="fl-thumbs"
                      items={row.photoKeys.map((k, i) => ({
                        src: berkasUrl(k),
                        alt: `Nota ${row.item} ${i + 1}`,
                      }))}
                    />
                  )}
                  {rejectingId === row.id && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <input
                        type="text"
                        className="fl-input"
                        style={{ flex: "1 1 200px" }}
                        placeholder="Alasan penolakan..."
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger fl-btn-sm"
                        disabled={isPending || !rejectNote.trim()}
                        onClick={() => handleApprove(row.id, "ditolak", rejectNote)}
                      >
                        Konfirmasi Tolak
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost fl-btn-sm"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectNote("");
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
                <div className="fl-acc-right">
                  <strong>{rp(row.total)}</strong>
                  {canApprove && (
                    <>
                      <button
                        type="button"
                        className="admin-btn fl-btn-income fl-btn-sm"
                        disabled={isPending}
                        onClick={() => handleApprove(row.id, "disetujui")}
                      >
                        Setujui
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger fl-btn-sm"
                        disabled={isPending}
                        onClick={() => {
                          setRejectingId(row.id);
                          setRejectNote("");
                        }}
                      >
                        Tolak
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TempoPanel — Tagihan Tempo Jatuh Tempo / Belum Lunas */}
      {openTempoItems.length > 0 && (
        <div className={`fl-banner ${openTempoItems.some((t) => t.overdue) ? "is-danger" : "is-warn"}`}>
          <div className="fl-banner-head">
            <h3 className="fl-banner-title">
              Tagihan Tempo Belum Lunas ({openTempoItems.length} tagihan ·{" "}
              {rp(openTempoItems.reduce((s, t) => s + t.total, 0))})
            </h3>
            <span className="fl-muted">Tandai lunas setelah pembayaran dikirim</span>
          </div>
          <div className="fl-tempo-list">
            {openTempoItems.map((t) => (
              <div key={t.key} className="fl-tempo-item">
                <div className="fl-tempo-meta">
                  <div className="fl-tempo-title">
                    {t.vehicleLabel || "Umum"} · {t.item}
                  </div>
                  <div className="fl-tempo-sub">
                    Tanggal: {tgl(t.entryDate)}
                    {t.dueDate ? ` · Jatuh tempo: ${tgl(t.dueDate)}` : " · Tanpa tgl jatuh tempo"}
                    {t.shop || t.party ? ` · ${t.shop || t.party}` : ""} · {fundLabelOf(t.fund)}
                  </div>
                </div>
                <div className="fl-tempo-right">
                  <TempoBadge payment={t.payment} dueDate={t.dueDate} tempoPaidAt={null} todayDate={todayDate} />
                  <strong>{rp(t.total)}</strong>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="admin-btn fl-btn-income fl-btn-sm"
                        disabled={isPending}
                        onClick={() =>
                          handleMarkTempoPaid(t.isTrip ? { tripRef: t.tripRef } : { id: t.id }, "transfer")
                        }
                      >
                        Lunas Transfer
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost fl-btn-sm"
                        disabled={isPending}
                        onClick={() =>
                          handleMarkTempoPaid(t.isTrip ? { tripRef: t.tripRef } : { id: t.id }, "tunai")
                        }
                      >
                        Lunas Tunai
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigasi */}
      <div className="fl-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "notes"}
          className={`fl-tab ${tab === "notes" ? "is-active" : ""}`}
          onClick={() => setTab("notes")}
        >
          Catatan ({filteredRows.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "recap"}
          className={`fl-tab ${tab === "recap" ? "is-active" : ""}`}
          onClick={() => setTab("recap")}
        >
          Rekap per Mobil ({recapRows.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "subcategory"}
          className={`fl-tab ${tab === "subcategory" ? "is-active" : ""}`}
          onClick={() => setTab("subcategory")}
        >
          Subkategori ({subcategoryRows.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "trips"}
          className={`fl-tab ${tab === "trips" ? "is-active" : ""}`}
          onClick={() => setTab("trips")}
        >
          Perjalanan ({tripGroups.length})
        </button>
      </div>

      {/* TAB 1: CATATAN */}
      {tab === "notes" && (
        <div className="fl-card">
          <div className="fl-card-head">
            <h3>Daftar Catatan Biaya &amp; Pendapatan</h3>
            <span className="fl-muted">
              {filteredRows.length} baris · {tgl(fromDate)} s.d. {tgl(toDate)}
            </span>
          </div>

          {!filteredRows.length ? (
            <div className="admin-empty" style={{ padding: 28 }}>
              Belum ada catatan pada periode dan filter ini.
            </div>
          ) : (
            <>
              <div className="fl-table-wrap fl-desktop-notes">
                <table className="fl-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kendaraan</th>
                      <th>Jenis &amp; Subkategori</th>
                      <th>Uraian &amp; Nota</th>
                      <th>Dana &amp; Bayar</th>
                      <th className="fl-num">Nominal</th>
                      {canEdit && <th className="fl-num">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => {
                      const info = FLEET_KIND_BY_KEY[r.kind as FleetKind];
                      const inc = info?.income === true;
                      return (
                        <tr key={r.id}>
                          <td className="fl-nowrap">
                            <div>{tgl(r.entryDate)}</div>
                            {r.tripRef && <div className="fl-muted">{r.tripRef}</div>}
                          </td>
                          <td>
                            <div>{r.vehicleLabel || "Umum"}</div>
                            {r.driverName && <div className="fl-muted">Supir: {r.driverName}</div>}
                            {r.destination && <div className="fl-muted">Tujuan: {r.destination}</div>}
                          </td>
                          <td>
                            <div>
                              <span className={`fl-badge ${inc ? "fl-badge-ok" : "fl-badge-neutral"}`}>
                                {info?.label || r.kind}
                              </span>
                            </div>
                            {r.subcategory && <div className="fl-muted" style={{ marginTop: 4 }}>{r.subcategory}</div>}
                            {MAINTENANCE_KINDS.has(r.kind) && (
                              <div className="fl-muted">
                                {placeOf(r.kind, r.place)}
                                {r.mechanic ? ` · ${r.mechanic}` : ""}
                              </div>
                            )}
                          </td>
                          <td>
                            <div>
                              <strong>{r.item}</strong>
                              {r.qty > 1 && <span className="fl-muted"> ({r.qty} × {rp(r.price)})</span>}
                            </div>
                            {(r.shop || r.party) && <div className="fl-muted">{r.shop || r.party}</div>}
                            {r.note && <div className="fl-muted">{r.note}</div>}
                            {r.photoKeys.length > 0 && (
                              <PhotoLightboxGrid
                                containerClassName="fl-thumbs"
                                items={r.photoKeys.map((k, i) => ({
                                  src: berkasUrl(k),
                                  alt: `${r.item} foto ${i + 1}`,
                                }))}
                              />
                            )}
                          </td>
                          <td>
                            <div>{fundLabelOf(r.fund)}</div>
                            <div className="fl-muted">{r.payment || "—"}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                              <TempoBadge
                                payment={r.payment}
                                dueDate={r.dueDate}
                                tempoPaidAt={r.tempoPaidAt}
                                todayDate={todayDate}
                              />
                              <AccBadge status={r.approvalStatus} note={r.approvalNote} />
                            </div>
                          </td>
                          <td className="fl-num">
                            <strong style={{ color: inc ? "#146c43" : undefined }}>
                              {inc ? `+ ${rp(r.total)}` : rp(r.total)}
                            </strong>
                          </td>
                          {canEdit && (
                            <td className="fl-num">
                              <div className="fl-row-actions">
                                {!inc && isTempoPayment(r.payment) && !r.tempoPaidAt && (
                                  <button
                                    type="button"
                                    className="admin-btn fl-btn-income fl-btn-sm"
                                    disabled={isPending}
                                    onClick={() => handleMarkTempoPaid({ id: r.id }, "transfer")}
                                  >
                                    Lunas
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-ghost fl-btn-sm"
                                  onClick={() => openEditEntry(r)}
                                >
                                  Ubah
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-danger fl-btn-sm"
                                  disabled={isPending}
                                  onClick={() => handleDeleteRow(r)}
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tampilan Kartu Mobile (<= 720px) */}
              <div className="fl-mobile-list">
                {filteredRows.map((r) => {
                  const info = FLEET_KIND_BY_KEY[r.kind as FleetKind];
                  const inc = info?.income === true;
                  return (
                    <div key={r.id} className="fl-mobile-card">
                      <div className="fl-mobile-top">
                        <div>
                          <div className="fl-muted">{tgl(r.entryDate)} · {r.vehicleLabel || "Umum"}</div>
                          <strong>{r.item}</strong>
                        </div>
                        <strong style={{ color: inc ? "#146c43" : "#111", whiteSpace: "nowrap" }}>
                          {inc ? `+ ${rp(r.total)}` : rp(r.total)}
                        </strong>
                      </div>
                      <div className="fl-mobile-badges">
                        <span className={`fl-badge ${inc ? "fl-badge-ok" : "fl-badge-neutral"}`}>
                          {info?.label || r.kind}
                        </span>
                        {r.subcategory && <span className="fl-badge fl-badge-neutral">{r.subcategory}</span>}
                        <span className="fl-badge fl-badge-info">{fundLabelOf(r.fund)}</span>
                        <TempoBadge
                          payment={r.payment}
                          dueDate={r.dueDate}
                          tempoPaidAt={r.tempoPaidAt}
                          todayDate={todayDate}
                        />
                        <AccBadge status={r.approvalStatus} note={r.approvalNote} />
                      </div>
                      {(r.shop || r.party || r.note) && (
                        <div className="fl-muted">
                          {[r.shop || r.party, r.note].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {r.photoKeys.length > 0 && (
                        <PhotoLightboxGrid
                          containerClassName="fl-thumbs"
                          items={r.photoKeys.map((k, i) => ({
                            src: berkasUrl(k),
                            alt: `${r.item} foto ${i + 1}`,
                          }))}
                        />
                      )}
                      {canEdit && (
                        <div className="fl-row-actions" style={{ justifyContent: "flex-start", marginTop: 4 }}>
                          {!inc && isTempoPayment(r.payment) && !r.tempoPaidAt && (
                            <button
                              type="button"
                              className="admin-btn fl-btn-income fl-btn-sm"
                              disabled={isPending}
                              onClick={() => handleMarkTempoPaid({ id: r.id }, "transfer")}
                            >
                              Tandai Lunas
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-btn admin-btn-ghost fl-btn-sm"
                            onClick={() => openEditEntry(r)}
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger fl-btn-sm"
                            disabled={isPending}
                            onClick={() => handleDeleteRow(r)}
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: REKAP PER MOBIL */}
      {tab === "recap" && (
        <div className="fl-card">
          <div className="fl-card-head">
            <h3>Rekapitulasi per Kendaraan</h3>
            <span className="fl-muted">Hanya mencakup catatan yang sudah disetujui</span>
          </div>
          {!recapRows.length ? (
            <div className="admin-empty" style={{ padding: 28 }}>
              Tidak ada data terhitung pada filter ini.
            </div>
          ) : (
            <div className="fl-table-wrap">
              <table className="fl-table">
                <thead>
                  <tr>
                    <th>Kendaraan</th>
                    <th className="fl-num">Catatan</th>
                    <th className="fl-num">Sewa</th>
                    <th className="fl-num">Pendapatan Lain</th>
                    <th className="fl-num">Operasional</th>
                    <th className="fl-num">Perawatan</th>
                    <th className="fl-num">Surat / Lain</th>
                    <th className="fl-num">Total Biaya</th>
                    <th className="fl-num">Selisih Bersih</th>
                  </tr>
                </thead>
                <tbody>
                  {recapRows.map((row) => (
                    <tr key={`${row.vehicleId || "umum"}-${row.vehicleLabel}`}>
                      <td><strong>{row.vehicleLabel}</strong></td>
                      <td className="fl-num">{row.count}</td>
                      <td className="fl-num">{rp(row.sewa)}</td>
                      <td className="fl-num">{rp(row.pendapatan)}</td>
                      <td className="fl-num">{rp(row.operasional)}</td>
                      <td className="fl-num">{rp(row.perawatan)}</td>
                      <td className="fl-num">{rp(row.admin)}</td>
                      <td className="fl-num"><strong>{rp(row.totalBiaya)}</strong></td>
                      <td className="fl-num" style={{ color: row.net >= 0 ? "#146c43" : "#9b1c1c" }}>
                        <strong>{rp(row.net)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="fl-num">{recapRows.reduce((s, r) => s + r.count, 0)}</td>
                    <td className="fl-num">{rp(recapRows.reduce((s, r) => s + r.sewa, 0))}</td>
                    <td className="fl-num">{rp(recapRows.reduce((s, r) => s + r.pendapatan, 0))}</td>
                    <td className="fl-num">{rp(recapRows.reduce((s, r) => s + r.operasional, 0))}</td>
                    <td className="fl-num">{rp(recapRows.reduce((s, r) => s + r.perawatan, 0))}</td>
                    <td className="fl-num">{rp(recapRows.reduce((s, r) => s + r.admin, 0))}</td>
                    <td className="fl-num">{rp(recapRows.reduce((s, r) => s + r.totalBiaya, 0))}</td>
                    <td className="fl-num">{rp(recapRows.reduce((s, r) => s + r.net, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUBKATEGORI */}
      {tab === "subcategory" && (
        <div className="fl-card">
          <div className="fl-card-head">
            <h3>Rekap per Jenis &amp; Subkategori</h3>
            <span className="fl-muted">Diurutkan dari nominal terbesar</span>
          </div>
          {!subcategoryRows.length ? (
            <div className="admin-empty" style={{ padding: 28 }}>
              Belum ada data subkategori pada filter ini.
            </div>
          ) : (
            <div className="fl-table-wrap">
              <table className="fl-table">
                <thead>
                  <tr>
                    <th>Jenis</th>
                    <th>Subkategori</th>
                    <th className="fl-num">Jumlah Pos</th>
                    <th className="fl-num">Total Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {subcategoryRows.map((s) => (
                    <tr key={`${s.kind}-${s.subcategory}`}>
                      <td>
                        <span className={`fl-badge ${s.income ? "fl-badge-ok" : "fl-badge-neutral"}`}>
                          {s.kindLabel}
                        </span>
                      </td>
                      <td><strong>{s.subcategory}</strong></td>
                      <td className="fl-num">{s.count}</td>
                      <td className="fl-num" style={{ color: s.income ? "#146c43" : undefined }}>
                        <strong>{s.income ? `+ ${rp(s.total)}` : rp(s.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PERJALANAN (TRIP) */}
      {tab === "trips" && (
        <div className="fl-card">
          <div className="fl-card-head">
            <h3>Daftar Biaya Perjalanan (Trip)</h3>
            {canEdit && (
              <button type="button" className="admin-btn admin-btn-primary fl-btn-sm" onClick={openNewTrip}>
                + Catat Perjalanan
              </button>
            )}
          </div>
          {!tripGroups.length ? (
            <div className="admin-empty" style={{ padding: 28 }}>
              Belum ada catatan perjalanan (trip) pada periode ini.
            </div>
          ) : (
            <div className="fl-table-wrap">
              <table className="fl-table">
                <thead>
                  <tr>
                    <th>Tanggal &amp; Ref</th>
                    <th>Kendaraan &amp; Tujuan</th>
                    <th>Rincian Biaya</th>
                    <th>Dana &amp; Bayar</th>
                    <th className="fl-num">Total</th>
                    {canEdit && <th className="fl-num">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {tripGroups.map((g) => (
                    <tr key={g.tripRef}>
                      <td className="fl-nowrap">
                        <div>{tgl(g.entryDate)}</div>
                        <div className="fl-muted">{g.tripRef}</div>
                      </td>
                      <td>
                        <div><strong>{g.vehicleLabel || "Umum"}</strong></div>
                        {g.driverName && <div className="fl-muted">Supir: {g.driverName}</div>}
                        {g.destination && <div className="fl-muted">Tujuan: {g.destination}</div>}
                        {g.note && <div className="fl-muted">{g.note}</div>}
                        {g.photoKeys.length > 0 && (
                          <PhotoLightboxGrid
                            containerClassName="fl-thumbs"
                            items={g.photoKeys.map((k, i) => ({
                              src: berkasUrl(k),
                              alt: `Trip ${g.tripRef} foto ${i + 1}`,
                            }))}
                          />
                        )}
                      </td>
                      <td>
                        {TRIP_COSTS.filter((c) => (g.costs[c.key] || 0) > 0).map((c) => (
                          <div key={c.key} className="fl-muted">
                            {c.label}: <strong>{rp(g.costs[c.key])}</strong>
                          </div>
                        ))}
                      </td>
                      <td>
                        <div>{fundLabelOf(g.fund)}</div>
                        <div className="fl-muted">{g.payment}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          <TempoBadge
                            payment={g.payment}
                            dueDate={g.dueDate}
                            tempoPaidAt={g.tempoPaidAt}
                            todayDate={todayDate}
                          />
                          <AccBadge status={g.approvalStatus} />
                        </div>
                      </td>
                      <td className="fl-num">
                        <strong>{rp(g.total)}</strong>
                      </td>
                      {canEdit && (
                        <td className="fl-num">
                          <div className="fl-row-actions">
                            {isTempoPayment(g.payment) && !g.tempoPaidAt && (
                              <button
                                type="button"
                                className="admin-btn fl-btn-income fl-btn-sm"
                                disabled={isPending}
                                onClick={() => handleMarkTempoPaid({ tripRef: g.tripRef }, "transfer")}
                              >
                                Lunas
                              </button>
                            )}
                            <button
                              type="button"
                              className="admin-btn admin-btn-ghost fl-btn-sm"
                              onClick={() => openEditTrip(g)}
                            >
                              Ubah
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-danger fl-btn-sm"
                              disabled={isPending}
                              onClick={() => handleDeleteTrip(g)}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL CATAT / UBAH BIAYA & PENDAPATAN */}
      <dialog ref={entryDialogRef} className="fl-modal">
        <form className="fl-modal-form" onSubmit={handleSubmitEntry}>
          <div className="fl-modal-head">
            <h2>{editingRow ? "Ubah Catatan Armada" : "Catat Biaya / Pendapatan Armada"}</h2>
            <button
              type="button"
              className="fl-modal-close"
              aria-label="Tutup dialog"
              onClick={() => entryDialogRef.current?.close()}
            >
              ×
            </button>
          </div>

          <div className="fl-modal-body">
            <div className="fl-form-grid">
              <div className="fl-field">
                <label htmlFor="entry-date">Tanggal transaksi</label>
                <DateField
                  id="entry-date"
                  value={entryDate}
                  min={FLEET_START_DATE}
                  onChange={setEntryDate}
                  required
                />
              </div>

              <div className="fl-field">
                <span className="fl-field-label">Jenis transaksi</span>
                <Select options={kindSelectOptions} value={entryKind} onChange={handleEntryKindChange} searchable />
              </div>

              <div className="fl-field">
                <span className="fl-field-label">Subkategori</span>
                <Select options={entrySubOptions} value={entrySub} onChange={setEntrySub} />
              </div>

              <div className="fl-field">
                <span className="fl-field-label">Kendaraan</span>
                <Select options={vehicleSelectOptions} value={entryVeh} onChange={setEntryVeh} searchable />
              </div>

              <div className="fl-field">
                <span className="fl-field-label">Sumber dana</span>
                <Select options={fundSelectOptions} value={entryFund} onChange={setEntryFund} />
              </div>

              <div className="fl-field">
                <span className="fl-field-label">Metode / status bayar</span>
                <Select options={entryPaymentOptions} value={entryPayment} onChange={setEntryPayment} />
              </div>

              {entryNeedsTempoDue && (
                <div className="fl-field fl-span-2">
                  <label htmlFor="entry-due">Tanggal jatuh tempo Tempo (wajib)</label>
                  <DateField id="entry-due" value={entryDueDate} onChange={setEntryDueDate} required />
                </div>
              )}

              {isIncome(entryKind) ? (
                <div className="fl-field fl-span-2">
                  <label htmlFor="entry-party">Penyewa / Pihak terkait</label>
                  <input
                    id="entry-party"
                    className="fl-input"
                    value={entryParty}
                    onChange={(e) => setEntryParty(e.target.value)}
                    placeholder="Nama penyewa, pembeli part bekas, dll."
                  />
                </div>
              ) : (
                <>
                  <div className="fl-field">
                    <label htmlFor="entry-shop">Toko / Bengkel / SPBU</label>
                    <input
                      id="entry-shop"
                      className="fl-input"
                      value={entryShop}
                      onChange={(e) => setEntryShop(e.target.value)}
                      placeholder="Nama toko atau bengkel"
                    />
                  </div>
                  <div className="fl-field">
                    <label htmlFor="entry-driver">Supir / PIC</label>
                    <input
                      id="entry-driver"
                      className="fl-input"
                      value={entryDriver}
                      onChange={(e) => setEntryDriver(e.target.value)}
                      placeholder="Nama supir / penanggung jawab"
                    />
                  </div>
                </>
              )}

              {MAINTENANCE_KINDS.has(entryKind) && (
                <>
                  <div className="fl-field">
                    <span className="fl-field-label">Tempat pengerjaan</span>
                    <Select
                      options={FLEET_PLACES.map((p) => ({ value: p, label: p }))}
                      value={entryPlace}
                      onChange={setEntryPlace}
                    />
                  </div>
                  <div className="fl-field">
                    <label htmlFor="entry-mechanic">Mekanik</label>
                    <input
                      id="entry-mechanic"
                      className="fl-input"
                      value={entryMechanic}
                      onChange={(e) => setEntryMechanic(e.target.value)}
                      placeholder={entryPlace === "Orang pabrik" ? "Pilih / tulis nama mekanik" : "Nama bengkel / mekanik"}
                    />
                    {entryPlace === "Orang pabrik" && (
                      <div className="fl-presets" style={{ marginTop: 4 }}>
                        {FLEET_MECHANICS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`fl-chip ${entryMechanic === m ? "is-active" : ""}`}
                            onClick={() => setEntryMechanic(m)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Baris Item / Harga */}
            <div className="fl-lines-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>Rincian Barang / Jasa</strong>
                {isMultiLineKind && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost fl-btn-sm"
                    onClick={() => setEntryLines((prev) => [...prev, { item: "", qty: "1", price: "" }])}
                  >
                    + Tambah baris
                  </button>
                )}
              </div>

              {entryLines.map((line, idx) => {
                const q = Math.max(0.01, Number(line.qty.replace(",", ".")) || 1);
                const sub = Math.round(q * parseRupiah(line.price));
                return (
                  <div key={idx} className="fl-line-row">
                    <div className="fl-field">
                      <label>Uraian / Nama item</label>
                      <input
                        className="fl-input"
                        value={line.item}
                        onChange={(e) =>
                          setEntryLines((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, item: e.target.value } : x)),
                          )
                        }
                        placeholder={entrySub || "Mis. Solar DEX, Kampas rem, Sewa harian..."}
                        required={idx === 0}
                      />
                    </div>
                    <div className="fl-field">
                      <label>Qty</label>
                      <input
                        className="fl-input"
                        inputMode="decimal"
                        value={line.qty}
                        onChange={(e) =>
                          setEntryLines((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)),
                          )
                        }
                      />
                    </div>
                    <div className="fl-field">
                      <label>Harga satuan (Rp)</label>
                      <input
                        className="fl-input"
                        inputMode="numeric"
                        value={line.price}
                        onChange={(e) =>
                          setEntryLines((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)),
                          )
                        }
                        placeholder="0"
                        required={idx === 0}
                      />
                    </div>
                    <div className="fl-field">
                      <label>Subtotal</label>
                      <div className="fl-input" style={{ background: "var(--p-head)", display: "flex", alignItems: "center" }}>
                        {rp(sub)}
                      </div>
                    </div>
                    {entryLines.length > 1 && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger fl-btn-sm"
                        onClick={() => setEntryLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}

              {entryKind === "servis" && !editingRow && (
                <div style={{ borderTop: "1px dashed var(--p-line-strong)", paddingTop: 10 }}>
                  <div className="fl-muted" style={{ marginBottom: 6 }}>
                    Biaya tambahan servis (opsional — tersimpan sebagai baris tambahan):
                  </div>
                  <div className="fl-trip-grid">
                    {SERVICE_EXTRAS.map((ex) => (
                      <div key={ex.key} className="fl-field">
                        <label>{ex.label}</label>
                        <input
                          className="fl-input"
                          inputMode="numeric"
                          placeholder="0"
                          value={serviceExtras[ex.key] || ""}
                          onChange={(e) => setServiceExtras((p) => ({ ...p, [ex.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {entryNeedsAcc && (
              <div className="fl-banner is-warn">
                <strong>Butuh ACC Pimpinan / Keuangan:</strong> Total melebihi Rp 3.000.000 ({rp(entryTotalPreview)}).
                Catatan akan masuk antrean ACC sebelum dihitung ke rekap.
              </div>
            )}

            <div className="fl-field">
              <label htmlFor="entry-note">Catatan tambahan</label>
              <textarea
                id="entry-note"
                className="fl-textarea"
                value={entryNote}
                onChange={(e) => setEntryNote(e.target.value)}
                placeholder="Keterangan kilometer, nomor nota, atau info lain..."
              />
            </div>

            {entryExistingPhotos.length > 0 && (
              <div className="fl-field">
                <span className="fl-field-label">Foto nota tersimpan</span>
                <div className="fl-existing-photos">
                  {entryExistingPhotos.map((k, idx) => (
                    <div key={`${k}-${idx}`} className="fl-existing-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={berkasUrl(k)} alt={`Foto tersimpan ${idx + 1}`} />
                      <button
                        type="button"
                        aria-label="Hapus foto tersimpan"
                        onClick={() => setEntryExistingPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entryExistingPhotos.length < MAX_FLEET_PHOTOS && (
              <PhotoPicker
                key={pickerKey}
                name="photos"
                max={MAX_FLEET_PHOTOS - entryExistingPhotos.length}
                label="Foto nota / struk"
                hint={`Maksimal ${MAX_FLEET_PHOTOS} foto per catatan (otomatis dikecilkan).`}
              />
            )}
          </div>

          <div className="fl-modal-foot">
            <div>
              <span className="fl-muted">Total: </span>
              <strong>{rp(entryTotalPreview)}</strong>
            </div>
            <div className="fl-actions">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => entryDialogRef.current?.close()}
              >
                Batal
              </button>
              <button type="submit" className="admin-btn fl-btn-cta" disabled={isPending}>
                {isPending ? "Menyimpan..." : editingRow ? "Simpan Perubahan" : "Simpan Catatan"}
              </button>
            </div>
          </div>
        </form>
      </dialog>

      {/* MODAL CATAT / UBAH PERJALANAN (TRIP) */}
      <dialog ref={tripDialogRef} className="fl-modal">
        <form className="fl-modal-form" onSubmit={handleSubmitTrip}>
          <div className="fl-modal-head">
            <h2>{editingTripRef ? `Ubah Perjalanan (${editingTripRef})` : "Catat Biaya Perjalanan (Trip)"}</h2>
            <button
              type="button"
              className="fl-modal-close"
              aria-label="Tutup dialog"
              onClick={() => tripDialogRef.current?.close()}
            >
              ×
            </button>
          </div>

          <div className="fl-modal-body">
            <div className="fl-form-grid">
              <div className="fl-field">
                <label htmlFor="trip-date">Tanggal berangkat</label>
                <DateField id="trip-date" value={tripDate} min={FLEET_START_DATE} onChange={setTripDate} required />
              </div>

              <div className="fl-field">
                <span className="fl-field-label">Kendaraan</span>
                <Select options={vehicleSelectOptions} value={tripVeh} onChange={setTripVeh} searchable />
              </div>

              <div className="fl-field">
                <label htmlFor="trip-driver">Supir</label>
                <input
                  id="trip-driver"
                  className="fl-input"
                  value={tripDriver}
                  onChange={(e) => setTripDriver(e.target.value)}
                  placeholder="Nama supir"
                />
              </div>

              <div className="fl-field">
                <label htmlFor="trip-dest">Tujuan pengiriman</label>
                <input
                  id="trip-dest"
                  className="fl-input"
                  value={tripDest}
                  onChange={(e) => setTripDest(e.target.value)}
                  placeholder="Mis. Cikarang, Karawang, Subang"
                  required
                />
              </div>

              <div className="fl-field">
                <span className="fl-field-label">Sumber dana</span>
                <Select options={fundSelectOptions} value={tripFund} onChange={setTripFund} />
              </div>

              <div className="fl-field">
                <span className="fl-field-label">Pembayaran</span>
                <Select options={tripPaymentOptions} value={tripPayment} onChange={setTripPayment} />
              </div>

              {tripNeedsTempoDue && (
                <div className="fl-field fl-span-2">
                  <label htmlFor="trip-due">Tanggal jatuh tempo Tempo (wajib)</label>
                  <DateField id="trip-due" value={tripDueDate} onChange={setTripDueDate} required />
                </div>
              )}
            </div>

            <div className="fl-lines-box">
              <strong>Rincian Biaya Perjalanan (isi yang terpakai saja)</strong>
              <div className="fl-trip-grid">
                {TRIP_COSTS.map((c) => (
                  <div key={c.key} className="fl-field">
                    <label>{c.label} (Rp)</label>
                    <input
                      className="fl-input"
                      inputMode="numeric"
                      placeholder="0"
                      value={tripCosts[c.key] || ""}
                      onChange={(e) => setTripCosts((prev) => ({ ...prev, [c.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {tripNeedsAcc && (
              <div className="fl-banner is-warn">
                <strong>Butuh ACC Pimpinan / Keuangan:</strong> Total perjalanan melebihi Rp 3.000.000 (
                {rp(tripTotalPreview)}).
              </div>
            )}

            <div className="fl-field">
              <label htmlFor="trip-note">Catatan perjalanan</label>
              <textarea
                id="trip-note"
                className="fl-textarea"
                value={tripNote}
                onChange={(e) => setTripNote(e.target.value)}
                placeholder="No. surat jalan, muatan, atau catatan supir..."
              />
            </div>

            {tripExistingPhotos.length > 0 && (
              <div className="fl-field">
                <span className="fl-field-label">Foto nota tersimpan</span>
                <div className="fl-existing-photos">
                  {tripExistingPhotos.map((k, idx) => (
                    <div key={`${k}-${idx}`} className="fl-existing-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={berkasUrl(k)} alt={`Foto trip ${idx + 1}`} />
                      <button
                        type="button"
                        aria-label="Hapus foto tersimpan"
                        onClick={() => setTripExistingPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tripExistingPhotos.length < MAX_FLEET_PHOTOS && (
              <PhotoPicker
                key={tripPickerKey}
                name="photos"
                max={MAX_FLEET_PHOTOS - tripExistingPhotos.length}
                label="Foto bukti / surat jalan"
                hint={`Maksimal ${MAX_FLEET_PHOTOS} foto.`}
              />
            )}
          </div>

          <div className="fl-modal-foot">
            <div>
              <span className="fl-muted">Total Perjalanan: </span>
              <strong>{rp(tripTotalPreview)}</strong>
            </div>
            <div className="fl-actions">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => tripDialogRef.current?.close()}
              >
                Batal
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan Perjalanan"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </div>
  );
}
