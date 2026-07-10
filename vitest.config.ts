import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**/*.ts",
        "src/components/**/*.tsx",
        "src/config/**/*.ts",
        "src/app/**/*.{ts,tsx}",
      ],
      exclude: [
        "src/components/ui/**",
        "src/app/layout.tsx",
        "src/app/globals.css",
        "src/**/*.d.ts",
        "src/app/api/auth/**",
        "src/lib/auth.ts",
        "src/lib/db.ts",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
