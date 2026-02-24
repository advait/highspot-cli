import { Args } from "@oclif/core";
import { BaseCommand } from "../lib/command.js";
import { globalFlags } from "../lib/flags.js";

export default class Item extends BaseCommand {
  static description = "Fetch metadata for a Highspot item";

  static examples = [
    "highspot item it_abc123",
    "highspot item it_abc123 --hs-user user@example.com",
    "highspot item it_abc123 --plain",
  ];

  static args = {
    itemId: Args.string({
      description: "Highspot item id",
      required: false,
    }),
  };

  static flags = {
    ...globalFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Item);
    this.ensureOutputFlags(flags);
    this.ensureVerbosityFlags(flags);

    if (!args.itemId) {
      this.fail("itemId is required", 2, flags);
    }

    const payload = {
      endpoint: `/items/${encodeURIComponent(args.itemId)}`,
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
      const data = await client.getItem({
        itemId: args.itemId,
        hsUser: this.effectiveHsUser(flags),
      });
      if (this.outputMode(flags) === "plain") {
        writeItemPlain(data.item);
        return;
      }
      this.printJson(data);
    } catch (error) {
      this.handleError(error, flags);
    }
  }
}

function writeItemPlain(item: unknown): void {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    process.stdout.write(`${JSON.stringify(item)}\n`);
    return;
  }

  const record = item as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const title = typeof record.title === "string" ? record.title : "";
  const url = typeof record.url === "string" ? record.url : "";
  const contentType =
    typeof record.content_type === "string" ? record.content_type : "";
  const description =
    typeof record.description === "string" ? record.description : "";

  process.stdout.write(
    `${id}\t${url}\t${title}\t${contentType}\t${description}\n`,
  );
}
