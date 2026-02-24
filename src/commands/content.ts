import { Args } from "@oclif/core";
import { BaseCommand } from "../lib/command.js";
import { contentFlags, globalFlags } from "../lib/flags.js";

export default class Content extends BaseCommand {
  static description = "Fetch Highspot item content";

  static examples = [
    "highspot content it_abc123",
    "highspot content it_abc123 --format text/plain --plain",
    "highspot content it_abc123 --start cursor-2",
  ];

  static args = {
    itemId: Args.string({
      description: "Highspot item id",
      required: false,
    }),
  };

  static flags = {
    ...globalFlags,
    ...contentFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Content);
    this.ensureOutputFlags(flags);
    this.ensureVerbosityFlags(flags);

    if (!args.itemId) {
      this.fail("itemId is required", 2, flags);
    }

    const payload = {
      endpoint: `/items/${encodeURIComponent(args.itemId)}/content`,
      query: {
        ...(flags.format ? { format: flags.format } : {}),
        ...(flags.start ? { start: flags.start } : {}),
      },
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
      const data = await client.getItemContent({
        itemId: args.itemId,
        format: flags.format,
        start: flags.start,
        hsUser: this.effectiveHsUser(flags),
      });
      if (this.outputMode(flags) === "plain") {
        writeContentPlain(data.content);
        return;
      }
      this.printJson(data);
    } catch (error) {
      this.handleError(error, flags);
    }
  }
}

function writeContentPlain(content: unknown): void {
  if (typeof content === "string") {
    process.stdout.write(content);
    if (!content.endsWith("\n")) {
      process.stdout.write("\n");
    }
    return;
  }

  process.stdout.write(`${JSON.stringify(content, null, 2)}\n`);
}
