import Link from "next/link";
import { and, asc, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Select } from "@/components/ui";
import { getDb, schema } from "@/db";
import { articleCategories } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { imageUrl, tanggal } from "@/lib/format";
import { deleteArticle, toggleArticlePublished } from "../../actions/articles";
import { ArticleToggleButton } from "./ArticleToggleButton";

export const metadata = { title: "Artikel" };

const PER_PAGE = 25;
const STATUS_TABS = [
  { key: "semua", label: "Semua" },
  { key: "terbit", label: "Terbit" },
  { key: "draf", label: "Draf" },
] as const;

const SORT_OPTIONS = [
  { value: "diubah", label: "Diubah terbaru" },
  { value: "terbit", label: "Terbit terbaru" },
  { value: "judul", label: "Judul A–Z" },
] as const;

type SP = {
  ok?: string;
  status?: string;
  kategori?: string;
  q?: string;
  urut?: string;
  hal?: string;
};

function buildUrl(params: { status?: string; kategori?: string; q?: string; urut?: string; hal?: number }) {
  const sp = new URLSearchParams();
  if (params.status && params.status !== "semua") sp.set("status", params.status);
  if (params.kategori) sp.set("kategori", params.kategori);
  if (params.q) sp.set("q", params.q);
  if (params.urut && params.urut !== "diubah") sp.set("urut", params.urut);
  if (params.hal && params.hal > 1) sp.set("hal", String(params.hal));
  const qs = sp.toString();
  return qs ? `/situs/artikel?${qs}` : "/situs/artikel";
}

