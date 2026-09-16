import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "../stores/auth";

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
 */
const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { public: true, title: "登录" },
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
        meta: { title: "概览" },
      },
      {
        path: "users",
        name: "users",
        component: () => import("../views/UsersView.vue"),
        meta: { title: "用户与部门" },
      },
      {
        path: "spaces",
        name: "spaces",
        component: () => import("../views/SpacesView.vue"),
        meta: { title: "空间治理" },
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

router.afterEach((to) => {
  const title = to.meta.title as string | undefined;
  document.title = title ? `${title} · 网盘管理后台` : "网盘管理后台";
});
