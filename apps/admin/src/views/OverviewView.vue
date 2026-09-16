<script setup lang="ts">
/**
 * 概览页:只做"当前登录者是谁"的确认 + 指向后续功能的说明。
 *
 * 刻意不在这里堆假数据图表:FE-W-01 的验收是"可独立 build",
 * 而假数据会让人误以为监控/统计已经做好了(后来排查时才发现是硬编码)。
 */
import { onMounted, ref } from "vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const me = ref<Record<string, unknown> | null>(null);
const error = ref("");

onMounted(async () => {
  try {
    me.value = await auth.client().request<Record<string, unknown>>("/api/v1/me");
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <n-card title="当前会话">
    <n-alert v-if="error" type="error" :show-icon="false">{{ error }}</n-alert>
    <n-descriptions v-else :column="1" label-placement="left">
      <n-descriptions-item label="用户">{{ me?.username ?? "-" }}</n-descriptions-item>
      <n-descriptions-item label="角色">{{ me?.role ?? "-" }}</n-descriptions-item>
      <n-descriptions-item label="令牌受众">{{ me?.audience ?? "-" }}</n-descriptions-item>
      <n-descriptions-item label="request_id">{{ me?.request_id ?? "-" }}</n-descriptions-item>
    </n-descriptions>
  </n-card>
</template>
