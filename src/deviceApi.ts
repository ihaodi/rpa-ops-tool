import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { vconsoleLog } from "./vconsole";

const TIMEOUT_MS = 5000;

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

const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("请求超时")), TIMEOUT_MS);
    }),
  ]);

async function requestDevice<T>(ip: string, path: string): Promise<ApiResponse<T> | null> {
  const url = `http://${ip}:8000${path}`;
  const params = { ip, path, method: "GET" };
  const startedAt = performance.now();
  vconsoleLog("[请求] GET", url, "参数:", params);

  try {
    const response = isTauri()
      ? await withTimeout(tauriFetch(url, { method: "GET" }))
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

/** 调用 /info，code 为 0 视为在线，其余情况（含超时）离线。 */
export async function checkDeviceStatus(ip: string): Promise<boolean> {
  const result = await requestDevice<unknown>(ip, "/info");
  return result?.code === 0;
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

/** 调用 /android，成功返回云机列表；失败时返回接口 message 供界面展示。 */
export async function fetchAndroidDevices(ip: string): Promise<AndroidDeviceResult> {
  const result = await requestDevice<{ list?: AndroidDevice[] }>(ip, "/android");
  if (!result) {
    return { list: [], message: "请求超时或设备不可达" };
  }
  if (result.code === 0) {
    const list = Array.isArray(result.data?.list) ? [...result.data!.list!] : [];
    list.sort((a, b) => Number(a.indexNum) - Number(b.indexNum));
    return { list, message: null };
  }
  return { list: [], message: result.message ?? "获取设备列表失败" };
}
