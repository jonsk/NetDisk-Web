import { defineStore } from "pinia";
import { Client } from "@netdisk/api";
// 类型必须用 `import type` 引入:verbatimModuleSyntax 下把类型当值引入,
// 打包器会在运行时找不到该导出(表现为构建告警 + 该 import 变成 undefined)
import type { LoginResult } from "@netdisk/api";

/**
 * 认证 store(FE-W-03 的骨架)。
 *
 * # 三条纪律
 *
 * 1. **受众必须是 `web`**(R-14 分端):管理后台用 desktop 令牌会被服务端拒,
 *    而错误信息只说"令牌无效" —— 因此这里显式传 `audience: "web"`。
 * 2. **令牌只存 sessionStorage**:localStorage 在共用电脑上会长期留存管理凭据。
 * 3. **刷新令牌**在过期时静默重放一次请求;刷新失败才登出(并把用户送回登录页)。
 *    直接把 401 抛给业务会让每个页面都写一遍"要不要重登"的判断。
 */
const TOKEN_KEY = "netdisk.admin.token";
const REFRESH_KEY = "netdisk.admin.refresh";

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  displayName?: string;
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: "" as string,
    refreshToken: "" as string,
    user: null as AdminUser | null,
    /** ready 表示"已从本地存储恢复过",守卫据此避免闪烁 */
    ready: false,
  }),
  getters: {
    isLoggedIn: (s) => s.token !== "",
  },
  actions: {
    restore() {
      this.token = sessionStorage.getItem(TOKEN_KEY) ?? "";
      this.refreshToken = sessionStorage.getItem(REFRESH_KEY) ?? "";
      this.ready = true;
    },

    /** client 返回共享的 API 客户端(带令牌注入与静默刷新)。 */
    client(): Client {
      return new Client({
        getToken: () => this.token,
        onUnauthorized: () => this.refresh(),
      });
    },

    async login(login: string, password: string): Promise<void> {
      const c = new Client({ getToken: () => null });
      const res = await c.request<LoginResult>("/api/v1/auth/login", {
        method: "POST",
        body: { login, password, audience: "web" },
      });
      this.applySession(res);
    },

    applySession(res: LoginResult) {
      this.token = res.token.access_token;
      this.refreshToken = res.token.refresh_token;
      sessionStorage.setItem(TOKEN_KEY, this.token);
      sessionStorage.setItem(REFRESH_KEY, this.refreshToken);
      this.user = {
        id: res.user.id,
        username: res.user.username,
        role: res.user.role,
        displayName: res.user.display_name,
      };
    },

    /**
     * refresh 用刷新令牌换新 access token。
     *
     * 返回 null 表示刷新失败(调用方应登出)。**刻意不抛异常**:
     * 客户端把它当作"这次请求的 401 无法挽救"来处理。
     */
    async refresh(): Promise<string | null> {
      if (!this.refreshToken) {
        this.logout();
        return null;
      }
      try {
        const c = new Client({ getToken: () => null });
        const res = await c.request<LoginResult>("/api/v1/auth/refresh", {
          method: "POST",
          body: { refresh_token: this.refreshToken },
        });
        this.applySession(res);
        return this.token;
      } catch {
        this.logout();
        return null;
      }
    },

    logout() {
      this.token = "";
      this.refreshToken = "";
      this.user = null;
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
    },
  },
});
