import { Flags } from "@oclif/core";

export const globalFlags = {
  json: Flags.boolean({
    description: "Output JSON (default)",
    default: false,
  }),
  plain: Flags.boolean({
    description: "Output stable, line-based text",
    default: false,
  }),
  "dry-run": Flags.boolean({
    description: "Print request details and exit without calling the API",
    default: false,
  }),
  "no-input": Flags.boolean({
    description: "Disable any interactive prompts (none are used today)",
    default: false,
  }),
  "no-color": Flags.boolean({
    description: "Disable color output",
    default: false,
  }),
  quiet: Flags.boolean({
    description: "Reduce non-essential output",
    default: false,
  }),
  verbose: Flags.boolean({
    description: "Increase diagnostic output",
    default: false,
  }),
  "hs-user": Flags.string({
    description: "Highspot user context header (hs-user)",
  }),
  endpoint: Flags.string({
    description: "Override Highspot API endpoint",
  }),
  "timeout-ms": Flags.integer({
    description: "HTTP timeout in milliseconds",
    min: 1,
  }),
  "max-retries": Flags.integer({
    description: "Retry attempts for throttled/transient errors",
    min: 0,
  }),
  "retry-delay-ms": Flags.integer({
    description: "Base retry delay in milliseconds",
    min: 1,
  }),
};

export const searchFlags = {
  limit: Flags.integer({
    description: "Results per page",
    min: 1,
    max: 100,
  }),
  start: Flags.integer({
    description: "Search offset",
    min: 0,
  }),
  "sort-by": Flags.string({
    description: "Sort order",
    options: ["relevancy", "date_added"],
  }),
  "with-fields": Flags.string({
    description: "Comma-separated list of extra fields to return",
  }),
};

export const contentFlags = {
  format: Flags.string({
    description: "Optional format query parameter forwarded to /content",
  }),
  start: Flags.string({
    description: "Optional cursor/start token for paginated content",
  }),
};
