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
 */
import { computed, h, onMounted, ref } from "vue";
import { NButton, NSelect, NSpace, NTag, useMessage, type DataTableColumns } from "naive-ui";
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

const roleOptions = [
  { label: "普通用户", value: "user" },
  { label: "部门管理员", value: "dept_admin" },
  { label: "超级管理员", value: "super_admin" },
];
const statusOptions = [
  { label: "启用", value: "active" },
  { label: "停用", value: "disabled" },
  { label: "待激活", value: "pending" },
];

function fmtTime(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
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
      `确认停用「${u.display_name || u.username}」?\n\n` +
        "停用后:该账号无法登录,已登录会话在令牌到期后失效(刷新令牌会立刻被吊销)。",
    );
    if (!ok) return;
  }
  try {
    const updated = await auth.client().request<AdminUser>(`/api/v1/admin/users/${u.id}`, {
      method: "PATCH",
      body: { status },
    });
    u.status = updated.status;
    message.success(status === "active" ? "已启用" : "已停用");
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
    message.success("角色已更新");
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
    message.success("已建号");
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
    message.success("部门已创建");
    void loadDepts();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function removeDept(node: DeptNode) {
  if (!window.confirm(`确认删除部门「${node.name}」?(仅空部门可删)`)) return;
  try {
    await auth.client().request(`/api/v1/admin/departments/${node.id}`, { method: "DELETE" });
    message.success("已删除");
    void loadDepts();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

const columns = computed<DataTableColumns<AdminUser>>(() => [
  { title: "用户名", key: "username" },
  { title: "显示名", key: "display_name" },
  { title: "邮箱", key: "email" },
  {
    title: "角色",
    key: "role",
    render: (row) =>
      h(NSelect, {
        value: row.role,
        size: "small",
        style: "width: 140px",
        options: roleOptions,
        "onUpdate:value": (v: string) => void setRole(row, v),
      }),
  },
  {
    title: "状态",
    key: "status",
    render: (row) =>
      h(
        NTag,
        { size: "small", type: row.status === "active" ? "success" : "warning" },
        { default: () => statusOptions.find((s) => s.value === row.status)?.label ?? row.status },
      ),
  },
  { title: "最后登录", key: "last_login_at", render: (row) => fmtTime(row.last_login_at) },
  {
    title: "操作",
    key: "actions",
    render: (row) =>
      h(NSpace, null, {
        default: () => [
          row.status === "active"
            ? h(NButton, { size: "small", type: "warning", onClick: () => void setStatus(row, "disabled") },
                { default: () => "停用" })
            : h(NButton, { size: "small", type: "primary", onClick: () => void setStatus(row, "active") },
                { default: () => "启用" }),
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

    <n-card title="用户" size="small" style="margin-bottom: 16px">
      <n-space align="center" style="margin-bottom: 12px">
        <n-input
          v-model:value="search"
          placeholder="搜索用户名 / 显示名 / 邮箱"
          style="width: 260px"
          clearable
          @keyup.enter="onSearch"
        />
        <n-select
          v-model:value="roleFilter"
          :options="roleOptions"
          placeholder="角色"
          clearable
          style="width: 140px"
        />
        <n-select
          v-model:value="statusFilter"
          :options="statusOptions"
          placeholder="状态"
          clearable
          style="width: 120px"
        />
        <n-button type="primary" @click="onSearch">搜索</n-button>
        <n-button @click="showCreate = true">新建用户</n-button>
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

    <n-card title="部门" size="small">
      <n-space align="center" style="margin-bottom: 12px">
        <n-input v-model:value="deptName" placeholder="新部门名称" style="width: 240px" />
        <n-button type="primary" @click="createDept">新建部门</n-button>
      </n-space>
      <n-empty v-if="depts.length === 0" description="暂无部门(可由组织同步创建)" />
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
          placeholder="选择要删除的部门(仅空部门可删)"
          clearable
          style="width: 280px"
        />
        <n-button
          :disabled="!deptParent"
          @click="removeDept(depts.find((d) => d.id === deptParent)!)"
        >
          删除该部门
        </n-button>
      </n-space>
    </n-card>

    <n-modal v-model:show="showCreate" preset="card" title="新建用户" style="width: 480px">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="用户名" :validation-status="fieldError.username ? 'error' : undefined"
                     :feedback="fieldError.username">
          <n-input v-model:value="createForm.username" placeholder="登录名,唯一" />
        </n-form-item>
        <n-form-item label="邮箱" :validation-status="fieldError.email ? 'error' : undefined"
                     :feedback="fieldError.email">
          <n-input v-model:value="createForm.email" placeholder="可选,填了就唯一" />
        </n-form-item>
        <n-form-item label="显示名">
          <n-input v-model:value="createForm.display_name" placeholder="默认与用户名相同" />
        </n-form-item>
        <n-form-item label="角色">
          <n-select v-model:value="createForm.role" :options="roleOptions" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreate = false">取消</n-button>
          <n-button type="primary" :loading="creating" @click="submitCreate">创建</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
