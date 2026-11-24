import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3200);

/**
 * End-to-end tests against a production build (`next build` must run first). The public pages
 * need nothing else. The signed-in app (`e2e/app`) also needs a real Supabase the build points
 * at, so those tests run only with E2E_APP=1; see docs/development.md.
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore: process.env.E2E_APP === "1" ? [] : ["app/**"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}/es`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
