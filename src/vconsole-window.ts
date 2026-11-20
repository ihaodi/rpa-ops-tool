import VConsole from "vconsole";

const CHANNEL_NAME = "rpa-ops-tool-vconsole";

const vc = new VConsole({ theme: "light" });
vc.show();
vc.log.log("[vConsole] 已连接，等待主窗口请求日志…");

const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

channel?.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as { type?: string; args?: unknown[] } | null;
  if (data?.type === "vconsole-log" && Array.isArray(data.args)) {
    vc.log.log(...data.args);
  }
});
