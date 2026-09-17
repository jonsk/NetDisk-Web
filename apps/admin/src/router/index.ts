import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { i18n } from "../i18n";

/**
 * 路由与守卫骨架(FE-W-03 会补齐"未登录跳登录 / token 过期静默刷新"的完整流程)。
 *
 * 两条与部署形态绑定的设置:
 *
 * 1. **`createWebHistory("/admin/")`** —— 必须与 vite 的 `base` 一致。
 *    用 `createWebHashHistory` 虽然能绕开服务端 rewrite,但 URL 会变成
 *    `/admin/#/users`,与"藏在子路径下的 SPA"这一部署形态不符,
 *    而 Go 侧已经实现了 SPA 回退(webui.Handler),没必要退化成 hash 路由。
 * 2. **守卫在 `auth.ready` 之前不跳转** —— 否则刷新页面时先跳登录页再跳回来,
 *    用户会看到一次闪烁(并且可能丢掉原本要去的地址)。
 *
 * `meta.title` 存 **i18n key**(如 `"routes.overview"`),而不是直接的中文字面量:
 * 这样后置守卫与顶栏在切换语言后能正确地本地化,无需在多个地方维护同一份标题。
 */
const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { public: true, title: "routes.login" },
  },
  {
    path: "/",
    component: () => import("../layouts/AdminLayout.vue"),
    children: [
      { path: "", redirect: "/overview" },
      {
        path: "overview",
        name: "overview",
        component: () => import("../views/OverviewView.vue"),
        meta: { title: "routes.overview" },
      },
      {
        path: "users",
        name: "users",
        component: () => import("../views/UsersView.vue"),
        meta: { title: "routes.users" },
      },
      {
        path: "spaces",
        name: "spaces",
        component: () => import("../views/SpacesView.vue"),
        meta: { title: "routes.spaces" },
      },
    ],
  },
  // 未匹配:回首页(而不是空白页 —— 空白页让用户以为"系统坏了")
  { path: "/:pathMatch(.*)*", redirect: "/overview" },
];

export const router = createRouter({
  history: createWebHistory("/admin/"),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    return true;
  }
  if (!auth.token) {
    // 记住原本要去的地址:登录后直接回那里(而不是永远回首页)
    return { name: "login", query: { redirect: to.fullPath } };
  }
  return true;
});

/** 把 meta.title(一个 i18n key)解析为当前语言文本。 */
function resolveTitle(key: unknown): string {
  if (typeof key !== "string" || key === "") return "";
  const t = i18n.global.t;
  const resolved = t(key);
  // t 在 key 缺失时会返回 key 本身;此时说明该 key 未定义,回退空串避免显示裸 key
  return resolved === key ? "" : resolved;
}

router.afterEach((to) => {
  const title = resolveTitle(to.meta.title);
  const appName = i18n.global.t("app.name");
  document.title = title ? `${title} · ${appName}` : appName;
});
