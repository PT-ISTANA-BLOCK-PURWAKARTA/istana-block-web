import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PageForm } from "../PageForm";

export const metadata = { title: "Buat halaman" };

export default async function NewPage() {
  await requireAdmin();
  return (
    <>
      <div className="admin-head"><div><Link href="/situs/halaman" className="small">← Halaman</Link><h1>Buat halaman</h1></div></div>
      <PageForm coverSrc={null} />
    </>
  );
}
