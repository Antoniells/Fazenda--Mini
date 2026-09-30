import { defineConfig } from 'vitest/config';

/** Testes de lógica pura (Vitest): só o que não depende do Phaser/navegador — `tests/unit`. Os de ponta a ponta são do Playwright (`tests/e2e`). */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
  },
});
