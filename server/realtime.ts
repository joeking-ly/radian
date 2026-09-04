import { createHash } from "node:crypto";
import { config } from "./config.js";

export async function createRealtimeSession(sdp: string): Promise<Response> {
  if (!config.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is required for voice", { status: 503 });
  const session = {
    type: "realtime",
    model: config.REALTIME_MODEL,
    instructions: `You are the voice interface for Radian, a spatial AI workspace. Be brief. For any request that requires research, creation, browser work, analysis, or more than a conversational answer, call submit_wall_task. Tell the user that the task is being shown on the wall.`,
    audio: { output: { voice: config.REALTIME_VOICE }, input: { transcription: { model: "gpt-live-transcribe" }, turn_detection: { type: "server_vad" } } },
    tools: [{
      type: "function", name: "submit_wall_task",
      description: "Send a substantive work request to GPT-6 Astra and display its progress on the wall.",
      parameters: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"], additionalProperties: false }
    }],
    tool_choice: "auto"
  };
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(session));
  return fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      "OpenAI-Safety-Identifier": createHash("sha256").update("radian-local-operator").digest("hex")
    }, body: form
  });
}
