import { randomUUID } from "node:crypto";
import { jobs } from "./job-store.js";
import type { Job } from "./types.js";

export async function requireApproval(job: Job, title: string, description: string, risk: "modify" | "communicate" | "financial" | "destructive"): Promise<void> {
  const approval = { id: randomUUID(), title, description, risk };
  job.approval = approval;
  jobs.emit(job, { type: "approval", state: "approval", message: "Waiting for approval", approval });
  const approved = await new Promise<boolean>((resolve) => { job.approvalResolver = resolve; });
  if (!approved) throw new Error("User rejected the action");
}
