import { createI18n } from "vue-i18n";

/**
 * 落地页 i18n(外部访客面,极简)。
 *
 * 与 admin 不同:访客不需要"切换语言偏好"的持久化 —— 按浏览器语言自动选,
 * 仅 zh-CN / en-US 两种。缺失 key 回退 en-US,避免出现裸 key。
 */
const zhCN = {
  title: "文件分享",
  file: "文件",
  size: "大小",
  expiresAt: "有效期至",
  remaining: "剩余可下载次数",
  needPassword: "该分享链接受密码保护",
  passwordPlaceholder: "请输入访问密码",
  download: "下载",
  downloading: "下载中…",
  badPassword: "密码错误,请重试",
  notFound: "分享链接不存在或已失效",
  expired: "该分享链接已过期",
  revoked: "该分享链接已被创建者吊销",
  limitReached: "该分享链接已达到下载次数上限",
  loadError: "加载分享信息失败,请稍后重试",
  langToggle: "EN",
};

const enUS = {
  title: "File Share",
  file: "File",
  size: "Size",
  expiresAt: "Expires at",
  remaining: "Downloads remaining",
  needPassword: "This share is password protected",
  passwordPlaceholder: "Enter access password",
  download: "Download",
  downloading: "Downloading…",
  badPassword: "Wrong password, please retry",
  notFound: "Share link not found or expired",
  expired: "This share link has expired",
  revoked: "This share link has been revoked by the owner",
  limitReached: "This share link reached its download limit",
  loadError: "Failed to load share info, please retry",
  langToggle: "中",
};

const initial =
  typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en-US";

export const i18n = createI18n({
  legacy: false,
  locale: initial,
  fallbackLocale: "en-US",
  messages: { "zh-CN": zhCN, "en-US": enUS },
});

/** 在两种语言间切换(顶栏小按钮用)。 */
export function toggleLocale(): void {
  i18n.global.locale.value = i18n.global.locale.value === "zh-CN" ? "en-US" : "zh-CN";
}
