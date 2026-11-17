import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

/** 仅用于浏览器预览：把 /api/device-info?ip=... 转发到设备的 8000 端口 */
const deviceInfoDevApi = () => ({
  name: "device-info-dev-api",
  configureServer(server: ViteDevServer) {
    server.middlewares.use("/api/device-info", async (req, res) => {
      const params = new URL(req.url ?? "", "http://localhost").searchParams;
      const ip = params.get("ip");
      const requestedPath = params.get("path") ?? "/info";
      const path = ["/info", "/info/device", "/android"].includes(requestedPath)
        ? requestedPath
        : "/info";
      const send = (status: number, body: unknown) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(body));
      };

      if (!ip || !/^[\d.]+$/.test(ip)) {
        send(400, { code: 400, message: "invalid ip" });
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const upstream = await fetch(`http://${ip}:8000${path}`, { signal: controller.signal });
        const text = await upstream.text();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(text || JSON.stringify({ code: 502 }));
      } catch {
        send(200, { code: 504, message: "timeout or unreachable" });
      } finally {
        clearTimeout(timer);
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), deviceInfoDevApi()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 5174,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
