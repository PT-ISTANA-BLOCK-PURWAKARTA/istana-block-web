import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { TestimonialForm } from "../TestimonialForm";

export const metadata = { title: "Tambah testimoni" };

export default async function NewTestimonial() {
  await requireAdmin();
  return (
    <>
      <div className="admin-head"><div><Link href="/admin/testimoni" className="small">← Testimoni</Link><h1>Tambah testimoni</h1></div></div>
      <TestimonialForm />
    </>
  );
}
