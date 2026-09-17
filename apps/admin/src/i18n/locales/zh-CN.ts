/**
 * 中文(简体)语言包 —— 即 i18n Schema。
 *
 * 所有 UI 文案统一收口到这里(应用内界面国际化)。
 * 后续新增语言只需新增 `locales/<lang>.ts` 并满足本 Schema(类型约束保证不丢 key)。
 */
const zhCN = {
  /** 应用名 */
  app: {
    name: "网盘管理后台",
  },
  /** 通用动作 */
  common: {
    cancel: "取消",
    create: "创建",
    save: "保存",
    search: "搜索",
    query: "查询",
    action: "操作",
    status: "状态",
    dash: "—",
  },
  /** 登录页 */
  login: {
    username: "用户名 / 邮箱",
    password: "密码",
    usernamePlaceholder: "请输入用户名或邮箱",
    passwordPlaceholder: "请输入密码",
    submit: "登录",
    empty: "请输入用户名与密码",
    rateLimited: "尝试过于频繁,请稍后再试",
    failed: "登录失败,请稍后再试",
  },
  /** 布局与导航 */
  layout: {
    brand: "网盘管理后台",
    logout: "退出",
    menu: {
      overview: "概览",
      users: "用户与部门",
      spaces: "空间治理",
    },
  },
  /** 路由标题(用于 document.title 与顶栏) */
  routes: {
    login: "登录",
    overview: "概览",
    users: "用户与部门",
    spaces: "空间治理",
  },
  /** 概览页 */
  overview: {
    title: "当前会话",
    user: "用户",
    role: "角色",
    audience: "令牌受众",
    requestId: "request_id",
  },
  /** 用户与部门 */
  users: {
    title: "用户",
    searchPlaceholder: "搜索用户名 / 显示名 / 邮箱",
    newUser: "新建用户",
    roleFilterPlaceholder: "角色",
    statusFilterPlaceholder: "状态",
    roles: {
      user: "普通用户",
      dept_admin: "部门管理员",
      super_admin: "超级管理员",
    },
    statuses: {
      active: "启用",
      disabled: "停用",
      pending: "待激活",
    },
    colUsername: "用户名",
    colDisplayName: "显示名",
    colEmail: "邮箱",
    colRole: "角色",
    colStatus: "状态",
    colLastLogin: "最后登录",
    colActions: "操作",
    enable: "启用",
    disable: "停用",
    enabled: "已启用",
    disabled: "已停用",
    roleUpdated: "角色已更新",
    created: "已建号",
    confirmDisable: "确认停用「{name}」?\n\n停用后:该账号无法登录,已登录会话在令牌到期后失效(刷新令牌会立刻被吊销)。",
    deptTitle: "部门",
    deptNamePlaceholder: "新部门名称",
    newDept: "新建部门",
    noDept: "暂无部门(可由组织同步创建)",
    selectDeptPlaceholder: "选择要删除的部门(仅空部门可删)",
    deleteDept: "删除该部门",
    confirmDeleteDept: "确认删除部门「{name}」?(仅空部门可删)",
    deptCreated: "部门已创建",
    deleted: "已删除",
    form: {
      username: "用户名",
      email: "邮箱",
      displayName: "显示名",
      role: "角色",
      usernamePlaceholder: "登录名,唯一",
      emailPlaceholder: "可选,填了就唯一",
      displayNamePlaceholder: "默认与用户名相同",
    },
  },
  /** 空间治理 */
  spaces: {
    title: "空间治理",
    alertInfo:
      "本页只做全局治理(配额/预警阈值/冻结/收回)。新建空间、邀请成员、退出空间属协作管理,入口在桌面客户端。\n用量为只读:它只由上传/删除事务增减,后台不手工修正。",
    searchPlaceholder: "搜索空间名 / 所有者",
    kindFilterPlaceholder: "类型",
    statusFilterPlaceholder: "状态",
    kinds: {
      personal: "个人空间",
      team: "团队空间",
    },
    statuses: {
      frozen: "已冻结",
      normal: "正常",
    },
    colSpace: "空间",
    colKind: "类型",
    colOwner: "所有者",
    colUsageQuota: "用量 / 配额",
    colUsed: "已用",
    colQuota: "配额",
    colWarn: "预警线",
    colMembers: "成员",
    colFiles: "文件",
    colStatus: "状态",
    colActions: "操作",
    quota: "配额",
    freeze: "冻结",
    unfreeze: "解冻",
    revoke: "收回",
    query: "查询",
    unlimited: "不限",
    confirmFreeze: "确认冻结「{name}」?\n\n冻结后该空间内所有写操作被拒(读仍可用)。",
    confirmUnfreeze: "确认解冻「{name}」?",
    confirmRevoke:
      "确认收回「{name}」?\n\n收回后:空间被冻结,且**全部成员被移出**(仅所有者保留)。\n空间内的文件**不会被删除** —— 需要删除请另行确认保留策略。",
    saved: "配额与预警阈值已更新",
    frozen: "已冻结",
    unfrozen: "已解冻",
    revoked: "已收回:移出 {count} 名成员;文件未删除",
    quotaTitle: "配额与预警阈值",
    form: {
      space: "空间",
      used: "已用",
      quotaGb: "配额(GB)",
      warnPercent: "预警阈值(%)",
      suffixUnlimited: "0 表示不限制",
    },
    alertWarn: "预警阈值是\"提醒线\"(达到后通知),不是上传上限 —— 上传上限由服务端 95% 策略控制。",
  },
};

export default zhCN;
export type LocaleSchema = typeof zhCN;
