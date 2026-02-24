import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type ConfigRecord = {
  endpoint?: string;
  hsUser?: string;
  maxRetries?: number | string;
  retryDelayMs?: number | string;
  timeoutMs?: number | string;
  basicAuth?: string;
  apiKeyId?: string;
  apiKeySecret?: string;
};

export type ConfigOverrides = {
  endpoint?: string;
  hsUser?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

export type ResolvedConfig = {
  endpoint: string;
  hsUser?: string;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  authorizationHeader: string;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_ENDPOINT = "https://api.highspot.com/v1.0";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1200;
const DEFAULT_TIMEOUT_MS = 30000;

function readConfigFile(path: string): ConfigRecord {
  if (!existsSync(path)) {
    return {};
  }

  const raw = readFileSync(path, "utf8").trim();
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError(
      `Invalid config file at ${path}: expected a JSON object.`,
    );
  }

  return parsed as ConfigRecord;
}

function toInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalize(config: ConfigRecord): ConfigRecord {
  return {
    endpoint:
      typeof config.endpoint === "string" ? config.endpoint.trim() : undefined,
    hsUser:
      typeof config.hsUser === "string" ? config.hsUser.trim() : undefined,
    maxRetries: toInteger(config.maxRetries),
    retryDelayMs: toInteger(config.retryDelayMs),
    timeoutMs: toInteger(config.timeoutMs),
    basicAuth:
      typeof config.basicAuth === "string"
        ? config.basicAuth.trim()
        : undefined,
    apiKeyId:
      typeof config.apiKeyId === "string" ? config.apiKeyId.trim() : undefined,
    apiKeySecret:
      typeof config.apiKeySecret === "string"
        ? config.apiKeySecret.trim()
        : undefined,
  };
}

function systemConfigPath(): string {
  if (process.platform === "win32") {
    const programData = process.env.PROGRAMDATA ?? "C:\\ProgramData";
    return join(programData, "highspot-cli", "config.json");
  }

  return "/etc/highspot-cli/config.json";
}

function userConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg?.trim()) {
    return join(xdg, "highspot-cli", "config.json");
  }

  const home = process.env.HOME;
  if (!home?.trim()) {
    return join(process.cwd(), ".highspot-cli.user.json");
  }

  return join(home, ".config", "highspot-cli", "config.json");
}

function projectConfigPath(): string {
  return join(process.cwd(), ".highspot-cli.json");
}

function fromEnv(): ConfigRecord {
  return normalize({
    endpoint: process.env.HIGHSPOT_API_ENDPOINT,
    hsUser: process.env.HIGHSPOT_HS_USER,
    maxRetries: process.env.HIGHSPOT_MAX_RETRIES,
    retryDelayMs: process.env.HIGHSPOT_RETRY_DELAY_MS,
    timeoutMs: process.env.HIGHSPOT_TIMEOUT_MS,
    basicAuth: process.env.HIGHSPOT_BASIC_AUTH,
    apiKeyId: process.env.HIGHSPOT_API_KEY_ID,
    apiKeySecret: process.env.HIGHSPOT_API_KEY_SECRET,
  });
}

function normalizeAuthorizationHeader(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^Basic\s+/i.test(trimmed)) {
    return trimmed;
  }

  return `Basic ${trimmed}`;
}

function resolveAuthorizationHeader(config: ConfigRecord): string {
  const explicitBasicAuth = normalizeAuthorizationHeader(config.basicAuth);
  if (explicitBasicAuth) {
    return explicitBasicAuth;
  }

  if (!config.apiKeyId && !config.apiKeySecret) {
    throw new ConfigError(
      "Missing auth configuration. Set HIGHSPOT_BASIC_AUTH, or set both HIGHSPOT_API_KEY_ID and HIGHSPOT_API_KEY_SECRET.",
    );
  }

  if (!config.apiKeyId) {
    throw new ConfigError(
      "Missing HIGHSPOT_API_KEY_ID. Set HIGHSPOT_BASIC_AUTH, or configure apiKeyId with apiKeySecret in .highspot-cli.json.",
    );
  }

  if (!config.apiKeySecret) {
    throw new ConfigError(
      "Missing HIGHSPOT_API_KEY_SECRET. Set HIGHSPOT_BASIC_AUTH, or configure apiKeySecret with apiKeyId in .highspot-cli.json.",
    );
  }

  const token = Buffer.from(
    `${config.apiKeyId}:${config.apiKeySecret}`,
  ).toString("base64");
  return `Basic ${token}`;
}

function overlay(base: ConfigRecord, next: ConfigRecord): ConfigRecord {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    ),
  } as ConfigRecord;
}

export function loadResolvedConfig(
  overrides: ConfigOverrides = {},
): ResolvedConfig {
  let config = normalize(readConfigFile(systemConfigPath()));
  config = overlay(config, normalize(readConfigFile(userConfigPath())));
  config = overlay(config, normalize(readConfigFile(projectConfigPath())));
  config = overlay(config, fromEnv());
  config = overlay(config, normalize(overrides));
  const maxRetries = toInteger(config.maxRetries) ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = toInteger(config.retryDelayMs) ?? DEFAULT_RETRY_DELAY_MS;
  const timeoutMs = toInteger(config.timeoutMs) ?? DEFAULT_TIMEOUT_MS;
  const authorizationHeader = resolveAuthorizationHeader(config);

  return {
    endpoint: config.endpoint || DEFAULT_ENDPOINT,
    hsUser: config.hsUser,
    maxRetries,
    retryDelayMs,
    timeoutMs,
    authorizationHeader,
  };
}
