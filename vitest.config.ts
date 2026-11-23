import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: [
      "src/lib/__tests__/**/*.test.ts",
      "src/lib/paving/**/__tests__/**/*.test.ts",
      "src/components/__tests__/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
