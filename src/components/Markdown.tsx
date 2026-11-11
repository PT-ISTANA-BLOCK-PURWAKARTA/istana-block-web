import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownImage } from "@/components/MarkdownImage";

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
  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
