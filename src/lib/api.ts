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

export type PendingApproval = { jobId: string; prompt: string; approval: { id: string; title: string; description: string; risk: string } };

export async function fetchApprovals(token: string): Promise<PendingApproval[]> {
  const response = await fetch("/api/controller/approvals", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function resolveControllerApproval(token: string, item: PendingApproval, approved: boolean): Promise<void> {
  const response = await fetch(`/api/controller/approvals/${item.jobId}/${item.approval.id}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ approved })
  });
  if (!response.ok) throw new Error(await response.text());
}
