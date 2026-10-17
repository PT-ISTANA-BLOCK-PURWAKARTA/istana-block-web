import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = { title: "Masuk · Keuangan", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Masuk({ searchParams }: { searchParams: Promise<{ next?: string; e?: string; cara?: string }> }) {
  return <LoginScreen module="keuangan" searchParams={searchParams} />;
}
