import { Command } from "@oclif/core";
import { ApiError, HighspotClient } from "./api.js";
import { ConfigError, loadResolvedConfig } from "./config.js";
import {
  formatApiError,
  resolveOutputMode,
  writeError,
  writeJson,
} from "./output.js";

type CommonFlags = {
  plain?: boolean;
  json?: boolean;
  endpoint?: string;
  "hs-user"?: string;
  "max-retries"?: number;
  "retry-delay-ms"?: number;
  "timeout-ms"?: number;
  quiet?: boolean;
  verbose?: boolean;
};

export abstract class BaseCommand extends Command {
  protected outputMode(flags: {
    plain?: boolean;
    [key: string]: unknown;
  }): "json" | "plain" {
    return resolveOutputMode(flags);
  }

  protected ensureOutputFlags(flags: {
    json?: boolean;
    plain?: boolean;
  }): void {
    if (flags.json && flags.plain) {
      this.fail("--json and --plain cannot be used together", 2, flags);
    }
  }

  protected ensureVerbosityFlags(flags: {
    quiet?: boolean;
    verbose?: boolean;
  }): void {
    if (flags.quiet && flags.verbose) {
      this.fail("--quiet and --verbose cannot be used together", 2, flags);
    }
  }

  protected clientFromFlags(flags: CommonFlags): HighspotClient {
    const config = loadResolvedConfig({
      endpoint: flags.endpoint,
      hsUser: flags["hs-user"],
      maxRetries: flags["max-retries"],
      retryDelayMs: flags["retry-delay-ms"],
      timeoutMs: flags["timeout-ms"],
    });
    return new HighspotClient(config);
  }

  protected effectiveHsUser(flags: { "hs-user"?: string }): string | undefined {
    return flags["hs-user"];
  }

  protected printJson(data: unknown): void {
    writeJson(data);
  }

  protected fail(
    message: string,
    exitCode: number,
    flags: { plain?: boolean; [key: string]: unknown },
  ): never {
    const mode = this.outputMode(flags);
    writeError(mode, { error: message });
    this.exit(exitCode);
  }

  protected failWithHint(
    message: string,
    hint: string,
    exitCode: number,
    flags: { plain?: boolean; [key: string]: unknown },
  ): never {
    const mode = this.outputMode(flags);
    writeError(mode, { error: message, hint });
    this.exit(exitCode);
  }

  protected handleError(
    error: unknown,
    flags: { plain?: boolean; [key: string]: unknown },
  ): never {
    if (error instanceof Error && /^EEXIT:\s*\d+/.test(error.message)) {
      throw error;
    }

    const mode = this.outputMode(flags);

    if (error instanceof ApiError) {
      writeError(mode, formatApiError(error));
      this.exit(1);
    }

    if (error instanceof ConfigError) {
      writeError(mode, {
        error: error.message,
        hint: "Set HIGHSPOT_BASIC_AUTH, or set HIGHSPOT_API_KEY_ID and HIGHSPOT_API_KEY_SECRET, or configure .highspot-cli.json.",
      });
      this.exit(2);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    writeError(mode, { error: message });
    this.exit(1);
  }
}
