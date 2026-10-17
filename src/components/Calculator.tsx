"use client";

import { useId, useMemo, useState } from "react";
import { waLink } from "@/lib/format";
import { Select } from "@/components/ui";

const TYPES = [
  { id: "bata", label: "Truepave / bata 21×10,5 cm (44 pcs/m²)", n: 44 },
  { id: "hex", label: "Hexagon 20×20 cm (27 pcs/m²)", n: 27 },
  { id: "ubin21", label: "Fullpave / ubin 21×21 cm (22 pcs/m²)", n: 22 },
  { id: "ubin30", label: "Fullpave 30×30 cm (11 pcs/m²)", n: 11 },
  { id: "grass", label: "Grass block 45×30 cm (7,5 pcs/m²)", n: 7.5 },
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
        <a className="btn btn-primary" href={waLink(whatsapp, msg)} target="_blank" rel="noopener">
          Kirim ke admin
        </a>
      </div>
    </form>
  );
}
