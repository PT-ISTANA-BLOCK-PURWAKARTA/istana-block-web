import clients from "@/data/clients.json";

/** Strip logo klien/proyek. Logo dinormalisasi ke kanvas 320×120 agar ukuran optiknya seimbang. */
export function ClientLogos({ label = "Dipercaya untuk proyek" }: { label?: string }) {
  if (!clients.length) return null;
  return (
    <div className="clients">
      <p className="clients-label">{label}</p>
      <ul>
        {clients.map((c) => (
          <li key={c.id}>
            <img src={c.logo} alt={c.name} width={Math.round((c.w / c.h) * 60)} height={60} loading="lazy" decoding="async" />
          </li>
        ))}
      </ul>
    </div>
  );
}
