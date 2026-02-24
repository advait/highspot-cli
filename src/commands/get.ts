import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { Args } from "@oclif/core";
import type { HighspotGetItemContentResult } from "../lib/api.js";
import { BaseCommand } from "../lib/command.js";
import { contentFlags, globalFlags } from "../lib/flags.js";

type ItemMetadata = Record<string, unknown>;

export default class Get extends BaseCommand {
  static description = "Fetch item metadata and content in one command";

  static examples = [
    "highspot get it_abc123",
    "highspot get it_abc123 --meta-only",
    "highspot get it_abc123 --output ./discover-guide.pdf",
    "highspot get it_abc123 --output-dir ./downloads",
    "highspot get it_abc123 --format text/plain --plain",
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
    const { args, flags } = await this.parse(Get);
    this.ensureOutputFlags(flags);
    this.ensureVerbosityFlags(flags);

    if (!args.itemId) {
      this.fail("itemId is required", 2, flags);
    }

    const payload = {
      operations: [
        { endpoint: `/items/${encodeURIComponent(args.itemId)}` },
        ...(flags["meta-only"]
          ? []
          : [
              {
                endpoint: `/items/${encodeURIComponent(args.itemId)}/content`,
                query: {
                  ...(flags.format ? { format: flags.format } : {}),
                  ...(flags.start ? { start: flags.start } : {}),
                },
              },
            ]),
      ],
      output: {
        ...(flags.output ? { output: flags.output } : {}),
        ...(flags["output-dir"] ? { outputDir: flags["output-dir"] } : {}),
        force: flags.force,
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
      const itemData = await client.getItem({
        itemId: args.itemId,
        hsUser: this.effectiveHsUser(flags),
      });
      const item = asItemRecord(itemData.item);

      if (flags["meta-only"]) {
        if (this.outputMode(flags) === "plain") {
          writeItemPlain(item);
          return;
        }
        this.printJson({ item });
        return;
      }

      const contentData = await client.getItemContent({
        itemId: args.itemId,
        format: flags.format,
        start: flags.start,
        hsUser: this.effectiveHsUser(flags),
      });

      const explicitOutputPath = flags.output
        ? resolve(process.cwd(), flags.output)
        : undefined;

      if (contentData.kind === "binary") {
        const binaryOutputPath =
          explicitOutputPath ??
          resolveBinaryOutputPath({
            outputDir: flags["output-dir"],
            item,
            itemId: args.itemId,
            contentType: contentData.contentType,
          });

        const fileResult = await writeBytesToFile({
          bytes: contentData.bytes,
          contentType: contentData.contentType,
          force: flags.force,
          item,
          itemId: args.itemId,
          outputPath: binaryOutputPath,
        });

        if (this.outputMode(flags) === "plain") {
          writeFileResultPlain(fileResult);
          return;
        }
        this.printJson(fileResult);
        return;
      }

      if (explicitOutputPath) {
        const fileResult = await writeInlineContentToFile({
          content: contentData,
          force: flags.force,
          item,
          itemId: args.itemId,
          outputPath: explicitOutputPath,
        });
        if (this.outputMode(flags) === "plain") {
          writeFileResultPlain(fileResult);
          return;
        }
        this.printJson(fileResult);
        return;
      }

      if (this.outputMode(flags) === "plain") {
        writeInlineContentPlain(contentData);
        return;
      }

      this.printJson({
        item,
        mode: "inline",
        isBinary: false,
        contentType: contentData.contentType,
        content: contentData.content,
      });
    } catch (error) {
      this.handleError(error, flags);
    }
  }
}

function asItemRecord(value: unknown): ItemMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as ItemMetadata;
}

function writeItemPlain(item: ItemMetadata): void {
  const id = asString(item.id);
  const url = asString(item.url);
  const title = asString(item.title);
  const contentType = asString(item.content_type);
  const contentName = asString(item.content_name);

  process.stdout.write(
    `${id}\t${url}\t${title}\t${contentType}\t${contentName}\n`,
  );
}

