import Link from "next/link";
import type { Product } from "@/db/schema";
import { imageUrl, priceLabel } from "@/lib/format";
import { responsif } from "@/lib/img";

export function ProductCard({ p }: { p: Product }) {
  const img = imageUrl(p.imageKey);
  return (
    // prefetch mati: tiap prefetch = satu request ke Worker (batas CPU paket Free).
    <Link prefetch={false} href={`/produk/${p.slug}`} className="card">
      <div className={`card-media hexlong ${img ? "" : "hexpat-light"}`}>
        {img ? <img src={img} {...responsif(img, "(max-width: 720px) 90vw, 380px")} alt={`Foto ${p.name}`} width={800} height={800} loading="lazy" decoding="async" /> : <span>Foto {p.name.toLowerCase()} menyusul</span>}
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
