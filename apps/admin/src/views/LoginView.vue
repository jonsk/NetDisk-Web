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
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import { APIError } from "@netdisk/api";
import { useAuthStore } from "../stores/auth";
import LanguageSwitcher from "../components/LanguageSwitcher.vue";

const router = useRouter();
const route = useRoute();
const message = useMessage();
const auth = useAuthStore();
const { t } = useI18n();

const login = ref("");
const password = ref("");
const loading = ref(false);

async function onSubmit() {
  if (!login.value || !password.value) {
    message.warning(t("login.empty"));
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
      message.error(e.status === 429 ? t("login.rateLimited") : e.message);
    } else {
      message.error(t("login.failed"));
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="lang-corner">
      <LanguageSwitcher />
    </div>
    <n-card class="login-card" :title="t('app.name')">
      <n-form @submit.prevent="onSubmit">
        <n-form-item :label="t('login.username')">
          <n-input v-model:value="login" :placeholder="t('login.usernamePlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('login.password')">
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            :placeholder="t('login.passwordPlaceholder')"
            @keyup.enter="onSubmit"
          />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="onSubmit">{{ t("login.submit") }}</n-button>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.login-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f7fa;
}
.lang-corner {
  position: absolute;
  top: 16px;
  right: 16px;
}
.login-card {
  width: 380px;
}
</style>
