import { requireAdmin } from "@/lib/auth";
import { SETTING_FIELDS, getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Info & kontak" };

export default async function Pengaturan() {
  await requireAdmin();
  const values = await getSettings();
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Informasi situs</h1>
          <p className="muted">Kontak, alamat, teks beranda, dan SEO. Perubahan langsung tampil di seluruh halaman.</p>
        </div>
      </div>
      <SettingsForm fields={SETTING_FIELDS} values={values} />
    </>
  );
}
