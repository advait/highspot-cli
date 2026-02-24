import { Help as OclifHelp } from "@oclif/core";

const AUTH_TEXT =
  "Requires HIGHSPOT_BASIC_AUTH, or HIGHSPOT_API_KEY_ID and HIGHSPOT_API_KEY_SECRET, via env or config file.";
const CONFIG_TEXT =
  "Precedence: flags > env > project config (.highspot-cli.json) > user config (~/.config/highspot-cli/config.json) > system config.";

export default class Help extends OclifHelp {
  formatRoot(): string {
    const base = super.formatRoot();
    const auth = this.section("AUTH", AUTH_TEXT);
    const config = this.section("CONFIG", CONFIG_TEXT);
    const examples = this.section(
      "EXAMPLES",
      this.renderList(
        [
          ["highspot --help"],
          ['highspot search "GoGuardian Teacher" --limit 5'],
          ["highspot get it_abc123 --meta-only"],
          ["highspot get it_abc123 --output ./discover-guide.pdf"],
          ["highspot me --json"],
        ],
        { indentation: 2, spacer: "\n", stripAnsi: this.opts.stripAnsi },
      ),
    );

    return `${base}\n\n${auth}\n\n${config}\n\n${examples}`;
  }

  formatCommand(command: Parameters<OclifHelp["formatCommand"]>[0]): string {
    const base = super.formatCommand(command);
    const auth = this.section("AUTH", AUTH_TEXT);
    return `${base}\n${auth}`;
  }
}
