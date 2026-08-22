import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PostgreSQL Lab 2 files intentionally reset one guarded disposable target.
    fileParallelism: false,
  },
});
