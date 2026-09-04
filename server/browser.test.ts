import { describe, expect, it } from "vitest";
import { BrowserWorkspace } from "./browser.js";

describe("BrowserWorkspace URL policy", () => {
  it("blocks localhost before navigation", async () => {
    const browser = new BrowserWorkspace();
    await expect(browser.open("http://localhost:3000/private")).rejects.toThrow(/blocked/i);
  });

  it("blocks private IPv4 ranges before navigation", async () => {
    const browser = new BrowserWorkspace();
    await expect(browser.open("http://192.168.1.10")).rejects.toThrow(/blocked/i);
  });
});
