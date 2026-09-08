import { createHash } from "node:crypto";
import { config } from "./config.js";

export async function createRealtimeSession(sdp: string): Promise<Response> {
  if (!config.OPENAI_API_KEY) return new Response("OPENAI_API_KEY is required for voice", { status: 503 });
  const session = {
    type: "realtime",
    model: config.REALTIME_MODEL,
    output_modalities: ["audio"],
    instructions: `You are the voice interface for Radian, a spatial AI workspace. Be brief and respond aloud. For any request that requires research, creation, browser work, analysis, or more than a conversational answer, call submit_wall_task. Tell the user that the task is being shown on the wall. Use control_interface whenever the user asks to operate Radian itself, including setup navigation, theme, wake word, or approving and rejecting pending actions. Never claim a control changed unless the tool confirms it. Browser and operating-system permission dialogs still require the user to click them.`,
    audio: { output: { voice: config.REALTIME_VOICE }, input: { transcription: { model: "gpt-live-transcribe" }, turn_detection: { type: "server_vad" } } },
    tools: [{
      type: "function", name: "submit_wall_task",
      description: "Send a substantive work request to Radian and display its progress on the wall.",
      parameters: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"], additionalProperties: false }
    }, {
      type: "function", name: "control_interface",
      description: "Operate Radian's interface in response to an explicit user voice command.",
      parameters: {
        type: "object",
        properties: { action: { type: "string", enum: ["open_setup", "close_setup", "next_setup", "previous_setup", "light_mode", "dark_mode", "enable_wake_word", "disable_wake_word", "approve", "reject", "open_google_setup", "open_dropbox_setup"] } },
        required: ["action"], additionalProperties: false
      }
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
