"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = { value: string; label: string; hint?: string; group?: string; disabled?: boolean };

type Props = {
  options: SelectOption[];
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Kotak cari di atas daftar. Bawaan: aktif bila pilihan lebih dari 8. */
  searchable?: boolean;
  "aria-label"?: string;
  className?: string;
  /** Lebar minimum daftar pilihan (px). */
  menuWidth?: number;
};

/** Judul lembar di ponsel: teks label tanpa keterangan kecil/tautan di dalamnya. */
function sheetTitle(id: string, fallback: string) {
  const label = document.querySelector(`label[for="${CSS.escape(id)}"]`) ?? document.getElementById(id)?.closest("label");
  if (!label) return fallback;
  const copy = label.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".help, a, small, .ui-select, .ui-date").forEach((n) => n.remove());
  return copy.textContent?.trim() || fallback;
}

const norm = (s: string) => s.toLocaleLowerCase("id").normalize("NFKD").replace(/[̀-ͯ]/g, "");

/**
 * Pilihan (pengganti <select>) bergaya Istana Block: daftar bergrup, cari cepat untuk daftar panjang,
 * navigasi keyboard, dan lembar bawah di ponsel. Nilai dikirim lewat input tersembunyi bernama `name`,
 * jadi bisa dipakai di form server action maupun form GET (filter).
 */
export function Select({ options, id, name, value, defaultValue = "", onChange, placeholder = "Pilih…", required, disabled, searchable, className, menuWidth = 240, ...rest }: Props) {
  const autoId = useId();
  const triggerId = id ?? `sel${autoId}`;
  const listId = `${triggerId}-list`;
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean; sheet: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const canSearch = searchable ?? options.length > 8;

  const selected = options.find((o) => o.value === current);
  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const words = norm(q).split(/\s+/).filter(Boolean);
    return options.filter((o) => {
      const hay = norm(`${o.label} ${o.hint ?? ""} ${o.group ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [options, q]);
  const selectable = filtered.filter((o) => !o.disabled);

  // Form di-reset (mis. setelah simpan) → kembali ke nilai awal.
  useEffect(() => {
    const form = wrap.current?.closest("form");
    if (!form || value !== undefined) return;
    const reset = () => setInner(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue, value]);

  const place = useCallback(() => {
    const t = trigger.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const sheet = window.innerWidth < 640;
    const below = window.innerHeight - r.bottom;
    const up = below < 280 && r.top > below;
    setPos({ top: up ? r.top : r.bottom, left: Math.min(r.left, window.innerWidth - Math.max(r.width, menuWidth) - 8), width: Math.max(r.width, menuWidth), up, sheet });
  }, [menuWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e: Event) => {
      if (pop.current?.contains(e.target as Node)) return;
      place();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (wrap.current?.contains(e.target as Node) || pop.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Pindahkan fokus ke kotak cari/daftar begitu daftar tampil (setelah posisinya dihitung).
  const shown = open && pos !== null;
  useEffect(() => {
    if (!shown) return;
    (canSearch ? search.current : list.current)?.focus({ preventScroll: true });
  }, [shown, canSearch]);

  // Gulir agar pilihan aktif tetap terlihat.
  useEffect(() => {
    if (!shown) return;
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, shown]);

  function openMenu(initial = "") {
    if (disabled) return;
    setPos(null);
    setQ(initial);
    const idx = Math.max(0, options.filter((o) => !o.disabled).findIndex((o) => o.value === current));
    setActive(initial ? 0 : idx);
    setOpen(true);
  }

  function choose(o: SelectOption | undefined) {
    if (!o || o.disabled) return;
    if (value === undefined) setInner(o.value);
    if (o.value !== current) onChange?.(o.value);
    setOpen(false);
    setQ("");
    trigger.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(selectable.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(selectable.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(selectable[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (!canSearch && e.key.length === 1 && /\S/.test(e.key)) {
      // Lompat ke pilihan berawalan huruf yang diketik.
      const i = selectable.findIndex((o, k) => k > active && norm(o.label).startsWith(norm(e.key)));
      const j = i >= 0 ? i : selectable.findIndex((o) => norm(o.label).startsWith(norm(e.key)));
      if (j >= 0) setActive(j);
    }
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    } else if (canSearch && e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      // Ketikan cepat sebelum fokus pindah ke kotak cari tetap tersambung.
      if (open) {
        setQ((x) => x + e.key);
        setActive(0);
      } else openMenu(e.key);
    }
  }

  // Kelompokkan sambil mempertahankan urutan.
  let lastGroup: string | undefined;
  let i = -1;
  const activeId = selectable[active] ? `${listId}-${options.indexOf(selectable[active])}` : undefined;

  const menu = open && pos && (
    <>
    {pos.sheet && <div className="ui-backdrop" aria-hidden="true" />}
    <div
      ref={pop}
      className={`ui-pop${pos.sheet ? " is-sheet" : ""}${pos.up ? " is-up" : ""}`}
      style={pos.sheet ? undefined : { top: pos.up ? undefined : pos.top + 6, bottom: pos.up ? window.innerHeight - pos.top + 6 : undefined, left: Math.max(8, pos.left), width: pos.width }}
    >
      {pos.sheet && <div className="ui-sheet-head">{sheetTitle(triggerId, rest["aria-label"] ?? placeholder)}</div>}
      {canSearch && (
        <input
          ref={search}
          className="ui-select-search"
          type="search"
          placeholder="Ketik untuk mencari…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onListKey}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-label="Cari pilihan"
          autoComplete="off"
        />
      )}
      <ul ref={list} id={listId} role="listbox" tabIndex={canSearch ? -1 : 0} onKeyDown={canSearch ? undefined : onListKey} aria-activedescendant={canSearch ? undefined : activeId} aria-labelledby={triggerId}>
        {filtered.map((o) => {
          const head = o.group && o.group !== lastGroup ? o.group : null;
          lastGroup = o.group;
          if (!o.disabled) i++;
          const k = i;
          const idx = options.indexOf(o);
          return (
            <li key={`${o.value}-${idx}`} role="presentation">
              {head && <div className="ui-opt-group" role="presentation">{head}</div>}
              <div
                id={`${listId}-${idx}`}
                role="option"
                data-value={o.value}
                data-i={o.disabled ? undefined : k}
                aria-selected={o.value === current}
                aria-disabled={o.disabled || undefined}
                className={`ui-opt${!o.disabled && k === active ? " is-active" : ""}`}
                onPointerMove={() => !o.disabled && setActive(k)}
                onClick={() => choose(o)}
              >
                <span className="ui-opt-label">
                  {o.label}
                  {o.hint && <small>{o.hint}</small>}
                </span>
                {o.value === current && (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="ui-opt-empty" role="presentation">Tidak ada yang cocok dengan “{q}”.</li>}
      </ul>
    </div>
    </>
  );

  return (
    <div ref={wrap} className={`ui-select${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}>
      <button
        ref={trigger}
        type="button"
        id={triggerId}
        className="ui-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={rest["aria-label"]}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKey}
      >
        <span className={`ui-select-value${selected && selected.value !== "" ? "" : " is-placeholder"}`}>{selected?.label ?? placeholder}</span>
        <svg className="ui-chevron" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {/* Nilai untuk form + validasi "wajib diisi" bawaan browser. */}
      <input className="ui-proxy" tabIndex={-1} aria-hidden="true" name={name} value={current} required={required} disabled={disabled} onChange={() => {}} onFocus={() => trigger.current?.focus()} />
      {menu && createPortal(menu, document.body)}
    </div>
  );
}
