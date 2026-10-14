"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { login } from "../actions/auth";

export function LoginForm() {
  return (
    <ActionForm action={login} className="stack" style={{ gap: 16 }}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton pendingText="Memeriksa…">Masuk</SubmitButton>
    </ActionForm>
  );
}
