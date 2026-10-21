"use client";

/** Deretan pilihan bentuk tombol (chip) yang besar dan nyaman di HP. Nilai terpilih ikut terkirim lewat input tersembunyi `name`. */
export function Chips<T extends string>({
  name,
  value,
  options,
  labels,
  onChange,
  label,
}: {
  name?: string;
  value: string;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="rcv-choices" role="group" aria-label={label}>
      {name && <input type="hidden" name={name} value={value} />}
      {options.map((option) => (
        <button key={option} type="button" aria-pressed={value === option} className={`rcv-choice${value === option ? " on" : ""}`} onClick={() => onChange(option)}>
          {labels?.[option] ?? option}
        </button>
      ))}
    </div>
  );
}
