import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'assets',
  build: {
    outDir: 'dist',
  },
  server: {
    // Porta fixa: o script `dev:electron` espera o Vite nela (wait-on) e o Electron carrega esta URL.
    // `strictPort`: se estiver ocupada, falha em vez de subir em outra porta silenciosamente.
    port: 5173,
    strictPort: true,
  },
});
