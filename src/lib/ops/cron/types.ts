import type { OpsDb } from "../push";

export type CronDb = OpsDb;
/** `budget.fetchLeft`: sisa fetch (subrequest) eksekusi ini, dipakai bersama keempat job; Workers Free membatasi 50 per eksekusi. */
export type CronContext = { env: CloudflareEnv; db: CronDb; now: Date; budget: { fetchLeft: number } };
