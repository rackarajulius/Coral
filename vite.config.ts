import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    // Fail instead of quietly moving to 8082: the backend builds links from
    // FRONTEND_URL (8081) and Google's OAuth client allows that origin, so a
    // different port breaks sign-in and every emailed link.
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 8081, // force HMR to use the same port
      overlay: false,
    },
    headers: {
      // Lets the opener keep access to popups it opens (OAuth popup flow) —
      // silences the COOP "window.closed" warning without weakening isolation
      // against windows that open us.
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ["react-countup"],
  },
}));
