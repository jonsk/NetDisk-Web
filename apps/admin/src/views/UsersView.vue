<script setup lang="ts">
/**
 * 用户与部门管理(FE-W-04)。
 *
 * # 三件必须做对的事
 *
 * 1. **停用/启用的提示要说清后果**:停用会**立刻**让对方刷新失败(会话在 access
 *    到期后必死),所以按钮带二次确认,并说明"已登录的会话会被踢出" ——
 *    管理员需要知道这是一次有外部影响的操作,而不是"改个状态"。
 * 2. **唯一冲突要落到具体输入框**:服务端返回 `details.field`,
 *    据此把错误挂到用户名或邮箱那个 `n-form-item` 上,而不是弹一个笼统的红条
 *    (笼统提示会让管理员在两个框之间来回试)。
 * 3. **搜索必须是服务端搜索**:前端过滤只能过滤"当前这一页",在几千人的组织里
 *    表现为"搜不到明明存在的人" —— 这类 bug 极难被用户理解为"分页问题"。
 *
 * 国际化:角色/状态下拉与表格列文本用 `computed` 包裹(内调 `t()`),
 * 保证切换语言时立即刷新渲染。
 */
import { computed, h, onMounted, ref } from "vue";
import { NButton, NSelect, NSpace, NTag, useMessage, type DataTableColumns } from "naive-ui";
import { useI18n } from "vue-i18n";
import { APIError } from "@netdisk/api";
import { useAuthStore } from "../stores/auth";

interface AdminUser {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
  role: string;
  status: string;
  last_login_at?: string | null;
  created_at?: string;
}

interface DeptNode {
  id: string;
  name: string;
  parent_id?: string | null;
  children?: DeptNode[];
}

const auth = useAuthStore();
const message = useMessage();
const { t } = useI18n();

