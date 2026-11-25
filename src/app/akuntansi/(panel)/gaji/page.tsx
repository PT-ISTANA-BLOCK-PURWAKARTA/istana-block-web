import { PageHead } from "@/components/erp/ui";
import { PayslipWorkspace } from "@/components/ops/payslip/PayslipWorkspace";
import { getDb } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import {
  getKasbonBalances,
  getPayslipSigners,
  getPayslipsWithMeta,
  nextThursday,
  payPeriod,
  productionPay,
  toDay,
} from "@/lib/ops/payslip";

export const metadata = { title: "Gaji & Rekap Kamis" };

export default async function Gaji() {
  const { user, canFinance } = await opsAccess();
  const db = await getDb();
  const today = toDay();
  const recapPayday = nextThursday(today);
  const recapPeriod = payPeriod("mingguan", recapPayday);

  const [slips, signers, kasbonBalances, recapGroups] = await Promise.all([
    getPayslipsWithMeta(db),
    getPayslipSigners(db),
    getKasbonBalances(db),
    productionPay(db, recapPeriod),
  ]);

  return (
    <>
      <PageHead
        title="Gaji & Rekap Kamis"
        sub="Slip gaji mingguan (Jumat–Kamis, gajian Kamis) dan bulanan (tgl 1), lengkap dengan rekap barang produksi per leader serta cetak A5."
      />
      <PayslipWorkspace
        today={today}
        canEdit={canFinance}
        currentUserId={user.id}
        initialSlips={slips}
        signers={signers}
        kasbonBalances={kasbonBalances}
        initialRecapPayday={recapPayday}
        initialRecapGroups={recapGroups}
      />
    </>
  );
}
