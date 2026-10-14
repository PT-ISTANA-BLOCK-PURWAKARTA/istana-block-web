import Link from "next/link";
import type { Product } from "@/db/schema";
import { imageUrl, priceLabel } from "@/lib/format";

export function ProductCard({ p }: { p: Product }) {
  const img = imageUrl(p.imageKey);
  return (
    <Link href={`/produk/${p.slug}`} className="card">
      <div className={`card-media hexlong ${img ? "" : "hexpat-light"}`}>
        {img ? <img src={img} alt={`Foto ${p.name}`} loading="lazy" /> : <span>Foto {p.name.toLowerCase()} menyusul</span>}
      </div>
      <div className="card-body">
        <h3>{p.name}</h3>
        <p>{p.summary}</p>
        <div className="card-foot">
          <span className="tabular">{priceLabel(p)}</span>
          <span className="card-arrow hex" aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}
