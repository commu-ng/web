import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Use setup-simple.ts for now (no Docker required)
    // To use Testcontainers, change to "./src/test/setup.ts"
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 10000,
    poolOptions: {
      threads: {
        singleThread: true, // Run tests serially for database isolation
      },
    },
  },
});
