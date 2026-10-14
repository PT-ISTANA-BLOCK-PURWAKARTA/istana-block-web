export function JsonLd({ data }: { data: unknown }) {
  // Escape "<" agar isi JSON tidak bisa menutup tag <script>.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
