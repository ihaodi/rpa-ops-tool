// 禁用 Windows 发布版启动时弹出的控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri_plugin_http::reqwest;

/// 自定义 HTTP 请求命令：在 Rust 侧直接用 reqwest 发送，
/// 完全绕过 @tauri-apps/plugin-http 的 URL scope 限制，
/// 从而可以请求任意内网 IP + 端口（如 http://10.x.x.x:8000）。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResult {
    ok: bool,
    status: u16,
    body: String,
    error: Option<String>,
}

#[tauri::command]
async fn http_request(url: String, method: String, body: Option<String>, timeout_ms: u64) -> HttpResult {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(timeout_ms))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return HttpResult {
                ok: false,
                status: 0,
                body: String::new(),
                error: Some(format!("创建客户端失败: {e}")),
            }
        }
    };

    let method_upper = method.to_uppercase();
    let mut req = if method_upper == "POST" {
        let mut r = client.post(&url);
        if let Some(ref b) = body {
            r = r.body(b.clone()).header("Content-Type", "application/json");
        }
        r
    } else {
        client.get(&url)
    };
    // 确保 JSON 接口带上 Accept 头
    req = req.header("Accept", "application/json");

    match req.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            HttpResult {
                ok: status >= 200 && status < 300,
                status,
                body: text,
                error: None,
            }
        }
        Err(e) => HttpResult {
            ok: false,
            status: 0,
            body: String::new(),
            error: Some(e.to_string()),
        },
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![http_request])
        .run(tauri::generate_context!())
        .expect("RPA 运营工具启动失败");
}
