<script setup lang="ts">
/**
 * 管理后台布局:侧边栏 + 顶栏 + 路由出口。
 *
 * 导航项**只有管理功能**(2.3 渠道定位):Web 端不提供文件浏览与传输 ——
 * 这不是"还没做",而是刻意的产品边界(文件操作在桌面客户端)。
 *
 * 国际化:品牌 / 菜单 / 顶栏标题 / 退出按钮均通过 `t()` 解析;
 * 菜单用 `computed` 以便切换语言时重新渲染(闭包内调用了 `t()`)。
 */
import { computed, h } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { MenuOption } from "naive-ui";
import { useAuthStore } from "../stores/auth";
import LanguageSwitcher from "../components/LanguageSwitcher.vue";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t, te } = useI18n();

const menu = computed<MenuOption[]>(() => [
  { label: () => h(RouterLink, { to: "/overview" }, { default: () => t("layout.menu.overview") }), key: "overview" },
  { label: () => h(RouterLink, { to: "/users" }, { default: () => t("layout.menu.users") }), key: "users" },
  { label: () => h(RouterLink, { to: "/spaces" }, { default: () => t("layout.menu.spaces") }), key: "spaces" },
]);

const activeKey = computed(() => (route.name as string) ?? "overview");

// 顶栏标题:meta.title 是 i18n key(routes.*),存在则本地化显示
const pageTitle = computed(() => {
  const key = route.meta.title as string | undefined;
  return key && te(key) ? t(key) : "";
});

function onLogout() {
  auth.logout();
  void router.replace("/login");
}
</script>

<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider bordered width="220">
      <div class="brand">{{ t("layout.brand") }}</div>
      <n-menu :value="activeKey" :options="menu" />
    </n-layout-sider>
    <n-layout>
      <n-layout-header bordered class="header">
        <span>{{ pageTitle }}</span>
        <n-space align="center">
          <LanguageSwitcher />
          <span class="who">{{ auth.user?.displayName ?? auth.user?.username ?? "" }}</span>
          <n-button size="small" quaternary @click="onLogout">{{ t("layout.logout") }}</n-button>
        </n-space>
      </n-layout-header>
      <n-layout-content content-style="padding: 16px">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<style scoped>
.brand {
  padding: 16px;
  font-weight: 600;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
}
.who {
  color: #666;
}
</style>
