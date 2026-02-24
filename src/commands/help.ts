import { Args, Command, loadHelpClass } from "@oclif/core";

export default class Help extends Command {
  static description = "Show help for a command";

  static args = {
    command: Args.string({
      description: "Command to show help for",
      required: false,
    }),
  };

  static examples = [
    "highspot help",
    "highspot help search",
    "highspot search --help",
    "highspot -h",
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(Help);
    const HelpClass = await loadHelpClass(this.config);
    const help = new HelpClass(
      this.config,
      this.config.pjson.oclif.helpOptions ?? this.config.pjson.helpOptions,
    );
    const argv = args.command ? [args.command] : [];
    await help.showHelp(argv);
  }
}
