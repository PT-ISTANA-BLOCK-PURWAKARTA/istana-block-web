import { JournalForm } from "@/components/erp/JournalForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { pickLists } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Jurnal umum baru" };

export default async function JurnalBaru() {
  await requireModule("keuangan");
  const db = await getDb();
  const lists = await pickLists(db);
  return (
    <>
      <BackLink href="/keuangan/jurnal">Jurnal</BackLink>
      <PageHead title="Jurnal umum baru" sub="Untuk saldo awal pakai akun lawan “Ekuitas Saldo Awal”. Piutang/hutang awal lebih baik dibuat sebagai faktur agar bisa ditagih." />
      <JournalForm head={{ date: today() }} lines={[]} accounts={lists.pick()} />
    </>
  );
}
