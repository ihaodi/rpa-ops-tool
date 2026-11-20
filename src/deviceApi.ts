import { invoke } from "@tauri-apps/api/core";
import { vconsoleLog } from "./vconsole";

const TIMEOUT_MS = 15000;

export interface DeviceInfo {
  ip: string;
  ip_1: string;
  hwaddr: string;
  hwaddr_1: string;
  cputemp: number;
  cpuload: string;
  memtotal: string;
  memuse: string;
  mmctotal: string;
  mmcuse: string;
  version: string;
  deviceId: string;
  model: string;
  speed: string;
  mmcread: string;
  mmcwrite: string;
  sysuptime: string;
  mmcmodel: string;
  mmctemp: string;
  network4g: string;
  netWork_eth0: string;
}

export interface AndroidDevice {
  id: string;
  name: string;
  status: string;
  indexNum: number;
  dataPath: string;
  modelPath: string;
  image: string;
  ip: string;
  networkName: string;
  portBindings: Record<string, unknown>;
  dns: string;
  doboxFps: string;
  doboxWidth: string;
  doboxHeight: string;
  doboxDpi: string;
  mgenable: string;
  gmsenable: string;
  s5User: string;
  s5Password: string;
  s5IP: string;
  s5Port: string;
  s5Type: string;
  created: string;
  started: string;
  finished: string;
  customBinds: unknown[];
  PINCode: string;
}

interface ApiResponse<T> {
  code?: number;
  message?: string;
  data?: T | null;
}

export interface DeviceInfoResult {
  data: DeviceInfo | null;
  message: string | null;
}

export interface AndroidDeviceResult {
  list: AndroidDevice[];
  message: string | null;
}

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface TauriHttpResult {
  ok: boolean;
  status: number;
  body: string;
  error: string | null;
}

/**
 * 走 Rust 自定义 command 发请求，绕过 plugin-http 的 URL scope 限制。
 * 返回与 fetch.Response 兼容的最小接口，便于上层复用现有逻辑。
 */
async function tauriRequest(
  url: string,
  method: "GET" | "POST",
  body: string | null,
  timeoutMs: number,
): Promise<{ status: number; json: () => Promise<unknown> }> {
  const result = await invoke<TauriHttpResult>("http_request", {
    url,
    method,
    body,
    timeoutMs,
  });
  if (result.error && result.status === 0) {
    throw new Error(result.error);
  }
  return {
    status: result.status,
    json: async () => {
      try {
        return JSON.parse(result.body);
      } catch {
        return null;
      }
    },
  };
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = TIMEOUT_MS): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("请求超时")), timeoutMs);
    }),
  ]);

/** 清理缓存命令可能耗时较久，单独放宽到 30 秒。 */
const EXEC_TIMEOUT_MS = 30_000;

async function requestDevice<T>(ip: string, path: string): Promise<ApiResponse<T> | null> {
  const url = `http://${ip}:8000${path}`;
  const params = { ip, path, method: "GET" };
  const startedAt = performance.now();
  vconsoleLog("[请求] GET", url, "参数:", params);

  try {
    const response = isTauri()
      ? await withTimeout(tauriRequest(url, "GET", null, TIMEOUT_MS))
      : await withTimeout(
          fetch(`/api/device-info?ip=${encodeURIComponent(ip)}&path=${encodeURIComponent(path)}`),
        );

    const data = (await response.json()) as ApiResponse<T>;
    vconsoleLog(
      `[响应] HTTP ${response.status}`,
      `耗时 ${Math.round(performance.now() - startedAt)}ms`,
      data,
    );
    return data;
  } catch (error) {
    vconsoleLog(
      "[请求失败]",
      url,
      "参数:",
      params,
      error instanceof Error ? error.message : "请求失败",
    );
    return null;
  }
}

export interface DeviceVersion {
  latestVersion: number;
  currentVersion: number;
}

export interface DeviceStatusResult {
  online: boolean;
  version: DeviceVersion | null;
}

/** 调用 /info，code 为 0 视为在线；同时带出版本号（latestVersion/currentVersion）。 */
export async function checkDeviceStatus(ip: string): Promise<DeviceStatusResult> {
  const result = await requestDevice<DeviceVersion>(ip, "/info");
  if (result?.code !== 0) {
    return { online: false, version: null };
  }
  const data = result.data;
  const version =
    data &&
    typeof data.latestVersion === "number" &&
    typeof data.currentVersion === "number"
      ? { latestVersion: data.latestVersion, currentVersion: data.currentVersion }
      : null;
  return { online: true, version };
}

