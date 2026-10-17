import { asc, eq } from "drizzle-orm";
import { SettleForm } from "@/components/erp/SettleForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { contactsOfKind, settleData } from "@/lib/erp/server";
import { today } from "@/lib/erp/util";
import { Select } from "@/components/ui";

export const metadata = { title: "Penerimaan baru" };

export default async function Baru({ searchParams }: { searchParams: Promise<{ kontak?: string; faktur?: string; jumlah?: string; memo?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const contact = sp.kontak ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, sp.kontak) }) : undefined;
  if (!contact) {
    const contacts = await db.select().from(schema.contacts).where(contactsOfKind("pelanggan")).orderBy(asc(schema.contacts.name));
    return (
      <>
        <BackLink href="/akuntansi/penerimaan">Penerimaan</BackLink>
        <PageHead title="Penerimaan baru" sub="Pilih pelanggan dulu untuk melihat faktur yang belum lunas." />
        <form method="get" className="form-section" style={{ maxWidth: 560 }}>
          <div className="field">
            <label htmlFor="kontak">Pelanggan</label>
            <Select id="kontak" name="kontak" required placeholder="Pilih pelanggan…" searchable options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company && c.company !== c.name ? c.company : undefined }))} />
          </div>
          <div><button type="submit" className="btn btn-blue">Lanjut</button></div>
        </form>
      </>
    );
  }
  const data = await settleData(db, "receipt", contact.id);
  const target = sp.faktur ? data.docs.find((d) => d.id === sp.faktur) : undefined;
  if (target) target.alloc = target.left;
  return (
    <>
      <BackLink href="/akuntansi/penerimaan">Penerimaan</BackLink>
      <PageHead title="Penerimaan baru" />
      <SettleForm
        kind="receipt"
        contactId={contact.id}
        contactName={contact.name}
        date={today()}
        accounts={data.accounts}
        depositAccountId={data.depositAccountId}
        depositBalance={data.depositBalance}
        initialAmount={target ? target.left : Number(sp.jumlah) || undefined}
        memo={sp.memo}
        docs={data.docs}
      />
    </>
  );
}
