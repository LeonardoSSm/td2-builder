import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Dev proxy so browser requests stay same-origin (/api) -> avoids cross-site cookie issues (auth/CSRF).
  const env = loadEnv(mode, process.cwd(), "");
  const target = String(env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3001").trim() || "http://127.0.0.1:3001";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
