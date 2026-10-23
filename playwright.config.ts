import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3400", ...devices["Pixel 7"] },
  webServer: {
    command: "pnpm build && pnpm start -p 3400",
    url: "http://localhost:3400",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
