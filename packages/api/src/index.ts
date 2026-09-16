/**
 * 类型化 REST 客户端(FE-W-01 骨架;类型来源在 FE-W-02 换成生成的 schema)。
 *
 * # 为什么单独成包
 *
 * 管理后台与未来的各端调的是**同一套**接口。把调用逻辑各写一遍,迟早对同一件事
 * 有两种理解(错误码处理、令牌刷新、分页游标) —— 而"两端行为不一致"在网盘里
 * 表现为"一端能删、另一端删不了"这类没人能一眼解释的现象。
 *
 * # 三条纪律(每一处都对应一个真实故障)
 *
 * 1. **令牌只在内存里**,刷新靠 HttpOnly 之外的方式不可行(SSE/下载要带头),
 *    因此这里只持有 access token,refresh token 由调用方(store)保管并负责刷新。
 * 2. **错误对象必须结构化**:服务端已经给出 `{code, message, details, request_id}`,
 *    客户端把它压成字符串就等于丢掉 `request_id`(用户报障时无法定位)。
 * 3. **不做隐式重试**:写请求重试可能造成重复操作;重试策略属于调用方
 *    (需要幂等键时由调用方提供)。
 */

/**
 * 类型**全部来自契约**(FE-W-02):`DOC/api/openapi.yaml` → `pnpm gen:api` → schema.gen.ts。
 *
 * 纪律:本文件**不再手写任何与契约同名的类型** —— 手写副本在契约变更时不会跟着变,
 * 而两端对同一字段的两种理解只会在线上才暴露(例如服务端把 `freed_bytes` 改名,
 * 手写类型仍然编译通过)。`pnpm lint:contract` 会把这类手写类型拦下。
 */
import type { components, operations, paths } from "./schema.gen";

/** Schema 是契约里全部模型(`components.schemas`)的入口。 */
export type Schema = components["schemas"];
/** Operations 是全部接口操作的入口(按 path + method 取请求/响应类型)。 */
export type Operations = operations;
/** Paths 是全部路径的入口。 */
export type Paths = paths;

// 常用模型的便捷别名(名字与契约一致,便于在业务代码里直接引用)
export type EntryView = Schema["EntryView"];
export type FileListResult = Schema["FileListResult"];
export type DeleteResult = Schema["DeleteResult"];
export type SubtreeStats = Schema["SubtreeStats"];
export type CopyResult = Schema["CopyResult"];
export type LockView = Schema["LockView"];
export type UploadCreateRequest = Schema["UploadCreateRequest"];
export type UploadCreateResult = Schema["UploadCreateResult"];
export type UploadSimpleResult = Schema["UploadSimpleResult"];
export type FastUploadHint = Schema["FastUploadHint"];
export type ChangesPage = Schema["ChangesPage"];
export type ChangeItem = Schema["ChangeItem"];
export type ShareMeta = Schema["ShareMeta"];
export type ShareCreated = Schema["ShareCreated"];
export type ShareItem = Schema["ShareItem"];
export type LoginResult = Schema["LoginResult"];
export type TokenPair = Schema["TokenPair"];
export type UserBrief = Schema["UserBrief"];
export type SpaceBrief = Schema["SpaceBrief"];
export type VersionInfo = Schema["VersionInfo"];
export type MeView = Schema["MeView"];
export type DepartmentNode = Schema["DepartmentNode"];

/**
 * APIErrorBody 是契约里的 `Error`。
 *
 * 这里**起别名而不是重名**:`Error` 是 JS 内置全局名,直接 `export type Error = ...`
 * 会在使用时与内置类型打架(而且 lint 也会把"手写同名类型"拦下)。
 */
export type APIErrorBody = Schema["Error"];

/** APIError 是**唯一**抛出的错误类型:调用方按 code 分流,不用解析文案。 */
export class APIError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly requestId: string;

  constructor(status: number, body: APIErrorBody) {
    super(body.message || `HTTP ${status}`);
    this.name = "APIError";
    this.status = status;
    this.code = body.code || "unknown";
    this.details = body.details ?? {};
    this.requestId = body.request_id ?? "";
  }

  /** 令牌过期/无效:调用方据此静默刷新并重放请求(FE-W-03 验收)。 */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  /** 被移出空间:客户端必须**保留本地数据**并等待恢复,绝不删除(6.4 P1-2)。 */
  get isSpaceRevoked(): boolean {
    return this.code === "space_revoked" || this.code === "space_gone";
  }
}

export interface ClientOptions {
  /** 基地址;同源部署留空即可(前端由 Go 提供,与 /api 同源) */
  baseURL?: string;
  /** 取当前 access token(为空表示未登录) */
  getToken?: () => string | null;
  /** 令牌失效时的刷新回调;返回新 token 或 null(刷新失败) */
  onUnauthorized?: () => Promise<string | null>;
  /** 便于测试注入 fetch */
  fetchImpl?: typeof fetch;
}

