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
        {img ? (
          <>
            <img src={img} {...responsif(img, "(max-width: 560px) 90vw, (max-width: 1000px) 45vw, 380px")} alt={`Foto ${p.name}`} width={1600} height={1200} loading="lazy" decoding="async" />
            <span className="card-watermark" aria-hidden="true">
              <img src="/brand/logo-istana-block-300.webp" alt="" width={300} height={90} loading="lazy" decoding="async" />
            </span>
          </>
        ) : (
          <span>Foto {p.name.toLowerCase()} menyusul</span>
        )}
      </div>
      <div className="card-body">
        <div className="card-badges">
          <span className="card-badge card-badge-cat">{p.category}</span>
          {p.tkdn && <span className="card-badge card-badge-tkdn">TKDN {p.tkdn.replace(/%$/, "")}%</span>}
        </div>
        <h3>{p.name}</h3>
        <p className="card-summary">{p.summary}</p>
        <div className="card-foot">
          <span className="tabular">{priceLabel(p)}</span>
          <span className="card-arrow hex" aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}
