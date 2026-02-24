import { Args } from "@oclif/core";
import type { HighspotSearchItemsResult } from "../lib/api.js";
import { BaseCommand } from "../lib/command.js";
import { globalFlags, searchFlags } from "../lib/flags.js";

export default class Search extends BaseCommand {
  static description = "Search Highspot items";

  static examples = [
    'highspot search "GoGuardian Teacher"',
    'highspot search "Beacon" --limit 5 --sort-by date_added',
    'highspot search "Hall Pass" --with-fields spot,id,title,url --plain',
    'highspot search "Fleet" --dry-run',
  ];

  static args = {
    query: Args.string({
      description: "Search query",
      required: false,
    }),
  };

  static flags = {
    ...globalFlags,
    ...searchFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Search);
    this.ensureOutputFlags(flags);
    this.ensureVerbosityFlags(flags);

    if (!args.query) {
      this.fail("query is required", 2, flags);
    }
    const sortBy = flags["sort-by"];
    const normalizedSortBy: "relevancy" | "date_added" | undefined =
      sortBy === "relevancy" || sortBy === "date_added" ? sortBy : undefined;
    if (sortBy && !normalizedSortBy) {
      this.fail("--sort-by must be one of: relevancy, date_added", 2, flags);
    }

    const payload = {
      endpoint: "/search/items",
      query: {
        "query-string": args.query,
        ...(flags.limit !== undefined ? { limit: flags.limit } : {}),
        ...(flags.start !== undefined ? { start: flags.start } : {}),
        ...(normalizedSortBy ? { sortby: normalizedSortBy } : {}),
        ...(flags["with-fields"]
          ? { "with-fields": flags["with-fields"] }
          : {}),
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
      const data = await client.searchItems({
        query: args.query,
        limit: flags.limit,
        start: flags.start,
        sortBy: normalizedSortBy,
        withFields: flags["with-fields"],
        hsUser: this.effectiveHsUser(flags),
      });
      if (this.outputMode(flags) === "plain") {
        writeSearchPlain(data);
        return;
      }
      this.printJson(data);
    } catch (error) {
      this.handleError(error, flags);
    }
  }
}

function writeSearchPlain(data: HighspotSearchItemsResult): void {
  for (const [index, item] of data.results.entries()) {
    process.stdout.write(
      `${index + 1}\t${item.id}\t${item.url}\t${item.title}\t${item.contentType}\n`,
    );
  }
}
