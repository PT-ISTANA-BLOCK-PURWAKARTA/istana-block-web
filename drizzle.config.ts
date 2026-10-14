import { defineConfig } from "drizzle-kit";

// Hanya untuk membuat file migrasi SQL (`npm run db:generate`).
// Migrasi dijalankan oleh Wrangler: `npm run db:migrate:local` / `db:migrate:remote`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
