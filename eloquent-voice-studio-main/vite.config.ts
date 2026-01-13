import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api/serverless': {
        target: 'https://api.runpod.ai/v2/vliov4h1a58iwu/runsync',
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000,
        rewrite: (path) => path.replace(/^\/api\/serverless/, '')
      },
      // Status Check Endpoint
      '/api/status': {
        target: 'https://api.runpod.ai/v2/vliov4h1a58iwu/status',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/status/, '')
      },
      "/v1": {
        target: "https://api.runpod.ai/v2/vliov4h1a58iwu/runsync",
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000,
      },
    },
    hmr: {
      // clientPort: 443, // Disabled for Localhost
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
