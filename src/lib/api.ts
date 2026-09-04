import type { JobSnapshot } from "../types";

export async function createJob(prompt: string): Promise<JobSnapshot> {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function decideApproval(jobId: string, approved: boolean): Promise<void> {
  const response = await fetch(`/api/jobs/${jobId}/approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved })
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function fetchHealth(): Promise<{ mockMode: boolean; astraModel: string }> {
  const response = await fetch("/api/health");
  if (!response.ok) throw new Error("Server unavailable");
  return response.json();
}
