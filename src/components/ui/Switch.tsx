/** Sakelar hidup/mati (checkbox bergaya), mis. "Terbitkan", "Aktif", "Tampil di beranda". */
export function Switch({ name, defaultChecked, checked, onChange, label, help, disabled, id }: { name?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void; label: React.ReactNode; help?: React.ReactNode; disabled?: boolean; id?: string }) {
  return (
    <label className="ui-switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        disabled={disabled}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
      />
      <span>
        {label}
        {help && <small>{help}</small>}
      </span>
    </label>
  );
}
