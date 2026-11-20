import { useState, type FormEvent } from "react";
import { checkCredentials, saveAuth } from "./auth";

interface LoginProps {
  onSuccess: () => void;
}

/** 管理端登录门禁：本地校验，可勾选保存密码以便下次自动进入。 */
export default function Login({ onSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    if (!checkCredentials(username, password)) {
      setError("用户名或密码错误，请重试");
      return;
    }
    if (remember) {
      saveAuth(username);
    }
    setError("");
    onSuccess();
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-mark">R</div>
        <h1 className="login-title">RPA 运营工具</h1>
        <p className="login-subtitle">管理端登录</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-field">
            <span>用户名</span>
            <input
              value={username}
              onChange={(event) => { setUsername(event.target.value); setError(""); }}
              placeholder="请输入用户名"
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="login-field">
            <span>密码</span>
            <div className="login-password">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((value) => !value)}
                title={showPassword ? "隐藏密码" : "显示密码"}
              >
                {showPassword ? "隐藏" : "显示"}
              </button>
            </div>
          </label>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>保存密码，下次自动进入</span>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-submit">登 录</button>
        </form>
      </div>
    </div>
  );
}
