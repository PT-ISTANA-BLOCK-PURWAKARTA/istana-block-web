import Link from "next/link";
import type { ArticleCoverMeta } from "@/db/schema";
import { resolveArticleCover } from "@/lib/article-cover";
import { ArticleCover } from "@/components/ArticleCover";

export type ArticleCardItem = {
  id: number;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  coverSrc: string | null;
  coverMeta?: ArticleCoverMeta | null;
  publishedDate: string;
  publishedMs: number;
  readMinutes: number;
};

export function ArticleCard({
  item,
  eager = false,
  headingLevel = "h2",
}: {
  item: ArticleCardItem;
  eager?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const cover = resolveArticleCover({
    title: item.title,
    category: item.category,
    excerpt: item.excerpt,
    coverMeta: item.coverMeta,
  });

  return (
    <Link prefetch={false} href={`/artikel/${item.slug}`} className="card artikel-card">
      <div className="card-media hexlong">
        <ArticleCover
          variant="card"
          title={cover.title}
          category={cover.badgeCategory}
          themeCategory={cover.themeCategory}
          excerpt={cover.excerpt}
          coverSrc={item.coverSrc}
          sizes="(max-width: 640px) 92vw, (max-width: 960px) 46vw, 380px"
          priority={eager}
        />
      </div>
      <div className="card-body" style={{ paddingTop: 2 }}>
        <div className="artikel-card-meta">
          <span className="artikel-cat">{item.category}</span>
          {item.publishedDate && <span className="small muted">{item.publishedDate}</span>}
        </div>
        <Heading className="artikel-card-title">{item.title}</Heading>
        {item.excerpt && <p className="artikel-excerpt">{item.excerpt}</p>}
        <div className="card-foot artikel-foot">
          <span className="small muted">{item.readMinutes} mnt baca</span>
          <span className="card-arrow hex" aria-hidden="true">→</span>
        </div>
      </div>
    </Link>
  );
}
