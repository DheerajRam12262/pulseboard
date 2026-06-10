import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/db/migrate.ts"],
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  clean: true,
  // Workspace packages ship TS source, so they must be bundled.
  noExternal: ["@pulseboard/shared"],
});
