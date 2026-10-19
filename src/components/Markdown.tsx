import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Tabel dibungkus agar bisa digeser ke samping di layar kecil tanpa melebarkan halaman.
const components: Components = {
  table: ({ node: _node, ...props }) => (
    <div className="table-scroll">
      <table {...props} />
    </div>
  ),
  // Foto di isi artikel/halaman biasanya jauh di bawah lipatan: tunda muat dan decode di luar utas utama.
  // Sampul artikel bukan lewat sini (itu <img className="article-cover"> di halamannya sendiri).
  img: ({ node: _node, alt, ...props }) => <img loading="lazy" decoding="async" alt={alt ?? ""} {...props} />,
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
