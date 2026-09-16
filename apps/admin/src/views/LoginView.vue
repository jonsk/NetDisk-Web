<script setup lang="ts">
/**
 * 登录页(FE-W-03 会补错误提示与限速提示;这里给出可用的最小形态)。
 *
 * 一条容易忽略的细节:**登录失败时不区分"用户不存在"与"密码错误"** ——
 * 服务端已经统一了文案,前端也不该通过其它渠道(比如检查某个字段是否存在)
 * 把差异暴露出去。
 */
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import { APIError } from "@netdisk/api";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const message = useMessage();
const auth = useAuthStore();

const login = ref("");
const password = ref("");
const loading = ref(false);

async function onSubmit() {
  if (!login.value || !password.value) {
    message.warning("请输入用户名与密码");
    return;
  }
  loading.value = true;
  try {
    await auth.login(login.value, password.value);
    const redirect = (route.query.redirect as string) || "/overview";
    await router.replace(redirect);
  } catch (e) {
    if (e instanceof APIError) {
      // 429 单独提示:用户需要知道"等一下再试"而不是"密码错了"
      message.error(e.status === 429 ? "尝试过于频繁,请稍后再试" : e.message);
    } else {
      message.error("登录失败,请稍后再试");
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <n-card class="login-card" title="网盘管理后台">
      <n-form @submit.prevent="onSubmit">
        <n-form-item label="用户名 / 邮箱">
          <n-input v-model:value="login" placeholder="请输入用户名或邮箱" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            @keyup.enter="onSubmit"
          />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="onSubmit">登录</n-button>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.login-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f7fa;
}
.login-card {
  width: 380px;
}
</style>
