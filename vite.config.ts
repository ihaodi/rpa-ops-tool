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
      const path = ["/info", "/info/device", "/android", "/android/exec"].includes(requestedPath)
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

      const method = req.method === "POST" ? "POST" : "GET";
      let requestBody: string | undefined;
      if (method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        requestBody = Buffer.concat(chunks).toString("utf8");
      }

      const controller = new AbortController();
      const timeoutMs = path === "/android/exec" ? 30_000 : 15_000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const upstream = await fetch(`http://${ip}:8000${path}`, {
          method,
          headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: requestBody,
          signal: controller.signal,
        });
        const text = await upstream.text();
        // 仅清理缓存接口透传真实 HTTP 状态供 200 判定；其他接口保持原行为（一律 200，由 code 判断）
        if (path === "/android/exec") {
          res.statusCode = upstream.status || 200;
        } else {
          res.statusCode = 200;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(text || JSON.stringify({ code: 502 }));
      } catch {
        if (path === "/android/exec") {
          send(504, { code: 504, message: "timeout or unreachable" });
        } else {
          send(200, { code: 504, message: "timeout or unreachable" });
        }
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
