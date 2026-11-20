// 本地登录校验：凭据硬编码在前端，仅做本地门禁，不做服务端鉴权。
const AUTH_STORAGE_KEY = "rpa-auth";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Cic@12345";

export interface SavedAuth {
  username: string;
  savedAt: string;
}

/** 读取本地保存的登录态（勾选保存密码后写入）。 */
export const readSavedAuth = (): SavedAuth | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedAuth;
    if (!parsed || parsed.username !== ADMIN_USERNAME) return null;
    return parsed;
  } catch {
    return null;
  }
};

/** 是否已登录（本地存在有效登录态）。 */
export const isAuthenticated = (): boolean => readSavedAuth() !== null;

/** 校验用户名密码。 */
export const checkCredentials = (username: string, password: string): boolean =>
  username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD;

/** 保存登录态到本地（下次自动进入）。 */
export const saveAuth = (username: string): void => {
  const payload: SavedAuth = {
    username: username.trim(),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
};

/** 退出登录，清除本地登录态。 */
export const clearAuth = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};
