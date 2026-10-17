import { asc } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getDb, schema } from "@/db";
import { requireOwner } from "@/lib/auth";
import { tanggal } from "@/lib/format";
import { normalizeRoles, ROLE_SHORT, ROLES, type Role } from "@/lib/roles";
import { deleteUser } from "../../actions/users";
import { NewUserForm, RolesForm } from "./UserForms";

type Cell = "ya" | "lihat" | undefined;
const MATRIX: [string, Partial<Record<Role, Cell>>][] = [
  ["Produk, harga, artikel, halaman situs", { owner: "ya", web: "ya" }],
  ["Faktur, penerimaan, pembelian, kas, jurnal, laporan", { owner: "ya", keuangan: "ya" }],
  ["Membuat & mengubah pesanan (PO), data pelanggan", { owner: "ya", operasional: "ya", keuangan: "lihat", gudang: "lihat" }],
  ["Menjadwalkan surat jalan, armada, sopir, konfirmasi terkirim", { owner: "ya", operasional: "ya", keuangan: "lihat", gudang: "lihat" }],
  ["Menandai truk berangkat (barang keluar gudang)", { owner: "ya", operasional: "ya", gudang: "ya" }],
  ["Hasil produksi, penyesuaian & saldo awal stok", { owner: "ya", gudang: "ya", keuangan: "lihat" }],
  ["Melihat stok barang di gudang", { owner: "ya", gudang: "ya", operasional: "ya", keuangan: "ya" }],
  ["Melihat harga pokok, nilai persediaan & nilai faktur", { owner: "ya", keuangan: "ya" }],
  ["Mengelola pengguna & peran", { owner: "ya" }],
];

export const metadata = { title: "Pengguna & peran" };

export default async function Pengguna() {
  const me = await requireOwner();
  const db = await getDb();
  const users = await db.select().from(schema.users).orderBy(asc(schema.users.id));
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Pengguna &amp; peran</h1>
          <p className="muted" style={{ marginTop: 4, maxWidth: 720 }}>Setiap staf cukup diberi peran sesuai pekerjaannya. Menu dan tombol yang bukan haknya tidak akan tampil. Satu orang boleh punya beberapa peran.</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 16 }}>
        <div className="admin-table">
          <table>
            <thead>
              <tr><th>Nama</th><th>Email</th><th>Peran</th><th>Dibuat</th><th className="num">Aksi</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roles = normalizeRoles(u.roles);
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700 }}>
                      {u.name}
                      {u.id === me.id && <span className="badge badge-on" style={{ marginLeft: 8 }}>Anda</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <div className="role-badges">{roles.length ? roles.map((r) => <span key={r} className={`badge role-${r}`}>{ROLE_SHORT[r]}</span>) : <span className="muted small">Tanpa akses</span>}</div>
                      <RolesForm userId={u.id} roles={roles} self={u.id === me.id} />
                    </td>
                    <td>{tanggal(u.createdAt)}</td>
                    <td className="num">{u.id !== me.id && <DeleteButton action={deleteUser.bind(null, u.id)} confirmText={`Hapus akses ${u.email}?`} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <NewUserForm />
        <section className="admin-table">
          <table className="perm-matrix">
            <caption>Siapa bisa apa</caption>
            <thead>
              <tr><th>Pekerjaan</th>{ROLES.map((r) => <th key={r}>{ROLE_SHORT[r]}</th>)}</tr>
            </thead>
            <tbody>
              {MATRIX.map(([label, cells]) => (
                <tr key={label}>
                  <td>{label}</td>
                  {ROLES.map((r) => (
                    <td key={r}>{cells[r] === "ya" ? <span className="perm-yes" aria-label="ya">✓</span> : cells[r] === "lihat" ? <span className="perm-view">lihat</span> : <span className="perm-view" aria-label="tidak">–</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
