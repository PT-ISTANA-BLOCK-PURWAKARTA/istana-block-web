"use client";

import { useId, useMemo, useState } from "react";
import { waLink } from "@/lib/format";
import { Select } from "@/components/ui";
import { PAVING_CATALOG } from "@/lib/paving/catalog";

const TYPES = [
  {
    id: "bata",
    label: `Truepave / bata 21×10,5 cm (${PAVING_CATALOG.truepave.labelPcsPerM2} pcs/m²)`,
    n: PAVING_CATALOG.truepave.labelPcsPerM2,
  },
  {
    id: "hex",
    label: `Hexagon 20×20 cm (${PAVING_CATALOG.hexagon.labelPcsPerM2} pcs/m²)`,
    n: PAVING_CATALOG.hexagon.labelPcsPerM2,
  },
  {
    id: "ubin21",
    label: `Fullpave / ubin 21×21 cm (${PAVING_CATALOG.fp21.labelPcsPerM2} pcs/m²)`,
    n: PAVING_CATALOG.fp21.labelPcsPerM2,
  },
  {
    id: "ubin30",
    label: `Fullpave 30×30 cm (${PAVING_CATALOG.fp30.labelPcsPerM2} pcs/m²)`,
    n: PAVING_CATALOG.fp30.labelPcsPerM2,
  },
  {
    id: "grass",
    label: `Grass block 45×30 cm (${String(PAVING_CATALOG.grass.labelPcsPerM2).replace(".", ",")} pcs/m²)`,
    n: PAVING_CATALOG.grass.labelPcsPerM2,
  },
];

const fmt = (n: number) => n.toString().replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function Calculator({ whatsapp }: { whatsapp: string }) {
  const id = useId();
  const [type, setType] = useState("bata");
  const [len, setLen] = useState("10");
  const [wid, setWid] = useState("5");
  const t = TYPES.find((x) => x.id === type) ?? TYPES[0];
  const { area, pcs } = useMemo(() => {
    const a = Math.round((parseFloat(len.replace(",", ".")) || 0) * (parseFloat(wid.replace(",", ".")) || 0) * 100) / 100;
    return { area: a, pcs: Math.ceil(a * t.n * 1.05) };
  }, [len, wid, t.n]);
  const msg = `Halo Istana Block, saya mau pesan paving ${t.label.split(" (")[0]}. Luas ±${fmt(area)} m² (sekitar ${fmt(pcs)} pcs). Lokasi kirim: ...`;

  return (
    <form className="calc-form" onSubmit={(e) => e.preventDefault()}>
      <div className="field full">
        <label htmlFor={`${id}-t`}>Jenis paving</label>
        <Select id={`${id}-t`} value={type} onChange={setType} options={TYPES.map((x) => ({ value: x.id, label: x.label }))} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-l`}>Panjang (m)</label>
        <input id={`${id}-l`} type="number" min="0" step="0.1" inputMode="decimal" value={len} onChange={(e) => setLen(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-w`}>Lebar (m)</label>
        <input id={`${id}-w`} type="number" min="0" step="0.1" inputMode="decimal" value={wid} onChange={(e) => setWid(e.target.value)} />
      </div>
      <div className="calc-result" aria-live="polite">
        <div>
          <div className="small" style={{ color: "var(--biru)" }}>
            {fmt(area)} m² × {fmt(t.n)} pcs/m² + cadangan 5%
          </div>
          <b className="tabular">{fmt(pcs)} pcs</b>
        </div>
        {/* data-cta dibaca pemicu GTM untuk menghitung lead kalkulator terpisah dari klik WhatsApp biasa. */}
        <a className="btn btn-primary" href={waLink(whatsapp, msg)} target="_blank" rel="noopener" data-cta="kalkulator">
          Kirim ke admin
        </a>
      </div>
    </form>
  );
}
