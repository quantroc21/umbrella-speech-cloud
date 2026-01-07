import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    allowedHosts: true,
    proxy: {
      // Serverless Endpoint (RunPod)
      '/api/serverless': {
        target: 'https://api.runpod.ai/v2/vliov4h1a58iwu/runsync',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/serverless/, '')
      },
      "/v1": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
