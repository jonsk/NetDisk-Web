<script setup lang="ts">
/**
 * 语言切换器:顶栏与登录页共用。
 *
 * 打开下拉后切换语言,立即生效并持久化到 localStorage。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NDropdown, type DropdownOption } from "naive-ui";
import { setLocale, SUPPORTED_LOCALES, type SupportedLocale } from "../i18n";

const { locale } = useI18n();

const options: DropdownOption[] = SUPPORTED_LOCALES.map((l) => ({
  label: l.label,
  key: l.value,
}));

const currentLabel = computed(
  () => SUPPORTED_LOCALES.find((l) => l.value === locale.value)?.label ?? "中文",
);

function onSelect(key: string) {
  const target = key as SupportedLocale;
  if (!SUPPORTED_LOCALES.some((l) => l.value === target)) return;
  setLocale(target);
}
</script>

<template>
  <n-dropdown :options="options" trigger="click" @select="onSelect">
    <n-button size="small" quaternary>
      <span style="display: inline-flex; align-items: center; gap: 4px">
        {{ currentLabel }}
        <span style="font-size: 10px">▾</span>
      </span>
    </n-button>
  </n-dropdown>
</template>
