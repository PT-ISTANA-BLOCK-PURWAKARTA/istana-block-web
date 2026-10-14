import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Masuk admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  return (
    <main className="login-wrap hexpat-light">
      <div className="login-card">
        <div className="brand">
          <img src="/brand/logo-istana-block.webp" alt="Istana Block Purwakarta" width={160} height={48} />
        </div>
        <h1 style={{ fontSize: 26 }}>Masuk ke panel admin</h1>
        <LoginForm />
      </div>
    </main>
  );
}
