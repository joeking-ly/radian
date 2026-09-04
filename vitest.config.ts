import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts"],
    coverage: { include: ["server/**/*.ts"], exclude: ["server/**/*.test.ts"] }
  }
});
