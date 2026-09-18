<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { fetchMeta, download, type ShareMeta, type LoadError, type DownloadError } from "./api";
import { toggleLocale } from "./i18n";

const { t } = useI18n();

type State = "loading" | "ready" | "need_password" | "gone" | "notfound" | "error";
const state = ref<State>("loading");
const reason = ref("");
const meta = ref<ShareMeta | null>(null);
const password = ref("");
const errorMsg = ref("");
const downloading = ref(false);
const token = ref("");

function parseToken(): string {
  // /s/{token} 或 /s/{token}/ ；Go 的 SPA 回退会把任意 /s/ 下路径都打到 index.html
  const m = window.location.pathname.match(/\/s\/([^/]+?)\/?$/);
  return m ? m[1] : "";
}

function fmtSize(n?: number): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function remaining(): number {
  const m = meta.value;
  if (!m || !m.max_downloads) return 0;
  return Math.max(0, m.max_downloads - (m.download_count ?? 0));
}

async function load() {
  try {
    meta.value = await fetchMeta(token.value);
    state.value = meta.value.need_password ? "need_password" : "ready";
  } catch (e) {
    const err = e as LoadError;
    if (err.kind === "gone") {
      state.value = "gone";
      reason.value = err.reason;
    } else if (err.kind === "notfound") {
      state.value = "notfound";
    } else {
      state.value = "error";
    }
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function doDownload() {
  if (!meta.value) return;
  downloading.value = true;
  errorMsg.value = "";
  try {
    const pw = meta.value.need_password ? password.value : undefined;
    const { blob, filename } = await download(token.value, pw);
    triggerDownload(blob, filename || meta.value.name || "download");
  } catch (e) {
    const err = e as DownloadError;
    if (err.kind === "badpassword") {
      errorMsg.value = t("badPassword");
    } else if (err.kind === "gone") {
      state.value = "gone";
      reason.value = err.reason;
    } else {
      errorMsg.value = t("loadError");
    }
  } finally {
    downloading.value = false;
  }
}

onMounted(() => {
  token.value = parseToken();
  if (token.value) {
    void load();
  } else {
    state.value = "notfound";
  }
});
</script>

<template>
  <div class="wrap">
    <button class="lang" @click="toggleLocale">{{ t("langToggle") }}</button>

    <h1>{{ t("title") }}</h1>

    <div v-if="state === 'loading'" class="card muted">…</div>

    <div v-else-if="state === 'ready' || state === 'need_password'" class="card">
      <div class="row"><span class="k">{{ t("file") }}</span><span class="v">{{ meta?.name }}</span></div>
      <div class="row"><span class="k">{{ t("size") }}</span><span class="v">{{ fmtSize(meta?.size) }}</span></div>
      <div class="row" v-if="meta?.expires_at">
        <span class="k">{{ t("expiresAt") }}</span><span class="v">{{ meta?.expires_at }}</span>
      </div>
      <div class="row" v-if="meta?.max_downloads">
        <span class="k">{{ t("remaining") }}</span><span class="v">{{ remaining() }}</span>
      </div>

      <div v-if="state === 'need_password'" class="pwd">
        <input
          v-model="password"
          type="password"
          :placeholder="t('passwordPlaceholder')"
          @keyup.enter="doDownload"
        />
      </div>
      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
      <button :disabled="downloading" @click="doDownload">
        {{ downloading ? t("downloading") : t("download") }}
      </button>
    </div>

    <div v-else-if="state === 'gone'" class="card err">
      <template v-if="reason === 'expired'">{{ t("expired") }}</template>
      <template v-else-if="reason === 'download_limit_reached'">{{ t("limitReached") }}</template>
      <template v-else>{{ t("revoked") }}</template>
    </div>
    <div v-else-if="state === 'notfound'" class="card err">{{ t("notFound") }}</div>
    <div v-else class="card err">{{ t("loadError") }}</div>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
  max-width: 520px;
  margin: 10vh auto;
  padding: 0 16px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #1f2329;
}
.lang {
  position: absolute;
  top: 0;
  right: 16px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
}
h1 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
}
.card {
  border: 1px solid #eef0f3;
  border-radius: 12px;
  padding: 20px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}
.muted {
  color: #999;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px dashed #f2f3f5;
}
.row:last-of-type {
  border-bottom: none;
}
.k {
  color: #8a9099;
}
.v {
  font-weight: 600;
  text-align: right;
  word-break: break-all;
}
.pwd {
  margin: 14px 0 4px;
}
input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d0d3d9;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 14px;
}
input:focus {
  outline: none;
  border-color: #2d6cdf;
}
button.download,
button {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  background: #2d6cdf;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: default;
}
.err {
  color: #c0392b;
}
</style>
