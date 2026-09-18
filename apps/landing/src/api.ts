/**
 * 落地页专用 API 封装(无 @netdisk/api 依赖,直接 fetch)。
 *
 * 只调两个**免登录**接口(后端 handlers_share.go):
 *   - GET  /api/v1/shares/{token}/meta   → ShareMeta
 *   - POST/GET /api/v1/shares/{token}/download  (密码走 X-Share-Password 头)
 *
 * 失效统一由服务端回 **410 + {code:"resource_gone", details:{reason}}**,
 * reason ∈ {expired, revoked, download_limit_reached}。这里按 reason 分流文案。
 */

export interface ShareMeta {
  token: string;
  name: string;
  /** Format: int64 */
  size: number;
  is_dir: boolean;
  need_password: boolean;
  expires_at?: string;
  download_count?: number;
  max_downloads?: number;
  mime_type?: string;
}

export type LoadError =
  | { kind: "gone"; reason: string }
  | { kind: "notfound" }
  | { kind: "error"; status: number };

export type DownloadError =
  | { kind: "badpassword" }
  | { kind: "gone"; reason: string }
  | { kind: "error"; status: number };

interface APIErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  request_id?: string;
}

async function readErr(res: Response): Promise<APIErrorBody> {
  try {
    return (await res.json()) as APIErrorBody;
  } catch {
    return {};
  }
}

function gone(res: Response, fallback: string): Promise<LoadError | DownloadError> {
  return readErr(res).then((b) => ({
    kind: "gone",
    reason: (b.details?.reason as string) ?? fallback,
  }));
}

export async function fetchMeta(token: string): Promise<ShareMeta> {
  const res = await fetch(`/api/v1/shares/${encodeURIComponent(token)}/meta`);
  if (res.ok) return (await res.json()) as ShareMeta;
  if (res.status === 410) return Promise.reject(await gone(res, "revoked"));
  if (res.status === 404) return Promise.reject({ kind: "notfound" } as LoadError);
  return Promise.reject({ kind: "error", status: res.status } as LoadError);
}

export async function download(
  token: string,
  password?: string,
): Promise<{ blob: Blob; filename: string }> {
  const headers: Record<string, string> = {};
  if (password) headers["X-Share-Password"] = password;
  const res = await fetch(`/api/v1/shares/${encodeURIComponent(token)}/download`, { headers });
  if (res.ok) {
    const blob = await res.blob();
    return { blob, filename: parseFilename(res.headers.get("content-disposition") ?? "") };
  }
  if (res.status === 401) return Promise.reject({ kind: "badpassword" } as DownloadError);
  if (res.status === 410) return Promise.reject(await gone(res, "revoked"));
  return Promise.reject({ kind: "error", status: res.status } as DownloadError);
}

/** 从 Content-Disposition 解析文件名(RFC 5987 优先)。 */
function parseFilename(cd: string): string {
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (m) return decodeURIComponent(m[1]);
  const m2 = cd.match(/filename="?([^";]+)"?/i);
  if (m2) return m2[1];
  return "download";
}
