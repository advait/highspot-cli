import { Buffer } from "node:buffer";
import type { ResolvedConfig } from "./config.js";

const TEXTUAL_CONTENT_TYPE_HINTS = [
  "application/xml",
  "application/xhtml+xml",
  "application/csv",
  "application/rtf",
  "application/markdown",
  "application/x-markdown",
  "text/csv",
  "text/html",
  "text/markdown",
] as const;

export type SearchItemsArgs = {
  hsUser?: string;
  limit?: number;
  query: string;
  sortBy?: "relevancy" | "date_added";
  start?: number;
  withFields?: string;
};

export type GetItemArgs = {
  hsUser?: string;
  itemId: string;
};

export type GetItemContentArgs = {
  format?: string;
  hsUser?: string;
  itemId: string;
  start?: string;
};

export type HighspotSearchItem = {
  contentType: string;
  description: string;
  id: string;
  title: string;
  url: string;
};

export type HighspotSearchItemsResult = {
  limit: number;
  query: string;
  results: HighspotSearchItem[];
  start: number;
  total: number;
};

export type HighspotGetItemResult = {
  item: unknown;
};

export type HighspotGetItemContentResult = {
  content: unknown;
  contentEncoding?: string;
  contentLength?: number;
  contentType: string;
  isBinary?: boolean;
  isJson: boolean;
  itemId: string;
};

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function sanitizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function looksTextual(contentType: string): boolean {
  if (contentType.startsWith("text/")) {
    return true;
  }

  return TEXTUAL_CONTENT_TYPE_HINTS.some((hint) => contentType.includes(hint));
}

export class HighspotClient {
  readonly #authorizationHeader: string;
  readonly #endpoint: string;
  readonly #hsUser?: string;
  readonly #maxRetries: number;
  readonly #retryDelayMs: number;
  readonly #timeoutMs: number;

  constructor(config: ResolvedConfig) {
    this.#authorizationHeader = `Basic ${Buffer.from(`${config.apiKeyId}:${config.apiKeySecret}`).toString("base64")}`;
    this.#endpoint = sanitizeEndpoint(config.endpoint);
    this.#hsUser = config.hsUser;
    this.#maxRetries = config.maxRetries;
    this.#retryDelayMs = config.retryDelayMs;
    this.#timeoutMs = config.timeoutMs;
  }

  #buildUrl(pathname: string): URL {
    return new URL(`${this.#endpoint}${pathname}`);
  }

  async #fetchWithRetry(args: {
    hsUser?: string;
    operation: string;
    url: URL;
  }): Promise<Response> {
    let response: Response | undefined;

    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(
        () => controller.abort(),
        this.#timeoutMs,
      );

      try {
        response = await fetch(args.url, {
          method: "GET",
          headers: {
            Accept: "*/*",
            Authorization: this.#authorizationHeader,
            ...((args.hsUser ?? this.#hsUser)
              ? { "hs-user": args.hsUser ?? this.#hsUser }
              : {}),
          },
          signal: controller.signal,
        });
      } catch (error) {
        if (attempt === this.#maxRetries) {
          throw error;
        }

        const delayMs = this.#retryDelayMs * (attempt + 1);
        await sleep(delayMs);
        continue;
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (response.ok) {
        return response;
      }

      if (
        attempt < this.#maxRetries &&
        (response.status === 429 || response.status >= 500)
      ) {
        const delayMs = this.#retryDelayMs * (attempt + 1);
        await sleep(delayMs);
        continue;
      }

      const body = await readResponseBody(response);
      throw new ApiError(
        `Highspot request "${args.operation}" failed with status ${response.status}`,
        response.status,
        body,
      );
    }

    throw new Error(`Highspot request "${args.operation}" failed unexpectedly`);
  }

  async searchItems(args: SearchItemsArgs): Promise<HighspotSearchItemsResult> {
    const limit = args.limit ?? 10;
    const start = args.start ?? 0;
    const url = this.#buildUrl("/search/items");
    url.searchParams.set("query-string", args.query);
    url.searchParams.set("limit", String(limit));

    if (args.start !== undefined) {
      url.searchParams.set("start", String(args.start));
    }

    if (args.sortBy) {
      url.searchParams.set("sortby", args.sortBy);
    }

    if (args.withFields) {
      url.searchParams.set("with-fields", args.withFields);
    }

    const response = await this.#fetchWithRetry({
      operation: "searchItems",
      url,
      ...(args.hsUser ? { hsUser: args.hsUser } : {}),
    });
    const payload = (await response.json()) as {
      collection?: Array<{
        content_type?: string;
        description?: string;
        id?: string;
        title?: string;
        url?: string;
      }>;
      results?: Array<{
        content_type?: string;
        description?: string;
        id?: string;
        title?: string;
        url?: string;
      }>;
      counts_total?: number;
      total_results?: number;
    };

    const source = payload.collection ?? payload.results ?? [];
    const results = source
      .filter(
        (item) => typeof item.id === "string" && item.id.trim().length > 0,
      )
      .map((item) => ({
        contentType: item.content_type ?? "",
        description: item.description ?? "",
        id: item.id ?? "",
        title: item.title ?? "",
        url: item.url ?? "",
      }));

    return {
      limit,
      query: args.query,
      results,
      start,
      total: payload.counts_total ?? payload.total_results ?? results.length,
    };
  }

  async getItem(args: GetItemArgs): Promise<HighspotGetItemResult> {
    const url = this.#buildUrl(`/items/${encodeURIComponent(args.itemId)}`);
    const response = await this.#fetchWithRetry({
      operation: "getItem",
      url,
      ...(args.hsUser ? { hsUser: args.hsUser } : {}),
    });

    const payload = (await response.json()) as unknown;
    return { item: payload };
  }

  async getItemContent(
    args: GetItemContentArgs,
  ): Promise<HighspotGetItemContentResult> {
    const url = this.#buildUrl(
      `/items/${encodeURIComponent(args.itemId)}/content`,
    );
    if (args.format) {
      url.searchParams.set("format", args.format);
    }

    if (args.start) {
      url.searchParams.set("start", args.start);
    }

    const response = await this.#fetchWithRetry({
      operation: "getItemContent",
      url,
      ...(args.hsUser ? { hsUser: args.hsUser } : {}),
    });

    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream";

    if (contentType.includes("json")) {
      const payload = (await response.json()) as unknown;
      return {
        content: payload,
        contentEncoding: "json",
        contentType,
        isBinary: false,
        isJson: true,
        itemId: args.itemId,
      };
    }

    if (!looksTextual(contentType)) {
      const binary = await response.arrayBuffer();
      return {
        content: Buffer.from(binary).toString("base64"),
        contentEncoding: "base64",
        contentLength: binary.byteLength,
        contentType,
        isBinary: true,
        isJson: false,
        itemId: args.itemId,
      };
    }

    const textContent = await response.text();
    return {
      content: textContent,
      contentEncoding: "utf8",
      contentLength: textContent.length,
      contentType,
      isBinary: false,
      isJson: false,
      itemId: args.itemId,
    };
  }

  async getMe(args: { hsUser?: string } = {}): Promise<unknown> {
    const url = this.#buildUrl("/me");
    const response = await this.#fetchWithRetry({
      operation: "getMe",
      url,
      ...(args.hsUser ? { hsUser: args.hsUser } : {}),
    });

    return (await response.json()) as unknown;
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
