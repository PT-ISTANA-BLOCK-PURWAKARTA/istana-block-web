"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Tanggal hari ini menurut WIB (sama dengan server). */
function todayIso() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** "2026-10-17" → "17/10/2026". */
const toText = (v: string) => (isIso(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : "");

/** Ketikan pengguna → ISO. Menerima 17/10/2026, 17-10-2026, 17.10.26, 2026-10-17, "17 okt 2026". */
function parseText(t: string): string | null {
  const s = t.trim().toLowerCase();
  if (!s) return "";
  if (isIso(s)) return s;
  let m = s.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const v = iso(y, Number(m[2]) - 1, Number(m[1]));
    return isIso(v) && Number(v.slice(8)) === Number(m[1]) ? v : null;
  }
  m = s.match(/^(\d{1,2})\s+([a-z]{3,})\.?\s+(\d{2,4})$/);
  if (m) {
    const mi = BULAN.findIndex((b) => b.toLowerCase().startsWith(m![2].slice(0, 3)));
    if (mi < 0) return null;
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const v = iso(y, mi, Number(m[1]));
    return isIso(v) ? v : null;
  }
  return null;
}

/** Tanggal panjang untuk pembaca layar & keterangan: "Sabtu, 17 Oktober 2026". */
function longText(v: string) {
  if (!isIso(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][d.getUTCDay()];
  return `${hari}, ${Number(v.slice(8))} ${BULAN[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}`;
}

type Props = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  "aria-label"?: string;
  className?: string;
};

/**
 * Pemilih tanggal bergaya Istana Block: ketik 17/10/2026 atau pilih dari kalender (Senin di depan,
 * nama bulan Indonesia). Nilai dikirim sebagai YYYY-MM-DD lewat input tersembunyi bernama `name`,
 * persis seperti <input type="date"> sebelumnya.
 */
