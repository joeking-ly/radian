import { randomUUID } from "node:crypto";
import type { Job, JobEvent, WallState } from "./types.js";

class JobStore {
  private jobs = new Map<string, Job>();

  create(prompt: string): Job {
    const job: Job = { id: randomUUID(), prompt, state: "planning", events: [], listeners: new Set() };
    this.jobs.set(job.id, job);
    this.emit(job, { type: "status", state: "planning", message: "Breaking the request into steps" });
    return job;
  }

  get(id: string): Job | undefined { return this.jobs.get(id); }

  emit(job: Job, event: Omit<JobEvent, "id" | "jobId" | "createdAt">): JobEvent {
    if (event.state) job.state = event.state;
    const full: JobEvent = {
      ...event,
      id: randomUUID(),
      jobId: job.id,
      createdAt: new Date().toISOString()
    };
    job.events.push(full);
    for (const listener of job.listeners) listener(full);
    return full;
  }

  status(job: Job, state: WallState, message: string) {
    return this.emit(job, { type: "status", state, message });
  }
}

export const jobs = new JobStore();
