import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownImage } from "@/components/MarkdownImage";

/**
 * Menormalkan loncatan level heading Markdown (mis. h1 -> h3 atau h2 -> h4 atau heading kosong)
 * supaya struktur dokumen di bawah H1 halaman tetap berurutan (H2 -> H3 -> H4) dan lolos audit aksesibilitas/SEO.
 */
function normalizeMarkdownHeadings(src: string): string {
  const lines = src.split(/\r?\n/);
  let inFence = false;
  let lastLevel = 1; // H1 halaman berada di header artikel/halaman
  return lines
    .map((line) => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const m = line.match(/^(#{1,6})\s*(.*)$/);
      if (!m) return line;
      const text = m[2].trim();
      if (!text) return ""; // buang heading kosong agar tidak mematahkan urutan outline
      const rawLevel = Math.max(2, m[1].length); // jangan pernah keluarkan H1 kedua di body
      const nextLevel = Math.min(rawLevel, lastLevel + 1, 6);
      lastLevel = nextLevel;
      return `${"#".repeat(nextLevel)} ${text}`;
    })
    .join("\n");
}

// Tabel dibungkus agar bisa digeser ke samping di layar kecil tanpa melebarkan halaman.
const components: Components = {
  table: ({ node: _node, ...props }) => (
    <div className="table-scroll">
      <table {...props} />
    </div>
  ),
  // Foto di isi artikel/halaman dibuka dalam modal backdrop saat diklik agar tidak membuka tab baru.
  // Sampul artikel bukan lewat sini (itu <ArticleCover> di halamannya sendiri).
  img: ({ node: _node, ...props }) => <MarkdownImage {...props} />,
};

// react-markdown tidak merender HTML mentah (tanpa rehype-raw), jadi aman dari skrip yang disisipkan.
// remark-gfm menambah tabel, coretan (~~teks~~), daftar centang, dan tautan otomatis.
export function Markdown({ children }: { children: string }) {
  const normalized = normalizeMarkdownHeadings(children);
  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
