import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./integration/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    include: ["integration/**/*.test.ts"],
    setupFiles: ["./integration/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