/** 调用 /info/device，成功返回设备信息；失败时返回接口 message 供界面展示。 */
export async function fetchDeviceInfo(ip: string): Promise<DeviceInfoResult> {
  const result = await requestDevice<DeviceInfo>(ip, "/info/device");
  if (!result) {
    return { data: null, message: "请求超时或设备不可达" };
  }
  if (result.code === 0 && result.data) {
    return { data: result.data, message: null };
  }
  return { data: null, message: result.message ?? "获取设备信息失败" };
}

// 同序号（indexNum）冲突时的状态优先级：数字越小越优先保留
const DEVICE_STATUS_PRIORITY: Record<string, number> = {
  running: 0,
  stopped: 1,
  exited: 2,
  created: 3,
};

const statusPriority = (status: string): number =>
  DEVICE_STATUS_PRIORITY[status] ?? Number.MAX_SAFE_INTEGER;

/**
 * 序号相同的云机只保留一个：按 running > stopped > exited > created 选取，
 * 优先级相同则保留最先出现的；最终按 indexNum 升序排列。
 */
function dedupeDevicesByIndex(list: AndroidDevice[]): AndroidDevice[] {
  const byIndex = new Map<number, AndroidDevice>();
  for (const device of list) {
    const index = Number(device.indexNum);
    const kept = byIndex.get(index);
    if (!kept || statusPriority(device.status) < statusPriority(kept.status)) {
      byIndex.set(index, device);
    }
  }
  return [...byIndex.values()].sort((a, b) => Number(a.indexNum) - Number(b.indexNum));
}

/** 调用 /android，成功返回云机列表；失败时返回接口 message 供界面展示。 */
export async function fetchAndroidDevices(ip: string): Promise<AndroidDeviceResult> {
  const result = await requestDevice<{ list?: AndroidDevice[] }>(ip, "/android");
  if (!result) {
    return { list: [], message: "请求超时或设备不可达" };
  }
  if (result.code === 0) {
    const list = Array.isArray(result.data?.list) ? [...result.data!.list!] : [];
    return { list: dedupeDevicesByIndex(list), message: null };
  }
  return { list: [], message: result.message ?? "获取设备列表失败" };
}

export interface ExecResult {
  success: boolean;
  message: string | null;
}

/**
 * 调用 POST /android/exec，在指定云机内执行命令。
 * code 为 0 视为成功；失败时返回接口 message 供界面展示。
 */
export async function execAndroidCommand(
  ip: string,
  name: string,
  command: string[],
): Promise<ExecResult> {
  const path = "/android/exec";
  const url = `http://${ip}:8000${path}`;
  const body = { name, command };
  const params = { ip, path, method: "POST", body };
  const startedAt = performance.now();
  vconsoleLog("[请求] POST", url, "参数:", params);

  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };

  try {
    const response = isTauri()
      ? await withTimeout(tauriRequest(url, "POST", JSON.stringify(body), EXEC_TIMEOUT_MS), EXEC_TIMEOUT_MS)
      : await withTimeout(
          fetch(
            `/api/device-info?ip=${encodeURIComponent(ip)}&path=${encodeURIComponent(path)}`,
            init,
          ),
          EXEC_TIMEOUT_MS,
        );

    const elapsed = Math.round(performance.now() - startedAt);
    // 只按 HTTP 状态判断：200 即成功，不依赖返回体是否为 JSON
    if (response.status === 200) {
      vconsoleLog(`[响应] HTTP 200`, `耗时 ${elapsed}ms`, "清理缓存成功");
      return { success: true, message: null };
    }
    let data: ApiResponse<unknown> | null = null;
    try {
      data = (await response.json()) as ApiResponse<unknown>;
    } catch {
      // 非 200 且返回体非 JSON 时忽略解析错误
    }
    vconsoleLog(`[响应] HTTP ${response.status}`, `耗时 ${elapsed}ms`, data);
    return { success: false, message: data?.message ?? `请求失败（HTTP ${response.status}）` };
  } catch (error) {
    vconsoleLog(
      "[请求失败]",
      url,
      "参数:",
      params,
      error instanceof Error ? error.message : "请求失败",
    );
    return { success: false, message: "请求超时或设备不可达" };
  }
}
