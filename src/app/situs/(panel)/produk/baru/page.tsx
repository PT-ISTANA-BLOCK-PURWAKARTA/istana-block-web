import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "Tambah produk" };

export default async function NewProduct() {
  await requireAdmin();
  return (
    <>
      <div className="admin-head">
        <div><Link href="/situs/produk" className="small">← Produk</Link><h1>Tambah produk</h1></div>
      </div>
      <ProductForm imageSrc={null} />
    </>
  );
}
