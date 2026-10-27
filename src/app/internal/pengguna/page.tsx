import { asc } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getDb, schema } from "@/db";
import { requireOwner } from "@/lib/auth";
import { tanggal } from "@/lib/format";
import { formatPhone, normalizeRoles, ROLE_SHORT, ROLES, type Role } from "@/lib/roles";
import { deleteUser, removeUserPin } from "../actions/users";
import { EditUser, NewUserForm, type DriverOption } from "./UserForms";

export const metadata = { title: "Pengguna & peran" };

type Cell = "ya" | "lihat" | undefined;
const MATRIX: [string, Partial<Record<Role, Cell>>][] = [
  ["Cara masuk", {}],
  ["Produk, harga, artikel, halaman situs", { owner: "ya", web: "ya" }],
  ["Faktur, penerimaan, pembelian, kas, jurnal, laporan keuangan", { owner: "ya", keuangan: "ya" }],
  ["Membuat & mengubah pesanan (PO), data pelanggan", { owner: "ya", operasional: "ya", keuangan: "lihat", gudang: "lihat" }],
  ["Menjadwalkan surat jalan, armada, sopir, konfirmasi terkirim", { owner: "ya", operasional: "ya", keuangan: "lihat", gudang: "lihat" }],
  ["Menandai truk berangkat (barang keluar gudang), tombol Sudah dimuat", { owner: "ya", operasional: "ya", gudang: "ya", mandor: "ya", satpam: "ya" }],
  ["Hasil produksi, penyesuaian & saldo awal stok", { owner: "ya", gudang: "ya", keuangan: "lihat" }],
  ["Mengisi hasil produksi lapangan (mandor: precast, QC: paving, kantor: keduanya)", { owner: "ya", operasional: "ya", mandor: "ya", qc: "ya" }],
  ["Mencatat barang masuk di gerbang", { owner: "ya", operasional: "ya", satpam: "ya" }],
  ["Melihat daftar barang masuk", { owner: "ya", operasional: "ya", qc: "ya", satpam: "ya", manajer_qc: "ya", pimpinan: "ya" }],
  ["Uji lumpur pasir: memulai & mengisi hasil", { owner: "ya", qc: "ya", satpam: "ya" }],
  ["Melihat hasil uji lumpur pasir", { owner: "ya", qc: "ya", manajer_qc: "ya", pimpinan: "ya" }],
  ["QC: mix desain, catatan harian, uji kuat tekan", { owner: "ya", operasional: "ya", qc: "ya", manajer_qc: "ya" }],
  ["ACC catatan & uji kuat tekan (tanda tangan Diperiksa)", { owner: "ya", manajer_qc: "ya" }],
  ["Tanda tangan Mengetahui pimpinan, nilai harga bahan", { owner: "ya", pimpinan: "ya" }],
  ["Nilai mutu bahan (QC) dan kecepatan kirim (kantor)", { owner: "ya", operasional: "ya", qc: "ya" }],
  ["Kalender rapat & training (melihat)", { owner: "ya", operasional: "ya", qc: "ya", mandor: "ya", manajer_qc: "ya", pimpinan: "ya" }],
  ["Membuat acara kalender, mengisi hasil rapat, melihat rekap piket", { owner: "ya", operasional: "ya" }],
  ["Laporan pimpinan harian/mingguan/bulanan", { owner: "ya", pimpinan: "ya" }],
  ["Rekap & form ISO (F-IB)", { owner: "ya", operasional: "ya", qc: "ya", mandor: "ya", manajer_qc: "ya", pimpinan: "ya" }],
  ["Absen piket (wajib bagi satpam & mandor sebelum mencatat)", { owner: "ya", mandor: "ya", satpam: "ya" }],
  ["Menyelesaikan PO/pengiriman dari kantor", { owner: "ya", operasional: "ya" }],
  ["Keamanan data: log aktivitas & backup", { owner: "ya" }],
  ["Rekap Pelanggan: konsumen, impor/ekspor Excel, penilaian pembeli", { owner: "ya", operasional: "ya" }],
  ["Stok opname (hitung fisik, selisih jadi penyesuaian stok)", { owner: "ya", operasional: "ya", gudang: "ya", qc: "ya" }],
  ["Cat genteng (konversi natural ke hitam/merah)", { owner: "ya", operasional: "ya", gudang: "ya", qc: "ya", mandor: "ya" }],
  ["Spesifikasi & berat produk (kelola)", { owner: "ya", operasional: "ya", qc: "ya" }],
  ["Tanda tangan Sekretaris uji lumpur pasir", { owner: "ya", operasional: "ya" }],
  ["Melihat stok barang di gudang", { owner: "ya", gudang: "ya", operasional: "ya", keuangan: "ya" }],
  ["Melihat posisi truk di peta", { owner: "ya", operasional: "ya" }],
  ["Tugas antar sendiri: berangkat, tandai terkirim + foto, bagikan lokasi", { sopir: "ya" }],
  ["Melihat harga pokok, nilai persediaan & nilai faktur", { owner: "ya", keuangan: "ya" }],
  ["Mengelola pengguna & peran", { owner: "ya" }],
];
const HOW: Record<Role, string> = { owner: "email", web: "email", keuangan: "email", operasional: "email / HP", gudang: "HP & PIN", sopir: "HP & PIN",
  qc: "HP & PIN / email", mandor: "HP & PIN", satpam: "HP & PIN", manajer_qc: "email", pimpinan: "email",
};

