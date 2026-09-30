import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de ponta a ponta (Playwright): abrem o jogo de verdade no navegador (o servidor do Vite sobe sozinho, ou reaproveita o que já
 * estiver rodando) e o dirigem pelo MENU DE HACK (`src/debug/hackMenu.ts`, F9). Os de lógica pura são do Vitest (`tests/unit`).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
