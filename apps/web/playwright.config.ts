import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: '../api/mvnw -f ../api/pom.xml -B -ntp spring-boot:run',
      url: 'http://localhost:8080/actuator/health',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm dev',
      url: 'http://127.0.0.1:5173',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