/** 请求选项。 */
export interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  /** 原始响应体(下载/SSE 用;此时不解析 JSON) */
  raw?: boolean;
  signal?: AbortSignal;
}

const TOKEN_HEADER = "Authorization";

/**
 * isBinaryBody 判断 body 是否应当**原样发送**(不做 JSON 序列化)。
 *
 * 分片上传发的是 `Blob`(一个分片),而 JSON.stringify 会把它变成 `{}` ——
 * 服务端收到 0 字节,表现为"上传成功但文件是空的",极难排查。
 * 因此显式列出二进制类型,并在 doFetch 里据此跳过 JSON 处理。
 */
function isBinaryBody(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) ||
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)
  );
}

/**
 * Client 是 REST 调用入口。
 *
 * 只暴露 `request` 一个方法:接口越来越多时,"每加一个接口就加一个方法"会让
 * 这个包无限膨胀,而 FE-W-02 生成的是**类型**,调用仍然走同一个 request ——
 * 这样错误处理、刷新、请求头只有一份实现。
 */
export class Client {
  private readonly baseURL: string;
  private readonly getToken: () => string | null;
  private readonly onUnauthorized?: () => Promise<string | null>;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseURL = opts.baseURL ?? "";
    this.getToken = opts.getToken ?? (() => null);
    this.onUnauthorized = opts.onUnauthorized;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /** request 发一次请求;失败抛 APIError。 */
  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const res = await this.send(path, opts);
    if (opts.raw) {
      return res as unknown as T;
    }
    if (res.status === 204) {
      return undefined as T;
    }
    const text = await res.text();
    if (!res.ok) {
      throw parseError(res.status, text);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /**
   * send 返回原始 Response(下载、需要读响应头时用)。
   *
   * 401 只在**没有刷新回调**时才直接抛出:有回调时先刷新再重放一次 ——
   * 这正是 FE-W-03 的"token 过期静默刷新",放在客户端里保证两端一致。
   */
  async send(path: string, opts: RequestOptions = {}): Promise<Response> {
    const doFetch = async (): Promise<Response> => {
      const url = this.buildURL(path, opts.query);
      const headers: Record<string, string> = { ...(opts.headers ?? {}) };
      const token = this.getToken();
      if (token) {
        headers[TOKEN_HEADER] = `Bearer ${token}`;
      }
      let body: BodyInit | undefined;
      if (opts.body !== undefined) {
        if (isBinaryBody(opts.body)) {
          // 二进制/表单体原样发送,且**不**擅自设 Content-Type
          // (Blob 自带 type;FormData 必须由运行时补 boundary,
          //  手工设成 application/json 会让服务端完全解析不出来)
          body = opts.body;
          if (typeof opts.body === "string") {
            headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
          }
        } else {
          headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
          body = JSON.stringify(opts.body);
        }
      }
      return this.fetchImpl(url, {
        method: opts.method ?? "GET",
        headers,
        body,
        signal: opts.signal,
        // 同源部署下带上 Cookie(将来若改用 Cookie 会话不至于要改所有调用点)
        credentials: "same-origin",
      });
    };

    let res = await doFetch();
    if (res.status === 401 && this.onUnauthorized) {
      const fresh = await this.onUnauthorized();
      if (fresh) {
        res = await doFetch();
      }
    }
    return res;
  }

  private buildURL(path: string, query?: RequestOptions["query"]): string {
    const base = this.baseURL.replace(/\/$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    if (!query) {
      return base + p;
    }
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) {
        continue;
      }
      qs.append(k, String(v));
    }
    const s = qs.toString();
    return s ? `${base}${p}?${s}` : base + p;
  }
}

/** parseError 把响应体解析成结构化错误;非 JSON 体也不丢状态码。 */
export function parseError(status: number, text: string): APIError {
  try {
    const body = JSON.parse(text) as APIErrorBody;
    if (body && typeof body === "object") {
      return new APIError(status, body);
    }
  } catch {
    // 非 JSON(代理返回的 HTML 错误页等):保留原文,便于排障
  }
  return new APIError(status, { code: "unknown", message: text || `HTTP ${status}` });
}

/**
 * Paged 是 keyset 分页的**通用形状**(不是契约模型)。
 *
 * 契约里每个列表接口的字段名不同(`entries`/`items`/`shares`),
 * 因此不强行在 OpenAPI 里做一个泛型模型(OpenAPI 的泛型表达力有限、
 * 生成的类型会变成 `any`)。这里只是给"entries + next_after"这一种形态一个名字。
 */
export interface Paged<T> {
  entries: T[];
  next_after?: string;
}