const users = ref<AdminUser[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref("");
const search = ref("");
const roleFilter = ref<string | null>(null);
const statusFilter = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;

const depts = ref<DeptNode[]>([]);
const deptName = ref("");
const deptParent = ref<string | null>(null);

// 建号表单:fieldError 只针对"唯一冲突"这类**能定位到字段**的错误
const showCreate = ref(false);
const createForm = ref({ username: "", email: "", display_name: "", role: "user" });
const fieldError = ref<{ username?: string; email?: string }>({});
const creating = ref(false);

const roleOptions = computed(() => [
  { label: t("users.roles.user"), value: "user" },
  { label: t("users.roles.dept_admin"), value: "dept_admin" },
  { label: t("users.roles.super_admin"), value: "super_admin" },
]);
const statusOptions = computed(() => [
  { label: t("users.statuses.active"), value: "active" },
  { label: t("users.statuses.disabled"), value: "disabled" },
  { label: t("users.statuses.pending"), value: "pending" },
]);

function fmtTime(v?: string | null): string {
  if (!v) return t("common.dash");
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? t("common.dash") : d.toLocaleString();
}

async function loadUsers() {
  loading.value = true;
  error.value = "";
  try {
    const query = new URLSearchParams();
    if (search.value.trim()) query.set("search", search.value.trim());
    if (roleFilter.value) query.set("role", roleFilter.value);
    if (statusFilter.value) query.set("status", statusFilter.value);
    query.set("limit", String(pageSize));
    query.set("offset", String((page.value - 1) * pageSize));
    const res = await auth.client().request<{ users: AdminUser[]; total: number }>(
      `/api/v1/admin/users?${query.toString()}`,
    );
    users.value = res.users ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function loadDepts() {
  try {
    const res = await auth.client().request<{ departments: DeptNode[] }>("/api/v1/admin/departments");
    depts.value = res.departments ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function onSearch() {
  page.value = 1;
  void loadUsers();
}

/** setStatus:停用带二次确认(它有外部影响:对方会话会被踢出)。 */
async function setStatus(u: AdminUser, status: string) {
  if (status === "disabled") {
    const ok = window.confirm(
      t("users.confirmDisable", { name: u.display_name || u.username }),
    );
    if (!ok) return;
  }
  try {
    const updated = await auth.client().request<AdminUser>(`/api/v1/admin/users/${u.id}`, {
      method: "PATCH",
      body: { status },
    });
    u.status = updated.status;
    message.success(status === "active" ? t("users.enabled") : t("users.disabled"));
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function setRole(u: AdminUser, role: string) {
  try {
    const updated = await auth.client().request<AdminUser>(`/api/v1/admin/users/${u.id}`, {
      method: "PATCH",
      body: { role },
    });
    u.role = updated.role;
    message.success(t("users.roleUpdated"));
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

/** submitCreate:把 details.field 映射到具体输入框。 */
async function submitCreate() {
  fieldError.value = {};
  creating.value = true;
  try {
    await auth.client().request("/api/v1/admin/users", { method: "POST", body: createForm.value });
    message.success(t("users.created"));
    showCreate.value = false;
    createForm.value = { username: "", email: "", display_name: "", role: "user" };
    void loadUsers();
  } catch (e) {
    if (e instanceof APIError && e.code === "account_conflict") {
      const field = String(e.details?.field ?? "");
      if (field === "email") {
        fieldError.value = { email: e.message };
      } else {
        fieldError.value = { username: e.message };
      }
    } else {
      message.error(e instanceof Error ? e.message : String(e));
    }
  } finally {
    creating.value = false;
  }
}

async function createDept() {
  if (!deptName.value.trim()) return;
  try {
    await auth.client().request("/api/v1/admin/departments", {
      method: "POST",
      body: { parent_id: deptParent.value ?? "", name: deptName.value.trim() },
    });
    deptName.value = "";
    message.success(t("users.deptCreated"));
    void loadDepts();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function removeDept(node: DeptNode) {
  if (!window.confirm(t("users.confirmDeleteDept", { name: node.name }))) return;
  try {
    await auth.client().request(`/api/v1/admin/departments/${node.id}`, { method: "DELETE" });
    message.success(t("users.deleted"));
    void loadDepts();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

const columns = computed<DataTableColumns<AdminUser>>(() => [
  { title: t("users.colUsername"), key: "username" },
  { title: t("users.colDisplayName"), key: "display_name" },
  { title: t("users.colEmail"), key: "email" },
  {
    title: t("users.colRole"),
    key: "role",
    render: (row) =>
      h(NSelect, {
        value: row.role,
        size: "small",
        style: "width: 140px",
        options: roleOptions.value,
        "onUpdate:value": (v: string) => void setRole(row, v),
      }),
  },
  {
    title: t("users.colStatus"),
    key: "status",
    render: (row) =>
      h(
        NTag,
        { size: "small", type: row.status === "active" ? "success" : "warning" },
        { default: () => statusOptions.value.find((s) => s.value === row.status)?.label ?? row.status },
      ),
  },
  { title: t("users.colLastLogin"), key: "last_login_at", render: (row) => fmtTime(row.last_login_at) },
  {
    title: t("users.colActions"),
    key: "actions",
    render: (row) =>
      h(NSpace, null, {
        default: () => [
          row.status === "active"
            ? h(NButton, { size: "small", type: "warning", onClick: () => void setStatus(row, "disabled") },
                { default: () => t("users.disable") })
            : h(NButton, { size: "small", type: "primary", onClick: () => void setStatus(row, "active") },
                { default: () => t("users.enable") }),
        ],
      }),
  },
]);

onMounted(() => {
  void loadUsers();
  void loadDepts();
});
</script>

<template>
  <div>
    <n-alert v-if="error" type="error" :show-icon="false" style="margin-bottom: 12px">
      {{ error }}
    </n-alert>

    <n-card :title="t('users.title')" size="small" style="margin-bottom: 16px">
      <n-space align="center" style="margin-bottom: 12px">
        <n-input
          v-model:value="search"
          :placeholder="t('users.searchPlaceholder')"
          style="width: 260px"
          clearable
          @keyup.enter="onSearch"
        />
        <n-select
          v-model:value="roleFilter"
          :options="roleOptions"
          :placeholder="t('users.roleFilterPlaceholder')"
          clearable
          style="width: 140px"
        />
        <n-select
          v-model:value="statusFilter"
          :options="statusOptions"
          :placeholder="t('users.statusFilterPlaceholder')"
          clearable
          style="width: 120px"
        />
        <n-button type="primary" @click="onSearch">{{ t("common.search") }}</n-button>
        <n-button @click="showCreate = true">{{ t("users.newUser") }}</n-button>
      </n-space>

      <n-data-table
        :columns="columns"
        :data="users"
        :loading="loading"
        :row-key="(row: AdminUser) => row.id"
        size="small"
      />
      <n-space justify="end" style="margin-top: 12px">
        <n-pagination
          v-model:page="page"
          :page-size="pageSize"
          :item-count="total"
          @update:page="loadUsers"
        />
      </n-space>
    </n-card>

    <n-card :title="t('users.deptTitle')" size="small">
      <n-space align="center" style="margin-bottom: 12px">
        <n-input v-model:value="deptName" :placeholder="t('users.deptNamePlaceholder')" style="width: 240px" />
        <n-button type="primary" @click="createDept">{{ t("users.newDept") }}</n-button>
      </n-space>
      <n-empty v-if="depts.length === 0" :description="t('users.noDept')" />
      <n-tree
        v-else
        block-line
        :data="(depts as never[])"
        children-field="children"
        label-field="name"
        key-field="id"
      />
      <n-space v-if="depts.length > 0" style="margin-top: 12px">
        <n-select
          v-model:value="deptParent"
          :options="depts.map((d) => ({ label: d.name, value: d.id }))"
          :placeholder="t('users.selectDeptPlaceholder')"
          clearable
          style="width: 280px"
        />
        <n-button
          :disabled="!deptParent"
          @click="removeDept(depts.find((d) => d.id === deptParent)!)"
        >
          {{ t("users.deleteDept") }}
        </n-button>
      </n-space>
    </n-card>

    <n-modal v-model:show="showCreate" preset="card" :title="t('users.newUser')" style="width: 480px">
      <n-form label-placement="left" label-width="90">
        <n-form-item :label="t('users.form.username')" :validation-status="fieldError.username ? 'error' : undefined"
                     :feedback="fieldError.username">
          <n-input v-model:value="createForm.username" :placeholder="t('users.form.usernamePlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('users.form.email')" :validation-status="fieldError.email ? 'error' : undefined"
                     :feedback="fieldError.email">
          <n-input v-model:value="createForm.email" :placeholder="t('users.form.emailPlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('users.form.displayName')">
          <n-input v-model:value="createForm.display_name" :placeholder="t('users.form.displayNamePlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('users.form.role')">
          <n-select v-model:value="createForm.role" :options="roleOptions" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreate = false">{{ t("common.cancel") }}</n-button>
          <n-button type="primary" :loading="creating" @click="submitCreate">{{ t("common.create") }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
