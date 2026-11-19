import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// React 挂载后移除启动屏，避免安装版首次启动时出现纯白空窗
window.setTimeout(() => {
  document.getElementById("boot-screen")?.remove();
}, 300);