export default async function Pengguna() {
  const me = await requireOwner();
  const db = await getDb();
  const [users, drivers] = await Promise.all([
    db.select().from(schema.users).orderBy(asc(schema.users.id)),
    db.select().from(schema.drivers).orderBy(asc(schema.drivers.name)),
  ]);
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const linked = new Map(users.filter((u) => u.driverId).map((u) => [u.driverId!, u.name]));
  const driverOptions: DriverOption[] = drivers.filter((d) => d.active || linked.has(d.id)).map((d) => ({ id: d.id, name: d.name, phone: d.phone, linkedTo: linked.get(d.id) ?? null }));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Pengguna &amp; peran</h1>
          <p className="muted" style={{ marginTop: 4, maxWidth: 760 }}>
            Staf kantor masuk dengan <b>email &amp; password</b>. Gudang, sopir, dan staf lapangan masuk ke Operasional dengan <b>nomor HP &amp; PIN 6 angka</b>. Menu dan tombol yang bukan haknya tidak tampil. Satu orang boleh punya beberapa peran.
          </p>
        </div>
      </div>
      <div className="stack" style={{ gap: 16 }}>
        <div className="admin-table">
          <table>
            <thead>
              <tr><th>Nama</th><th>Masuk dengan</th><th>Peran</th><th>Dibuat</th><th className="num">Aksi</th></tr>
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
                    <td className="small">
                      {u.email && <div>{u.email}</div>}
                      {u.phone && (
                        <div>
                          {formatPhone(u.phone)} · PIN
                          {u.email && (
                            <form action={removeUserPin.bind(null, u.id)} style={{ display: "inline" }}>
                              <button type="submit" className="linklike small" style={{ marginLeft: 8 }}>cabut</button>
                            </form>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="role-badges">
                        {roles.length ? roles.map((r) => <span key={r} className={`badge role-${r}`}>{ROLE_SHORT[r]}{r === "sopir" && u.driverId ? `: ${driverName.get(u.driverId) ?? "?"}` : ""}</span>) : <span className="muted small">Tanpa akses</span>}
                      </div>
                      <EditUser user={{ id: u.id, name: u.name, email: u.email, phone: u.phone, roles, driverId: u.driverId }} drivers={driverOptions} self={u.id === me.id} />
                    </td>
                    <td>{tanggal(u.createdAt)}</td>
                    <td className="num">{u.id !== me.id && <DeleteButton action={deleteUser.bind(null, u.id)} confirmText={`Hapus akses ${u.name}?`} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <NewUserForm drivers={driverOptions} />
        <section className="admin-table">
          <table className="perm-matrix">
            <caption>Siapa bisa apa</caption>
            <thead>
              <tr><th>Pekerjaan</th>{ROLES.map((r) => <th key={r}>{ROLE_SHORT[r]}</th>)}</tr>
            </thead>
            <tbody>
              {MATRIX.map(([label, cells], i) => (
                <tr key={label}>
                  <td>{label}</td>
                  {ROLES.map((r) =>
                    i === 0 ? (
                      <td key={r} className="small">{HOW[r]}</td>
                    ) : (
                      <td key={r}>{cells[r] === "ya" ? <span className="perm-yes" aria-label="ya">✓</span> : cells[r] === "lihat" ? <span className="perm-view">lihat</span> : <span className="perm-view" aria-label="tidak">–</span>}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
