import { AssetForm } from "@/components/erp/AssetForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { assetFormOptions } from "@/lib/erp/assetForm";
import { loadAccounts } from "@/lib/erp/server";

export const metadata = { title: "Aset baru" };

export default async function AsetBaru() {
  await requireModule("keuangan");
  const db = await getDb();
  const o = assetFormOptions(await loadAccounts(db));
  return (
    <>
      <BackLink href="/akuntansi/harta-tetap">Harta Tetap</BackLink>
      <PageHead title="Aset baru" sub="Kelompok mengisi rekening dan umur bawaan; ubah bila perlu." />
      <AssetForm {...o} />
    </>
  );
}
