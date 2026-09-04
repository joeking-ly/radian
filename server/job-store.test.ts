import { describe, expect, it } from "vitest";
import { jobs } from "./job-store.js";

describe("JobStore", () => {
  it("creates a planning event and updates state", () => {
    const job = jobs.create("Prepare a briefing");
    expect(job.state).toBe("planning");
    expect(job.events[0]).toMatchObject({ type: "status", state: "planning" });
    jobs.status(job, "working", "Working");
    expect(job.state).toBe("working");
    expect(job.events.at(-1)?.message).toBe("Working");
  });
});