function pageWindow(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export default async function AdminArtikel({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = STATUS_TABS.some((t) => t.key === sp.status) ? (sp.status as (typeof STATUS_TABS)[number]["key"]) : "semua";
  const kategori = (articleCategories as readonly string[]).includes(sp.kategori ?? "") ? (sp.kategori as string) : "";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const urut = SORT_OPTIONS.some((o) => o.value === sp.urut) ? (sp.urut as (typeof SORT_OPTIONS)[number]["value"]) : "diubah";
  const reqPage = Math.max(1, parseInt(sp.hal ?? "1", 10) || 1);

  const db = await getDb();
  const { articles } = schema;

  const baseFilters: SQL[] = [];
  if (kategori) baseFilters.push(eq(articles.category, kategori));
  if (q) {
    const pattern = `%${q}%`;
    const matchQ = or(like(articles.title, pattern), like(articles.slug, pattern));
    if (matchQ) baseFilters.push(matchQ);
  }
  const baseWhere = baseFilters.length ? and(...baseFilters) : undefined;

  const fullFilters: SQL[] = [...baseFilters];
  if (status === "terbit") fullFilters.push(eq(articles.published, true));
  else if (status === "draf") fullFilters.push(eq(articles.published, false));
  const fullWhere = fullFilters.length ? and(...fullFilters) : undefined;

  const orderBy =
    urut === "terbit"
      ? [desc(articles.publishedAt), desc(articles.id)]
      : urut === "judul"
        ? [asc(articles.title)]
        : [desc(articles.updatedAt), desc(articles.id)];

  const [[totalAll], [totalPub], [totalDraft], [totalMatched]] = await Promise.all([
    db.select({ n: count() }).from(articles).where(baseWhere),
    db.select({ n: count() }).from(articles).where(baseWhere ? and(baseWhere, eq(articles.published, true)) : eq(articles.published, true)),
    db.select({ n: count() }).from(articles).where(baseWhere ? and(baseWhere, eq(articles.published, false)) : eq(articles.published, false)),
    db.select({ n: count() }).from(articles).where(fullWhere),
  ]);

  const totalItems = totalMatched.n;
  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));
  const page = Math.min(reqPage, totalPages);
  const offset = (page - 1) * PER_PAGE;

  const rows = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      category: articles.category,
      coverKey: articles.coverKey,
      published: articles.published,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(fullWhere)
    .orderBy(...orderBy)
    .limit(PER_PAGE)
    .offset(offset);

  const counts = { semua: totalAll.n, terbit: totalPub.n, draf: totalDraft.n };
  const hasActiveFilter = status !== "semua" || Boolean(kategori) || Boolean(q) || urut !== "diubah";
  const startIdx = totalItems === 0 ? 0 : offset + 1;
  const endIdx = Math.min(totalItems, offset + rows.length);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Artikel</h1>
          <p className="muted">Kelola artikel, kategori topik, gambar sampul, dan status terbit.</p>
        </div>
        <Link href="/situs/artikel/baru" className="btn btn-primary">+ Tulis artikel</Link>
      </div>
      {sp.ok && <p className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>“{sp.ok}” tersimpan.</p>}

      <form className="filter-bar" method="get" action="/situs/artikel">
        <nav className="seg" aria-label="Filter status artikel">
          {STATUS_TABS.map((t) => (
            <Link
              key={t.key}
              href={buildUrl({ status: t.key, kategori, q, urut })}
              aria-current={t.key === status ? "page" : undefined}
            >
              {t.label} ({counts[t.key]})
            </Link>
          ))}
        </nav>
        {status !== "semua" && <input type="hidden" name="status" value={status} />}
        <div className="field">
          <label htmlFor="f-kat">Kategori</label>
          <Select
            id="f-kat"
            name="kategori"
            defaultValue={kategori}
            searchable={false}
            menuWidth={230}
            options={[{ value: "", label: "Semua kategori" }, ...articleCategories.map((c) => ({ value: c, label: c }))]}
          />
        </div>
        <div className="field">
          <label htmlFor="f-urut">Urutkan</label>
          <Select
            id="f-urut"
            name="urut"
            defaultValue={urut}
            searchable={false}
            menuWidth={190}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <div className="field grow">
          <label htmlFor="f-q">Cari judul atau slug</label>
          <input id="f-q" name="q" defaultValue={q} placeholder="mis. paving, K-350, buis..." maxLength={100} />
        </div>
        <button type="submit" className="btn btn-blue btn-sm">Terapkan</button>
        {hasActiveFilter && <Link href="/situs/artikel" className="btn btn-ghost btn-sm">Reset</Link>}
      </form>

      <div className="admin-list-meta small muted" style={{ marginBottom: 10 }}>
        Menampilkan {startIdx}–{endIdx} dari {totalItems} artikel
        {totalPages > 1 ? ` · Halaman ${page} dari ${totalPages}` : ""}
      </div>

      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>Sampul</th>
              <th>Judul</th>
              <th>Kategori</th>
              <th>Status</th>
              <th>Terbit</th>
              <th>Diubah</th>
              <th className="num">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const img = imageUrl(a.coverKey);
              return (
                <tr key={a.id}>
                  <td>
                    {img ? <img src={img} alt="" className="thumb" loading="lazy" decoding="async" /> : <div className="thumb hexpat-light" />}
                  </td>
                  <td>
                    <Link href={`/situs/artikel/${a.id}`} style={{ fontWeight: 700 }}>{a.title}</Link>
                    <div className="small muted">/artikel/{a.slug}</div>
                  </td>
                  <td><span className="badge badge-info">{a.category}</span></td>
                  <td>
                    <span className={`badge ${a.published ? "badge-on" : "badge-off"}`}>{a.published ? "Terbit" : "Draf"}</span>
                  </td>
                  <td className="small">{tanggal(a.publishedAt) || "—"}</td>
                  <td className="small">{tanggal(a.updatedAt)}</td>
                  <td className="num">
                    <div className="admin-row-actions">
                      {a.published && <Link href={`/artikel/${a.slug}`} target="_blank" rel="noopener">Lihat ↗</Link>}
                      <Link href={`/situs/artikel/${a.id}`}>Ubah</Link>
                      <ArticleToggleButton action={toggleArticlePublished.bind(null, a.id)} published={a.published} />
                      <DeleteButton action={deleteArticle.bind(null, a.id)} confirmText={`Hapus artikel "${a.title}"?`} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: 28, textAlign: "center" }}>
                  {hasActiveFilter ? "Tidak ada artikel yang cocok dengan filter ini." : "Belum ada artikel."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="admin-pager" aria-label="Halaman daftar artikel">
          {page > 1 ? (
            <Link href={buildUrl({ status, kategori, q, urut, hal: page - 1 })} className="btn btn-ghost btn-sm">← Sebelumnya</Link>
          ) : (
            <span className="btn btn-ghost btn-sm is-disabled" aria-disabled="true">← Sebelumnya</span>
          )}
          <div className="pager-nums">
            {pageWindow(page, totalPages).map((item, idx) =>
              item === "..." ? (
                <span key={`e-${idx}`} className="pager-gap">…</span>
              ) : (
                <Link
                  key={item}
                  href={buildUrl({ status, kategori, q, urut, hal: item })}
                  className={`pager-num${item === page ? " is-active" : ""}`}
                  aria-current={item === page ? "page" : undefined}
                >
                  {item}
                </Link>
              ),
            )}
          </div>
          {page < totalPages ? (
            <Link href={buildUrl({ status, kategori, q, urut, hal: page + 1 })} className="btn btn-ghost btn-sm">Berikutnya →</Link>
          ) : (
            <span className="btn btn-ghost btn-sm is-disabled" aria-disabled="true">Berikutnya →</span>
          )}
        </nav>
      )}
    </>
  );
}
