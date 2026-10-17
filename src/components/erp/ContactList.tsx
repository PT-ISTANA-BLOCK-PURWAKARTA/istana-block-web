import Link from "next/link";
import type { Contact } from "@/db/erp";
import { CONTACT_KIND_LABEL } from "@/lib/erp/accounting";
import { Rp } from "./ui";

export function ContactList({ rows, balances, base, q, jenis, nonaktif, showJenis = true }: { rows: Contact[]; balances?: Map<string, { ar: number; ap: number }>; base: string; q?: string; jenis?: string; nonaktif: boolean; showJenis?: boolean }) {
  return (
    <>
      <form className="filter-bar" method="get">
        <div className="field grow"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={q} placeholder="nama, perusahaan, atau telepon" /></div>
        {showJenis && (
          <div className="field">
            <label htmlFor="jenis">Jenis</label>
            <select id="jenis" name="jenis" defaultValue={jenis ?? ""}>
              <option value="">Semua</option>
              <option value="pelanggan">Pelanggan</option>
              <option value="pemasok">Pemasok</option>
            </select>
          </div>
        )}
        <label className="check"><input type="checkbox" name="nonaktif" value="1" defaultChecked={nonaktif} /> Tampilkan nonaktif</label>
        <button className="btn btn-blue btn-sm" type="submit">Cari</button>
      </form>
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>Nama</th>{showJenis && <th>Jenis</th>}<th>Telepon</th><th>Alamat</th>{balances && <><th className="num">Piutang</th><th className="num">Hutang</th></>}</tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const b = balances?.get(c.id);
              return (
                <tr key={c.id} className={c.active ? "" : "row-muted"}>
                  <td><Link href={`${base}/${c.id}`}><b>{c.name}</b></Link>{c.company && <div className="small muted">{c.company}</div>}</td>
                  {showJenis && <td>{CONTACT_KIND_LABEL[c.kind]}</td>}
                  <td>{c.phone}</td>
                  <td className="small clamp-2">{c.address}</td>
                  {balances && (
                    <>
                      <td className="num">{b?.ar ? <Rp n={b.ar} /> : ""}</td>
                      <td className="num">{b?.ap ? <Rp n={b.ap} /> : ""}</td>
                    </>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Belum ada kontak yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
