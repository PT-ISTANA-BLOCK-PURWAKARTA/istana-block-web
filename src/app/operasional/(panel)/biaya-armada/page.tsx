import { PageHead } from "@/components/erp/ui";
import { FleetWorkspace } from "@/components/ops/fleet/FleetWorkspace";
import { opsAccess } from "@/lib/erp/ops";
import { isDate, monthStart, today } from "@/lib/erp/util";
import { getFleetAlerts, listFleetExpenses, listFleetVehicles } from "@/lib/ops/fleet";
import { FLEET_START_DATE } from "@/lib/ops/shared/fleet";
import { can } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biaya armada" };

export default async function BiayaArmadaPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [{ user }, sp] = await Promise.all([opsAccess(), searchParams]);
  const todayDate = today();

  const defaultFrom =
    monthStart(todayDate) < FLEET_START_DATE ? FLEET_START_DATE : monthStart(todayDate);
  const rawFrom = sp.from && isDate(sp.from) ? sp.from : defaultFrom;
  const from = rawFrom < FLEET_START_DATE ? FLEET_START_DATE : rawFrom;
  const to = sp.to && isDate(sp.to) ? sp.to : todayDate;

  const [expenses, vehicles] = await Promise.all([
    listFleetExpenses({ from, to }),
    listFleetVehicles(),
  ]);
  const alerts = getFleetAlerts(vehicles, todayDate);

  const canEdit = can(user.roles, "keuangan") || can(user.roles, "pengiriman") || can(user.roles, "ekspedisi");
  const canApprove =
    can(user.roles, "keuangan") ||
    can(user.roles, "laporan") ||
    can(user.roles, "ttd_pimpinan") ||
    can(user.roles, "setujui_qc");

  return (
    <>
      <PageHead
        title="Biaya armada"
        sub="Catat biaya operasional, servis & suku cadang, sewa, pendapatan lain, perjalanan (trip), dan tagihan tempo armada."
      />
      <FleetWorkspace
        initialExpenses={expenses}
        vehicles={vehicles}
        alerts={alerts}
        initialFrom={from}
        initialTo={to}
        todayDate={todayDate}
        canEdit={canEdit}
        canApprove={canApprove}
      />
    </>
  );
}
