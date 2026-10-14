import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Halaman publik dirender dinamis dari D1, jadi tidak perlu incremental cache.
export default defineCloudflareConfig({});
