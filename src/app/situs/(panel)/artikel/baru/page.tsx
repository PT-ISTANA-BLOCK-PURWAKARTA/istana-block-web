import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ArticleForm } from "../ArticleForm";

export const metadata = { title: "Tulis artikel" };

export default async function NewArticle() {
  await requireAdmin();
  return (
    <>
      <div className="admin-head"><div><Link href="/situs/artikel" className="small">← Artikel</Link><h1>Tulis artikel</h1></div></div>
      <ArticleForm coverSrc={null} />
    </>
  );
}
