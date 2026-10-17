"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Icon } from "@/components/panel/Icon";
import { loginEmail, loginPin } from "@/app/internal/actions/auth";
import type { ModuleKey } from "@/lib/roles";

export function EmailLoginForm({ module, next, autoFocus = true }: { module: ModuleKey; next: string; autoFocus?: boolean }) {
  return (
    <ActionForm action={loginEmail.bind(null, module)} className="stack login-form">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus={autoFocus} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton pendingText="Memeriksa…">Masuk</SubmitButton>
    </ActionForm>
  );
}

export function PinLoginForm({ next }: { next: string }) {
  const [show, setShow] = useState(false);
  return (
    <ActionForm action={loginPin} className="stack login-form">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="phone">Nomor HP</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="pin">PIN 6 angka</label>
        <div className="pin-wrap">
          <input
            id="pin"
            name="pin"
            className="pin-input"
            type={show ? "text" : "password"}
            inputMode="numeric"
            autoComplete="current-password"
            pattern="\d{6}"
            minLength={6}
            maxLength={6}
            required
            onInput={(e) => (e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button type="button" className="pin-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? "Sembunyikan" : "Lihat"}
          </button>
        </div>
      </div>
      <SubmitButton pendingText="Memeriksa…">Masuk</SubmitButton>
      <p className="small muted login-help">
        <Icon name="info" size={16} /> Lupa PIN atau nomor berganti? Minta admin kantor mengatur ulang PIN Anda.
      </p>
    </ActionForm>
  );
}

/** Operasional: staf lapangan memakai nomor HP + PIN, pemilik/admin bisa memakai email. */
export function OpsLogin({ next, initial }: { next: string; initial: "pin" | "email" }) {
  const [tab, setTab] = useState(initial);
  return (
    <>
      <div className="login-tabs" role="tablist" aria-label="Cara masuk">
        <button type="button" role="tab" aria-selected={tab === "pin"} onClick={() => setTab("pin")}>
          <Icon name="phone" size={18} /> Nomor HP &amp; PIN
        </button>
        <button type="button" role="tab" aria-selected={tab === "email"} onClick={() => setTab("email")}>
          <Icon name="mail" size={18} /> Email
        </button>
      </div>
      {tab === "pin" ? <PinLoginForm next={next} /> : <EmailLoginForm module="operasional" next={next} />}
      {tab === "email" && <p className="small muted login-help">Untuk pemilik dan admin kantor yang punya akun email.</p>}
    </>
  );
}
