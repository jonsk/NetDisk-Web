import { createApp } from "vue";
import { createPinia } from "pinia";
import naive from "naive-ui";
import App from "./App.vue";
import { router } from "./router";
import { useAuthStore } from "./stores/auth";

/**
 * 管理后台入口(FE-W-01 骨架;登录/守卫在 FE-W-03,业务页在 FE-W-04~07)。
 *
 * 装配顺序刻意如此:
 *  1. **先建 store 并恢复会话**,再挂路由 —— 路由守卫会读 `auth.ready` 与
 *     `auth.token`;若顺序反过来,守卫在首次导航时看到的是"未登录",
 *     于是用户每次刷新页面都会被弹回登录页(而令牌其实还在)。
 *  2. 令牌存 **sessionStorage**(不是 localStorage):管理后台是敏感界面,
 *     关掉标签页即失效能显著缩小"共用电脑"场景下的暴露面。
 */
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const auth = useAuthStore(pinia);
// restore 只读本地令牌;不在这里发网络请求(避免入口处的串行等待)
auth.restore();

app.use(router);
app.use(naive);
app.mount("#app");
