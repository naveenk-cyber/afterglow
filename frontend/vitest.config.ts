import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest reads the app's Vite setup for transforms, but the test run needs a
 * jsdom document (React Testing Library) and the shared setup file that stubs
 * the browser APIs jsdom does not implement.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // The jsdom suite imports Leaflet and three.js; spawning one OS process per
    // test file exhausts the default startup budget on Windows. Two worker
    // threads keep the run parallel without timing out the pool.
    pool: 'threads',
    maxWorkers: 2,
    minWorkers: 1,
  },
});
