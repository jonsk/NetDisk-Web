/**
 * 应用内界面国际化(i18n)入口。
 *
 * - 基于 vue-i18n(Composition API,`legacy:false`),与 Vue 3 官方配套。
 * - 语言偏好存 **localStorage**:语言选择不是管理凭据,不受「共用电脑不存
 *   管理凭据」纪律约束(auth store 的令牌仍只存 sessionStorage)。
 * - 提供 `setLocale()` 统一写入当前语言与持久化,并导出支持的语言清单供
 *   语言切换器使用。
 */
import { createI18n } from "vue-i18n";
import zhCN from "./locales/zh-CN";
import enUS from "./locales/en-US";

export type SupportedLocale = "zh-CN" | "en-US";

export const SUPPORTED_LOCALES: ReadonlyArray<{ value: SupportedLocale; label: string }> = [
  { value: "zh-CN", label: "中文" },
  { value: "en-US", label: "English" },
] as const;

/** 管理后台语言偏好键(auth store 的令牌键是 netdisk.admin.token / refresh,勿混淆) */
const STORAGE_KEY = "netdisk.admin.locale";
const DEFAULT_LOCALE: SupportedLocale = "zh-CN";

function isSupported(v: string | null): v is SupportedLocale {
  return v === "zh-CN" || v === "en-US";
}

function loadInitialLocale(): SupportedLocale {
  // 存储里可能是历史遗留的其它值,非白名单则回退默认
  const saved = localStorage.getItem(STORAGE_KEY);
  return isSupported(saved) ? saved : DEFAULT_LOCALE;
}

export const i18n = createI18n({
  legacy: false,
  locale: loadInitialLocale(),
  fallbackLocale: "zh-CN", // 缺失 key 时回退中文,避免出现裸 key
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});

/** 切换语言并持久化。 */
export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
}

/** 当前语言(供组件内 read 使用)。 */
export function getLocale(): SupportedLocale {
  return i18n.global.locale.value as SupportedLocale;
}
