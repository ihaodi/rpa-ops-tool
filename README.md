# RPA 运营工具

跨平台桌面端 RPA 运营工具骨架，基于 **Tauri 2 + React 19 + TypeScript + Vite**，使用 VS Code 开发，可同时打包 macOS 与 Windows 应用。

## 目录结构

```text
rpa-ops-tool/
├── src/                    # 前端界面（React + TypeScript）
│   ├── App.tsx             # 主界面：控制台 / 任务管理 / 运行日志 / 设置
│   └── styles.css          # 浅色主题样式
├── src-tauri/              # Rust 后端与桌面配置
│   ├── src/main.rs         # 应用入口
│   ├── capabilities/       # Tauri 2 权限配置
│   ├── icons/              # 应用图标
│   ├── tauri.conf.json     # 窗口、构建与打包配置
│   └── Cargo.toml
└── .vscode/                # VS Code 插件推荐、任务与调试配置
```

## 环境要求

| 平台 | 依赖 |
| --- | --- |
| 通用 | Node.js 20.19+（已验证 22.x）、npm |
| 通用 | Rust 稳定版（rustup） |
| macOS | Xcode Command Line Tools |
| Windows | WebView2 Runtime（Win11 自带）、MSVC Build Tools |

> 当前机器已具备 Node.js 22 与 Xcode Command Line Tools，但**尚未安装 Rust**，安装后才能运行桌面应用与打包。

## 快速开始

```bash
cd /Users/haodi/workspace/rpa-ops-tool
npm install

# 仅预览前端界面（不需要 Rust）
npm run dev

# 启动桌面应用（需要 Rust）
npm run tauri dev

# 打包桌面应用（需要 Rust）
npm run tauri build
```

VS Code 中打开项目后，推荐安装弹出的插件（Tauri、rust-analyzer、Prettier），然后按 `Cmd/Ctrl + Shift + B` 可直接启动 Tauri 开发模式。

## 当前状态

- 已完成：跨平台项目骨架、桌面窗口配置、四个功能页面的界面原型、模拟任务状态交互、VS Code 开发环境。
- 待接入：真实 RPA 引擎、任务配置持久化、日志落盘、系统托盘与通知。
- 界面中的任务与日志为示例数据，后续可通过 Tauri Command 在 Rust 侧替换为真实数据源。

## ARM 设备 IP 列表

- 数据保存在浏览器/Webview 的 `localStorage`（键名 `rpa-arm-device-ips`），首次启动为空，不再内置示例 IP。
- 批量导入后自动去重并按 IP 数值升序排列，随后逐个请求 `http://{IP}:8000/info`（5 秒超时）。
- 接口返回 JSON 中 `code === 0` 标记为在线，其余情况标记为离线；检测中的状态显示为灰色。
- 删除 IP 会弹出二次确认，确认后从本地库删除并刷新列表。
- 默认选中排序后的第一个 IP；云机页面顶部展示**设备信息**面板（替换了原统计卡片），数据来自 `http://{主机IP}:8000/info/device`，可手动刷新。
- 云机页面**设备列表**改为接口驱动：`http://{主机IP}:8000/android`，以卡片展示名称、状态、IP、镜像、FPS/分辨率/DPI 等主要信息；次要字段在卡片左下角 `!` 图标悬停时浮层展示，支持刷新；接口失败时显示返回的 `message`。
- 浏览器预览通过 Vite 开发中间件转发 `/api/device-info?ip=...&path=...` 解决跨域；Tauri 桌面端使用 `@tauri-apps/plugin-http`，已在 `src-tauri/capabilities/default.json` 中放行 `http://*/*`。
- 已引入官方 `vconsole` 库，右下角会显示 vConsole 自带悬浮按钮；安装版无需开发者工具即可查看日志。请求地址、参数、响应和耗时通过 `vconsoleLog` 输出到 Log 面板。

## 打包说明

`tauri.conf.json` 中 `bundle.targets` 当前为 `all`：在 macOS 上生成 `.app` / `.dmg`，在 Windows 上生成 `.msi` / `.exe`（NSIS）。正式发版时建议按平台拆分配置，并配置签名证书。

### Windows 安装包

- **推荐（Windows 本机）**：安装 Rust 与 WebView2 后运行 `npm run tauri build`，产物在 `src-tauri/target/release/bundle/nsis/`。
- **macOS 交叉编译**：需安装 `rustup target add x86_64-pc-windows-msvc`、`cargo-xwin`、`brew install nsis llvm`，然后运行：
  ```bash
  npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
  ```
  产物在 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`。此方式生成的安装包未签名。
- **GitHub Actions**：项目已包含 `.github/workflows/build-windows.yml`，在 Windows Runner 上构建 NSIS 安装包并上传 Artifact，可手动触发或推送 `v*` 标签触发。
