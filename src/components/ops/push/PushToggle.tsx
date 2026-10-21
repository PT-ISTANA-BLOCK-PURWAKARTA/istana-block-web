"use client";

import { useCallback, useEffect, useState } from "react";

const SCOPE = "/operasional/";
const API = "/api/ops/push";

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (c) => c.charCodeAt(0));
}
const bufferToBase64Url = (key: ArrayBuffer | null) => {
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function call(method: string, url = API, body?: unknown) {
  const res = await fetch(url, { method, credentials: "same-origin", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; sent?: number; publicKey?: string | null };
  if (!res.ok || data.ok === false) throw new Error(data.error ?? "Permintaan gagal.");
  return data;
}

/** Pengingat di HP/komputer (Web Push): aktifkan, matikan, dan kirim tes untuk perangkat ini. */
export function PushToggle({ description = "Aktifkan agar pengingat dan pemberitahuan muncul di perangkat ini." }: { description?: string }) {
  // "memuat" = belum tahu; "tidak" = browser tak mendukung; "kosong" = server belum punya kunci VAPID.
  const [phase, setPhase] = useState<"memuat" | "tidak" | "kosong" | "siap">("memuat");
  const [publicKey, setPublicKey] = useState("");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const currentSubscription = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration(SCOPE);
    return registration?.pushManager.getSubscription() ?? null;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supported()) return alive && setPhase("tidak");
      setPermission(Notification.permission);
      try {
        const { publicKey: key } = await call("GET");
        if (!alive) return;
        if (!key) return setPhase("kosong");
        setPublicKey(key);
        setPhase("siap");
        setActive(Boolean(await currentSubscription()));
      } catch {
        if (alive) setPhase("kosong");
      }
    })();
    return () => {
      alive = false;
    };
  }, [currentSubscription]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next !== "granted") throw new Error("Izin notifikasi belum diberikan. Buka pengaturan browser untuk mengizinkannya.");
      await navigator.serviceWorker.register("/sw.js", { scope: SCOPE });
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) as BufferSource });
      await call("POST", API, {
        endpoint: subscription.endpoint,
        p256dh: bufferToBase64Url(subscription.getKey("p256dh")),
        auth: bufferToBase64Url(subscription.getKey("auth")),
        userAgent: navigator.userAgent,
      });
      setActive(true);
      setMsg({ tone: "ok", text: "Notifikasi aktif di perangkat ini." });
    } catch (error) {
      setMsg({ tone: "error", text: error instanceof Error ? error.message : "Gagal mengaktifkan notifikasi." });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await call("DELETE", API, { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setActive(false);
      setMsg({ tone: "ok", text: "Notifikasi di perangkat ini dimatikan." });
    } catch (error) {
      setMsg({ tone: "error", text: error instanceof Error ? error.message : "Gagal mematikan notifikasi." });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const { sent } = await call("POST", `${API}?test=1`);
      setMsg(sent ? { tone: "ok", text: "Tes terkirim. Cek notifikasi di perangkat ini." } : { tone: "error", text: "Belum ada perangkat aktif untuk akun ini." });
    } catch (error) {
      setMsg({ tone: "error", text: error instanceof Error ? error.message : "Gagal mengirim tes." });
    } finally {
      setBusy(false);
    }
  }

  if (phase === "memuat") return null;
  if (phase === "tidak") {
    return <p className="alert alert-warn" style={{ fontWeight: 500 }}>Notifikasi belum tersedia di browser ini. Di Android pakai Chrome; di iPhone pasang aplikasi ke layar utama dulu.</p>;
  }
  if (phase === "kosong") {
    return <p className="alert alert-warn" style={{ fontWeight: 500 }}>Notifikasi belum dikonfigurasi di server (kunci VAPID belum dipasang).</p>;
  }
  const denied = permission === "denied";
  return (
    <div className={`alert ${active ? "alert-ok" : "alert-warn"}`} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", fontWeight: 500 }}>
      <span role="status">{active ? "Notifikasi aktif di perangkat ini." : denied ? "Notifikasi diblokir di browser ini. Izinkan lewat pengaturan situs." : description}</span>
      <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {active ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={test}>Kirim tes</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={disable}>Matikan</button>
          </>
        ) : (
          !denied && <button type="button" className="btn btn-blue btn-sm" disabled={busy} aria-busy={busy} onClick={enable}>{busy ? "Memproses…" : "Aktifkan notifikasi"}</button>
        )}
      </span>
      {msg && <span role={msg.tone === "error" ? "alert" : "status"} className={msg.tone === "error" ? "text-bahaya" : "text-sukses"} style={{ flexBasis: "100%", fontSize: 13.5 }}>{msg.text}</span>}
    </div>
  );
}
