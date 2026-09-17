<script setup lang="ts">
/**
 * 空间治理(FE-W-06 / 4.3)。
 *
 * # 与"桌面端的协作管理"的边界
 *
 * 这里**不提供**"新建空间/邀请成员/退出" —— 那些属协作管理(入口在桌面端),
 * 而 Web 后台只做全局治理:*配额与预警阈值、冻结、收回*。
 * 后台能替业务建空间,权限模型就会多出一个说不清的入口。
 *
 * # 三处必须讲清楚的语义
 *
 * 1. **收回 ≠ 删除**:收回是"冻结 + 清空成员"(收回访问权),空间内的文件**不删**。
 *    文档把"回收/保留期限"列为待拍板的裁量项,所以界面必须如实写明这一点 ——
 *    否则管理员会以为数据已经销毁。
 * 2. **预警阈值是"提醒线",不是"上限"**:上限是 95%(服务端硬策略),
 *    这里设的是多少百分比开始提醒(不同空间可以不同)。
 * 3. **用量不可手改**:界面只读 `used_bytes`;它只由上传/删除事务增减。
 *    给个输入框让它"可编辑"会让人以为可以手工修正配额用量。
 *
 * 国际化:筛选下拉与表格列用 `computed` 包裹(内调 `t()`),切换语言即刷新。
 */
import { computed, h, onMounted, ref } from "vue";
import { NButton, NProgress, NTag, useMessage, type DataTableColumns } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";

interface AdminSpace {
  id: string;
  kind: string;
  name: string;
  owner_username: string;
  owner_display_name: string;
  quota_bytes: number;
  used_bytes: number;
  warn_percent: number;
  used_percent: number;
  frozen: boolean;
  member_count: number;
  files_count: number;
}

const auth = useAuthStore();
const message = useMessage();
const { t } = useI18n();

