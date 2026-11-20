import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const CHANNEL_NAME = "rpa-ops-tool-vconsole";
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

/**
 * 把请求日志广播给独立的 vConsole 调试窗口；浏览器控制台也保留一份。
 * 主窗口不再注入 vConsole 面板，面板在单独窗口里展示。
 */
export function vconsoleLog(...args: unknown[]): void {
  channel?.postMessage({ type: "vconsole-log", args });
  console.log(...args);
}

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 打开独立的 vConsole 调试窗口；浏览器预览中用弹窗，安装版中用 Tauri 原生窗口。 */
export async function openVConsoleWindow(): Promise<void> {
  if (isTauri()) {
    try {
      new WebviewWindow(`vconsole-${Date.now()}`, {
        url: "vconsole.html",
        title: "vConsole 调试面板",
        width: 760,
        height: 560,
        resizable: true,
        center: true,
      });
    } catch (error) {
      console.error("打开 vConsole 窗口失败", error);
    }
    return;
  }

  const popup = window.open("/vconsole.html", "vconsole", "width=760,height=560,resizable=yes");
  popup?.focus();
}