function writeInlineContentPlain(content: HighspotGetItemContentResult): void {
  if (content.kind === "text") {
    process.stdout.write(content.content);
    if (!content.content.endsWith("\n")) {
      process.stdout.write("\n");
    }
    return;
  }

  if (content.kind === "json") {
    process.stdout.write(`${JSON.stringify(content.content, null, 2)}\n`);
    return;
  }

  throw new Error("Binary content must be written to a file.");
}

function writeFileResultPlain(result: {
  itemId: string;
  outputPath: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}): void {
  process.stdout.write(
    `${result.itemId}\t${result.outputPath}\t${result.contentType}\t${result.sizeBytes}\t${result.sha256}\n`,
  );
}

function resolveBinaryOutputPath(args: {
  outputDir?: string;
  item: ItemMetadata;
  itemId: string;
  contentType: string;
}): string {
  const outputDir = args.outputDir
    ? resolve(process.cwd(), args.outputDir)
    : process.cwd();
  const fileName = preferredBinaryFileName(
    args.item,
    args.itemId,
    args.contentType,
  );
  return join(outputDir, fileName);
}

function preferredBinaryFileName(
  item: ItemMetadata,
  itemId: string,
  contentType: string,
): string {
  const candidates = [
    item.content_name,
    item.filename,
    item.file_name,
    item.name,
    item.title,
  ]
    .map((value) => asString(value).trim())
    .filter((value) => value.length > 0);

  const baseCandidate = candidates[0] ?? itemId;
  const safeBase = sanitizeFileName(baseCandidate) || itemId;

  if (extname(safeBase)) {
    return safeBase;
  }

  const extension = extensionFromContentType(contentType) ?? "bin";
  return `${safeBase}.${extension}`;
}

function sanitizeFileName(input: string): string {
  const invalidChars = new Set(["\\", "/", ":", "*", "?", '"', "<", ">", "|"]);
  let output = "";

  for (const char of input) {
    const code = char.charCodeAt(0);
    if (code >= 0 && code < 32) {
      output += "_";
      continue;
    }

    output += invalidChars.has(char) ? "_" : char;
  }

  return output.replace(/\s+/g, " ").trim();
}

function extensionFromContentType(contentType: string): string | undefined {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("pdf")) {
    return "pdf";
  }

  if (normalized.includes("json")) {
    return "json";
  }

  if (normalized.includes("csv")) {
    return "csv";
  }

  if (normalized.startsWith("text/")) {
    return "txt";
  }

  return undefined;
}

async function writeBytesToFile(args: {
  bytes: Uint8Array;
  contentType: string;
  force: boolean;
  item: ItemMetadata;
  itemId: string;
  outputPath: string;
}): Promise<{
  contentType: string;
  item: ItemMetadata;
  itemId: string;
  mode: "file";
  outputPath: string;
  sha256: string;
  sizeBytes: number;
}> {
  await ensureWriteablePath(args.outputPath, args.force);
  await writeFile(args.outputPath, args.bytes);

  return {
    contentType: args.contentType,
    item: args.item,
    itemId: args.itemId,
    mode: "file",
    outputPath: args.outputPath,
    sha256: createHash("sha256").update(args.bytes).digest("hex"),
    sizeBytes: args.bytes.byteLength,
  };
}

async function writeInlineContentToFile(args: {
  content: Exclude<HighspotGetItemContentResult, { kind: "binary" }>;
  force: boolean;
  item: ItemMetadata;
  itemId: string;
  outputPath: string;
}): Promise<{
  contentType: string;
  item: ItemMetadata;
  itemId: string;
  mode: "file";
  outputPath: string;
  sha256: string;
  sizeBytes: number;
}> {
  await ensureWriteablePath(args.outputPath, args.force);

  const text =
    args.content.kind === "text"
      ? args.content.content
      : `${JSON.stringify(args.content.content, null, 2)}\n`;

  await writeFile(args.outputPath, text, "utf8");

  return {
    contentType: args.content.contentType,
    item: args.item,
    itemId: args.itemId,
    mode: "file",
    outputPath: args.outputPath,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    sizeBytes: Buffer.byteLength(text, "utf8"),
  };
}

async function ensureWriteablePath(
  path: string,
  force: boolean,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  if (existsSync(path) && !force) {
    throw new Error(
      `Output file already exists: ${path}. Use --force to overwrite.`,
    );
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
