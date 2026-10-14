import { asc } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { tanggal } from "@/lib/format";
import { deleteUser } from "../../actions/users";
import { NewUserForm } from "./UserForms";

export const metadata = { title: "Pengguna admin" };

export default async function Pengguna() {
  const me = await requireAdmin();
  const db = await getDb();
  const users = await db.select().from(schema.users).orderBy(asc(schema.users.id));
  return (
    <>
      <div className="admin-head"><h1>Pengguna admin</h1></div>
      <div className="stack" style={{ gap: 20 }}>
        <div className="admin-table">
          <table>
            <thead><tr><th>Nama</th><th>Email</th><th>Dibuat</th><th className="num">Aksi</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}{u.id === me.id && <span className="badge badge-on" style={{ marginLeft: 8 }}>Anda</span>}</td>
                  <td>{u.email}</td>
                  <td>{tanggal(u.createdAt)}</td>
                  <td className="num">{u.id !== me.id && <DeleteButton action={deleteUser.bind(null, u.id)} confirmText={`Hapus akses admin ${u.email}?`} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NewUserForm />
      </div>
    </>
  );
}
