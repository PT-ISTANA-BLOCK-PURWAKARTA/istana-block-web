import { and, inArray, isNotNull, isNull, like, lte, lt, or } from "drizzle-orm";
import { fleetExpenses, users, vehicles } from "../../../db/schema";
import { normalizeRoles } from "../../roles";
import { pushToUsers } from "../push";
import type { CronContext } from "./types";

const TARGET_NAMES = new Set(["cepi", "arel"]);

function jakartaDateAndHour(now: Date): { todayWib: string; hourWib: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    todayWib: `${pick("year")}-${pick("month")}-${pick("day")}`,
    hourWib: Number(pick("hour") || 0),
  };
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/**
 * Pengingat Hari-H & lewat jatuh tempo biaya armada (`payment = tempo`) mulai pukul 08:00 WIB.
 * Berjalan di Worker cron (tanpa `@/` atau `server-only`).
 */
export async function remindFleetTempo(c: CronContext) {
  if (c.budget.fetchLeft <= 0) return;

  const { todayWib, hourWib } = jakartaDateAndHour(c.now);
  if (hourWib < 8) return;

  const dueRows = await c.db
    .select({
      id: fleetExpenses.id,
      vehicleId: fleetExpenses.vehicleId,
      vehicleLabel: fleetExpenses.vehicleLabel,
      item: fleetExpenses.item,
      total: fleetExpenses.total,
      shop: fleetExpenses.shop,
      dueDate: fleetExpenses.dueDate,
    })
    .from(fleetExpenses)
    .where(
      and(
        like(fleetExpenses.payment, "%tempo%"),
        isNull(fleetExpenses.tempoPaidAt),
        isNotNull(fleetExpenses.dueDate),
        lte(fleetExpenses.dueDate, todayWib),
        or(isNull(fleetExpenses.tempoRemindedOn), lt(fleetExpenses.tempoRemindedOn, todayWib)),
      ),
    );

  if (!dueRows.length) return;

  const allUsers = await c.db
    .select({ id: users.id, name: users.name, email: users.email, roles: users.roles })
    .from(users);

  let recipientIds = allUsers
    .filter((u) => {
      const name = u.name.trim().toLowerCase();
      const emailLocal = (u.email ?? "").trim().toLowerCase().split("@")[0] ?? "";
      return (
        TARGET_NAMES.has(name) ||
        TARGET_NAMES.has(emailLocal) ||
        name.includes("cepi") ||
        name.includes("arel")
      );
    })
    .map((u) => u.id);

  if (!recipientIds.length) {
    recipientIds = allUsers
      .filter((u) => {
        const roles = normalizeRoles(u.roles);
        return roles.includes("keuangan") || roles.includes("owner");
      })
      .map((u) => u.id);
  }

  if (!recipientIds.length) return;

  const vehicleIds = Array.from(
    new Set(dueRows.map((r) => r.vehicleId).filter((v): v is string => typeof v === "string" && v.length > 0)),
  );
  const plateMap = new Map<string, string>();
  if (vehicleIds.length) {
    const vehicleRows = await c.db
      .select({ id: vehicles.id, plate: vehicles.plate })
      .from(vehicles)
      .where(inArray(vehicles.id, vehicleIds));
    for (const v of vehicleRows) plateMap.set(v.id, v.plate);
  }

  const totalAmount = dueRows.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const first = dueRows[0];
  const unit =
    first.vehicleLabel?.trim() ||
    (first.vehicleId ? plateMap.get(first.vehicleId) : undefined) ||
    "Armada";
  const overdueCount = dueRows.filter((r) => (r.dueDate ?? "") < todayWib).length;

  const title =
    dueRows.length === 1
      ? `ALARM TEMPO ARMADA: ${unit} jatuh tempo`
      : `ALARM TEMPO ARMADA: ${dueRows.length} tagihan jatuh tempo`;

  const body =
    dueRows.length === 1
      ? `${first.item} (${first.shop || "Toko"}) — ${formatRupiah(Number(first.total || 0))} · tempo ${first.dueDate}`
      : `Total ${formatRupiah(totalAmount)} (${overdueCount ? `${overdueCount} lewat tanggal, ` : ""}cek ${unit} & lainnya).`;

  const res = await pushToUsers(
    c.db,
    c.env,
    recipientIds,
    {
      title,
      body,
      url: "/anak-usaha/biaya-armada",
      tag: `alarm-tempo-${todayWib}`,
    },
    c.budget,
  );

  // Bila anggaran subrequest habis sebelum ada push terkirim, coba lagi pada tick berikutnya.
  if (res.sent === 0 && res.skipped > 0) return;

  const ids = dueRows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 90) {
    await c.db
      .update(fleetExpenses)
      .set({ tempoRemindedOn: todayWib })
      .where(inArray(fleetExpenses.id, ids.slice(i, i + 90)));
  }
}
