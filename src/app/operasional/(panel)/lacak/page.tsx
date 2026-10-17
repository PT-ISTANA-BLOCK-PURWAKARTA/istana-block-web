import { PageHead } from "@/components/erp/ui";
import { TruckTracker } from "@/components/ops/TruckTracker";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { truckBoard } from "@/lib/erp/tracking";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Lacak truk" };

export default async function Lacak() {
  const me = await requirePerm("lacak");
  const db = await getDb();
  const trucks = await truckBoard(db);
  return (
    <>
      <PageHead title="Lacak truk" sub="Posisi terakhir tiap truk dari perangkat GPS atau HP sopir yang sedang mengantar." />
      <TruckTracker initial={{ trucks, route: null, now: Math.floor(Date.now() / 1000) }} today={today()} canSetup={me.roles.includes("owner")} />
    </>
  );
}
