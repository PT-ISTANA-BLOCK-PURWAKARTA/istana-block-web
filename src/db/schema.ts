import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export type SpecItem = { label: string; value: string };
export type PriceRow = { group: string; variant: string; detail: string; price: number | null; unit: string };
export type FaqItem = { q: string; a: string };

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Akun kantor masuk dengan email + password. Akun lapangan boleh tanpa email. */
  email: text("email").unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  /** Akun lapangan (operasional, gudang, sopir): nomor HP (disimpan 62…) + PIN 6 digit. */
  phone: text("phone").unique(),
  pinHash: text("pin_hash"),
  /** Akun sopir terhubung ke data sopir (ops_drivers.id) untuk melihat tugas antarnya sendiri. */
  driverId: text("driver_id"),
  /** Peran: owner, web (/situs), keuangan (/akuntansi), operasional, gudang, sopir. */
  roles: text("roles", { mode: "json" }).$type<string[]>().notNull().default(sql`'["owner"]'`),
  ...timestamps,
});

export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start").notNull(),
});

export const categories = [
  "Paving",
  "Saluran",
  "Buis",
  "Kanstin",
  "Atap",
  "Jasa",
  "Lainnya",
] as const;

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Lainnya"),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    priceFrom: integer("price_from"),
    priceTo: integer("price_to"),
    unit: text("unit").notNull().default("pcs"),
    imageKey: text("image_key"),
    specs: text("specs", { mode: "json" }).$type<SpecItem[]>().notNull().default(sql`'[]'`),
    priceRows: text("price_rows", { mode: "json" }).$type<PriceRow[]>().notNull().default(sql`'[]'`),
    faq: text("faq", { mode: "json" }).$type<FaqItem[]>().notNull().default(sql`'[]'`),
    tkdn: text("tkdn"),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    featured: integer("featured", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /** Pesan WhatsApp otomatis untuk tombol di halaman produk; null = pesan standar. */
    waText: text("wa_text"),
    ...timestamps,
  },
  (t) => [index("products_published_idx").on(t.published, t.sortOrder)],
);

export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    content: text("content").notNull().default(""),
    coverKey: text("cover_key"),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ...timestamps,
  },
  (t) => [index("articles_published_idx").on(t.published, t.publishedAt)],
);

export const testimonials = sqliteTable("testimonials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  context: text("context").notNull().default(""),
  quote: text("quote").notNull(),
  rating: integer("rating").notNull().default(5),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Jenis halaman statis: "area" = halaman area pengiriman, "info" = halaman informasi biasa. */
export const pageKinds = ["area", "info"] as const;
export type PageKind = (typeof pageKinds)[number];
export const PAGE_KIND_LABEL: Record<PageKind, string> = { area: "Area pengiriman", info: "Informasi" };

// Halaman statis yang dikelola dari admin dan tayang di /<slug>.
export const pages = sqliteTable(
  "pages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    kind: text("kind").$type<PageKind>().notNull().default("info"),
    excerpt: text("excerpt").notNull().default(""),
    content: text("content").notNull().default(""),
    coverKey: text("cover_key"),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ...timestamps,
  },
  (t) => [index("pages_published_idx").on(t.published, t.kind)],
);

export type Product = typeof products.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type Page = typeof pages.$inferSelect;

export * from "./erp";
