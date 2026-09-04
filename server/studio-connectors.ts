import { spawn } from "node:child_process";
import path from "node:path";
import { google } from "googleapis";
import { WebClient } from "@slack/web-api";
import { Client as FtpClient } from "basic-ftp";
import mqtt from "mqtt";
import { z } from "zod";
import { config } from "./config.js";
import { requireApproval } from "./approval.js";
import type { Job } from "./types.js";

const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const string = { type: "string" } as const;

export const studioToolDefinitions = [
  { type: "function", name: "connector_status", description: "List configured production-studio connectors without exposing credentials.", parameters: object({}), strict: true },
  { type: "function", name: "google_drive_search", description: "Search the connected operator's Google Drive.", parameters: object({ query: string, limit: { type: "number" } }, ["query"]), strict: true },
  { type: "function", name: "google_doc_create", description: "Create a Google Doc after approval.", parameters: object({ title: string, body: string }, ["title", "body"]), strict: true },
  { type: "function", name: "google_slides_create", description: "Create a Google Slides deck containing title and body slides after approval.", parameters: object({ title: string, slides: { type: "array", items: object({ title: string, body: string }, ["title", "body"]) } }, ["title", "slides"]), strict: true },
  { type: "function", name: "slack_search", description: "Search messages visible to the connected Slack user.", parameters: object({ query: string, limit: { type: "number" } }, ["query"]), strict: true },
  { type: "function", name: "slack_send", description: "Send an exact Slack message after communication approval.", parameters: object({ channel: string, text: string }, ["channel", "text"]), strict: true },
  { type: "function", name: "blender_render", description: "Render a Blender file in the configured studio workspace.", parameters: object({ input: string, output: string, frame: { type: "number" } }, ["input", "output"]), strict: true },
  { type: "function", name: "blender_export", description: "Run an operator-reviewed Blender Python export script against a blend file.", parameters: object({ input: string, script: string }, ["input", "script"]), strict: true },
  { type: "function", name: "bambu_slice", description: "Slice a 3MF project with Bambu Studio and export a sliced 3MF.", parameters: object({ input: string, output: string, plate: { type: "number" } }, ["input", "output"]), strict: true },
  { type: "function", name: "bambu_print", description: "Upload a sliced 3MF to the configured Bambu printer and start it after mandatory approval.", parameters: object({ file: string, plateGcode: string, useAms: { type: "boolean" }, timelapse: { type: "boolean" } }, ["file", "plateGcode"]), strict: true },
  { type: "function", name: "studio_webhook", description: "Call an operator-configured studio system by connector and action name. Mutating connectors require approval.", parameters: object({ connector: string, action: string, input: { type: "object", additionalProperties: true } }, ["connector", "action", "input"]), strict: false }
] as const;

const inputSchema = z.string().min(1);

