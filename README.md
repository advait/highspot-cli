# highspot-cli

`highspot-cli` is an unofficial CLI client for the [Highspot](https://www.highspot.com/) REST API.

It is designed for both humans and agents:

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

Or provide a precomputed Basic auth header directly:

```bash
export HIGHSPOT_BASIC_AUTH="Basic <base64(id:secret)>"
```

Optional:

```bash
export HIGHSPOT_API_ENDPOINT=https://api.highspot.com/v1.0
export HIGHSPOT_HS_USER=user@example.com
```

`HIGHSPOT_HS_USER` (or `--hs-user`) is optional impersonation context.
It is not implied by the API key:
- API key (`HIGHSPOT_API_KEY_ID` + `HIGHSPOT_API_KEY_SECRET`) authenticates the caller.
- `hs-user` sets an explicit user context for requests where impersonation is needed.
- CLI flag precedence still applies, so `--hs-user` overrides `HIGHSPOT_HS_USER`.

Auth precedence:
- `HIGHSPOT_BASIC_AUTH` is used directly when set.
- Otherwise, `HIGHSPOT_API_KEY_ID` + `HIGHSPOT_API_KEY_SECRET` are used to compute `Authorization: Basic ...`.

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
  "basicAuth": "Basic <base64(id:secret)>",
  "apiKeyId": "hs_key_id_xxx",
  "apiKeySecret": "hs_key_secret_xxx"
}
```

## Commands

```bash
highspot search <query>
highspot get <item-id>
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

`get` command flags:

- `--format <value>`
- `--start <value>`
- `--meta-only` (skip content download)
- `-o, --output <path>` (explicit file path)
- `--output-dir <path>` (directory for auto-saved binary files)
- `-f, --force` (overwrite existing output file)

Exit codes:

- `0` success
- `1` API/runtime failure
- `2` invalid usage or missing configuration

## Examples

```bash
highspot search "GoGuardian Teacher" --limit 10
highspot search "Beacon" --sort-by date_added --plain
highspot get it_abc123 --meta-only
highspot get it_abc123 --format text/plain --plain
highspot get it_abc123
highspot get it_abc123 --output ./custom-filename.pdf
highspot get it_abc123 --output-dir ./downloads
highspot me --json
highspot search "Fleet" --dry-run
```

Behavior notes:

- Prompts are not used; `--no-input` is accepted for automation consistency.
- Primary data goes to stdout, errors go to stderr.
- `get` always fetches `/items/{id}` metadata first, then fetches `/items/{id}/content` unless `--meta-only` is set.
- Binary content is automatically saved to disk using Highspot `content_name` (canonical filename) when available.
- Use `--output` to force a specific filename/path, or `--output-dir` to control where auto-saved binaries are written.

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
