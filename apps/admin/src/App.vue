<script setup lang="ts">
/**
 * 根组件:只做布局与路由出口,并承担 naive-ui 组件内置文案的国际化。
 *
 * `n-config-provider` 同时注入两件事:
 *  1. **业务文案**由子组件各自 `useI18n().t()` 提供(vue-i18n)。
 *  2. **naive-ui 组件内置文案**(分页/表格空态/弹出等)由 `:locale` 与
 *     `:date-locale` 驱动 —— 这里按当前语言映射到 naive-ui 的语言包。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { zhCN, dateZhCN, enUS, dateEnUS } from "naive-ui";

const { locale } = useI18n();

// naive-ui 内置语言数量有限,当前只有 zh/en 两语,直接二元映射;
// 后续若补 de/fr/ru,在此追加映射并给出未覆盖语言的回退。
const naiveLocale = computed(() => (locale.value === "en-US" ? enUS : zhCN));
const naiveDateLocale = computed(() => (locale.value === "en-US" ? dateEnUS : dateZhCN));
</script>

<template>
  <n-config-provider :locale="naiveLocale" :date-locale="naiveDateLocale">
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>
