import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Konteyner/önizleme ana bilgisayarlarından gelen isteklere izin ver.
    allowedHosts: true,
  },
  preview: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
});
