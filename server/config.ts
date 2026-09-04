import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  OPENAI_API_KEY: z.string().optional(),
  ASTRA_MODEL: z.string().default("gpt-6-astra"),
  REALTIME_MODEL: z.string().default("gpt-realtime-2.1"),
  REALTIME_VOICE: z.string().default("marin"),
  MOCK_MODE: z.enum(["true", "false"]).default("true"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173,http://localhost:8787"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  SLACK_USER_TOKEN: z.string().optional(),
  BLENDER_PATH: z.string().default("/Applications/Blender.app/Contents/MacOS/Blender"),
  BAMBU_STUDIO_PATH: z.string().default("/Applications/BambuStudio.app/Contents/MacOS/BambuStudio"),
  BAMBU_PRINTER_HOST: z.string().optional(),
  BAMBU_PRINTER_SERIAL: z.string().optional(),
  BAMBU_ACCESS_CODE: z.string().optional(),
  STUDIO_ROOT: z.string().default(process.cwd()),
  CONTROLLER_TOKEN: z.preprocess((value) => value === "" ? undefined : value, z.string().min(24).optional()),
  CUSTOM_CONNECTORS_JSON: z.string().default("[]")
});

const parsed = schema.parse(process.env);

export const config = {
  ...parsed,
  mockMode: parsed.MOCK_MODE === "true" || !parsed.OPENAI_API_KEY,
  origins: parsed.ALLOWED_ORIGINS.split(",").map((value) => value.trim())
};
