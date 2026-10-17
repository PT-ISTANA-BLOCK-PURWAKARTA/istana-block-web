import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteAccount } from "@/app/keuangan/actions/master";
import { AccountForm } from "@/components/erp/AccountForm";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Akun" };

export default async function AkunDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const db = await getDb();
  const a = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, id) });
  if (!a) notFound();
  async function remove() {
    "use server";
    await deleteAccount(id);
    redirect("/keuangan/akun?ok=dihapus");
  }
  return (
    <>
      <BackLink href="/keuangan/akun">Daftar akun</BackLink>
      <PageHead title={`${a.code} ${a.name}`}>
        <Link href={`/keuangan/laporan/buku-besar?akun=${a.id}`} className="btn btn-ghost btn-sm">Buku besar</Link>
      </PageHead>
      <div className="stack" style={{ gap: 20 }}>
        <AccountForm a={a} />
        {!a.systemKey && <div><ConfirmAction action={remove} label="Hapus / nonaktifkan akun" confirmText="Hapus akun ini? Bila sudah dipakai jurnal, akun hanya dinonaktifkan." /></div>}
      </div>
    </>
  );
}
