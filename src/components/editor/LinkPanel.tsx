"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

type Suggestion = { label: string; href: string; kind: string };
let cache: Promise<Suggestion[]> | null = null;
const loadLinks = () =>
  (cache ??= fetch("/api/situs/tautan")
    .then((r) => (r.ok ? (r.json() as Promise<{ links?: Suggestion[] }>) : { links: [] as Suggestion[] }))
    .then((d: { links?: Suggestion[] }) => d.links ?? [])
    .catch(() => {
      cache = null;
      return [];
    }));

/**
 * Ubah ketikan menjadi alamat tautan yang aman: /produk/x, https://…, mailto:, tel:, atau #bagian.
 * "istanablock.com" → https://istanablock.com, "0813 1234 5678" → tel:, email → mailto:.
 * Mengembalikan null untuk alamat yang tidak dikenali (termasuk javascript:).
 */
export function normalizeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v.replace(/\s/g, "%20");
  if (v.startsWith("/") || v.startsWith("#")) return v.replace(/\s/g, "-");
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return `mailto:${v}`;
  if (/^\+?\d[\d\s-]{6,}$/.test(v)) return `tel:${v.replace(/[\s-]/g, "")}`;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(v)) return `https://${v}`;
  return null;
}

const norm = (s: string) => s.toLocaleLowerCase("id");

/** Panel tautan: cari halaman situs (produk, artikel, halaman) atau tempel alamat luar. */
export function LinkPanel({ editor, currentHref, onClose }: { editor: Editor; currentHref: string; onClose: () => void }) {
  const emptySel = editor.state.selection.empty && !editor.isActive("link");
  const [href, setHref] = useState(currentHref);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [links, setLinks] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    void loadLinks().then(setLinks);
  }, []);

  const q = norm(href.trim());
  const matches = useMemo(() => {
    if (!links.length) return [];
    if (!q || q.startsWith("http") || q.includes("@")) return q ? [] : links.slice(0, 6);
    const words = q.replace(/^\//, "").split(/[\s/-]+/).filter(Boolean);
    return links.filter((l) => words.every((w) => norm(`${l.label} ${l.href}`).includes(w))).slice(0, 8);
  }, [links, q]);

  function apply(target = href) {
    const url = normalizeHref(target);
    if (!url) {
      setError("Alamat belum dikenali. Pilih halaman dari daftar, atau tulis lengkap seperti https://contoh.com.");
      return;
    }
    const chain = editor.chain().focus();
    if (emptySel) {
      const label = text.trim() || links.find((l) => l.href === url)?.label || url;
      chain.insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href: url } }] }).insertContent(" ").run();
    } else {
      chain.extendMarkRange("link").setLink({ href: url }).run();
    }
    onClose();
  }

  function pick(s: Suggestion) {
    setHref(s.href);
    if (emptySel && !text.trim()) setText(s.label);
    setError("");
    if (!emptySel) apply(s.href);
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      // Jangan sampai mengirim form artikel.
      e.preventDefault();
      if (matches[active] && document.activeElement === input.current && !/^(https?:|\/|#|mailto:|tel:)/i.test(href.trim())) pick(matches[active]);
      else apply();
    } else if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault();
      setActive((a) => Math.min(matches.length - 1, a + 1));
    } else if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    }
  };

  return (
    <div className="rte-panel rte-link" role="group" aria-label="Tautan">
      <div className="rte-link-fields">
        <label className="rte-field">
          <span>Alamat atau cari halaman</span>
          <input
            ref={input}
            value={href}
            placeholder="Ketik nama produk/artikel, atau tempel https://…"
            onChange={(e) => {
              setHref(e.target.value);
              setActive(0);
              setError("");
            }}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded={matches.length > 0}
            aria-controls="rte-link-list"
            aria-activedescendant={matches[active] ? `rte-link-${active}` : undefined}
            autoComplete="off"
          />
        </label>
        {emptySel && (
          <label className="rte-field">
            <span>Teks yang ditampilkan</span>
            <input value={text} placeholder="mis. lihat harga paving" onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
          </label>
        )}
      </div>
      {matches.length > 0 && (
        <ul id="rte-link-list" className="rte-link-list" role="listbox" aria-label="Halaman situs">
          {matches.map((m, i) => (
            <li
              key={m.href}
              id={`rte-link-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => setActive(i)}
              onClick={() => pick(m)}
            >
              <span>{m.label}</span>
              <small>{m.kind} · {m.href}</small>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="rte-err" role="alert">{error}</p>}
      <div className="rte-panel-row">
        <button type="button" className="btn btn-blue btn-sm" onClick={() => apply()}>Pasang tautan</button>
        {currentHref && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              onClose();
            }}
          >
            Lepas tautan
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Batal</button>
      </div>
    </div>
  );
}
