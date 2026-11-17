import VConsole from "vconsole";

let instance: VConsole | null = null;

/** 在 Webview / 浏览器里初始化一次 vConsole，提供安装版的调试面板。 */
export function getVConsole(): VConsole | null {
  if (typeof window === "undefined") return null;
  if (!instance) {
    instance = new VConsole({ theme: "light" });
  }
  return instance;
}

/** 把请求参数、响应等信息输出到 vConsole 的 Log 面板。 */
export function vconsoleLog(...args: unknown[]): void {
  getVConsole()?.log.log(...args);
}
