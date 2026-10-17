import { asc } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getDb, schema } from "@/db";
import { requireOwner } from "@/lib/auth";
import { tanggal } from "@/lib/format";
import { normalizeRoles, ROLE_SHORT } from "@/lib/roles";
import { deleteUser } from "../../actions/users";
import { NewUserForm, RolesForm } from "./UserForms";

export const metadata = { title: "Pengguna & peran" };

export default async function Pengguna() {
  const me = await requireOwner();
  const db = await getDb();
  const users = await db.select().from(schema.users).orderBy(asc(schema.users.id));
  return (
    <>
      <div className="admin-head">
        <h1>Pengguna &amp; peran</h1>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20, maxWidth: 720 }}>
        Peran menentukan modul yang bisa dibuka: <b>Situs</b> (/admin), <b>Keuangan</b> (/keuangan), dan <b>Operasional</b> (/operasional). <b>Pemilik</b> bisa membuka semuanya dan mengelola pengguna.
      </p>
      <div className="stack" style={{ gap: 20 }}>
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
      </div>
    </>
  );
}
