import { ZoomableImage } from "@/components/ImageLightbox";
import { categoryCoverTheme, isRealArticleCover } from "@/lib/article-cover";
import { responsif } from "@/lib/img";

function CategoryMotif({ category, accent }: { category: string; accent: string }) {
  switch (category) {
    case "Genteng & Atap":
      return (
        <svg viewBox="0 0 180 140" fill="none" aria-hidden="true" className="artikel-dyn-svg">
          <path d="M16 96L90 30L164 96" stroke="#fff" strokeWidth="3" strokeOpacity=".34" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 106L90 56L144 106" stroke={accent} strokeWidth="2.5" strokeOpacity=".65" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M52 114H128" stroke="#fff" strokeWidth="2" strokeOpacity=".24" strokeDasharray="5 5" />
          <circle cx="90" cy="30" r="5" fill={accent} fillOpacity=".85" />
        </svg>
      );
    case "U-Ditch & Saluran":
      return (
        <svg viewBox="0 0 180 140" fill="none" aria-hidden="true" className="artikel-dyn-svg">
          <path d="M38 30V96C38 104 44 110 52 110H128C136 110 142 104 142 96V30H122V90H58V30H38Z" stroke="#fff" strokeWidth="2.5" strokeOpacity=".34" strokeLinejoin="round" />
          <path d="M58 64H122M58 80H122" stroke={accent} strokeWidth="2.5" strokeOpacity=".7" strokeDasharray="6 4" />
        </svg>
      );
    case "Buis & Gorong-gorong":
      return (
        <svg viewBox="0 0 180 140" fill="none" aria-hidden="true" className="artikel-dyn-svg">
          <circle cx="96" cy="70" r="46" stroke="#fff" strokeWidth="2.5" strokeOpacity=".32" />
          <circle cx="96" cy="70" r="30" stroke={accent} strokeWidth="2.5" strokeOpacity=".7" />
          <circle cx="96" cy="70" r="14" stroke="#fff" strokeWidth="2" strokeOpacity=".26" strokeDasharray="4 4" />
        </svg>
      );
    case "Kanstin":
      return (
        <svg viewBox="0 0 180 140" fill="none" aria-hidden="true" className="artikel-dyn-svg">
          <path d="M36 104V40H78L104 68V104H36Z" stroke="#fff" strokeWidth="2.5" strokeOpacity=".34" strokeLinejoin="round" />
          <path d="M104 68L136 52V88L104 104" stroke={accent} strokeWidth="2.5" strokeOpacity=".7" strokeLinejoin="round" />
          <path d="M36 40L68 24H110L136 52" stroke="#fff" strokeWidth="2" strokeOpacity=".26" strokeLinejoin="round" />
        </svg>
      );
    case "Beton Cor & Konstruksi":
      return (
        <svg viewBox="0 0 180 140" fill="none" aria-hidden="true" className="artikel-dyn-svg">
          <polygon points="96,24 140,48 140,94 96,118 52,94 52,48" stroke="#fff" strokeWidth="2.5" strokeOpacity=".3" />
          <path d="M52 48L96 72L140 48M96 72V118" stroke={accent} strokeWidth="2.5" strokeOpacity=".7" />
          <circle cx="96" cy="72" r="4" fill={accent} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 180 140" fill="none" aria-hidden="true" className="artikel-dyn-svg">
          <polygon points="64,34 86,22 108,34 108,58 86,70 64,58" stroke="#fff" strokeWidth="2.5" strokeOpacity=".34" />
          <polygon points="108,58 130,46 152,58 152,82 130,94 108,82" stroke={accent} strokeWidth="2.5" strokeOpacity=".72" />
          <polygon points="64,82 86,70 108,82 108,106 86,118 64,106" stroke="#fff" strokeWidth="2" strokeOpacity=".28" />
        </svg>
      );
  }
}

export function ArticleCover({
  variant,
  title,
  category,
  excerpt,
  coverSrc,
  topics = [],
  sizes,
  priority = false,
}: {
  variant: "card" | "spotlight" | "hero";
  title: string;
  category: string;
  excerpt?: string;
  coverSrc?: string | null;
  topics?: string[];
  sizes?: string;
  priority?: boolean;
}) {
  const hasReal = isRealArticleCover(coverSrc);

  if (variant === "hero") {
    if (hasReal) {
      const resp = sizes ? responsif(coverSrc, sizes) : undefined;
      return (
        <figure className="article-hero-frame">
          <ZoomableImage
            src={coverSrc}
            alt={title}
            caption={title}
            srcSet={resp?.srcSet}
            sizes={resp?.sizes}
            className="article-hero-zoom"
            imgClassName="article-hero-img"
            width={1200}
            height={675}
            fetchPriority={priority ? "high" : undefined}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          >
            <span className="article-zoom-pill" aria-hidden="true">Perbesar gambar</span>
          </ZoomableImage>
        </figure>
      );
    }

    const theme = categoryCoverTheme(category);
    return (
      <div
        className="article-cover-hex hexlong hexpat"
        style={{
          ["--cov-from" as string]: theme.bgFrom,
          ["--cov-to" as string]: theme.bgTo,
          ["--cov-acc" as string]: theme.accent,
        }}
        role="region"
        aria-label={`Ringkasan visual panduan ${title}`}
      >
        <CategoryMotif category={category} accent={theme.accent} />
        <div className="article-cover-hex-inner">
          <div className="artikel-dyn-kicker">
            <span className="artikel-dyn-dot" aria-hidden="true" />
            <span>Istana Block · {category}</span>
          </div>
          <p className="artikel-dyn-title">{title}</p>
          {excerpt && <p className="artikel-dyn-excerpt">{excerpt}</p>}
          {topics.length > 0 && (
            <ul className="artikel-dyn-topics" aria-label="Poin pembahasan">
              {topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (hasReal) {
    const resp = sizes ? responsif(coverSrc, sizes) : {};
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={coverSrc}
        {...resp}
        alt={title}
        width={1200}
        height={675}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
    );
  }

  const theme = categoryCoverTheme(category);
  return (
    <div
      className={`artikel-dyn-cover is-${variant} hexpat`}
      style={{
        ["--cov-from" as string]: theme.bgFrom,
        ["--cov-to" as string]: theme.bgTo,
        ["--cov-acc" as string]: theme.accent,
      }}
      aria-hidden="true"
    >
      <CategoryMotif category={category} accent={theme.accent} />
      <div className="artikel-dyn-inner">
        <span className="artikel-dyn-badge">
          <i className="artikel-dyn-dot" />
          {category}
        </span>
        <span className="artikel-dyn-title">{title}</span>
        {excerpt && <span className="artikel-dyn-sub">{excerpt}</span>}
      </div>
    </div>
  );
}
