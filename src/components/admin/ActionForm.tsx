"use client";

import { createContext, useActionState, useEffect, useRef, useTransition, type CSSProperties } from "react";
import { FormMessage, type FormState } from "./FormMessage";

export const PendingContext = createContext(false);

/**
 * Form untuk server action yang TIDAK mengosongkan isian ketika terjadi error
 * (perilaku bawaan React 19 untuk <form action>), jadi admin tidak kehilangan ketikan.
 */
export function ActionForm({
  action,
  children,
  className,
  style,
  resetOnOk = false,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  resetOnOk?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <form
      ref={ref}
      className={className}
      style={style}
      onSubmit={(e) => {
        e.preventDefault();
        // Sertakan tombol yang diklik (name/value), mis. "Simpan sebagai draf" vs "Simpan & konfirmasi".
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(e.currentTarget, submitter instanceof HTMLButtonElement && submitter.name ? submitter : undefined);
        startTransition(() => dispatch(data));
      }}
    >
      <PendingContext.Provider value={pending}>
        <FormMessage state={state} />
        {children}
      </PendingContext.Provider>
    </form>
  );
}
