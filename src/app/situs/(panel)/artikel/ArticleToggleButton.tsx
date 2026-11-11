"use client";

import { useTransition } from "react";

export function ArticleToggleButton({
  action,
  published,
}: {
  action: () => Promise<void>;
  published: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="linklike small"
      disabled={pending}
      onClick={() => start(() => action())}
    >
      {pending ? "Menyimpan…" : published ? "Jadikan draf" : "Terbitkan"}
    </button>
  );
}
