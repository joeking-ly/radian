import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

export class BrowserWorkspace {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;

  async start(): Promise<void> {
    if (this.page) return;
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Radian/0.1 controlled-browser"
    });
    this.page = await this.context.newPage();
  }

  async open(url: string): Promise<string> {
    const safeUrl = validatePublicUrl(url);
    await this.start();
    await this.page!.goto(safeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return `Opened ${this.page!.url()} — ${await this.page!.title()}`;
  }

  async snapshot(): Promise<string> {
    await this.start();
    const data = await this.page!.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    return JSON.stringify({
      url: this.page!.url(),
      title: await this.page!.title(),
      text: data.slice(0, 18_000)
    });
  }

  async screenshot(jobId: string): Promise<string> {
    await this.start();
    const directory = path.resolve("artifacts", jobId);
    await fs.mkdir(directory, { recursive: true });
    const filename = `browser-${Date.now()}.png`;
    await this.page!.screenshot({ path: path.join(directory, filename), fullPage: false });
    return `/artifacts/${jobId}/${filename}`;
  }

  async click(text: string): Promise<string> {
    await this.start();
    const target = this.page!.getByText(text, { exact: false }).first();
    await target.click({ timeout: 10_000 });
    return `Clicked visible text: ${text}`;
  }

  async fill(label: string, value: string): Promise<string> {
    await this.start();
    const target = this.page!.getByLabel(label, { exact: false }).first();
    await target.fill(value, { timeout: 10_000 });
    return `Filled field labeled: ${label}`;
  }

  async close(): Promise<void> { await this.browser?.close(); }
}

function validatePublicUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only HTTP(S) URLs are allowed");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
    throw new Error("Local and private hosts are blocked");
  }
  if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error("Private network addresses are blocked");
  }
  return url.toString();
}

export const browserWorkspace = new BrowserWorkspace();
