<script setup lang="ts">
/**
 * 管理后台布局:侧边栏 + 顶栏 + 路由出口。
 *
 * 导航项**只有管理功能**(2.3 渠道定位):Web 端不提供文件浏览与传输 ——
 * 这不是"还没做",而是刻意的产品边界(文件操作在桌面客户端)。
 */
import { computed, h } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import type { MenuOption } from "naive-ui";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const menu: MenuOption[] = [
  { label: () => h(RouterLink, { to: "/overview" }, { default: () => "概览" }), key: "overview" },
  { label: () => h(RouterLink, { to: "/users" }, { default: () => "用户与部门" }), key: "users" },
  { label: () => h(RouterLink, { to: "/spaces" }, { default: () => "空间治理" }), key: "spaces" },
];

const activeKey = computed(() => (route.name as string) ?? "overview");

function onLogout() {
  auth.logout();
  void router.replace("/login");
}
</script>

<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider bordered width="220">
      <div class="brand">网盘管理后台</div>
      <n-menu :value="activeKey" :options="menu" />
    </n-layout-sider>
    <n-layout>
      <n-layout-header bordered class="header">
        <span>{{ route.meta.title ?? "" }}</span>
        <n-space align="center">
          <span class="who">{{ auth.user?.displayName ?? auth.user?.username ?? "" }}</span>
          <n-button size="small" quaternary @click="onLogout">退出</n-button>
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
