import { useEffect, useState, type ReactNode } from "react";
import {
  checkDeviceStatus,
  fetchAndroidDevices,
  fetchDeviceInfo,
  type AndroidDevice,
  type DeviceInfo,
  type DeviceVersion,
} from "./deviceApi";
import { getVConsole } from "./vconsole";
import "./styles.css";

type NavKey = "cloud" | "dashboard" | "tasks" | "logs" | "settings";
type TaskStatus = "运行中" | "成功" | "待执行" | "失败";

interface Task {
  id: string;
  name: string;
  trigger: string;
  lastRun: string;
  status: TaskStatus;
}

interface NavItem {
  key: NavKey;
  label: string;
  icon: ReactNode;
}

interface IpEntry {
  address: string;
  status: "在线" | "离线" | "检测中";
}

const IP_STORAGE_KEY = "rpa-arm-device-ips";
const IPV4_PATTERN = /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/;

const compareIp = (a: string, b: string) => {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 4; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

const sortIps = (list: IpEntry[]) =>
  [...list].sort((a, b) => compareIp(a.address, b.address));

const loadIps = (): IpEntry[] => {
  try {
    const raw = localStorage.getItem(IP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IpEntry[];
    if (!Array.isArray(parsed)) return [];
    return sortIps(
      parsed
        .filter((item) => item && IPV4_PATTERN.test(item.address))
        .map((item) => ({
          address: item.address,
          status: item.status === "在线" ? "在线" : "离线",
        })),
    );
  } catch {
    return [];
  }
};

const saveIps = (list: IpEntry[]) => {
  localStorage.setItem(IP_STORAGE_KEY, JSON.stringify(sortIps(list)));
};

function parseIpAddresses(text: string): string[] {
  const parts = text.split(/[\s,;，；、]+/).filter(Boolean);
  return [...new Set(parts.filter((value) => IPV4_PATTERN.test(value)))].sort(compareIp);
}

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

const navItems: NavItem[] = [
  {
    key: "cloud",
    label: "云机",
    icon: icon(<><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.5 4.25 4.25 0 0 0 7 18z" /><path d="M9 21h6" /></>),
  },
  {
    key: "dashboard",
    label: "控制台",
    icon: icon(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  },
  {
    key: "tasks",
    label: "任务管理",
    icon: icon(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="m3 6 1.5 1.5L7 5" /><path d="m3 12 1.5 1.5L7 11" /><path d="m3 18 1.5 1.5L7 17" /></>),
  },
  {
    key: "logs",
    label: "运行日志",
    icon: icon(<><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></>),
  },
  {
    key: "settings",
    label: "设置",
    icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14a1.7 1.7 0 0 0-1.5-1H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3 7.6a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8 3h.1A1.7 1.7 0 0 0 9 1.5V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 3a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19 8v.1A1.7 1.7 0 0 0 20.5 9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  },
];

const deviceFieldGroups: { title: string; fields: { key: keyof DeviceInfo; label: string }[] }[] = [
  {
    title: "基础信息",
    fields: [
      { key: "deviceId", label: "设备ID" },
      { key: "model", label: "型号版本" },
      { key: "version", label: "固件版本" },
      { key: "ip", label: "网口IP" },
      { key: "ip_1", label: "网口1的IP" },
      { key: "hwaddr", label: "MAC地址" },
      { key: "hwaddr_1", label: "MAC1地址" },
    ],
  },
  {
    title: "运行状态",
    fields: [
      { key: "cputemp", label: "CPU温度" },
      { key: "cpuload", label: "CPU负载" },
      { key: "memtotal", label: "内存总大小" },
      { key: "memuse", label: "内存已使用大小" },
      { key: "sysuptime", label: "设备运行时间" },
    ],
  },
  {
    title: "磁盘与网络",
    fields: [
      { key: "mmcmodel", label: "磁盘型号" },
      { key: "mmctotal", label: "磁盘总大小" },
      { key: "mmcuse", label: "磁盘已使用大小" },
      { key: "mmcread", label: "磁盘读取量" },
      { key: "mmcwrite", label: "磁盘写入量" },
      { key: "mmctemp", label: "磁盘温度" },
      { key: "speed", label: "网口速率" },
      { key: "netWork_eth0", label: "ETH0网卡状态" },
      { key: "network4g", label: "4G网卡状态" },
    ],
  },
];

const androidSecondaryFields: { key: keyof AndroidDevice; label: string }[] = [
  { key: "id", label: "云机容器ID" },
  { key: "indexNum", label: "云机实例位序号" },
  { key: "dataPath", label: "云机Data路径" },
  { key: "modelPath", label: "云机机型文件路径" },
  { key: "networkName", label: "容器网卡名称" },
  { key: "portBindings", label: "端口映射" },
  { key: "dns", label: "云机DNS" },
  { key: "doboxFps", label: "云机FPS" },
  { key: "doboxWidth", label: "云机分辨率的宽" },
  { key: "doboxHeight", label: "云机分辨率的高" },
  { key: "doboxDpi", label: "云机DPI" },
  { key: "mgenable", label: "magisk开关" },
  { key: "gmsenable", label: "gms开关" },
  { key: "s5User", label: "s5代理用户名" },
  { key: "s5Password", label: "s5代理密码" },
  { key: "s5IP", label: "s5代理IP" },
  { key: "s5Port", label: "s5代理端口" },
  { key: "s5Type", label: "代理类型" },
  { key: "created", label: "云机容器创建时间" },
  { key: "started", label: "云机容器上次开启时间" },
  { key: "finished", label: "云机容器上次关闭时间" },
  { key: "customBinds", label: "自定义文件映射" },
  { key: "PINCode", label: "自定义屏幕锁屏密码" },
];

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const formatDeviceStatus = (status: string): string =>
  status === "running" ? "运行中" : status === "stopped" ? "已停止" : status;

const stats = [
  { label: "今日执行", value: "128", delta: "+12.5%", tone: "blue" },
  { label: "成功", value: "121", delta: "94.5%", tone: "green" },
  { label: "失败", value: "3", delta: "2.3%", tone: "red" },
  { label: "运行中", value: "4", delta: "实时", tone: "amber" },
];

const initialTasks: Task[] = [
  { id: "RP-0021", name: "日报数据抓取", trigger: "每天 09:00", lastRun: "今天 09:02", status: "成功" },
  { id: "RP-0020", name: "客户工单同步", trigger: "每 30 分钟", lastRun: "今天 14:30", status: "运行中" },
  { id: "RP-0019", name: "发票信息录入", trigger: "每天 18:30", lastRun: "昨天 18:33", status: "失败" },
  { id: "RP-0018", name: "库存报表导出", trigger: "每周一 08:00", lastRun: "11月10日 08:01", status: "成功" },
  { id: "RP-0017", name: "舆情信息巡检", trigger: "每 15 分钟", lastRun: "今天 15:15", status: "待执行" },
];

const logs = [
  { time: "15:15:02", level: "信息", text: "舆情信息巡检任务已加入队列" },
  { time: "14:30:11", level: "信息", text: "客户工单同步完成，处理 26 条记录" },
  { time: "14:12:43", level: "警告", text: "页面加载超时，已自动重试第 2 次" },
  { time: "09:02:18", level: "信息", text: "日报数据抓取完成，耗时 1 分 42 秒" },
  { time: "昨天 18:33", level: "错误", text: "发票信息录入失败：目标字段未找到" },
];

const titles: Record<NavKey, { title: string; subtitle: string }> = {
  cloud: { title: "云机", subtitle: "查看与管理云端设备资源" },
  dashboard: { title: "控制台", subtitle: "概览自动化任务的整体运行情况" },
  tasks: { title: "任务管理", subtitle: "查看、配置并手动触发自动化任务" },
  logs: { title: "运行日志", subtitle: "追踪每一次执行的过程与结果" },
  settings: { title: "设置", subtitle: "调整引擎、通知与运行偏好" },
};

function TaskTable({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>任务名称</th>
            <th>触发方式</th>
            <th>最近执行</th>
            <th>状态</th>
            <th className="right">操作</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <div className="task-name">{task.name}</div>
                <div className="task-id">{task.id}</div>
              </td>
              <td className="muted">{task.trigger}</td>
              <td className="muted">{task.lastRun}</td>
              <td><span className={`badge ${task.status}`}>{task.status}</span></td>
              <td className="right">
                <button className="text-btn" onClick={() => onToggle(task.id)}>
                  {task.status === "运行中" ? "停止" : "运行"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogList() {
  return (
    <div className="log-list">
      {logs.map((log, index) => (
        <div className="log-item" key={index}>
          <span className="log-time">{log.time}</span>
          <span className={`log-level ${log.level}`}>{log.level}</span>
          <span className="log-text">{log.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState<NavKey>("cloud");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [notice, setNotice] = useState("");
  const [ipList, setIpList] = useState<IpEntry[]>([]);
  const [ipQuery, setIpQuery] = useState("");
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceInfoError, setDeviceInfoError] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoRefresh, setInfoRefresh] = useState(0);
  const [androidDevices, setAndroidDevices] = useState<AndroidDevice[]>([]);
  const [deviceListError, setDeviceListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listRefresh, setListRefresh] = useState(0);
  // 每个 IP 对应的版本信息（来自 /info 的 latestVersion/currentVersion）
  const [deviceVersions, setDeviceVersions] = useState<Record<string, DeviceVersion>>({});

  // 对指定 IP 逐个调用 /info 检测在线状态（code=0 在线），记录版本，并写回本地库。
  const checkIpsOnline = (addresses: string[]) => {
    if (addresses.length === 0) return;
    void Promise.all(
      addresses.map(async (address) => {
        const result = await checkDeviceStatus(address);
        setIpList((current) => {
          const updated = current.map((item) =>
            item.address === address
              ? { ...item, status: result.online ? ("在线" as const) : ("离线" as const) }
              : item,
          );
          saveIps(updated);
          return updated;
        });
        if (result.version) {
          setDeviceVersions((current) => ({ ...current, [address]: result.version! }));
        }
      }),
    );
  };

  useEffect(() => {
    const loaded = loadIps();
    // 加载后统一设为检测中，再逐个请求 /info 重新判定在线状态
    setIpList(loaded.map((item) => ({ ...item, status: "检测中" as const })));
    checkIpsOnline(loaded.map((item) => item.address));
  }, []);

  useEffect(() => {
    getVConsole();
  }, []);

  useEffect(() => {
    if (ipList.length === 0) {
      if (selectedIp !== null) setSelectedIp(null);
      return;
    }
    if (!selectedIp || !ipList.some((item) => item.address === selectedIp)) {
      setSelectedIp(ipList[0].address);
    }
  }, [ipList, selectedIp]);

  useEffect(() => {
    if (!selectedIp) {
      setDeviceInfo(null);
      setDeviceInfoError(null);
      return;
    }
    let cancelled = false;
    setInfoLoading(true);
    setDeviceInfo(null);
    setDeviceInfoError(null);
    void fetchDeviceInfo(selectedIp).then((result) => {
      if (!cancelled) {
        setDeviceInfo(result.data);
        setDeviceInfoError(result.message);
        setInfoLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIp, infoRefresh]);

  useEffect(() => {
    if (!selectedIp) {
      setAndroidDevices([]);
      setDeviceListError(null);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    setDeviceListError(null);
    void fetchAndroidDevices(selectedIp).then((result) => {
      if (!cancelled) {
        setAndroidDevices(result.list);
        setDeviceListError(result.message);
        setListLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIp, listRefresh]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, status: task.status === "运行中" ? "待执行" : "运行中" }
          : task,
      ),
    );
    showNotice(`已更新任务 ${id} 的运行状态`);
  };

  const confirmImport = () => {
    const parsed = parseIpAddresses(importText);
    if (parsed.length === 0) {
      showNotice("未识别到有效 IP 地址");
      return;
    }

    const existing = new Set(ipList.map((item) => item.address));
    const added = parsed.filter((address) => !existing.has(address));
    setImportOpen(false);
    setImportText("");

    if (added.length === 0) {
      showNotice("这些 IP 地址已存在");
      return;
    }

    const next = sortIps([
      ...ipList,
      ...added.map((address) => ({ address, status: "检测中" as const })),
    ]);
    setIpList(next);
    saveIps(next);
    showNotice(`已导入 ${added.length} 个 IP，正在检测在线状态`);
    checkIpsOnline(added);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const next = ipList.filter((item) => item.address !== deleteTarget);
    setIpList(next);
    saveIps(next);
    if (selectedIp === deleteTarget) setSelectedIp(null);
    setDeleteTarget(null);
    showNotice(`已删除 ${deleteTarget}`);
  };

  const filteredIps = ipList.filter((item) => item.address.includes(ipQuery.trim()));
  const validImportCount = parseIpAddresses(importText).length;
  const meta = titles[active];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <div className="brand-name">RPA 运营工具</div>
            <div className="brand-sub">Automation Studio</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-label">工作台</div>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${active === item.key ? "active" : ""}`}
              onClick={() => setActive(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="pulse" />
          <div>
            <div className="footer-title">引擎运行正常</div>
            <div className="footer-sub">v0.1.0 · 本地模式</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <div className="topbar-actions">
            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input placeholder="搜索任务或日志" aria-label="搜索任务或日志" />
            </div>
            <button className="primary-btn" onClick={() => setActive("tasks")}>+ 新建任务</button>
          </div>
        </header>

        <div className="content">
          {active === "cloud" && (
            <div className="cloud-layout">
              <aside className="ip-panel">
                <div className="ip-panel-head">
                  <div>
                    <div className="ip-panel-title">ARM设备IP列表</div>
                    <div className="ip-panel-count">{ipList.length} 个地址</div>
                  </div>
                  <button className="icon-btn" title="批量导入 IP 地址" onClick={() => setImportOpen(true)}>+</button>
                </div>
                <input
                  className="ip-search"
                  placeholder="筛选 IP 地址"
                  value={ipQuery}
                  onChange={(event) => setIpQuery(event.target.value)}
                />
                <div className="ip-list">
                  {filteredIps.map((item) => (
                    <div
                      key={item.address}
                      className={`ip-item ${selectedIp === item.address ? "selected" : ""}`}
                      onClick={() => setSelectedIp(item.address)}
                    >
                      <span className={`ip-dot ${item.status}`} />
                      <span className="ip-address">{item.address}</span>
                      <span className="ip-status">{item.status}</span>
                      <button
                        className="ip-remove"
                        title="移除"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(item.address);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {filteredIps.length === 0 && <div className="ip-empty">暂无匹配的 IP 地址</div>}
                </div>
                <div className="ip-panel-footer">点击 + 可批量导入 IP</div>
              </aside>

              <div className="cloud-main">
              <section className="panel device-info-panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      设备信息
                      {selectedIp && deviceVersions[selectedIp] && (
                        <span className="version-badge">
                          当前版本 {deviceVersions[selectedIp].currentVersion}
                          {deviceVersions[selectedIp].latestVersion >
                            deviceVersions[selectedIp].currentVersion && (
                            <span className="version-new">
                              · 可升级至 {deviceVersions[selectedIp].latestVersion}
                            </span>
                          )}
                        </span>
                      )}
                    </h2>
                    <span className="muted small">{selectedIp ?? "未选择设备"}</span>
                  </div>
                  <button
                    className="text-btn"
                    disabled={!selectedIp}
                    onClick={() => setInfoRefresh((value) => value + 1)}
                  >
                    刷新
                  </button>
                </div>
                {infoLoading && <div className="device-info-empty">正在获取设备信息…</div>}
                {!infoLoading && !deviceInfo && (
                  <div className={`device-info-empty ${deviceInfoError ? "error" : ""}`}>
                    {selectedIp
                      ? deviceInfoError ?? "未获取到设备信息，请检查设备是否在线"
                      : "请先导入或选择一个设备 IP"}
                  </div>
                )}
                {!infoLoading && deviceInfo && (
                  <div className="device-info-body">
                    {deviceFieldGroups.map((group) => (
                      <div className="device-info-group" key={group.title}>
                        <div className="device-info-group-title">{group.title}</div>
                        <div className="device-info-grid">
                          {group.fields.map((field) => (
                            <div className="device-info-item" key={field.key}>
                              <span className="device-info-label">{field.label}</span>
                              <span className="device-info-value">{deviceInfo[field.key]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="panel device-list-panel">
                <div className="panel-head">
                  <div>
                    <h2>设备列表（{androidDevices.length}）</h2>
                    <span className="muted small">{selectedIp ?? "未选择设备"}</span>
                  </div>
                  <div className="panel-actions">
                    <button
                      className="text-btn"
                      disabled={!selectedIp}
                      onClick={() => setListRefresh((value) => value + 1)}
                    >
                      刷新
                    </button>
                  </div>
                </div>
                {listLoading && <div className="device-info-empty">正在获取设备列表…</div>}
                {!listLoading && deviceListError && (
                  <div className="device-info-empty error">{deviceListError}</div>
                )}
                {!listLoading && !deviceListError && androidDevices.length === 0 && (
                  <div className="device-info-empty">暂无云机数据</div>
                )}
                {!listLoading && !deviceListError && androidDevices.length > 0 && (
                  <div className="android-card-grid">
                    {androidDevices.map((device, index) => (
                      <div className="android-card" key={`${device.id}-${index}`}>
                        <div className="android-card-top">
                          <div className="android-card-heading">
                            <div className="android-card-icon">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                <rect x="6" y="3" width="12" height="18" rx="2" />
                                <path d="M11 18h2" />
                              </svg>
                            </div>
                            <div>
                              <div className="android-card-name">{formatCell(device.name)}</div>
                              <div className="android-card-sub">ID：{formatCell(device.id)}</div>
                            </div>
                          </div>
                          <span className={`badge ${device.status === "running" ? "成功" : "待执行"}`}>
                            {formatDeviceStatus(device.status)}
                          </span>
                        </div>

                        <div className="android-card-row">
                          <span className="android-card-label">云机局域网IP</span>
                          <span className="android-card-value">{formatCell(device.ip)}</span>
                        </div>
                        <div className="android-card-row">
                          <span className="android-card-label">镜像</span>
                          <span className="android-card-value" title={formatCell(device.image)}>
                            {formatCell(device.image)}
                          </span>
                        </div>
                        <div className="android-card-specs">
                          <span>序号 {formatCell(device.indexNum)}</span>
                          <span>FPS {formatCell(device.doboxFps)}</span>
                          <span>{formatCell(device.doboxWidth)} × {formatCell(device.doboxHeight)}</span>
                          <span>DPI {formatCell(device.doboxDpi)}</span>
                        </div>

                        <div className="android-card-foot">
                          <div className="android-card-more">
                            <button className="android-card-info" type="button" aria-label="查看次要信息">!</button>
                            <div className="android-card-popover">
                              <div className="android-card-popover-title">次要信息</div>
                              {androidSecondaryFields.map((field) => (
                                <div className="android-card-popover-row" key={field.key}>
                                  <span>{field.label}</span>
                                  <span title={formatCell(device[field.key])}>{formatCell(device[field.key])}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <span className="android-card-hint">悬停 ! 查看更多信息</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              </div>
            </div>
          )}

          {active === "dashboard" && (
            <>
              <section className="stats">
                {stats.map((item) => (
                  <div className="stat-card" key={item.label}>
                    <div className="stat-label">{item.label}</div>
                    <div className="stat-value">{item.value}</div>
                    <div className={`stat-delta ${item.tone}`}>{item.delta}</div>
                  </div>
                ))}
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>任务概览</h2>
                  <button className="text-btn" onClick={() => setActive("tasks")}>查看全部 →</button>
                </div>
                <TaskTable tasks={tasks.slice(0, 4)} onToggle={toggleTask} />
              </section>
              <section className="panel">
                <div className="panel-head"><h2>最近日志</h2></div>
                <LogList />
              </section>
            </>
          )}

          {active === "tasks" && (
            <section className="panel">
              <div className="panel-head">
                <h2>全部任务（{tasks.length}）</h2>
                <span className="muted small">点击操作可模拟启动 / 停止</span>
              </div>
              <TaskTable tasks={tasks} onToggle={toggleTask} />
            </section>
          )}

          {active === "logs" && (
            <section className="panel">
              <div className="panel-head"><h2>运行日志</h2></div>
              <LogList />
            </section>
          )}

          {active === "settings" && (
            <section className="panel settings-panel">
              <div className="panel-head"><h2>运行偏好</h2></div>
              <label className="field"><span>引擎名称</span><input defaultValue="本地执行引擎" /></label>
              <label className="field"><span>失败重试次数</span><input type="number" defaultValue={3} /></label>
              <label className="field checkbox"><input type="checkbox" defaultChecked /><span>任务失败时发送通知</span></label>
              <p className="muted small">设置项当前为界面示例，后续可接入 Tauri 配置持久化。</p>
            </section>
          )}
        </div>

        {importOpen && (
          <div className="modal-mask" onClick={() => setImportOpen(false)}>
            <div className="modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <h2>批量导入 IP 地址</h2>
                <button className="modal-close" onClick={() => setImportOpen(false)}>×</button>
              </div>
              <p className="modal-desc">支持换行、逗号、分号或空格分隔，重复地址会自动去重。</p>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={"例如：\n192.168.1.1\n192.168.1.2\n10.0.0.1"}
                autoFocus
              />
              <div className="modal-result">识别到 {validImportCount} 个有效地址</div>
              <div className="modal-actions">
                <button className="ghost-btn" onClick={() => setImportOpen(false)}>取消</button>
                <button className="primary-btn" onClick={confirmImport}>导入</button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="modal-mask" onClick={() => setDeleteTarget(null)}>
            <div className="modal confirm-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <h2>删除 IP 地址</h2>
                <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
              </div>
              <p className="modal-desc">
                确定要从本地库删除 <strong>{deleteTarget}</strong> 吗？此操作不可撤销。
              </p>
              <div className="modal-actions">
                <button className="ghost-btn" onClick={() => setDeleteTarget(null)}>取消</button>
                <button className="danger-btn" onClick={confirmDelete}>确认删除</button>
              </div>
            </div>
          </div>
        )}

        {notice && <div className="toast">{notice}</div>}
      </main>
    </div>
  );
}
