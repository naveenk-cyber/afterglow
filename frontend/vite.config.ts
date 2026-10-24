import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * `@tailwindcss/vite` must be registered here. It is the only thing that
 * compiles `@import 'tailwindcss'`, the `@theme` tokens in `src/index.css` and
 * the utility classes used across the app. With the plugin missing (as it was
 * before this fix) Vite serves the stylesheet verbatim: every design token is
 * undefined, no utility class exists, and the whole interface falls back to
 * defaults — the "old-looking", washed-out site.
 *
 * The dev proxy is equally load-bearing. `.env.example` and the README both say
 * the frontend calls `/api/v1` same-origin and Vite forwards it to Express, but
 * the proxy was missing: `/api/...` fell through to the SPA HTML fallback, the
 * JSON parse failed, and every page silently dropped to the demo catalogue.
 * 127.0.0.1 is deliberate — `localhost` can resolve to IPv6 `::1` while
 * Express listens on IPv4.
 */
export default defineConfig(({ mode }) => {
  // `loadEnv` resolves from the project root without needing Node types here.
  const env = loadEnv(mode, '.', 'VITE_');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
