import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // PGlite instances are created per test file; keep them isolated.
    pool: "forks",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
