import { describe, expect, it } from "vitest";
import { connectorStatus, studioPath, studioToolDefinitions } from "./studio-connectors.js";

describe("studio connectors", () => {
  it("publishes the expected production tool surface", () => {
    const names = studioToolDefinitions.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["google_drive_search", "google_doc_create", "google_slides_create", "slack_search", "slack_send", "blender_render", "blender_export", "bambu_slice", "bambu_print", "studio_webhook"]));
  });

  it("prevents tools from escaping STUDIO_ROOT", () => {
    expect(() => studioPath("../../outside.txt")).toThrow(/outside STUDIO_ROOT/);
  });

  it("never exposes connector secrets in status", () => {
    expect(JSON.stringify(connectorStatus())).not.toMatch(/token|secret|access.code/i);
  });
});
