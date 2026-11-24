import { defineConfig } from "@playwright/test";
const port = process.env.COUP_TEST_PORT ?? "3176";
const baseURL = "http://127.0.0.1:" + port;
export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  // One server transition can narrate a declaration, its result and a reveal.
  expect: { timeout: 25000 },
  use: { baseURL, headless: true },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "node --import tsx e2e/server.ts --production",
    url: baseURL,
    env: { PORT: port },
    reuseExistingServer: false,
  },
});
