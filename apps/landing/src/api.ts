/**
 * 落地页专用 API 封装(统一走 @netdisk/api 契约单源客户端,不再手写 fetch/DTO)。
 *
 * 只调两个**免登录**接口(后端 handlers_share.go):
 *   - GET  /api/v1/shares/{token}/meta   → ShareMeta
 *   - POST/GET /api/v1/shares/{token}/download  (密码走 X-Share-Password 头)
 *
 * 失效统一由服务端回 **410 + {code:"resource_gone", details:{reason}}**,
 * reason ∈ {expired, revoked, download_limit_reached}。这里按 reason 分流文案。
 * 类型全部来自契约:@netdisk/api 已 `export type ShareMeta = Schema["ShareMeta"]`,
 * 这里只做 re-export,不再手写同名类型(FE-W-02 契约单源)。
 */

import {
  Client,
  APIError,
  parseError,
  type ShareMeta,
} from "@netdisk/api";

export type { ShareMeta };

/** 免登录访客客户端(无 token;落地页所有调用都不带令牌)。 */
const client = new Client();

export type LoadError =
  | { kind: "gone"; reason: string }
  | { kind: "notfound" }
  | { kind: "error"; status: number };

export type DownloadError =
  | { kind: "badpassword" }
  | { kind: "gone"; reason: string }
  | { kind: "error"; status: number };

/** 加载(META)错误分流:410=gone(按 reason),404=notfound,其余=error。 */
function toLoadError(e: unknown): LoadError {
  if (e instanceof APIError) {
    if (e.status === 410) {
      return { kind: "gone", reason: (e.details?.reason as string) ?? "revoked" };
    }
    if (e.status === 404) {
      return { kind: "notfound" };
    }
    return { kind: "error", status: e.status };
  }
  return { kind: "error", status: 0 };
}

/** 下载错误分流:401=密码错误,410=gone(按 reason),其余=error。 */
function toDownloadError(e: unknown): DownloadError {
  if (e instanceof APIError) {
    if (e.status === 401) {
      return { kind: "badpassword" };
    }
    if (e.status === 410) {
      return { kind: "gone", reason: (e.details?.reason as string) ?? "revoked" };
    }
    return { kind: "error", status: e.status };
  }
  return { kind: "error", status: 0 };
}

export async function fetchMeta(token: string): Promise<ShareMeta> {
  try {
    return await client.request<ShareMeta>(
      `/api/v1/shares/${encodeURIComponent(token)}/meta`,
    );
  } catch (e) {
    throw toLoadError(e);
  }
}

export async function download(
  token: string,
  password?: string,
): Promise<{ blob: Blob; filename: string }> {
  const headers: Record<string, string> = {};
  if (password) headers["X-Share-Password"] = password;
  try {
    const res = await client.send(
      `/api/v1/shares/${encodeURIComponent(token)}/download`,
      { headers },
    );
    if (!res.ok) {
      // send 返回原始 Response 不抛错,非 2xx 需自行解析为 APIError 再分流
      const text = await res.text();
      throw parseError(res.status, text);
    }
    const blob = await res.blob();
    return { blob, filename: parseFilename(res.headers.get("content-disposition") ?? "") };
  } catch (e) {
    throw toDownloadError(e);
  }
}

/** 从 Content-Disposition 解析文件名(RFC 5987 优先)。 */
function parseFilename(cd: string): string {
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (m) return decodeURIComponent(m[1]);
  const m2 = cd.match(/filename="?([^";]+)"?/i);
  if (m2) return m2[1];
  return "download";
}
