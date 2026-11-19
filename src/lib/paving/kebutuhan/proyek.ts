import { rekomendasiBeban, tebalBawaan } from "./beban";
import { hitungBiaya, type HasilBiaya } from "./biaya";
import { hitungMultiArea, type AreaInput, type HasilArea } from "./lahan";
import { hitungLogistik, type HasilLogistik } from "./logistik";
import { hitungMaterialPendukung, type MaterialPendukung } from "./material";
import type { JenisTruk, KelasBeban } from "./konstanta-sementara";
import { bulat2 } from "./util";

export interface OpsiProyek {
  /** Jarak kirim (km). Tanpa ini biaya tidak dihitung. */
  jarakKm?: number;
  jenisTruk?: JenisTruk;
  sertakanKanstin?: boolean;
  hargaPerPcs?: number;
}

export interface AreaProyek extends HasilArea {
  kelas: KelasBeban;
  tebalCm: number;
  material: MaterialPendukung;
}

export interface HasilProyek {
  areas: AreaProyek[];
  totalLuasBersihM2: number;
  totalPcsBeli: number;
  material: { pasirAlasM3: number; sirtuM3: number; abuNatM3: number; kanstinPcs: number };
  logistik: HasilLogistik;
  biaya?: HasilBiaya;
  peringatan: string[];
}

/** Gabungkan lahan, material, logistik, dan biaya untuk satu proyek (satu atau banyak area). */
export function hitungProyek(areas: AreaInput[], opsi: OpsiProyek = {}): HasilProyek {
  const multi = hitungMultiArea(areas);
  const peringatan: string[] = [];

  const rows: AreaProyek[] = multi.rows.map((r, i) => {
    const input = areas[i];
    const kelas = input.kelas ?? "pejalan";
    const tebalCm = input.tebalCm ?? tebalBawaan(r.produkId, kelas);
    const rek = rekomendasiBeban(kelas);
    if (tebalCm < rek.tebalMinCm) {
      peringatan.push(`${r.label}: tebal ${tebalCm} cm di bawah minimum ${rek.tebalMinCm} cm untuk ${rek.label.toLowerCase()}.`);
    }
    const material = hitungMaterialPendukung(r.luasBersihM2, kelas, {
      kelilingM: opsi.sertakanKanstin ? input.kelilingM ?? 0 : undefined,
    });
    return { ...r, kelas, tebalCm, material };
  });

  const logistik = hitungLogistik(
    rows.map((r) => ({ produkId: r.produkId, tebalCm: r.tebalCm, pcs: r.pcsBeli })),
    opsi.jenisTruk,
  );

  const biaya =
    opsi.jarakKm === undefined
      ? undefined
      : hitungBiaya({
          trip: logistik.trip,
          jarakKm: opsi.jarakKm,
          pasang: rows.map((r) => ({ kelas: r.kelas, luasM2: r.luasBersihM2 })),
          material:
            opsi.hargaPerPcs === undefined ? undefined : { pcs: multi.totalPcsBeli, hargaPerPcs: opsi.hargaPerPcs },
        });

  const jumlah = (f: (m: MaterialPendukung) => number) => bulat2(rows.reduce((a, r) => a + f(r.material), 0));
  return {
    areas: rows,
    totalLuasBersihM2: multi.totalLuasBersihM2,
    totalPcsBeli: multi.totalPcsBeli,
    material: {
      pasirAlasM3: jumlah((m) => m.pasirAlas.m3),
      sirtuM3: jumlah((m) => m.sirtu.m3),
      abuNatM3: jumlah((m) => m.abuNat.m3),
      kanstinPcs: rows.reduce((a, r) => a + (r.material.kanstin?.pcs ?? 0), 0),
    },
    logistik,
    biaya,
    peringatan,
  };
}
