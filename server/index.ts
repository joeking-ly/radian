import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { config } from "./config.js";
import { jobs } from "./job-store.js";
import { runAstraJob } from "./astra.js";
import { createRealtimeSession } from "./realtime.js";

const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..");
app.use(cors({ origin: config.origins }));
app.use("/artifacts", express.static(path.join(root, "artifacts")));

app.get("/api/health", (_req, res) => res.json({ ok: true, mockMode: config.mockMode, astraModel: config.ASTRA_MODEL }));

app.post("/api/realtime/session", express.text({ type: ["application/sdp", "text/plain"], limit: "1mb" }), async (req, res) => {
  try {
    const upstream = await createRealtimeSession(req.body);
    res.status(upstream.status).type("application/sdp").send(await upstream.text());
  } catch (error) { res.status(500).send(error instanceof Error ? error.message : "Realtime session failed"); }
});

app.use(express.json({ limit: "1mb" }));

app.post("/api/jobs", (req, res) => {
  const input = z.object({ prompt: z.string().trim().min(2).max(8_000) }).parse(req.body);
  const job = jobs.create(input.prompt);
  res.status(202).json({ id: job.id, prompt: job.prompt, state: job.state, events: job.events });
  runAstraJob(job).catch((error) => jobs.emit(job, { type: "error", state: "error", message: error instanceof Error ? error.message : "Task failed" }));
});

app.get("/api/jobs/:id/events", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).end();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  job.events.forEach(send);
  const listener = (event: unknown) => send(event);
  job.listeners.add(listener);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  req.on("close", () => { clearInterval(heartbeat); job.listeners.delete(listener); });
});

app.post("/api/jobs/:id/approval", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || !job.approval || !job.approvalResolver) return res.status(404).json({ error: "No pending approval" });
  const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
  const resolve = job.approvalResolver;
  job.approval = undefined; job.approvalResolver = undefined;
  jobs.status(job, "working", approved ? "Approved — continuing" : "Cancelled — adjusting the task");
  resolve(approved);
  res.json({ ok: true });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.use((_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
});

app.listen(config.PORT, () => console.log(`Radian server listening on http://localhost:${config.PORT} (${config.mockMode ? "mock" : "live"} mode)`));
