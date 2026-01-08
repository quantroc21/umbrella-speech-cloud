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
      // Serverless Endpoint (RunPod)
      '/api/serverless': {
        target: 'https://api.runpod.ai/v2/vliov4h1a58iwu/runsync',
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000,
        rewrite: (path) => path.replace(/^\/api\/serverless/, '')
      },
      "/v1": {
        target: "https://api.runpod.ai/v2/vliov4h1a58iwu/runsync",
        changeOrigin: true,
      },
    },
    hmr: {
      clientPort: 443, // Critical for Ngrok WSS connection
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
