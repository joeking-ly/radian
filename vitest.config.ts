import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts", "src/**/*.test.ts"],
    coverage: { include: ["server/**/*.ts", "src/lib/**/*.ts"], exclude: ["**/*.test.ts"] }
  }
});
