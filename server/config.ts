import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  OPENAI_API_KEY: z.string().optional(),
  ASTRA_MODEL: z.string().default("gpt-6-astra"),
  REALTIME_MODEL: z.string().default("gpt-realtime-2.1"),
  REALTIME_VOICE: z.string().default("marin"),
  MOCK_MODE: z.enum(["true", "false"]).default("true"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:8787")
});

const parsed = schema.parse(process.env);

export const config = {
  ...parsed,
  mockMode: parsed.MOCK_MODE === "true" || !parsed.OPENAI_API_KEY,
  origins: parsed.ALLOWED_ORIGINS.split(",").map((value) => value.trim())
};
