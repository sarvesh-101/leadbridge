import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leadbridge_test",
      JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters-long!!",
      JWT_REFRESH_SECRET: "test-refresh-secret-that-is-also-32-characters-long!!",
      OMNIDIM_API_KEY: "test-omni-api-key",
    },
    // E2E tests require a real DB — only run if RUN_E2E_TESTS=true
    testTimeout: 15_000,
  },
});
