# highspot-cli

`highspot-cli` is an `oclif` command-line client for the Highspot REST API.

It is designed for both humans and scripts:
- default output: JSON on stdout
- script-stable output: `--plain`
- diagnostics/errors: stderr

## Install

```bash
npm install -g highspot-cli
```

Run without global install:

```bash
npx highspot-cli --help
bunx highspot-cli --help
deno run -A npm:highspot-cli --help
```

## Auth

Set credentials with environment variables:

```bash
export HIGHSPOT_API_KEY_ID=hs_key_id_xxx
export HIGHSPOT_API_KEY_SECRET=hs_key_secret_xxx
```

Optional:

```bash
export HIGHSPOT_API_ENDPOINT=https://api.highspot.com/v1.0
export HIGHSPOT_HS_USER=user@example.com
```

## Config Files

Config precedence (highest to lowest):
1. CLI flags
2. Environment variables
3. Project config: `.highspot-cli.json`
4. User config: `~/.config/highspot-cli/config.json`
5. System config: `/etc/highspot-cli/config.json`

Example `.highspot-cli.json`:

```json
{
  "endpoint": "https://api.highspot.com/v1.0",
  "hsUser": "user@example.com",
  "maxRetries": 3,
  "retryDelayMs": 1200,
  "timeoutMs": 30000,
  "apiKeyId": "hs_key_id_xxx",
  "apiKeySecret": "hs_key_secret_xxx"
}
```

## Commands

```bash
highspot search <query>
highspot item <item-id>
highspot content <item-id>
highspot me
```

Global flags:
- `-h, --help`
- `--version`
- `--json` (default output mode)
- `--plain` (line-based stable output)
- `--dry-run` (print request and exit)
- `--hs-user <value>`
- `--endpoint <url>`
- `--timeout-ms <n>`
- `--max-retries <n>`
- `--retry-delay-ms <n>`
- `--quiet`
- `--verbose`
- `--no-input`
- `--no-color`

Exit codes:
- `0` success
- `1` API/runtime failure
- `2` invalid usage or missing configuration

## Examples

```bash
highspot search "GoGuardian Teacher" --limit 10
highspot search "Beacon" --sort-by date_added --plain
highspot item it_abc123
highspot content it_abc123 --format text/plain --plain
highspot me --json
highspot search "Fleet" --dry-run
```

Behavior notes:
- Prompts are not used; `--no-input` is accepted for automation consistency.
- Primary data goes to stdout, errors go to stderr.

## Development

```bash
npm install
npm run build
npm run check
npm run format
node dist/bin/highspot.js --help
```

## Publish (npm)

For `advait/highspot-cli`:

```bash
npm version patch
npm publish --access public
```

Then tag/push your release in GitHub.
