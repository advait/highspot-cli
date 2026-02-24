import { BaseCommand } from "../lib/command.js";
import { globalFlags } from "../lib/flags.js";

export default class Me extends BaseCommand {
  static description = "Fetch /me from the Highspot API";

  static aliases = ["whoami"];

  static examples = ["highspot me", "highspot me --plain", "highspot whoami"];

  static flags = {
    ...globalFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Me);
    this.ensureOutputFlags(flags);
    this.ensureVerbosityFlags(flags);

    const payload = {
      endpoint: "/me",
      headers: {
        ...(flags["hs-user"] ? { "hs-user": flags["hs-user"] } : {}),
      },
    };

    if (flags["dry-run"]) {
      this.printJson(payload);
      return;
    }

    try {
      const client = this.clientFromFlags(flags);
      const data = await client.getMe({ hsUser: this.effectiveHsUser(flags) });
      if (this.outputMode(flags) === "plain") {
        writeMePlain(data);
        return;
      }
      this.printJson(data);
    } catch (error) {
      this.handleError(error, flags);
    }
  }
}

function writeMePlain(data: unknown): void {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    process.stdout.write(`${JSON.stringify(data)}\n`);
    return;
  }

  const record = data as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const email = typeof record.email === "string" ? record.email : "";
  const name = typeof record.name === "string" ? record.name : "";
  process.stdout.write(`${id}\t${email}\t${name}\n`);
}
