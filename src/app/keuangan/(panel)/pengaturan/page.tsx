import { FinSettingsForm } from "@/components/erp/FinSettingsForm";
import { PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { getFinSettings } from "@/lib/erp/server";

export const metadata = { title: "Pengaturan keuangan" };

export default async function Pengaturan() {
  await requireModule("keuangan");
  const db = await getDb();
  const fin = await getFinSettings(db);
  return (
    <>
      <PageHead title="Pengaturan keuangan" />
      <FinSettingsForm values={fin.raw} />
    </>
  );
}
