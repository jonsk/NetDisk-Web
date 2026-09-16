<script setup lang="ts">
/**
 * 根组件:只做布局与路由出口。
 *
 * 侧边栏/顶栏在 FE-W-03 随登录态一起做;这里保持最小可用,
 * 以便 FE-W-01 的验收("两应用可独立 build")不被业务代码拖住。
 */
</script>

<template>
  <n-config-provider>
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>
