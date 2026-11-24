import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { setNewPassword } from "../actions/users";
import { logout } from "../actions/auth";

export const metadata: Metadata = { title: "Buat password baru", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Wajib setelah masuk dengan password sementara (akun baru atau password diatur ulang pemilik). */
export default async function GantiPassword({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const me = await requireUser("/internal", { allowTempPassword: true });
  if (!me.mustChangePassword) redirect(homeFor(me.allRoles) ?? "/internal");
  const { next } = await searchParams;
  return (
    <main className="portal hexpat">
      <section className="portal-body" aria-labelledby="gp-title" style={{ maxWidth: 480 }}>
        <h1 id="gp-title">Halo, {me.name.split(" ")[0]}. Buat password baru</h1>
        <p className="portal-lead">Anda masuk dengan password sementara. Buat password baru milik Anda sendiri sebelum membuka aplikasi.</p>
        <ActionForm action={setNewPassword} className="form-section card" >
          <input type="hidden" name="dest" value={next ?? ""} />
          <div className="field"><label htmlFor="gp-new">Password baru <span className="help">minimal 10 karakter</span></label><input id="gp-new" name="next" type="password" autoComplete="new-password" minLength={10} required /></div>
          <div className="field"><label htmlFor="gp-confirm">Ulangi password baru</label><input id="gp-confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></div>
          <div><SubmitButton className="btn btn-blue">Simpan &amp; lanjut</SubmitButton></div>
        </ActionForm>
        <form action={logout} style={{ marginTop: 12 }}><button type="submit" className="btn btn-ghost btn-sm">Keluar</button></form>
      </section>
    </main>
  );
}
