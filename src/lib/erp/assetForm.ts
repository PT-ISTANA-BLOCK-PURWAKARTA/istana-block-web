import "server-only";
// Pilihan untuk form harta tetap (kelompok, metode, rekening bawaan per kelompok).
import { assetCategories, depreciationMethods } from "@/db/erp";
import { CATEGORY_CODES, CATEGORY_LABEL, METHOD_LABEL } from "./assets";
import type { Accounts } from "./server";

export function assetFormOptions(acc: Accounts) {
  const byCode = new Map(acc.rows.map((a) => [a.code, a.id]));
  const opt = (pred: (g: string) => boolean) =>
    acc.rows.filter((a) => a.active && pred(a.group)).sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  return {
    categories: assetCategories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
    methods: depreciationMethods.map((m) => ({ value: m, label: METHOD_LABEL[m] })),
    defaults: Object.fromEntries(
      assetCategories.map((c) => {
        const d = CATEGORY_CODES[c];
        return [c, { asset: byCode.get(d.asset), accum: d.accum ? byCode.get(d.accum) : undefined, expense: d.expense ? byCode.get(d.expense) : undefined, lifeMonths: d.lifeMonths }];
      }),
    ),
    assetAccounts: opt((g) => g === "aset_tetap"),
    accumAccounts: opt((g) => g === "akum_penyusutan"),
    expenseAccounts: opt((g) => g === "beban" || g === "hpp" || g === "beban_lain"),
  };
}
