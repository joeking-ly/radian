import { randomUUID } from "node:crypto";
import { z } from "zod";
import { browserWorkspace } from "./browser.js";
import { jobs } from "./job-store.js";
import type { Job, WallCard } from "./types.js";

export const toolDefinitions = [
  {
    type: "function", name: "browser_open",
    description: "Open a public HTTP(S) URL in the isolated wall browser.",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false }, strict: true
  },
  {
    type: "function", name: "browser_snapshot",
    description: "Read the current browser page URL, title, and visible text.",
    parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true
  },
  {
    type: "function", name: "browser_click",
    description: "Click an element by its visible text in the isolated browser.",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false }, strict: true
  },
  {
    type: "function", name: "browser_fill",
    description: "Fill a form field by accessible label. Never use for passwords or financial information.",
    parameters: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"], additionalProperties: false }, strict: true
  },
  {
    type: "function", name: "show_browser",
    description: "Show the current controlled browser on the wall.",
    parameters: { type: "object", properties: {}, additionalProperties: false }, strict: true
  },
  {
    type: "function", name: "present_card",
    description: "Present a polished conclusion or briefing card on the wall.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" }, eyebrow: { type: "string" }, body: { type: "string" },
        bullets: { type: "array", items: { type: "string" } }, sourceUrl: { type: "string" }
      },
      required: ["title", "body", "bullets"], additionalProperties: false
    }, strict: false
  },
  {
    type: "function", name: "request_approval",
    description: "Pause before any external, modifying, communicating, financial, or destructive action.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" }, description: { type: "string" },
        risk: { type: "string", enum: ["modify", "communicate", "financial", "destructive"] }
      }, required: ["title", "description", "risk"], additionalProperties: false
    }, strict: true
  }
] as const;

const cardSchema = z.object({ title: z.string(), eyebrow: z.string().optional(), body: z.string(), bullets: z.array(z.string()).default([]), sourceUrl: z.string().optional() });
const approvalSchema = z.object({ title: z.string(), description: z.string(), risk: z.enum(["modify", "communicate", "financial", "destructive"]) });

export async function executeTool(job: Job, name: string, rawArguments: string): Promise<string> {
  const args = JSON.parse(rawArguments || "{}");
  switch (name) {
    case "browser_open": {
      jobs.status(job, "working", `Opening ${new URL(args.url).hostname}`);
      const result = await browserWorkspace.open(args.url);
      const screenshotUrl = await browserWorkspace.screenshot(job.id);
      jobs.emit(job, { type: "browser", state: "working", message: result, screenshotUrl });
      return result;
    }
    case "browser_snapshot": return browserWorkspace.snapshot();
    case "browser_click": return browserWorkspace.click(args.text);
    case "browser_fill": return browserWorkspace.fill(args.label, args.value);
    case "show_browser": {
      const screenshotUrl = await browserWorkspace.screenshot(job.id);
      jobs.emit(job, { type: "browser", state: "working", message: "Showing the controlled browser", screenshotUrl });
      return "Browser displayed on the wall";
    }
    case "present_card": {
      const card: WallCard = cardSchema.parse(args);
      jobs.emit(job, { type: "card", state: "presenting", message: card.title, card });
      return "Card is now displayed";
    }
    case "request_approval": {
      const input = approvalSchema.parse(args);
      const approval = { id: randomUUID(), ...input };
      job.approval = approval;
      jobs.emit(job, { type: "approval", state: "approval", message: "Waiting for approval", approval });
      return await new Promise<string>((resolve) => {
        job.approvalResolver = (approved) => resolve(approved ? "User approved the action" : "User rejected the action");
      });
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
