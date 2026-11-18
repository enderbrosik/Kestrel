import { defineConfig } from 'vite';

// Tauri expects a fixed dev port and no screen clearing so Rust logs stay visible.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2022',
    sourcemap: false,
    // Monaco's core chunk is large by nature; everything else stays small.
    chunkSizeWarningLimit: 3000,
  },
});