export async function executeStudioTool(job: Job, name: string, args: unknown): Promise<string> {
  switch (name) {
    case "connector_status": return JSON.stringify(connectorStatus());
    case "google_drive_search": return googleDriveSearch(z.object({ query: inputSchema, limit: z.number().int().min(1).max(100).default(20) }).parse(args));
    case "google_doc_create": {
      const input = z.object({ title: inputSchema, body: z.string() }).parse(args);
      await requireApproval(job, `Create Google Doc: ${input.title}`, "Create a new document in the connected Google Drive.", "modify");
      return googleDocCreate(input);
    }
    case "google_slides_create": {
      const input = z.object({ title: inputSchema, slides: z.array(z.object({ title: inputSchema, body: z.string() })).min(1).max(50) }).parse(args);
      await requireApproval(job, `Create slide deck: ${input.title}`, `Create ${input.slides.length} slides in the connected Google Drive.`, "modify");
      return googleSlidesCreate(input);
    }
    case "slack_search": return slackSearch(z.object({ query: inputSchema, limit: z.number().int().min(1).max(100).default(20) }).parse(args));
    case "slack_send": {
      const input = z.object({ channel: inputSchema, text: inputSchema.max(40_000) }).parse(args);
      await requireApproval(job, `Send Slack message to ${input.channel}`, input.text, "communicate");
      return slackSend(input);
    }
    case "blender_render": {
      const input = z.object({ input: inputSchema, output: inputSchema, frame: z.number().int().positive().default(1) }).parse(args);
      const source = studioPath(input.input); const output = studioPath(input.output);
      return run(config.BLENDER_PATH, ["-b", source, "-o", output, "-f", String(input.frame)]);
    }
    case "blender_export": {
      const input = z.object({ input: inputSchema, script: inputSchema }).parse(args);
      return run(config.BLENDER_PATH, ["-b", studioPath(input.input), "--python", studioPath(input.script)]);
    }
    case "bambu_slice": {
      const input = z.object({ input: inputSchema, output: inputSchema, plate: z.number().int().min(0).default(0) }).parse(args);
      return run(config.BAMBU_STUDIO_PATH, ["--slice", String(input.plate), "--debug", "2", "--export-3mf", studioPath(input.output), studioPath(input.input)]);
    }
    case "bambu_print": {
      const input = z.object({ file: inputSchema, plateGcode: z.string().regex(/^Metadata\/[A-Za-z0-9_.-]+\.gcode$/).default("Metadata/plate_1.gcode"), useAms: z.boolean().default(false), timelapse: z.boolean().default(false) }).parse(args);
      const filename = path.basename(input.file);
      await requireApproval(job, `Start print: ${filename}`, `Upload ${filename} and immediately start printing ${input.plateGcode} on ${config.BAMBU_PRINTER_SERIAL ?? "the configured Bambu printer"}. Confirm the build plate is clear and the printer is safe to operate.`, "modify");
      return bambuPrint(studioPath(input.file), filename, input);
    }
    case "studio_webhook": {
      const input = z.object({ connector: inputSchema, action: inputSchema, input: z.record(z.string(), z.unknown()) }).parse(args);
      return studioWebhook(job, input);
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

export function connectorStatus() {
  return {
    googleWorkspace: Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REFRESH_TOKEN),
    slack: Boolean(config.SLACK_USER_TOKEN),
    blender: Boolean(config.BLENDER_PATH),
    bambuStudio: Boolean(config.BAMBU_STUDIO_PATH),
    bambuPrinter: Boolean(config.BAMBU_PRINTER_HOST && config.BAMBU_PRINTER_SERIAL && config.BAMBU_ACCESS_CODE),
    custom: customConnectors().map(({ name, mutating }) => ({ name, mutating }))
  };
}

const customConnectorSchema = z.array(z.object({ name: z.string().regex(/^[a-z][a-z0-9_-]{1,40}$/), url: z.string().url(), token: z.string().min(1), mutating: z.boolean().default(false) }));

function customConnectors() {
  try { return customConnectorSchema.parse(JSON.parse(config.CUSTOM_CONNECTORS_JSON)); }
  catch (error) { throw new Error(`Invalid CUSTOM_CONNECTORS_JSON: ${error instanceof Error ? error.message : "invalid value"}`); }
}

async function studioWebhook(job: Job, input: { connector: string; action: string; input: Record<string, unknown> }) {
  const connector = customConnectors().find((item) => item.name === input.connector);
  if (!connector) throw new Error(`Custom connector is not configured: ${input.connector}`);
  if (connector.mutating) await requireApproval(job, `${input.connector}: ${input.action}`, JSON.stringify(input.input, null, 2), "modify");
  const response = await fetch(connector.url, { method: "POST", headers: { Authorization: `Bearer ${connector.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: input.action, input: input.input, jobId: job.id }) });
  const body = await response.text();
  if (!response.ok) throw new Error(`${input.connector} returned ${response.status}: ${body.slice(0, 2_000)}`);
  return body.slice(0, 20_000);
}

function googleAuth() {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REFRESH_TOKEN) throw new Error("Google Workspace is not configured");
  const auth = new google.auth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN });
  return auth;
}

async function googleDriveSearch({ query, limit }: { query: string; limit: number }) {
  const drive = google.drive({ version: "v3", auth: googleAuth() });
  const escaped = query.replaceAll("'", "\\'");
  const response = await drive.files.list({ q: `trashed = false and fullText contains '${escaped}'`, pageSize: limit, orderBy: "modifiedTime desc", fields: "files(id,name,mimeType,modifiedTime,webViewLink,description)" });
  return JSON.stringify(response.data.files ?? []);
}

async function googleDocCreate({ title, body }: { title: string; body: string }) {
  const docs = google.docs({ version: "v1", auth: googleAuth() });
  const document = await docs.documents.create({ requestBody: { title } });
  await docs.documents.batchUpdate({ documentId: document.data.documentId!, requestBody: { requests: [{ insertText: { location: { index: 1 }, text: body } }] } });
  return `https://docs.google.com/document/d/${document.data.documentId}/edit`;
}

async function googleSlidesCreate({ title, slides }: { title: string; slides: Array<{ title: string; body: string }> }) {
  const api = google.slides({ version: "v1", auth: googleAuth() });
  const presentation = await api.presentations.create({ requestBody: { title } });
  const requests: any[] = [];
  slides.forEach((slide, index) => {
    const pageId = `slide_${index}_${Date.now()}`;
    requests.push({ createSlide: { objectId: pageId, slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" }, placeholderIdMappings: [{ layoutPlaceholder: { type: "TITLE", index: 0 }, objectId: `${pageId}_title` }, { layoutPlaceholder: { type: "BODY", index: 0 }, objectId: `${pageId}_body` }] } });
    requests.push({ insertText: { objectId: `${pageId}_title`, text: slide.title } }, { insertText: { objectId: `${pageId}_body`, text: slide.body } });
  });
  await api.presentations.batchUpdate({ presentationId: presentation.data.presentationId!, requestBody: { requests } });
  return `https://docs.google.com/presentation/d/${presentation.data.presentationId}/edit`;
}

function slackClient() {
  if (!config.SLACK_USER_TOKEN) throw new Error("Slack is not configured");
  return new WebClient(config.SLACK_USER_TOKEN);
}

async function slackSearch({ query, limit }: { query: string; limit: number }) {
  const result = await slackClient().search.messages({ query, count: limit, sort: "timestamp", sort_dir: "desc" });
  return JSON.stringify(result.messages?.matches ?? []);
}

async function slackSend({ channel, text }: { channel: string; text: string }) {
  const result = await slackClient().chat.postMessage({ channel, text });
  return JSON.stringify({ ok: result.ok, channel: result.channel, ts: result.ts });
}

export function studioPath(value: string): string {
  const root = path.resolve(config.STUDIO_ROOT);
  const resolved = path.resolve(root, value);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("Path is outside STUDIO_ROOT");
  return resolved;
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, cwd: config.STUDIO_ROOT });
    let output = ""; let errors = "";
    child.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-20_000); });
    child.stderr.on("data", (chunk) => { errors = `${errors}${chunk}`.slice(-20_000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output || "Command completed") : reject(new Error(`${path.basename(command)} exited ${code}: ${errors || output}`)));
  });
}

async function bambuPrint(localFile: string, remoteName: string, options: { plateGcode: string; useAms: boolean; timelapse: boolean }) {
  if (!config.BAMBU_PRINTER_HOST || !config.BAMBU_PRINTER_SERIAL || !config.BAMBU_ACCESS_CODE) throw new Error("Bambu printer is not configured");
  const ftp = new FtpClient(15_000);
  ftp.ftp.verbose = false;
  try {
    await ftp.access({ host: config.BAMBU_PRINTER_HOST, port: 990, user: "bblp", password: config.BAMBU_ACCESS_CODE, secure: "implicit", secureOptions: { rejectUnauthorized: false } });
    await ftp.uploadFrom(localFile, remoteName);
  } finally { ftp.close(); }

  const client = mqtt.connect(`mqtts://${config.BAMBU_PRINTER_HOST}:8883`, { username: "bblp", password: config.BAMBU_ACCESS_CODE, rejectUnauthorized: false, connectTimeout: 15_000 });
  const payload = JSON.stringify({ print: { sequence_id: String(Date.now()), command: "project_file", param: options.plateGcode, project_id: "0", profile_id: "0", task_id: "0", subtask_id: "0", subtask_name: remoteName, url: `ftp:///${remoteName}`, bed_type: "auto", timelapse: options.timelapse, bed_leveling: true, flow_cali: false, vibration_cali: true, layer_inspect: true, use_ams: options.useAms, ams_mapping: [] } });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { client.end(true); reject(new Error("Timed out connecting to Bambu printer")); }, 15_000);
    client.once("error", (error) => { clearTimeout(timeout); client.end(true); reject(error); });
    client.once("connect", () => client.publish(`device/${config.BAMBU_PRINTER_SERIAL}/request`, payload, { qos: 1 }, (error) => { clearTimeout(timeout); client.end(); error ? reject(error) : resolve(); }));
  });
  return `Uploaded ${remoteName} and submitted print start to ${config.BAMBU_PRINTER_SERIAL}`;
}
