import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Mirrors the `@/*` path in tsconfig.app.json. Without this the alias would
    // typecheck and then fail to resolve at build time.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    /*
      Bind to every interface, not just loopback, so the dev server can be opened
      from a phone on the same Wi-Fi — which is the only way to test the mobile
      layout on a real device, with a real touch screen and a real notch.

      This does expose the dev server, and the API behind its proxy, to anything
      else on the network. That is fine on a home or office LAN and is not fine on
      a public one; there is no authentication in front of the Vite server itself.
    */
    host: true,
    // The API is called through /api on the same origin in development, so the
    // browser never deals with cross-origin cookies. This is also what makes the
    // phone work without touching CORS: to the device it is all one origin, and
    // the login cookie is same-site by construction.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Charts are only needed on two pages and dominate the bundle, so they get
        // their own chunk instead of blocking first paint everywhere else.
        manualChunks: {
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
