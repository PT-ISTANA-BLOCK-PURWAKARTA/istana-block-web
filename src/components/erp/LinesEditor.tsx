"use client";

import { useMemo, useState } from "react";
import { docTotals, lineAmount } from "@/lib/erp/docs";
import { formatAmount, formatQty, parseQty, parseRupiah } from "@/lib/erp/util";
import { Select, type SelectOption } from "@/components/ui";

export type PickItem = { id: string; code: string; name: string; unit: string; sellPrice: number; buyPrice: number; kind: string };
export type PickAccount = { id: string; code: string; name: string };

export type EditorLine = {
  /** "item:<id>" atau "acc:<id>" (khusus pembelian: biaya langsung ke akun). */
  ref: string;
  description: string;
  qty: string;
  unit: string;
  price: string;
  /** Diteruskan apa adanya (mis. baris pesanan asal). */
  orderLineId?: string | null;
  /** Batas qty (mis. sisa yang belum dikirim/difaktur); hanya untuk info. */
  maxQty?: number | null;
};

type Mode = "sales" | "purchase" | "order";

/**
 * Editor baris dokumen (faktur, pesanan, pembelian) dengan total, diskon, ongkir, dan PPN.
 * Mengirim: lines (JSON), discount, ongkir, taxable.
 */
export function LinesEditor({
  mode,
  items,
  accounts = [],
  initial,
  initialDiscount = 0,
  initialOngkir = 0,
  initialTaxable = false,
  taxRate,
  showOngkir = mode !== "purchase",
}: {
  mode: Mode;
  items: PickItem[];
  accounts?: PickAccount[];
  initial: EditorLine[];
  initialDiscount?: number;
  initialOngkir?: number;
  initialTaxable?: boolean;
  taxRate: number;
  showOngkir?: boolean;
}) {
  const blank = (): EditorLine => ({ ref: "", description: "", qty: "1", unit: "", price: "" });
  const [rows, setRows] = useState<EditorLine[]>(initial.length ? initial : [blank()]);
  const [discount, setDiscount] = useState(initialDiscount ? String(initialDiscount) : "");
  const [ongkir, setOngkir] = useState(initialOngkir ? String(initialOngkir) : "");
  const [taxable, setTaxable] = useState(initialTaxable);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const parsed = rows.map((r) => ({ qty: parseQty(r.qty), price: parseRupiah(r.price) }));
  const t = docTotals(parsed, { discount: parseRupiah(discount), ongkir: showOngkir ? parseRupiah(ongkir) : 0, taxable, taxRate });

  const update = (i: number, patch: Partial<EditorLine>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const pick = (i: number, ref: string) => {
    const [kind, id] = ref.split(":");
    if (kind === "item") {
      const it = itemMap.get(id);
      if (it) {
        update(i, { ref, unit: it.unit, description: rows[i].description || "", price: String(mode === "purchase" ? it.buyPrice || "" : it.sellPrice || "") });
        return;
      }
    }
    update(i, { ref });
  };

  const json = JSON.stringify(
    rows.map((r) => ({ ref: r.ref, description: r.description.trim(), qty: parseQty(r.qty), unit: r.unit.trim(), price: parseRupiah(r.price), orderLineId: r.orderLineId ?? null })),
  );

  const groups = {
    barang_jadi: items.filter((i) => i.kind === "barang_jadi"),
    jasa: items.filter((i) => i.kind === "jasa"),
    bahan_baku: items.filter((i) => i.kind === "bahan_baku"),
    lainnya: items.filter((i) => i.kind === "lainnya"),
  };
  const groupLabel = { barang_jadi: "Barang jadi", jasa: "Jasa", bahan_baku: "Bahan baku", lainnya: "Lain-lain" } as const;
  const order = mode === "purchase" ? (["bahan_baku", "lainnya", "barang_jadi", "jasa"] as const) : (["barang_jadi", "jasa", "lainnya", "bahan_baku"] as const);
  const refOptions: SelectOption[] = [
    ...order.flatMap((g) =>
      groups[g].map((it) => {
        const price = mode === "purchase" ? it.buyPrice : it.sellPrice;
        return { value: `item:${it.id}`, label: it.name, hint: [it.code, price ? `Rp ${formatAmount(price)}/${it.unit}` : it.unit].join(" · "), group: groupLabel[g] };
      }),
    ),
    ...(mode === "purchase" ? accounts.map((a) => ({ value: `acc:${a.id}`, label: `${a.code} · ${a.name}`, group: "Biaya langsung ke akun" })) : []),
  ];

  return (
    <div className="lines">
      <input type="hidden" name="lines" value={json} />
      <div className="lines-table" role="table" aria-label="Rincian barang">
        <div className="lines-head" role="row">
          <span role="columnheader">{mode === "purchase" ? "Barang / akun biaya" : "Barang / jasa"}</span>
          <span role="columnheader">Keterangan</span>
          <span role="columnheader" className="num">Qty</span>
          <span role="columnheader">Satuan</span>
          <span role="columnheader" className="num">Harga</span>
          <span role="columnheader" className="num">Jumlah</span>
          <span role="columnheader" aria-label="Hapus" />
        </div>
        {rows.map((r, i) => {
          const amt = lineAmount(parsed[i]);
          const over = r.maxQty != null && parsed[i].qty > r.maxQty + 1e-9;
          return (
            <div className="lines-row" role="row" key={i}>
              <Select aria-label={`Barang baris ${i + 1}`} value={r.ref} onChange={(v) => pick(i, v)} required options={refOptions} placeholder="Pilih barang…" searchable menuWidth={340} />
              <input aria-label={`Keterangan baris ${i + 1}`} value={r.description} placeholder="opsional" onChange={(e) => update(i, { description: e.target.value })} />
              <div className="qty-cell">
                <input aria-label={`Qty baris ${i + 1}`} className="num" inputMode="decimal" value={r.qty} onChange={(e) => update(i, { qty: e.target.value })} aria-invalid={over || undefined} />
                {r.maxQty != null && <span className={`small ${over ? "text-bahaya" : "muted"}`}>maks {formatQty(r.maxQty)}</span>}
              </div>
              <input aria-label={`Satuan baris ${i + 1}`} value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} />
              <input aria-label={`Harga baris ${i + 1}`} className="num" inputMode="numeric" value={r.price} onChange={(e) => update(i, { price: e.target.value })} />
              <output className="num tabular" aria-label={`Jumlah baris ${i + 1}`}>{formatAmount(amt)}</output>
              <button type="button" className="icon-btn" aria-label={`Hapus baris ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))}>
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="lines-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((rs) => [...rs, blank()])}>
          + Tambah baris
        </button>
        <dl className="totals">
          <dt>Subtotal</dt>
          <dd className="tabular">{formatAmount(t.subtotal)}</dd>
          <dt><label htmlFor="le-discount">Diskon</label></dt>
          <dd><input id="le-discount" name="discount" className="num" inputMode="numeric" value={discount} placeholder="0" onChange={(e) => setDiscount(e.target.value)} /></dd>
          {showOngkir && (
            <>
              <dt><label htmlFor="le-ongkir">Ongkos kirim</label></dt>
              <dd><input id="le-ongkir" name="ongkir" className="num" inputMode="numeric" value={ongkir} placeholder="0" onChange={(e) => setOngkir(e.target.value)} /></dd>
            </>
          )}
          <dt>
            <label className="check" style={{ minHeight: 0 }}>
              <input type="checkbox" name="taxable" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} />
              PPN {formatQty(taxRate)}%
            </label>
          </dt>
          <dd className="tabular">{formatAmount(t.tax)}</dd>
          <dt className="grand">Total</dt>
          <dd className="grand tabular">Rp{formatAmount(t.total)}</dd>
        </dl>
      </div>
    </div>
  );
}
