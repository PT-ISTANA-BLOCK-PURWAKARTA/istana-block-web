"use client";

import Link from "next/link";
import { categories, type Product } from "@/db/schema";
import { ActionForm } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/ImageField";
import { Repeater } from "@/components/admin/Repeater";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveProduct } from "../../actions/products";

export function ProductForm({ product, imageSrc }: { product?: Product; imageSrc: string | null }) {
  const p = product;
  return (
    <ActionForm action={saveProduct} className="stack" style={{ gap: 20 }}>
      {p && <input type="hidden" name="id" value={p.id} />}

      <section className="form-section">
        <h2>Informasi utama</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Nama produk</label>
            <input id="name" name="name" defaultValue={p?.name} required />
          </div>
          <div className="field">
            <label htmlFor="category">Kategori</label>
            <select id="category" name="category" defaultValue={p?.category ?? "Paving"}>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="slug">Slug URL <span className="help">kosongkan untuk dibuat dari nama</span></label>
            <input id="slug" name="slug" defaultValue={p?.slug} placeholder="contoh: u-ditch" />
          </div>
          <div className="field">
            <label htmlFor="unit">Satuan harga</label>
            <input id="unit" name="unit" defaultValue={p?.unit ?? "pcs"} required placeholder="m², pcs, unit, buah" />
          </div>
          <div className="field full">
            <label htmlFor="summary">Ringkasan <span className="help">tampil di kartu produk & bagian atas halaman</span></label>
            <textarea id="summary" name="summary" defaultValue={p?.summary} rows={3} maxLength={400} />
          </div>
          <div className="field full">
            <label htmlFor="waText">Pesan WhatsApp otomatis <span className="help">kosong = pesan standar</span></label>
            <textarea id="waText" name="waText" defaultValue={p?.waText ?? ""} rows={2} maxLength={600} placeholder={`Halo Istana Block, saya mau tanya harga ${p?.name ?? "…"}. Ukuran: ..., jumlah: ..., lokasi kirim: ...`} />
          </div>
          <div className="field">
            <label htmlFor="priceFrom">Harga mulai (Rp) <span className="help">kosongkan = diambil dari tabel harga</span></label>
            <input id="priceFrom" name="priceFrom" inputMode="numeric" defaultValue={p?.priceFrom ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="priceTo">Harga tertinggi (Rp) <span className="help">opsional</span></label>
            <input id="priceTo" name="priceTo" inputMode="numeric" defaultValue={p?.priceTo ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="tkdn">Nilai TKDN (%) <span className="help">opsional, contoh 91,58</span></label>
            <input id="tkdn" name="tkdn" defaultValue={p?.tkdn ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="sortOrder">Urutan tampil <span className="help">angka kecil tampil lebih dulu</span></label>
            <input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={p?.sortOrder ?? 0} />
          </div>
          <div className="full" style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            <label className="check"><input type="checkbox" name="published" defaultChecked={p?.published ?? true} /> Tampilkan di situs</label>
            <label className="check"><input type="checkbox" name="featured" defaultChecked={p?.featured ?? true} /> Tampilkan di beranda</label>
          </div>
        </div>
        <ImageField name="image" current={imageSrc} label="Foto produk" />
      </section>

      <section className="form-section">
        <h2>Spesifikasi singkat</h2>
        <p className="help">Tampil sebagai kotak di samping foto, misalnya Mutu beton → K-350.</p>
        <Repeater
          name="specs"
          addLabel="Tambah spesifikasi"
          initial={p?.specs ?? []}
          columns={[
            { key: "label", label: "Label", placeholder: "Mutu beton" },
            { key: "value", label: "Nilai", width: "1.4fr", placeholder: "K-350" },
          ]}
        />
      </section>

      <section className="form-section">
        <h2>Tabel harga</h2>
        <p className="help">Isi kolom Grup untuk memisahkan tabel, misalnya &quot;U-Ditch&quot; dan &quot;Cover heavy duty&quot;. Harga cukup angka.</p>
        <Repeater
          name="priceRows"
          addLabel="Tambah baris harga"
          initial={(p?.priceRows ?? []).map((r) => ({ ...r, price: r.price ?? "" }))}
          columns={[
            { key: "group", label: "Grup", width: "1fr", placeholder: "U-Ditch" },
            { key: "variant", label: "Ukuran / jenis", width: "1.3fr", placeholder: "300 × 300 × 1200" },
            { key: "detail", label: "Keterangan", width: "1.3fr", placeholder: "163,3 kg" },
            { key: "price", label: "Harga (Rp)", width: "0.9fr", type: "number", placeholder: "270000" },
            { key: "unit", label: "Satuan", width: "0.6fr", placeholder: "unit" },
          ]}
        />
      </section>

      <section className="form-section">
        <h2>Deskripsi lengkap</h2>
        <div className="field">
          <label htmlFor="description">Isi halaman produk <span className="help">mendukung Markdown: ## Judul, **tebal**, - daftar, [tautan](/produk/u-ditch)</span></label>
          <textarea id="description" name="description" className="tall" defaultValue={p?.description} />
        </div>
      </section>

      <section className="form-section">
        <h2>Pertanyaan umum (FAQ)</h2>
        <Repeater
          name="faq"
          addLabel="Tambah pertanyaan"
          initial={p?.faq ?? []}
          columns={[
            { key: "q", label: "Pertanyaan", type: "textarea" },
            { key: "a", label: "Jawaban", width: "1.6fr", type: "textarea" },
          ]}
        />
      </section>

      <section className="form-section">
        <h2>SEO</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="seoTitle">Judul SEO <span className="help">≤ 60 karakter; kosong = &quot;Harga [nama] Purwakarta&quot;</span></label>
            <input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={p?.seoTitle ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="seoDescription">Deskripsi SEO <span className="help">120–155 karakter</span></label>
            <textarea id="seoDescription" name="seoDescription" maxLength={170} rows={3} defaultValue={p?.seoDescription ?? ""} />
          </div>
        </div>
      </section>

      <div className="form-actions">
        <SubmitButton>{p ? "Simpan perubahan" : "Tambah produk"}</SubmitButton>
        <Link href="/situs/produk" className="btn btn-ghost">Batal</Link>
        {p && <Link href={`/produk/${p.slug}`} target="_blank">Lihat di situs ↗</Link>}
      </div>
    </ActionForm>
  );
}
