import type { OpsDb } from "../push";

export type CronDb = OpsDb;
export type CronContext = { env: CloudflareEnv; db: CronDb; now: Date };