export function DateField({ id, name, value, defaultValue = "", onChange, required, disabled, min, max, className, ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? `dt${autoId}`;
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const [text, setText] = useState(toText(current));
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (isIso(current) ? current : todayIso()).slice(0, 7));
  const [mode, setMode] = useState<"days" | "months">("days");
  const [focusDay, setFocusDay] = useState(current || todayIso());
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean; sheet: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  // Nilai dari luar berubah → tampilkan.
  useEffect(() => setText(toText(current)), [current]);

  useEffect(() => {
    const form = wrap.current?.closest("form");
    if (!form || value !== undefined) return;
    const reset = () => setInner(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue, value]);

  const outOfRange = (v: string) => (min && v < min) || (max && v > max);

  function commit(v: string) {
    if (v && outOfRange(v)) {
      setBad(true);
      return;
    }
    setBad(false);
    if (value === undefined) setInner(v);
    if (v !== current) onChange?.(v);
    setText(toText(v));
  }

  const place = useCallback(() => {
    const r = input.current?.getBoundingClientRect();
    if (!r) return;
    const sheet = window.innerWidth < 640;
    const below = window.innerHeight - r.bottom;
    const up = below < 360 && r.top > below;
    setPos({ top: up ? r.top : r.bottom, left: Math.min(r.left, window.innerWidth - 312), up, sheet });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e: Event) => !pop.current?.contains(e.target as Node) && place();
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

  const shown = open && pos !== null;
  useEffect(() => {
    if (shown && mode === "days") grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus({ preventScroll: true });
  }, [shown, focusDay, view, mode]);

  function openCal() {
    if (disabled) return;
    setPos(null);
    const start = isIso(current) ? current : todayIso();
    setFocusDay(start);
    setView(start.slice(0, 7));
    setMode("days");
    setOpen(true);
  }

  function pick(v: string) {
    commit(v);
    setOpen(false);
    input.current?.focus();
  }

  function moveFocus(days: number, months = 0) {
    const d = new Date(`${focusDay}T00:00:00Z`);
    if (months) d.setUTCMonth(d.getUTCMonth() + months);
    d.setUTCDate(d.getUTCDate() + days);
    const n = d.toISOString().slice(0, 10);
    setFocusDay(n);
    setView(n.slice(0, 7));
  }

  function onGridKey(e: React.KeyboardEvent) {
    const map: Record<string, () => void> = {
      ArrowLeft: () => moveFocus(-1),
      ArrowRight: () => moveFocus(1),
      ArrowUp: () => moveFocus(-7),
      ArrowDown: () => moveFocus(7),
      PageUp: () => moveFocus(0, -1),
      PageDown: () => moveFocus(0, 1),
      Home: () => moveFocus(-((new Date(`${focusDay}T00:00:00Z`).getUTCDay() + 6) % 7)),
      End: () => moveFocus(6 - ((new Date(`${focusDay}T00:00:00Z`).getUTCDay() + 6) % 7)),
      Escape: () => {
        setOpen(false);
        input.current?.focus();
      },
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  }

  // Sel kalender bulan yang sedang dilihat (minggu dimulai Senin).
  const [vy, vm] = view.split("-").map(Number);
  const first = new Date(Date.UTC(vy, vm - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, k) => iso(vy, vm - 1, k + 1))];
  while (cells.length % 7) cells.push(null);
  const today = todayIso();
  const shift = (n: number) => {
    const d = new Date(Date.UTC(vy, vm - 1 + n, 1));
    setView(d.toISOString().slice(0, 7));
    setFocusDay(d.toISOString().slice(0, 10));
  };

  const cal = open && pos && (
    <>
      {pos.sheet && <div className="ui-backdrop" aria-hidden="true" />}
      <div
        ref={pop}
        className={`ui-pop ui-cal${pos.sheet ? " is-sheet" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label="Pilih tanggal"
        style={pos.sheet ? undefined : { top: pos.up ? undefined : pos.top + 6, bottom: pos.up ? window.innerHeight - pos.top + 6 : undefined, left: Math.max(8, pos.left) }}
      >
        <div className="cal-head">
          <button type="button" className="cal-nav" onClick={() => (mode === "days" ? shift(-1) : setView(`${vy - 1}-${pad(vm)}`))} aria-label={mode === "days" ? "Bulan sebelumnya" : "Tahun sebelumnya"}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="cal-title" aria-live="polite" onClick={() => setMode((m) => (m === "days" ? "months" : "days"))} aria-label={mode === "days" ? `${BULAN[vm - 1]} ${vy}, pilih bulan lain` : `Tahun ${vy}, kembali ke tanggal`}>
            {mode === "days" ? `${BULAN[vm - 1]} ${vy}` : vy}
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d={mode === "days" ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="cal-nav" onClick={() => (mode === "days" ? shift(1) : setView(`${vy + 1}-${pad(vm)}`))} aria-label={mode === "days" ? "Bulan berikutnya" : "Tahun berikutnya"}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        {mode === "months" ? (
          <div className="cal-months">
            {BULAN.map((b, k) => (
              <button
                key={b}
                type="button"
                className={`cal-month${k === vm - 1 ? " is-sel" : ""}${`${vy}-${pad(k + 1)}` === today.slice(0, 7) ? " is-today" : ""}`}
                onClick={() => {
                  setView(`${vy}-${pad(k + 1)}`);
                  setFocusDay(iso(vy, k, Math.min(Number(focusDay.slice(8)), new Date(Date.UTC(vy, k + 1, 0)).getUTCDate())));
                  setMode("days");
                }}
              >
                {b.slice(0, 3)}
              </button>
            ))}
          </div>
        ) : (
          <div className="cal-grid" ref={grid} role="grid" onKeyDown={onGridKey}>
            {HARI.map((h) => <div key={h} className="cal-dow" role="columnheader">{h}</div>)}
            {cells.map((c, k) =>
              c ? (
                <button
                  key={c}
                  type="button"
                  role="gridcell"
                  data-day={c}
                  tabIndex={c === focusDay ? 0 : -1}
                  disabled={!!outOfRange(c)}
                  aria-selected={c === current}
                  aria-label={longText(c)}
                  className={`cal-day${c === current ? " is-sel" : ""}${c === today ? " is-today" : ""}${k % 7 === 6 ? " is-sunday" : ""}`}
                  onClick={() => pick(c)}
                >
                  {Number(c.slice(8))}
                </button>
              ) : (
                <span key={`e${k}`} className="cal-empty" />
              ),
            )}
          </div>
        )}
        <div className="cal-foot">
          <button type="button" className="cal-link" onClick={() => pick(today)} disabled={!!outOfRange(today)}>Hari ini</button>
          {!required && <button type="button" className="cal-link" onClick={() => pick("")}>Kosongkan</button>}
          <button type="button" className="cal-link" onClick={() => setOpen(false)}>Tutup</button>
        </div>
      </div>
    </>
  );

  return (
    <div ref={wrap} className={`ui-date${open ? " is-open" : ""}${bad ? " is-bad" : ""}${className ? ` ${className}` : ""}`}>
      <input
        ref={input}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh/bb/tttt"
        value={text}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        aria-describedby={current ? `${inputId}-long` : undefined}
        aria-invalid={bad || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseText(e.target.value);
          if (v && e.target.value.replace(/\D/g, "").length >= 8) commit(v);
        }}
        onBlur={() => {
          const v = parseText(text);
          if (v === null) setBad(true);
          else commit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || (e.key === "Enter" && !text)) {
            e.preventDefault();
            openCal();
          } else if (e.key === "Enter") {
            const v = parseText(text);
            if (v === null) {
              e.preventDefault();
              setBad(true);
            } else commit(v);
          }
        }}
      />
      <button type="button" className="ui-date-btn" onClick={() => (open ? setOpen(false) : openCal())} disabled={disabled} aria-label="Buka kalender" aria-expanded={open}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16V20H4zM4 10.5h16M8.5 4v4M15.5 4v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <span id={`${inputId}-long`} className="sr-only">{longText(current)}</span>
      <input className="ui-proxy" tabIndex={-1} aria-hidden="true" name={name} value={current} required={required} disabled={disabled} onChange={() => {}} onFocus={() => input.current?.focus()} />
      {bad && <span className="ui-date-err" role="alert">{min || max ? "Tanggal tidak valid atau di luar rentang." : "Tulis seperti 17/10/2026."}</span>}
      {cal && createPortal(cal, document.body)}
    </div>
  );
}
