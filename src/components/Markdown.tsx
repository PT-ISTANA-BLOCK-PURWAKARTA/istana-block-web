import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Tabel dibungkus agar bisa digeser ke samping di layar kecil tanpa melebarkan halaman.
const components: Components = {
  table: ({ node: _node, ...props }) => (
    <div className="table-scroll">
      <table {...props} />
    </div>
  ),
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
