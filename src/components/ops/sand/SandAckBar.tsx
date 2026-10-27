"use client";

import { ackSandTests, type AckLevel } from "@/app/operasional/actions/sand";
import { ConfirmAction } from "@/components/erp/ConfirmAction";

export type AckTodo = { level: AckLevel; label: string; ids: string[] };

/** Tombol TTD massal bertingkat (Sekretaris -> Manager -> Pimpinan) untuk hasil uji pada periode yang sedang ditampilkan. */
export function SandAckBar({ todos }: { todos: AckTodo[] }) {
  const active = todos.filter((todo) => todo.ids.length > 0);
  if (!active.length) return null;
  return (
    <div className="sand-ackbar flag flag-info">
      <span>Hasil uji periode ini yang menunggu tanda tangan Anda:</span>
      {active.map((todo) => (
        <ConfirmAction
          key={todo.level}
          className="btn btn-blue btn-sm"
          action={ackSandTests.bind(null, todo.level, todo.ids)}
          label={`Tanda tangan sebagai ${todo.label} (${todo.ids.length})`}
          confirmText={`Tanda tangani ${todo.ids.length} hasil uji lumpur sebagai ${todo.label}?`}
        />
      ))}
    </div>
  );
}