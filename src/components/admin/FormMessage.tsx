"use client";

import { useEffect, useRef } from "react";

export type FormState = { error?: string; ok?: string } | undefined;

export function FormMessage({ state }: { state: FormState }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.error || state?.ok) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);
  if (state?.error) return <p ref={ref} className="alert alert-error" role="alert">{state.error}</p>;
  if (state?.ok) return <p ref={ref} className="alert alert-ok" role="status">{state.ok}</p>;
  return null;
}