const spaces = ref<AdminSpace[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref("");
const search = ref("");
const kindFilter = ref<string | null>(null);
const frozenFilter = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;

const showQuota = ref(false);
const quotaTarget = ref<AdminSpace | null>(null);
const quotaForm = ref({ quota_gb: 0, warn_percent: 80 });
const saving = ref(false);

function fmtBytes(v: number): string {
  if (!v) return t("spaces.unlimited");
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = v;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const q = new URLSearchParams();
    if (search.value.trim()) q.set("search", search.value.trim());
    if (kindFilter.value) q.set("kind", kindFilter.value);
    if (frozenFilter.value) q.set("frozen", frozenFilter.value);
    q.set("limit", String(pageSize));
    q.set("offset", String((page.value - 1) * pageSize));
    const res = await auth
      .client()
      .request<{ spaces: AdminSpace[]; total: number }>(`/api/v1/admin/spaces?${q.toString()}`);
    spaces.value = res.spaces ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function openQuota(sp: AdminSpace) {
  quotaTarget.value = sp;
  quotaForm.value = {
    quota_gb: sp.quota_bytes ? Math.round((sp.quota_bytes / 1024 ** 3) * 100) / 100 : 0,
    warn_percent: sp.warn_percent,
  };
  showQuota.value = true;
}

async function saveQuota() {
  if (!quotaTarget.value) return;
  saving.value = true;
  try {
    await auth.client().request(`/api/v1/admin/spaces/${quotaTarget.value.id}/quota`, {
      method: "PATCH",
      body: {
        quota_bytes: Math.round(quotaForm.value.quota_gb * 1024 ** 3),
        warn_percent: quotaForm.value.warn_percent,
      },
    });
    message.success(t("spaces.saved"));
    showQuota.value = false;
    await load();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function setFrozen(sp: AdminSpace, frozen: boolean) {
  const text = frozen
    ? t("spaces.confirmFreeze", { name: sp.name })
    : t("spaces.confirmUnfreeze", { name: sp.name });
  if (!window.confirm(text)) return;
  try {
    await auth.client().request(`/api/v1/admin/spaces/${sp.id}/freeze`, {
      method: "POST",
      body: { frozen },
    });
    message.success(frozen ? t("spaces.frozen") : t("spaces.unfrozen"));
    await load();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function revoke(sp: AdminSpace) {
  const ok = window.confirm(t("spaces.confirmRevoke", { name: sp.name }));
  if (!ok) return;
  try {
    const res = await auth
      .client()
      .request<{ members_removed: number; note: string }>(`/api/v1/admin/spaces/${sp.id}/revoke`, {
        method: "POST",
      });
    message.success(t("spaces.revoked", { count: res.members_removed }));
    await load();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

const kindOptions = computed(() => [
  { label: t("spaces.kinds.personal"), value: "personal" },
  { label: t("spaces.kinds.team"), value: "team" },
]);
const frozenOptions = computed(() => [
  { label: t("spaces.statuses.frozen"), value: "true" },
  { label: t("spaces.statuses.normal"), value: "false" },
]);

const columns = computed<DataTableColumns<AdminSpace>>(() => [
  { title: t("spaces.colSpace"), key: "name", ellipsis: { tooltip: true } },
  { title: t("spaces.colKind"), key: "kind", width: 90 },
  { title: t("spaces.colOwner"), key: "owner_username", width: 160 },
  {
    title: t("spaces.colUsageQuota"),
    key: "used",
    width: 240,
    render: (row) =>
      row.quota_bytes > 0
        ? h(NProgress, {
            type: "line",
            percentage: Math.min(100, Math.round(row.used_percent)),
            indicatorPlacement: "outside",
            height: 10,
            status: row.used_percent >= 95 ? "error" : row.used_percent >= row.warn_percent ? "warning" : "success",
          })
        : h("span", null, `${fmtBytes(row.used_bytes)} / ${t("spaces.unlimited")}`),
  },
  { title: t("spaces.colUsed"), key: "used_bytes", width: 110, render: (row) => fmtBytes(row.used_bytes) },
  { title: t("spaces.colQuota"), key: "quota_bytes", width: 110, render: (row) => fmtBytes(row.quota_bytes) },
  { title: t("spaces.colWarn"), key: "warn_percent", width: 90, render: (row) => `${row.warn_percent}%` },
  { title: t("spaces.colMembers"), key: "member_count", width: 80 },
  { title: t("spaces.colFiles"), key: "files_count", width: 80 },
  {
    title: t("spaces.colStatus"),
    key: "frozen",
    width: 100,
    render: (row) =>
      h(NTag, { size: "small", type: row.frozen ? "error" : "success" }, {
        default: () => (row.frozen ? t("spaces.statuses.frozen") : t("spaces.statuses.normal")),
      }),
  },
  {
    title: t("spaces.colActions"),
    key: "actions",
    width: 250,
    render: (row) =>
      h("div", { style: "display:flex;gap:6px;flex-wrap:wrap" }, [
        h(NButton, { size: "tiny", onClick: () => openQuota(row) }, { default: () => t("spaces.quota") }),
        row.frozen
          ? h(NButton, { size: "tiny", type: "primary", onClick: () => void setFrozen(row, false) }, { default: () => t("spaces.unfreeze") })
          : h(NButton, { size: "tiny", type: "warning", onClick: () => void setFrozen(row, true) }, { default: () => t("spaces.freeze") }),
        h(NButton, { size: "tiny", type: "error", onClick: () => void revoke(row) }, { default: () => t("spaces.revoke") }),
      ]),
  },
]);

onMounted(() => void load());
</script>

<template>
  <div>
    <n-alert v-if="error" type="error" :show-icon="false" style="margin-bottom: 12px">{{ error }}</n-alert>

    <n-card :title="t('spaces.title')" size="small">
      <n-alert type="info" :show-icon="false" style="white-space: pre-line; margin-bottom: 12px">
        {{ t("spaces.alertInfo") }}
      </n-alert>

      <n-space align="center" style="margin-bottom: 12px">
        <n-input
          v-model:value="search"
          :placeholder="t('spaces.searchPlaceholder')"
          style="width: 260px"
          clearable
          @keyup.enter="load()"
        />
        <n-select
          v-model:value="kindFilter"
          :options="kindOptions"
          :placeholder="t('spaces.kindFilterPlaceholder')"
          clearable
          style="width: 140px"
        />
        <n-select
          v-model:value="frozenFilter"
          :options="frozenOptions"
          :placeholder="t('spaces.statusFilterPlaceholder')"
          clearable
          style="width: 120px"
        />
        <n-button type="primary" @click="load()">{{ t("common.query") }}</n-button>
      </n-space>

      <n-data-table :columns="columns" :data="spaces" :loading="loading" size="small" :row-key="(r: AdminSpace) => r.id" />
      <n-space justify="end" style="margin-top: 12px">
        <n-pagination v-model:page="page" :page-size="pageSize" :item-count="total" @update:page="load" />
      </n-space>
    </n-card>

    <n-modal v-model:show="showQuota" preset="card" :title="t('spaces.quotaTitle')" style="width: 460px">
      <n-form label-placement="left" label-width="110">
        <n-form-item :label="t('spaces.form.space')">
          <span>{{ quotaTarget?.name }}</span>
        </n-form-item>
        <n-form-item :label="t('spaces.form.used')">
          <span>{{ fmtBytes(quotaTarget?.used_bytes ?? 0) }}</span>
        </n-form-item>
        <n-form-item :label="t('spaces.form.quotaGb')">
          <n-input-number v-model:value="quotaForm.quota_gb" :min="0" :step="1" style="width: 100%">
            <template #suffix>{{ t("spaces.form.suffixUnlimited") }}</template>
          </n-input-number>
        </n-form-item>
        <n-form-item :label="t('spaces.form.warnPercent')">
          <n-input-number v-model:value="quotaForm.warn_percent" :min="1" :max="100" style="width: 100%" />
        </n-form-item>
        <n-alert type="info" :show-icon="false" style="white-space: pre-line">
          {{ t("spaces.alertWarn") }}
        </n-alert>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showQuota = false">{{ t("common.cancel") }}</n-button>
          <n-button type="primary" :loading="saving" @click="saveQuota">{{ t("common.save") }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
